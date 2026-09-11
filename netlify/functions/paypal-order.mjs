import { MAX_BOOKING_CENTS, driveTooFar, priceFromWire, validateWire } from "./_pricing.mjs";
import { addressLine, measureRoundTrip } from "./_routes.mjs";
import { limited } from "./_ratelimit.mjs";
import { verifyTurnstile } from "./_turnstile.mjs";

/**
 * PayPal and Venmo.
 *
 * Stripe covers cards, Apple Pay, Google Pay, Link, ACH and Cash App, but it
 * does not support Venmo, which is PayPal owned. So PayPal's own Orders API
 * runs alongside it and picks up both.
 *
 * Order creation and capture both happen here rather than in the browser, for
 * the same reason as the Stripe function: the amount is recomputed from the
 * catalog, never accepted from the request. PayPal is pay-in-full only, so
 * an inquiry (no confirmed time) cannot use it.
 *
 *   POST { action: "create", cart, contact, consent }  -> { id }
 *   POST { action: "capture", orderId }                 -> { status, captureId }
 */

const json = (status, body) => ({
  statusCode: status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  body: JSON.stringify(body),
});

/** PayPal order ids are short upper-case alphanumerics. Nothing else goes in a URL. */
const ORDER_ID = /^[A-Z0-9]{8,32}$/;

function apiBase() {
  return process.env.PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

async function token() {
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) return null;

  const res = await fetch(`${apiBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`PayPal auth ${res.status}`);
  return (await res.json()).access_token;
}

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

export async function handler(event) {
  if (event?.httpMethod !== "POST") return json(405, { error: "POST only" });
  if (limited(event, "paypal-order", 30)) return json(429, { error: "slow_down" });

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "bad_json" });
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return json(400, { error: "bad_body" });
  }

  let access;
  try {
    access = await token();
  } catch (err) {
    console.error("paypal auth", err?.message);
    return json(502, { error: "paypal_auth", message: "PayPal is not responding. Choose card instead." });
  }
  if (!access) {
    return json(503, { error: "unconfigured", message: "PayPal is not switched on yet." });
  }

  const base = apiBase();

  if (payload.action === "create") {
    const checked = validateWire(payload, { nowMs: Date.now(), mode: "pay_now" });
    if (!checked.ok) return json(400, { error: checked.error, message: checked.message });
    const { cart, contact, consent } = checked.booking;

    // No card is kept on file for a PayPal payment, so there is no
    // card-on-file mandate to require. The terms acceptance is recorded in
    // custom_id below.
    const bot = await verifyTurnstile(payload?.turnstileToken, event);
    if (bot) return json(400, { error: bot, message: "Please complete the check and try again." });

    const measured = await measuredMinutes(cart);
    if (driveTooFar(measured)) {
      return json(400, { error: "too_far", message: "That address is further than we can drive for a mobile detail." });
    }

    const priced = priceFromWire(cart, { measuredOneWayMinutes: measured, nowMs: Date.now(), payInFull: true });
    if (priced.rejected.length) return json(400, { error: "unknown_items", rejected: priced.rejected });
    if (priced.totalCents <= 0 || priced.totalCents > MAX_BOOKING_CENTS) {
      return json(400, { error: "amount_out_of_range" });
    }

    const res = await fetch(`${base}/v2/checkout/orders`, {
      method: "POST",
      headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            amount: { currency_code: "USD", value: (priced.totalCents / 100).toFixed(2) },
            description: `513 Auto Clean detail for ${contact.name}`.slice(0, 127),
            custom_id: `terms:${consent.termsVersion ?? ""};slot:${cart.slot ?? ""}`.slice(0, 127),
            soft_descriptor: "513AUTOCLEAN",
          },
        ],
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("paypal create", res.status, JSON.stringify(body).slice(0, 500));
      return json(502, { error: "paypal_create", message: "PayPal could not start the payment. Choose card instead." });
    }
    return json(200, { id: body.id, totalCents: priced.totalCents });
  }

  if (payload.action === "capture") {
    const orderId = payload.orderId;
    if (typeof orderId !== "string" || !ORDER_ID.test(orderId)) {
      return json(400, { error: "missing_order" });
    }
    const res = await fetch(`${base}/v2/checkout/orders/${orderId}/capture`, {
      method: "POST",
      headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("paypal capture", res.status, JSON.stringify(body).slice(0, 500));
      return json(502, { error: "paypal_capture", message: "PayPal could not complete the payment." });
    }
    const cap = body?.purchase_units?.[0]?.payments?.captures?.[0];
    return json(200, { status: body.status, captureId: cap?.id ?? null });
  }

  return json(400, { error: "unknown_action" });
}
