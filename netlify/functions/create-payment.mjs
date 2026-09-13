import Stripe from "stripe";
import { MAX_BOOKING_CENTS, driveTooFar, priceFromWire, validateWire } from "./_pricing.mjs";
import { addressLine, measureRoundTrip } from "./_routes.mjs";
import { limited } from "./_ratelimit.mjs";
import { verifyTurnstile } from "./_turnstile.mjs";

/**
 * Creates the Stripe intent the funnel's payment step confirms against.
 *
 * The amount is NEVER taken from the request. The browser sends package and
 * add-on ids; validateWire() checks every one of them against the catalog
 * and derives the two things the browser is not allowed to decide (priority
 * and pay in full); priceFromWire() then recomputes the total with the same
 * engine the unit tests cover. A tampered request can only name something
 * that does not exist, which comes back as a rejection.
 *
 * Two modes:
 *   pay_now    PaymentIntent for the full total, discount applied
 *   card_only  SetupIntent, nothing charged. The card is kept ONLY as cover
 *              for a late cancellation or change, which is the narrow thing
 *              the customer authorized; the detail itself they pay for on the
 *              day by whatever suits, or by asking us to use this card.
 *              Requires the mandate to be accepted.
 */

const json = (status, body) => ({
  statusCode: status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  body: JSON.stringify(body),
});

/**
 * Measure the drive before pricing, so the customer is charged the same
 * travel fee the funnel showed them rather than a ZIP band approximation.
 *
 * Failure is not fatal: it falls back to the estimate, because refusing a
 * booking over a routing hiccup costs more than a few dollars of drive time.
 * Too far IS fatal, and is checked by the caller.
 */
async function measuredMinutes(cart) {
  const line = addressLine(cart?.address);
  if (!line) return null;
  try {
    const drive = await measureRoundTrip({
      dest: { address: line },
      slotMs: cart?.slot ?? null,
      serviceMin: cart?.serviceDurationMin ?? 0,
    });
    return drive?.reachable ? drive.minutes : null;
  } catch {
    return null;
  }
}

/**
 * What a customer is allowed to read out of a Stripe error.
 *
 * Invalid-request errors that name a field ("Invalid email address") are
 * useful to the person typing. Everything else is ours to log, not theirs
 * to read, and must never echo a key.
 */
function safeMessage(err) {
  if (err?.type === "StripeInvalidRequestError" && err.param && !/key|secret/i.test(String(err.message))) {
    return String(err.message).slice(0, 200);
  }
  return "Payment setup failed. Nothing was charged.";
}

export async function handler(event) {
  if (event?.httpMethod !== "POST") return json(405, { error: "POST only" });
  if (limited(event, "create-payment", 30)) return json(429, { error: "slow_down" });

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    // Explicit, so the funnel can show an honest message instead of a
    // half-broken card form.
    return json(503, { error: "unconfigured", message: "Payments are not switched on yet." });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "bad_json" });
  }

  const mode = payload?.mode === "pay_now" ? "pay_now" : "card_only";
  const checked = validateWire(payload, { nowMs: Date.now(), mode });
  if (!checked.ok) return json(400, { error: checked.error, message: checked.message });
  const { cart, contact, consent, kind, payInFull } = checked.booking;

  // A card is only ever saved with the customer's say-so, in words they read.
  if (!consent.mandateAccepted) {
    return json(400, { error: "mandate_required", message: "Please confirm the card authorization to continue." });
  }

  const bot = await verifyTurnstile(payload?.turnstileToken, event);
  if (bot) return json(400, { error: bot, message: "Please complete the check and try again." });

  const measured = await measuredMinutes(cart);
  if (driveTooFar(measured)) {
    return json(400, { error: "too_far", message: "That address is further than we can drive for a mobile detail." });
  }

  const priced = priceFromWire(cart, { measuredOneWayMinutes: measured, nowMs: Date.now(), payInFull });
  if (priced.rejected.length) {
    return json(400, { error: "unknown_items", rejected: priced.rejected });
  }
  if (priced.totalCents <= 0 || priced.totalCents > MAX_BOOKING_CENTS) {
    return json(400, { error: "amount_out_of_range", totalCents: priced.totalCents });
  }

  const stripe = new Stripe(key);
  const idempotencyKey =
    typeof payload?.idempotencyKey === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(payload.idempotencyKey)
      ? payload.idempotencyKey
      : undefined;

  try {
    // Phone is our identity key, so an existing customer is reused rather
    // than duplicated on every booking. It is E.164 by now, so the search
    // query cannot be broken by punctuation.
    let customerId;
    const found = await stripe.customers.search({ query: `phone:'${contact.phone}'`, limit: 1 });
    customerId = found.data[0]?.id;
    if (!customerId) {
      const created = await stripe.customers.create({
        name: contact.name,
        phone: contact.phone,
        ...(contact.email ? { email: contact.email } : {}),
      });
      customerId = created.id;
    }

    const metadata = {
      total_cents: String(priced.totalCents),
      duration_min: String(priced.serviceDurationMin),
      surcharge_bp: String(priced.surchargeBp),
      priority: String(priced.priority),
      pay_in_full: String(payInFull),
      kind,
      slot: cart.slot ? new Date(cart.slot).toISOString() : "unset",
      vehicles: String(cart.vehicles.length),
      travel_source: priced.travelSource,
      one_way_min: String(priced.oneWayMinutes ?? ""),
      // The record of what was agreed, in case a card network ever asks.
      terms_version: consent.termsVersion ?? "",
      mandate_accepted: "true",
      sms_consent: String(consent.sms ?? ""),
      media_consent: String(consent.media ?? ""),
    };

    const opts = idempotencyKey ? { idempotencyKey } : undefined;

    if (payInFull) {
      const pi = await stripe.paymentIntents.create(
        {
          amount: priced.totalCents,
          currency: "usd",
          customer: customerId,
          // Whatever is enabled in the dashboard shows up here: cards, Apple
          // Pay, Google Pay, Link, ACH, Cash App and so on. Enabling a new
          // method is a dashboard toggle, not a code change.
          automatic_payment_methods: { enabled: true },
          setup_future_usage: "off_session",
          statement_descriptor_suffix: "513AUTOCLEAN",
          description: `513 Auto Clean, ${contact.name}`.slice(0, 200),
          metadata,
        },
        opts,
      );
      return json(200, {
        clientSecret: pi.client_secret,
        kind: "payment",
        totalCents: priced.totalCents,
        lines: priced.lines,
      });
    }

    const si = await stripe.setupIntents.create(
      {
        customer: customerId,
        usage: "off_session",
        automatic_payment_methods: { enabled: true },
        metadata,
      },
      opts,
    );
    return json(200, {
      clientSecret: si.client_secret,
      kind: "setup",
      totalCents: priced.totalCents,
      lines: priced.lines,
    });
  } catch (err) {
    console.error("create-payment", err?.type, err?.code, err?.message);
    /*
     * The CODE comes back, the message does not.
     *
     * Stripe's error codes name the configuration problem in one word:
     * account_invalid for an account that has not finished verification,
     * api_key_expired for a rotated key, testmode_charges_only for a live
     * key on an account that cannot yet take live money. None of them is a
     * secret, none of them is shown to a customer, and without them a
     * failure here is indistinguishable from any other failure here, which
     * cost an afternoon of guessing.
     */
    return json(502, {
      error: "stripe_error",
      code: err?.code ?? err?.type ?? null,
      message: safeMessage(err),
    });
  }
}
