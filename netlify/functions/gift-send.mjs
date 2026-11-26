import Stripe from "stripe";
import { randomBytes } from "node:crypto";
import { cincinnatiDay } from "./_pricing.mjs";
import { GIFT_KIND, appendLog, cardFromMeta, codeFor, ensureIssued, giftSecret, requestHost, sendRefusal, siteUrl } from "./_giftcards.mjs";
import { ownerAddress, ownerSendEmail, recipientEmail, sendMail } from "./_giftmail.mjs";
import { giftDetails } from "./gift-checkout.mjs";
import { SESSION_ID } from "./gift-card.mjs";
import { runHoursWords } from "./gift-deliver.mjs";
import { limited } from "./_ratelimit.mjs";

/**
 * "Send it to someone", on the card's page after paying (gift-certificate.html,
 * js/giftcert.js). Buying is one click straight to Stripe (November 26), so who
 * the card is for is asked here instead of before the payment.
 *
 * The session id opens the card, and anyone the buyer shares the link with
 * has it too. So this works once per card, only while it is active and
 * unexpired, and only for config/gift-cards.json sendWindowHours after it was
 * bought: a forwarded link can't send the card to someone else, or be used to
 * email strangers again and again. After that it's printed or shared by link,
 * and Elijah can resend it from /gift-admin.
 *
 * Nothing about the price or the value comes from the browser: only the
 * session, who it's for and when. The buyer's email is never returned.
 *
 * The card's delivery flags are the webhook's (gift_deliver, gift_mail_to), so
 * the hourly run (gift-deliver.mjs) sends a dated card on its day and retries
 * a send that failed. Once per card is enforced by Stripe, not by reading the
 * card back: the claim is written under one idempotency key per payment
 * ("gift-send-claim:<payment>"), and its body carries a fresh nonce, so only
 * the first request ever writes it. Any other gets Stripe's idempotency error
 * (another body under the key: someone already claimed it) or a 409 while the
 * first is still being written. A read-back could not do this: two requests
 * that both checked before either wrote would both see their own claim at
 * some point and both email (review, November 26).
 *
 * A request that already claimed the card (gift_send_req is its key) is
 * answered from the card as it stands: sent, set for a later day, or still to
 * go, in which case the page says so (retrying), never "Sent".
 */

const json = (status, body) => ({
  statusCode: status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  body: JSON.stringify(body),
});

const REQUEST_KEY = /^[A-Za-z0-9_-]{8,64}$/;

/**
 * What the page shows: the address they typed, the day if it's later, and
 * `retrying` (with the hourly run's hours) whenever it hasn't gone and isn't
 * waiting for a day still to come, so the page never says "Sent" for an email
 * that didn't go.
 */
function done(meta, nowMs, repeated = false) {
  const later = meta.gift_deliver === "pending" && (meta.gift_send_on || "") > cincinnatiDay(nowMs);
  const out = { ok: true, to: meta.gift_to_email, sendOn: later ? meta.gift_send_on : "" };
  if (meta.gift_deliver !== "sent" && !later) Object.assign(out, { retrying: true, hours: runHoursWords(nowMs) });
  return repeated ? { ...out, repeated: true } : out;
}

/**
 * Tells Elijah, once per card (gift_mail_send_owner), by the request that won
 * the claim only. Its failure is logged and never fails or undoes the send.
 */
async function tellOwner(stripe, piId, meta, code, state, mail) {
  if (meta.gift_mail_send_owner === "1") return;
  try {
    const msg = ownerSendEmail({ card: { ...cardFromMeta(meta), sendOn: meta.gift_send_on || "" }, code, toEmail: meta.gift_to_email, state });
    if ((await mail(ownerAddress(), msg)) !== "ok") { console.error("gift-send: the owner email didn't send"); return; }
    await stripe.paymentIntents.update(piId, { metadata: { gift_mail_send_owner: "1" } });
  } catch (err) {
    console.error("gift-send: owner email", err?.type, String(err?.message || err).slice(0, 200));
  }
}

/** Stripe's answers to a second write under the claim's key. */
const inProgress = (err) => err?.statusCode === 409 || err?.code === "idempotency_key_in_use";
const otherBody = (err) => err?.type === "StripeIdempotencyError" || err?.rawType === "idempotency_error";

