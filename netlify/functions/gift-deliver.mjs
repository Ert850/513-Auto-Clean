import Stripe from "stripe";
import { cincinnatiDay } from "./_pricing.mjs";
import { GIFT_KIND, appendLog, cardFromMeta, codeFor, giftSecret, siteUrl } from "./_giftcards.mjs";
import { recipientEmail } from "./_giftmail.mjs";
import { send } from "./send-confirmation.mjs";

/**
 * Sends the cards that were scheduled for a later day (gift_deliver "pending")
 * once that day has come in Cincinnati. Runs every hour from 8 AM to 6 PM
 * (netlify.toml [functions."gift-deliver"]), so a busy morning (Christmas)
 * that doesn't finish in one run finishes in the next, and stops itself well
 * inside a function's time limit. Scheduled functions run only on the
 * published site, never on a preview.
 *
 * A card whose email fails is tried again each hour; after MAX_TRIES it is
 * marked "failed" and Elijah is told once, rather than every hour forever.
 */
export const MAX_TRIES = 3;
const BATCH = 5;
const BUDGET_MS = 20_000;
const STRANDED_MS = 15 * 60_000;

export async function deliverDue(stripe, secret, nowMs = Date.now(), mail, startMs = Date.now()) {
  const today = cincinnatiDay(nowMs);
  const out = { sent: 0, failed: 0, gaveUp: [], waiting: 0, stopped: false };
  // One search, then each card re-read by id before it is sent: search can
  // trail a change by a minute, and an earlier run (or a resend) may have sent it.
  // Also "now" cards left unsent: recorded by the certificate page while the
  // webhook never came, so nobody emailed them (validation pass 2). Given the
  // webhook a quarter of an hour first.
  const found = [];
  for (const state of ["pending", "now"]) {
    let page;
    do {
      page = await stripe.paymentIntents.search({
        query: `metadata['gift_deliver']:'${state}'`,
        limit: 100,
        ...(page?.next_page ? { page: page.next_page } : {}),
      });
      found.push(...page.data.filter((p) => state === "pending" || (p.created || 0) * 1000 < nowMs - STRANDED_MS).map((p) => p.id));
    } while (page.has_more && page.next_page);
  }

  const one = async (id) => {
    const pi = await stripe.paymentIntents.retrieve(id);
    const m = pi?.metadata || {};
    if (m.kind !== GIFT_KIND || !["pending", "now"].includes(m.gift_deliver) || m.gift_mail_to === "1") return;
    if (m.gift_deliver === "pending" && (!m.gift_send_on || m.gift_send_on > today)) { out.waiting++; return; }
    // A cancelled card isn't sent. A disputed one waits: if the dispute is
    // won, it goes out then (validation pass 2).
    if (m.gift_status === "disputed") { out.waiting++; return; }
    if (m.gift_status === "void") {
      await stripe.paymentIntents.update(pi.id, { metadata: { gift_deliver: "cancelled" } });
      return;
    }
    const code = codeFor(m.gift_session, secret);
    const link = `${siteUrl()}/gift-certificate#s=${encodeURIComponent(m.gift_session)}`;
    if (await mail(m.gift_to_email, recipientEmail({ card: cardFromMeta(m), code, link }))) {
      await stripe.paymentIntents.update(pi.id, { metadata: { gift_deliver: "sent", gift_mail_to: "1", gift_log: appendLog(m.gift_log, `${today} emailed to them`) } });
      out.sent++;
      return;
    }
    const tries = (Number(m.gift_deliver_tries) || 0) + 1;
    const gaveUp = tries >= MAX_TRIES;
    await stripe.paymentIntents.update(pi.id, {
      metadata: gaveUp
        ? { gift_deliver: "failed", gift_deliver_tries: String(tries), gift_log: appendLog(m.gift_log, `${today} email to them failed ${tries} times`) }
        : { gift_deliver_tries: String(tries) },
    });
    out.failed++;
    if (gaveUp) out.gaveUp.push(`${m.gift_last4 || "?"} (${m.gift_to_email})`);
  };

  for (let i = 0; i < found.length; i += BATCH) {
    if (Date.now() - startMs > BUDGET_MS) { out.stopped = true; break; }
    await Promise.all(found.slice(i, i + BATCH).map(one));
  }
  return out;
}

export async function handler() {
  const key = process.env.STRIPE_SECRET_KEY;
  const secret = giftSecret();
  const apiKey = process.env.RESEND_API_KEY;
  if (!key || !secret || !apiKey) return { statusCode: 200, body: "not configured" };
  const from = process.env.RESEND_FROM || "513 Auto Clean <onboarding@resend.dev>";
  const owner = process.env.OWNER_EMAIL || "elijahthackerllc@gmail.com";
  const mail = (to, msg) => send(apiKey, from, to, msg);
  try {
    const out = await deliverDue(new Stripe(key), secret, Date.now(), mail);
    if (out.gaveUp.length) {
      await mail(owner, {
        subject: `CHECK: ${out.gaveUp.length} gift card email(s) couldn't be delivered`,
        html: `<p>These scheduled cards couldn't be emailed to the person they're for, after ${MAX_TRIES} tries. The address may be wrong. Look them up at /gift-admin and resend to the buyer, who can pass the card on:</p><p>${out.gaveUp.map((g) => g.replace(/[<>&]/g, "")).join("<br>")}</p>`,
      });
    }
    console.log("gift-deliver", JSON.stringify({ ...out, gaveUp: out.gaveUp.length }));
    return { statusCode: 200, body: "ok" };
  } catch (err) {
    console.error("gift-deliver", String(err?.message || err).slice(0, 300));
    return { statusCode: 500, body: "failed" };
  }
}
