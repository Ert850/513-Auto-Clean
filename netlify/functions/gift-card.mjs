import Stripe from "stripe";
import { GIFT_KIND, cardFromMeta, codeFor, ensureIssued, giftSecret, isExpired, sendRefusal } from "./_giftcards.mjs";
import { GIFT_CARDS, cincinnatiDay, expiresOn } from "./_pricing.mjs";
import { limited } from "./_ratelimit.mjs";

/**
 * One card, for the certificate page (/gift-certificate#s=<session>). The
 * session id is in the buyer's own return address and in the card's emails;
 * it is long and random, and only the card is returned: never the buyer's
 * email or the payment.
 *
 * The code is derived from the session, so the page works the moment Stripe
 * sends the buyer back, even before the webhook has run. And the card is
 * written onto its payment here too (ensureIssued), so a code the buyer can
 * see can always be found on /gift-admin, even if the webhook never arrives.
 *
 * POST with the session in the body, never in the address: the session opens
 * the card, and addresses end up in request logs (validation pass 1).
 */

const json = (status, body) => ({
  statusCode: status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  body: JSON.stringify(body),
});

export const SESSION_ID = /^cs_(test|live)_[A-Za-z0-9]{10,200}$/;

export async function handler(event) {
  if (event?.httpMethod !== "POST") return json(405, { error: "POST only" });
  if (limited(event, "gift-card", 60)) return json(429, { error: "slow_down" });
  const key = process.env.STRIPE_SECRET_KEY;
  const secret = giftSecret();
  if (!key || !secret) return json(503, { error: "unconfigured" });
  let s;
  try {
    s = JSON.parse(event.body || "{}").s;
  } catch {
    return json(400, { error: "bad_json" });
  }
  if (typeof s !== "string" || !SESSION_ID.test(s)) return json(404, { error: "not_found" });

  try {
    const stripe = new Stripe(key);
    const session = await stripe.checkout.sessions.retrieve(s, { expand: ["payment_intent"] });
    if (session?.metadata?.kind !== GIFT_KIND) return json(404, { error: "not_found" });
    if (session.payment_status !== "paid") return json(202, { error: "not_paid" });
    // The payment's metadata once issued (balance, status); the session's until then.
    let meta = { ...session.metadata, ...(session.payment_intent?.metadata || {}) };
    try {
      meta = { ...meta, ...(await ensureIssued(stripe, session, secret)).meta };
    } catch (err) {
      // The page still shows the card; the webhook will record it.
      console.error("gift-card issue", String(err?.message || "").slice(0, 200));
    }
    const card = cardFromMeta(meta);
    const today = cincinnatiDay(Date.now());
    // Not written onto the payment yet (ensureIssued failed above): it was bought today.
    const expires = card.expires || expiresOn(today, GIFT_CARDS.expiryYears);
    return json(200, {
      code: codeFor(session.id, secret),
      valueCents: card.valueCents,
      balanceCents: card.balanceCents,
      status: card.status,
      toName: card.toName,
      fromName: card.fromName,
      message: card.message,
      expires,
      expired: isExpired({ expires }, today),
      // Only while it's still to be sent: the person it's for opens this page too.
      sendOn: meta.gift_deliver === "pending" ? card.sendOn : "",
      // Whether the page offers "Send it to someone" (gift-send.mjs): a yes or
      // no only, never who it went to or why not.
      canSend: !!process.env.RESEND_API_KEY && !!meta.gift_code_hash && sendRefusal(session, meta, Date.now()) === null,
    });
  } catch (err) {
    if (err?.statusCode === 404 || err?.code === "resource_missing") return json(404, { error: "not_found" });
    console.error("gift-card", err?.type, String(err?.message || "").slice(0, 200));
    return json(502, { error: "stripe" });
  }
}
