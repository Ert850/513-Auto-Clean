import Stripe from "stripe";
import { GIFT_KIND, cardFromMeta, codeFor, giftSecret } from "./_giftcards.mjs";
import { limited } from "./_ratelimit.mjs";

/**
 * One card, for the certificate page (/gift-certificate#s=<session>). The
 * session id is in the buyer's own return address and in the card's emails;
 * it is long and random, and only the card is returned: never the buyer's
 * email or the payment.
 *
 * The code is derived from the session, so the page works the moment Stripe
 * sends the buyer back, even before the webhook has run.
 */

const json = (status, body) => ({
  statusCode: status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  body: JSON.stringify(body),
});

export const SESSION_ID = /^cs_(test|live)_[A-Za-z0-9]{10,200}$/;

export async function handler(event) {
  if (event?.httpMethod !== "GET") return json(405, { error: "GET only" });
  if (limited(event, "gift-card", 60)) return json(429, { error: "slow_down" });
  const key = process.env.STRIPE_SECRET_KEY;
  const secret = giftSecret();
  if (!key || !secret) return json(503, { error: "unconfigured" });
  const s = event.queryStringParameters?.s;
  if (typeof s !== "string" || !SESSION_ID.test(s)) return json(404, { error: "not_found" });

  try {
    const session = await new Stripe(key).checkout.sessions.retrieve(s, { expand: ["payment_intent"] });
    if (session?.metadata?.kind !== GIFT_KIND) return json(404, { error: "not_found" });
    if (session.payment_status !== "paid") return json(202, { error: "not_paid" });
    // The payment's metadata once issued (balance, status); the session's until then.
    const pi = session.payment_intent && typeof session.payment_intent === "object" ? session.payment_intent : null;
    const card = cardFromMeta({ ...session.metadata, ...(pi?.metadata || {}) });
    return json(200, {
      code: codeFor(session.id, secret),
      valueCents: card.valueCents,
      balanceCents: card.balanceCents,
      status: card.status,
      toName: card.toName,
      fromName: card.fromName,
      message: card.message,
      sendOn: card.sendOn,
    });
  } catch (err) {
    if (err?.statusCode === 404 || err?.code === "resource_missing") return json(404, { error: "not_found" });
    console.error("gift-card", err?.type, String(err?.message || "").slice(0, 200));
    return json(502, { error: "stripe" });
  }
}
