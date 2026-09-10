import { priceFromWire } from "./_pricing.mjs";
import { addressLine, measureDrive } from "./_routes.mjs";

/**
 * PayPal and Venmo.
 *
 * Stripe covers cards, Apple Pay, Google Pay, Link, ACH and Cash App, but it
 * does not support Venmo, which is PayPal owned. So PayPal's own Orders API
 * runs alongside it and picks up both.
 *
 * Order creation and capture both happen here rather than in the browser, for
 * the same reason as the Stripe function: the amount is recomputed from the
 * catalog, never accepted from the request.
 *
 *   POST { action: "create", cart, contact }  -> { id }
 *   POST { action: "capture", orderId }       -> { status, captureId }
 */

const MAX_CENTS = 2_000_00;

const json = (status, body) => ({
  statusCode: status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  body: JSON.stringify(body),
});

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
    // Same address AND same departure time the funnel quoted from, so the
    // charge matches the number the customer agreed to.
    const drive = await measureDrive({ address: line, departureMs: cart?.slot ?? null });
    return drive?.reachable ? drive.minutes : null;
  } catch {
    return null;
  }
}

export async function handler(event) {
  if (event.httpMethod !== "POST") return json(405, { error: "POST only" });

  let access;
  try {
    access = await token();
  } catch (err) {
    return json(502, { error: "paypal_auth", message: err.message });
  }
  if (!access) {
    return json(503, { error: "unconfigured", message: "PayPal is not switched on yet." });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "bad_json" });
  }

  const base = apiBase();

  if (payload.action === "create") {
    const { cart, contact } = payload;
    if (!cart?.vehicles?.length) return json(400, { error: "empty_cart" });

    const priced = priceFromWire(cart, {
      measuredOneWayMinutes: await measuredMinutes(cart),
    });
    if (priced.rejected.length) return json(400, { error: "unknown_items", rejected: priced.rejected });
    if (priced.totalCents <= 0 || priced.totalCents > MAX_CENTS) {
      return json(400, { error: "amount_out_of_range" });
    }

    const res = await fetch(`${base}/v2/checkout/orders`, {
      method: "POST",
      headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            amount: {
              currency_code: "USD",
              value: (priced.totalCents / 100).toFixed(2),
            },
            description: `513 Auto Clean detail for ${contact?.name ?? "customer"}`.slice(0, 127),
            soft_descriptor: "513AUTOCLEAN",
          },
        ],
      }),
    });
    const body = await res.json();
    if (!res.ok) return json(502, { error: "paypal_create", detail: body });
    return json(200, { id: body.id, totalCents: priced.totalCents });
  }

  if (payload.action === "capture") {
    if (!payload.orderId) return json(400, { error: "missing_order" });
    const res = await fetch(`${base}/v2/checkout/orders/${payload.orderId}/capture`, {
      method: "POST",
      headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
    });
    const body = await res.json();
    if (!res.ok) return json(502, { error: "paypal_capture", detail: body });
    const cap = body?.purchase_units?.[0]?.payments?.captures?.[0];
    return json(200, { status: body.status, captureId: cap?.id ?? null });
  }

  return json(400, { error: "unknown_action" });
}
