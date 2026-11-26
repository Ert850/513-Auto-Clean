import { MAX_BOOKING_CENTS, driveTooFar, isLive, priceFromWire, validateWire } from "./_pricing.mjs";
import { blockFeeFor, detailerFor, homeFor, timeFeeWaived } from "./_detailers.mjs";
import { measuredOneWayMinutes } from "./_routes.mjs";
import { limited } from "./_ratelimit.mjs";
import { verifyTurnstile } from "./_turnstile.mjs";
import { requestKey } from "./_requestkey.mjs";

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
 *   POST { action: "create", cart, contact, consent, idempotencyKey }  -> { id }
 *   POST { action: "capture", orderId }                                 -> { status, captureId }
 */

const json = (status, body) => ({
  statusCode: status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  body: JSON.stringify(body),
});

/** PayPal order ids are short upper-case alphanumerics. Nothing else goes in a URL. */
const ORDER_ID = /^[A-Z0-9]{8,32}$/;

/*
 * NAMED, NEVER ASSUMED (review, November 23, P6).
 *
 * Anything but PAYPAL_ENV=live used to mean the sandbox, so live keys with the
 * variable forgotten talked to the sandbox, and the only sign was a PayPal
 * button that never worked. Now it must say "live" or "sandbox", or nothing
 * runs and the log says why.
 */
const API_BASE = {
  live: "https://api-m.paypal.com",
  sandbox: "https://api-m.sandbox.paypal.com",
};

function apiBase() {
  return API_BASE[process.env.PAYPAL_ENV] ?? null;
}

async function token() {
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) return null;
  if (!apiBase()) throw new Error("PAYPAL_ENV must be live or sandbox, to match the client id");

  const res = await fetch(`${apiBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (res.status === 401) {
    // Live keys against the sandbox, or the other way round, land here.
    throw new Error(`PayPal auth 401: check PAYPAL_ENV (${process.env.PAYPAL_ENV}) matches the client id and secret`);
  }
  if (!res.ok) throw new Error(`PayPal auth ${res.status}`);
  return (await res.json()).access_token;
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

  // Off means off, whatever keys are set (P7): the same switches the booking
  // form needs before it shows the PayPal button (rPay, canPayNow).
  if (!isLive("cardOnFile") || !isLive("payInFull") || !isLive("digitalWallets")) {
    return json(503, { error: "off", message: "PayPal is not switched on yet." });
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

    const who = detailerFor(payload?.detailer, cart);
    const measured = await measuredOneWayMinutes(cart, homeFor(who));
    if (driveTooFar(measured)) {
      return json(400, { error: "too_far", message: "That address is further than we can drive for a mobile detail." });
    }

    const timeOfDayWaived = timeFeeWaived(who, cart.slot);
    const blockFeeBp = await blockFeeFor(who, cart.slot, payload?.timeFeeBp);
    const priced = priceFromWire(cart, { measuredOneWayMinutes: measured, nowMs: Date.now(), payInFull: true, timeOfDayWaived, blockFeeBp });
    if (priced.rejected.length) return json(400, { error: "unknown_items", rejected: priced.rejected });
    if (priced.totalCents <= 0 || priced.totalCents > MAX_BOOKING_CENTS) {
      return json(400, { error: "amount_out_of_range" });
    }

    const order = {
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: { currency_code: "USD", value: (priced.totalCents / 100).toFixed(2) },
          description: `513 Auto Clean detail for ${contact.name}`.slice(0, 127),
          custom_id: `terms:${consent.termsVersion ?? ""};slot:${cart.slot ?? ""}`.slice(0, 127),
          soft_descriptor: "513AUTOCLEAN",
        },
      ],
    };
    // PayPal's idempotency header (P6): a retried create returns the same
    // order, and a changed cart gets a new one (_requestkey.mjs).
    const requestId = requestKey(payload.idempotencyKey, "order", order);
    const res = await fetch(`${base}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access}`,
        "Content-Type": "application/json",
        ...(requestId ? { "PayPal-Request-Id": requestId } : {}),
      },
      body: JSON.stringify(order),
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
    // One capture per order, so the order id is the key (P6): a retry after a
    // lost answer gets the first capture's result back, instead of
    // ORDER_ALREADY_CAPTURED and "PayPal could not complete the payment" for
    // money that was taken.
    const res = await fetch(`${base}/v2/checkout/orders/${orderId}/capture`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": `capture-${orderId}`,
      },
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
