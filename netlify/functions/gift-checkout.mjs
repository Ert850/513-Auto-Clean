import Stripe from "stripe";
import { GIFT_CARDS, cincinnatiDay, giftOffer } from "./_pricing.mjs";
import { GIFT_KIND, dollars, giftSecret, plain, requestHost, siteUrl } from "./_giftcards.mjs";
import { limited } from "./_ratelimit.mjs";
import { requestKey } from "./_requestkey.mjs";

/**
 * Starts a gift card purchase: a Stripe Checkout Session on Stripe's own page,
 * then back to /gift-certificate. Nothing is issued here; the signed webhook
 * (gift-webhook.mjs) does that once Stripe says the money is in.
 *
 * The browser sends the card's value and the gift details, never a price:
 * the price is giftOffer()'s, from config/gift-cards.json and today's
 * Cincinnati date. No sales tax: a gift card is taxed when it is used
 * (Ohio Adm. Code 5703-9-15; GIFT-CARDS-PLAN section 2).
 */

const json = (status, body) => ({
  statusCode: status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  body: JSON.stringify(body),
});

/**
 * How a buyer can pay: config/gift-cards.json checkout.methods, each one
 * checked against its provider's gift card rules (CHECKOUT_METHODS). If Stripe
 * refuses the list (a method not switched on in the dashboard yet), the
 * session is made again with card and Link only: a missing setting must never
 * stop a sale.
 */
const FALLBACK_METHODS = ["card", "link"];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** How long Stripe's page stays open: a session started on the sale's last day can't be paid at the sale price days later. */
const SESSION_MINUTES = 60;

/** Trimmed text with no control characters, at most `max` long; "" when absent. */
function text(v, max) {
  if (v === undefined || v === null) return "";
  if (typeof v !== "string") return null;
  // No control characters (no header tricks), no direction overrides or
  // zero-width marks (no disguised text in an email from the business).
  const s = plain(v).replace(/[\u0000-\u001f\u007f]+/g, " ").trim();
  return s.length <= max ? s : null;
}

/** The gift details, checked; or the name of what is wrong. */
export function giftDetails(p, nowMs) {
  const toName = text(p?.to?.name, 60);
  const toEmail = text(p?.to?.email, 254);
  const fromName = text(p?.from?.name, 60);
  const message = text(p?.message, 300);
  const sendOn = text(p?.sendOn, 10);
  if ([toName, toEmail, fromName, message, sendOn].includes(null)) return { error: "bad_details" };
  if (toEmail && !EMAIL.test(toEmail)) return { error: "bad_email" };
  const today = cincinnatiDay(nowMs);
  const last = cincinnatiDay(nowMs + GIFT_CARDS.scheduleDays * 86_400_000);
  // A real calendar day: "2026-13-01" passes the pattern and sorts inside the range (November 26).
  const at = DAY.test(sendOn) ? Date.parse(sendOn + "T12:00:00Z") : NaN;
  const real = Number.isFinite(at) && new Date(at).toISOString().slice(0, 10) === sendOn;
  if (sendOn && (!real || sendOn < today || sendOn > last)) return { error: "bad_date" };
  // A date in the future means "send it to them then": there has to be a "them".
  if (sendOn && sendOn > today && !toEmail) return { error: "date_needs_email" };
  return { toName, toEmail: toEmail.toLowerCase(), fromName, message, sendOn: sendOn && sendOn > today ? sendOn : "" };
}

