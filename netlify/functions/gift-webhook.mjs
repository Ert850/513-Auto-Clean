import Stripe from "stripe";
import { cincinnatiDay } from "./_pricing.mjs";
import { GIFT_KIND, appendLog, cardFromMeta, codeFor, dollars, ensureIssued, giftSecret, requestHost, siteUrl } from "./_giftcards.mjs";
import { buyerEmail, ownerEmail, recipientEmail, sendMail } from "./_giftmail.mjs";

/**
 * Stripe's webhook for gift cards.
 *
 * Signed (STRIPE_WEBHOOK_SECRET), so nobody can claim a payment that didn't
 * happen: the lesson of the booking form's trusted "paid in full" (P1). Every
 * step is idempotent: ensureIssued() writes the card once (the certificate
 * page may have done it already), each email is marked sent on the payment
 * once it goes, and each refund or dispute event is applied once, so a webhook
 * delivered twice, or retried after a failure, never makes a second card or a
 * second email.
 *
 * Events (set these on the endpoint in Stripe, docs/GIFT-CARDS-SETUP.md):
 *   checkout.session.completed, checkout.session.async_payment_succeeded: issue and email
 *   charge.refunded: a full refund cancels the card; a partial one is logged for Elijah
 *   charge.dispute.created: the card is frozen while the dispute is open
 *   charge.dispute.closed: won, the card is active again; lost, it is cancelled
 */

const reply = (status, text) => ({ statusCode: status, headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" }, body: text });

function mailer() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || "513 Auto Clean <onboarding@resend.dev>";
  return apiKey ? async (to, msg) => (await sendMail(apiKey, from, to, msg)) === "ok" : null;
}
const owner = () => process.env.OWNER_EMAIL || "elijahthackerllc@gmail.com";

/** Issue the card for a paid session, then send whatever hasn't been sent. `base` is the site the emails link to. */
export async function issue(stripe, sessionId, secret, nowMs = Date.now(), note = "", base = siteUrl()) {
  const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["payment_intent"] });
  if (session?.metadata?.kind !== GIFT_KIND) return "not a gift card";
  if (session.payment_status !== "paid") return "not paid yet";
  const { pi, meta } = await ensureIssued(stripe, session, secret, nowMs);

  const code = codeFor(session.id, secret);
  const mail = mailer();
  const link = `${base}/gift-certificate#s=${encodeURIComponent(session.id)}`;
  const payCents = Number(meta.gift_pay_cents) || session.amount_total || 0;
  const buyer = session.customer_details?.email || "";
  const toEmail = meta.gift_to_email || "";
  // The send date only while it's still to come: a card paid on its send day
  // has gone already, and the emails mustn't promise it for later (pass 2).
  const card = { ...cardFromMeta(meta), sendOn: meta.gift_deliver === "pending" ? meta.gift_send_on || "" : "" };
  const marks = {};
  const problems = [];
  const sendOnce = async (flag, to, msg) => {
    if (meta[flag] === "1" || !to) return true;
    if (mail && (await mail(to, msg))) {
      // Marked at once, not after all three: a run cut short mustn't send it again (final pre-merge pass).
      marks[flag] = "1";
      await stripe.paymentIntents.update(pi.id, { metadata: { [flag]: "1" } });
      return true;
    }
    problems.push(`the ${flag.replace("gift_mail_", "")} email didn't send${mail ? "" : " (no RESEND_API_KEY)"}`);
    return false;
  };
  // A card refunded or disputed before it was ever issued: no code goes out (validation pass 3).
  if (meta.gift_status === "void" || meta.gift_status === "disputed") return "not sent: " + meta.gift_status;
  // The person it's for first, so the buyer's email says what really happened (pass 3).
  let deliver = meta.gift_deliver;
  if (deliver === "now") {
    if (await sendOnce("gift_mail_to", toEmail, recipientEmail({ card, code, link }))) {
      deliver = marks.gift_deliver = "sent";
    } else {
      // Handed to the hourly run (gift-deliver.mjs): three tries, then Elijah
      // is told. Not Stripe's retries: a refused address would fail for days
      // and could get the endpoint switched off (validation pass 2).
      Object.assign(marks, { gift_deliver: "pending", gift_send_on: cincinnatiDay(nowMs) });
      deliver = "now";
    }
  }
  await sendOnce("gift_mail_buyer", buyer, buyerEmail({ card, code, link, payCents, toEmail, deliver }));
  const ownerOk = await sendOnce("gift_mail_owner", owner(), ownerEmail({
    card, code, payCents, buyer, toEmail, problem: [note, ...problems].filter(Boolean).join(" ") || (buyer ? "" : "Stripe gave no buyer email: send the card yourself."),
  }));
  if (Object.keys(marks).length) await stripe.paymentIntents.update(pi.id, { metadata: marks });
  // Only Elijah's email is worth Stripe's retries: it carries any other failure.
  if (!ownerOk) throw new Error(problems.join("; "));
  return "issued";
}