export async function handler(event) {
  if (event?.httpMethod !== "POST") return json(405, { error: "POST only" });
  // Tight: each request can send an email to an address typed in the browser.
  if (limited(event, "gift-send", 10)) return json(429, { error: "slow_down" });
  const key = process.env.STRIPE_SECRET_KEY;
  const secret = giftSecret();
  const apiKey = process.env.RESEND_API_KEY;
  if (!key || !secret || !apiKey) return json(503, { error: "unconfigured" });

  let p;
  try {
    p = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "bad_json" });
  }
  if (typeof p?.s !== "string" || !SESSION_ID.test(p.s)) return json(404, { error: "not_found" });
  if (typeof p.requestKey !== "string" || !REQUEST_KEY.test(p.requestKey)) return json(400, { error: "bad_request" });
  const now = Date.now();
  const gift = giftDetails(p, now);
  if (gift.error) return json(400, { error: gift.error });
  // Here the address is the point: there has to be one.
  if (!gift.toEmail) return json(400, { error: "need_email" });

  try {
    const stripe = new Stripe(key);
    const session = await stripe.checkout.sessions.retrieve(p.s, { expand: ["payment_intent"] });
    if (session?.metadata?.kind !== GIFT_KIND) return json(404, { error: "not_found" });
    if (session.payment_status !== "paid") return json(409, { error: "not_paid" });
    // Recorded on its payment first, as the certificate page does, so the card exists before it's sent anywhere.
    const { pi, meta } = await ensureIssued(stripe, session, secret, now);

    // The same request again (a double tap, a retry after a lost answer): say what it did, change nothing.
    if (meta.gift_send_req === p.requestKey) return json(200, done(meta, now, true));
    const no = sendRefusal(session, meta, now);
    if (no) return json(409, { error: no });

    const today = cincinnatiDay(now);
    // As issuing decides it (ensureIssued): a date still to come waits for the hourly run on that day.
    const deliver = gift.sendOn ? "pending" : "now";
    const nonce = randomBytes(8).toString("hex");
    const claim = {
      gift_to_name: gift.toName,
      gift_to_email: gift.toEmail,
      gift_from_name: gift.fromName,
      gift_message: gift.message,
      gift_send_on: gift.sendOn,
      gift_deliver: deliver,
      gift_send_req: p.requestKey,
      gift_send_claim: nonce,
      // Holds the webhook and the hourly run off this card while this request sends it (claimedByPage).
      gift_send_started: String(now),
      gift_log: appendLog(meta.gift_log, `${today} set to email to them ${gift.sendOn ? "on " + gift.sendOn : "now"}`),
    };
    try {
      await stripe.paymentIntents.update(pi.id, { metadata: claim }, { idempotencyKey: `gift-send-claim:${pi.id}` });
    } catch (err) {
      // The first request is still writing its claim: the page asks again in a moment.
      if (inProgress(err)) return json(409, { error: "busy" });
      if (!otherBody(err)) throw err;
      // Claimed already. By this same request (a twin of a double tap): answer as it stands.
      const m = (await stripe.paymentIntents.retrieve(pi.id))?.metadata || {};
      if (m.gift_send_req === p.requestKey) return json(200, done(m, now, true));
      if (m.gift_send_req || m.gift_to_email) return json(409, { error: "already_sent" });
      // The key was spent by a claim Stripe refused, and nothing was written: nothing to send yet.
      throw err;
    }
    const after = { ...meta, ...claim };
    const code = codeFor(session.id, secret);
    const from = process.env.RESEND_FROM || "513 Auto Clean <onboarding@resend.dev>";
    const mail = (to, msg) => sendMail(apiKey, from, to, msg);
    if (deliver === "pending") {
      await tellOwner(stripe, pi.id, after, code, "pending", mail);
      return json(200, done(after, now));
    }

    const link = `${siteUrl(process.env, requestHost(event))}/gift-certificate#s=${encodeURIComponent(session.id)}`;
    const result = await mail(gift.toEmail, recipientEmail({ card: { ...cardFromMeta(after), sendOn: "" }, code, link }));
    if (result === "ok") {
      const sent = { gift_deliver: "sent", gift_mail_to: "1", gift_log: appendLog(after.gift_log, `${today} emailed to them`) };
      // Tried twice: left at "now", the card would be emailed again once the hold ends.
      for (let i = 0; i < 2; i++) {
        try {
          await stripe.paymentIntents.update(pi.id, { metadata: sent });
          break;
        } catch (err) {
          console.error("gift-send: emailed, but couldn't mark it sent", i + 1, err?.type, String(err?.message || "").slice(0, 200));
        }
      }
      await tellOwner(stripe, pi.id, after, code, "sent", mail);
      // It went either way: say so.
      return json(200, done({ ...after, ...sent }, now));
    }
    // Not sent: handed to the hourly run, as the webhook does (three tries, then Elijah is told).
    const later = { gift_deliver: "pending", gift_send_on: today };
    await stripe.paymentIntents.update(pi.id, { metadata: later });
    await tellOwner(stripe, pi.id, after, code, "retrying", mail);
    return json(200, done({ ...after, ...later }, now));
  } catch (err) {
    if (err?.statusCode === 404 || err?.code === "resource_missing") return json(404, { error: "not_found" });
    console.error("gift-send", err?.type, String(err?.message || "").slice(0, 200));
    return json(502, { error: "stripe" });
  }
}