export async function handler(event) {
  if (event?.httpMethod !== "POST") return json(405, { error: "POST only" });
  if (limited(event, "gift-checkout", 20)) return json(429, { error: "slow_down" });

  // Off in the setting, or not set up: say so plainly, take nothing.
  if (GIFT_CARDS.mode === "off" || !GIFT_CARDS.checkout.enabled) {
    return json(503, { error: "off", message: "Gift cards aren't on sale online right now." });
  }
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || !giftSecret() || !process.env.STRIPE_WEBHOOK_SECRET) {
    // Without the webhook secret a paid card would never be issued, and
    // without the code secret it couldn't be: refuse before taking money.
    return json(503, { error: "unconfigured", message: "Gift cards aren't on sale online right now." });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "bad_json" });
  }
  // No Turnstile here: the page draws none, so switching it on site-wide
  // would refuse every purchase (validation pass 1). Opening a session costs
  // nothing; the payment itself is screened by Stripe on its own page.

  const now = Date.now();
  const offer = giftOffer(payload?.value, now);
  if (!offer.ok) return json(400, { error: offer.error });
  const gift = giftDetails(payload, now);
  if (gift.error) return json(400, { error: gift.error });

  const metadata = {
    kind: GIFT_KIND,
    gift_value_cents: String(offer.valueCents),
    gift_pay_cents: String(offer.payCents),
    gift_percent_off: String(offer.percentOff),
    gift_to_name: gift.toName,
    gift_to_email: gift.toEmail,
    gift_from_name: gift.fromName,
    gift_message: gift.message,
    gift_send_on: gift.sendOn,
  };
  const base = siteUrl(process.env, requestHost(event));
  const name = `${dollars(offer.valueCents)} 513 Auto Clean gift card`;
  const params = {
    mode: "payment",
    payment_method_types: GIFT_CARDS.checkout.methods,
    submit_type: "pay",
    line_items: [{
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: offer.payCents,
        product_data: {
          name,
          description: offer.percentOff
            ? `${offer.percentOff}% off: you pay ${dollars(offer.payCents)} for ${dollars(offer.valueCents)}. Good for ${GIFT_CARDS.expiryYears} years. No sales tax until it's used.`
            : `Good for ${GIFT_CARDS.expiryYears} years. No sales tax until it's used.`,
        },
      },
    }],
    // Kept on the session and on the payment: the payment is where the card lives.
    metadata,
    // No statement suffix: with a long account prefix Stripe would refuse it.
    payment_intent_data: { metadata, description: name },
    // In 5-minute steps, so the same request made again soon (a retry, or Back
    // then Continue) is the same request to Stripe (final pre-merge pass).
    expires_at: Math.floor(now / 300_000) * 300 + SESSION_MINUTES * 60,
    // After the #, so the session (which opens the card) never reaches a server log or analytics.
    success_url: `${base}/gift-certificate#s={CHECKOUT_SESSION_ID}&new=1`,
    cancel_url: `${base}/gift-cards`,
  };

  try {
    const stripe = new Stripe(key);
    // A double tap makes one session, a changed card a new one (P3). The
    // key hashes the parameters, so the fallback below gets a key of its own.
    const create = (p) => {
      const idem = requestKey(payload?.requestKey, "gift-session", p);
      return stripe.checkout.sessions.create(p, idem ? { idempotencyKey: idem } : undefined);
    };
    let session;
    try {
      session = await create(params);
    } catch (err) {
      // "The payment method type provided: amazon_pay is invalid. Please ensure the provided type is activated in your dashboard."
      const methodRefused = err?.type === "StripeInvalidRequestError" &&
        (String(err?.param || "").startsWith("payment_method_types") || /payment method type/i.test(String(err?.message || "")));
      const fewer = params.payment_method_types.filter((m) => FALLBACK_METHODS.includes(m));
      if (!methodRefused || fewer.length === params.payment_method_types.length) throw err;
      console.error("gift-checkout: Stripe refused a payment method, using card and Link. Switch it on in the Stripe dashboard:", String(err?.message || "").slice(0, 200));
      session = await create({ ...params, payment_method_types: fewer });
    }
    return json(200, { url: session.url });
  } catch (err) {
    console.error("gift-checkout", err?.type, err?.code, String(err?.message || "").slice(0, 200));
    return json(502, { error: "stripe", message: "The payment page didn't open. Nothing was charged. Please try again." });
  }
}
