import Stripe from "stripe";
import { priceFromWire } from "./_pricing.mjs";
import { addressLine, measureRoundTrip } from "./_routes.mjs";

/**
 * Creates the Stripe intent the funnel's payment step confirms against.
 *
 * The amount is NEVER taken from the request. The browser sends package and
 * add-on ids, this recomputes the total from the catalog with the same engine
 * the unit tests cover, and charges that. A tampered request can only name
 * something that does not exist, which comes back as a rejection.
 *
 * Two modes:
 *   pay_now    PaymentIntent for the full total, 5% discount already applied
 *   card_only  SetupIntent, nothing charged, card kept for the balance and
 *              for cancellation cover
 */

const MAX_CENTS = 2_000_00; // sanity ceiling; nothing legitimate reaches it

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
 */
async function measuredMinutes(cart) {
  const line = addressLine(cart?.address);
  if (!line) return null;
  try {
    // The SAME round trip the funnel quoted from: both legs, at the same
    // times, averaged the same way. Anything else and the charge drifts from
    // the number the customer agreed to.
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

export async function handler(event) {
  if (event.httpMethod !== "POST") return json(405, { error: "POST only" });

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

  const { cart, contact, mode, idempotencyKey } = payload;
  if (!cart || !Array.isArray(cart.vehicles) || !cart.vehicles.length) {
    return json(400, { error: "empty_cart" });
  }
  if (!contact?.name || !contact?.phone) {
    return json(400, { error: "missing_contact" });
  }

  const priced = priceFromWire(cart, {
    measuredOneWayMinutes: await measuredMinutes(cart),
  });
  if (priced.rejected.length) {
    return json(400, { error: "unknown_items", rejected: priced.rejected });
  }
  if (priced.totalCents <= 0 || priced.totalCents > MAX_CENTS) {
    return json(400, { error: "amount_out_of_range", totalCents: priced.totalCents });
  }

  const stripe = new Stripe(key, { apiVersion: "2026-08-26.dahlia" });

  try {
    // Phone is our identity key, so an existing customer is reused rather
    // than duplicated on every booking.
    let customerId;
    const found = await stripe.customers.search({
      query: `phone:'${String(contact.phone).replace(/'/g, "")}'`,
      limit: 1,
    });
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
      slot: cart.slot ? new Date(cart.slot).toISOString() : "unset",
      vehicles: String(cart.vehicles.length),
    };

    const opts = idempotencyKey ? { idempotencyKey } : undefined;

    if (mode === "pay_now") {
      const pi = await stripe.paymentIntents.create(
        {
          amount: priced.totalCents,
          currency: "usd",
          customer: customerId,
          // Whatever is enabled in the dashboard shows up here: cards, Apple
          // Pay, Google Pay, Link, ACH, Cash App, Klarna and so on. Enabling a
          // new method is a dashboard toggle, not a code change.
          automatic_payment_methods: { enabled: true },
          setup_future_usage: "off_session",
          statement_descriptor_suffix: "513AUTOCLEAN",
          description: `513 Auto Clean, ${contact.name}`,
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
    return json(502, { error: "stripe_error", message: err?.message ?? "Payment setup failed." });
  }
}