/**
 * A refund or a dispute on a gift card's payment. `eventId` makes it once
 * only: Stripe may deliver the same event again.
 */
export async function settle(stripe, piId, change, eventId, nowMs = Date.now()) {
  if (!piId) return "no payment";
  const pi = await stripe.paymentIntents.retrieve(typeof piId === "string" ? piId : piId.id);
  if (pi?.metadata?.kind !== GIFT_KIND) return "not a gift card";
  if (eventId && pi.metadata.gift_last_event === eventId) return "already applied";
  const card = cardFromMeta(pi.metadata);
  const day = cincinnatiDay(nowMs);
  const was = card.status;
  const log = (entry) => appendLog(card.log, `${day} ${entry}`);
  let metadata;
  let words;
  if (change.kind === "dispute_open") {
    metadata = { gift_status: "disputed", gift_status_before: was, gift_log: log("frozen: payment disputed") };
    words = "The card's payment is disputed. The card is frozen until the dispute closes.";
  } else if (change.kind === "dispute_closed" && !change.lost) {
    const back = pi.metadata.gift_status_before && pi.metadata.gift_status_before !== "disputed" ? pi.metadata.gift_status_before : "active";
    metadata = { gift_status: back, gift_log: log("dispute won: card back on") };
    words = "The dispute was closed and the money is kept. The card works again.";
  } else if (change.kind === "dispute_closed") {
    metadata = { gift_status: "void", gift_balance_cents: "0", gift_log: log("void: dispute lost") };
    words = "The dispute was lost. The card is cancelled.";
  } else if (change.full) {
    metadata = { gift_status: "void", gift_balance_cents: "0", gift_log: log("void: refunded") };
    words = "The payment was refunded in full. The card is cancelled.";
  } else {
    metadata = { gift_log: log(`partly refunded ${dollars(change.refundedCents)}: balance not changed`) };
    words = `Partly refunded (${dollars(change.refundedCents)}). The card's balance was not changed: adjust it at /gift-admin if it should be.`;
  }
  if (eventId) metadata.gift_last_event = eventId;
  await stripe.paymentIntents.update(pi.id, { metadata });
  const mail = mailer();
  if (mail) {
    await mail(owner(), {
      subject: `CHECK: gift card ending ${pi.metadata.gift_last4 || "?"}`,
      html: `<p>${words} ${dollars(card.valueCents ?? 0)} card, ${dollars(card.balanceCents ?? 0)} on it before this.</p>`,
    });
  }
  return metadata.gift_status || "logged";
}

export async function handler(event) {
  if (event?.httpMethod !== "POST") return reply(405, "POST only");
  const key = process.env.STRIPE_SECRET_KEY;
  const whsec = process.env.STRIPE_WEBHOOK_SECRET;
  const secret = giftSecret();
  if (!key || !whsec || !secret) return reply(503, "not configured");

  const stripe = new Stripe(key);
  const raw = event.isBase64Encoded ? Buffer.from(event.body || "", "base64") : event.body || "";
  const sig = event.headers?.["stripe-signature"] || event.headers?.["Stripe-Signature"];
  let ev;
  try {
    ev = stripe.webhooks.constructEvent(raw, sig, whsec);
  } catch {
    return reply(400, "bad signature");
  }

  try {
    const o = ev.data?.object || {};
    let result = "ignored";
    if (ev.type === "checkout.session.completed" || ev.type === "checkout.session.async_payment_succeeded") {
      // The endpoint Stripe called is the site this card was bought on (a Deploy Preview, in test mode).
      result = await issue(stripe, o.id, secret, Date.now(), "", siteUrl(process.env, requestHost(event)));
    } else if (ev.type === "charge.refunded") {
      result = await settle(stripe, o.payment_intent, { kind: "refund", full: o.amount_refunded >= o.amount, refundedCents: o.amount_refunded }, ev.id);
    } else if (ev.type === "charge.dispute.created") {
      result = await settle(stripe, o.payment_intent, { kind: "dispute_open" }, ev.id);
    } else if (ev.type === "charge.dispute.closed") {
      // Only a lost dispute cancels: "won" and "warning_closed" (an inquiry the bank closed) keep the money (pass 2).
      result = await settle(stripe, o.payment_intent, { kind: "dispute_closed", lost: o.status === "lost" }, ev.id);
    }
    return reply(200, result);
  } catch (err) {
    console.error("gift-webhook", ev.type, String(err?.message || err).slice(0, 300));
    return reply(500, "retry");
  }
}
