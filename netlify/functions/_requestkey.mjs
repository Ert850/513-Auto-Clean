import { createHash } from "node:crypto";

/**
 * One idempotency key per distinct payment request (review, November 23, P3).
 *
 * The booking form sends one key for the whole booking (bookingKey() in
 * js/funnel.js), and it used to go to Stripe as it was. Stripe answers a key
 * it has seen with different parameters, or on a different endpoint, with an
 * error: choosing "pay now" after "pay later" (a SetupIntent, then a
 * PaymentIntent), or adding an add-on after the card form loaded, could
 * never get a payment form again in that booking.
 *
 * So the key sent upstream is the booking's key, what is being created, and a
 * hash of the exact parameters. A retry of the same request keeps its key (a
 * double tap still makes one charge); a changed cart or mode gets a new one.
 */
export const BOOKING_KEY = /^[A-Za-z0-9_-]{8,64}$/;

/** `base` is the browser's booking key, or anything else for no key. */
export function requestKey(base, what, params) {
  if (typeof base !== "string" || !BOOKING_KEY.test(base)) return undefined;
  const digest = createHash("sha256").update(JSON.stringify(params)).digest("hex").slice(0, 32);
  return `${base}-${what}-${digest}`;
}
