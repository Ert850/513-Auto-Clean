/**
 * Who a booking was given to, as THIS deploy knows them.
 *
 * Shared by every function that prices or records a booking
 * (send-confirmation, create-payment, paypal-order), so they cannot disagree
 * about a detailer or about the fee-free hours they work (DETAILERS
 * `noFeeStarts`, e.g. Kris at 6 to 7pm). One copy here; it used to live in
 * send-confirmation alone, and the payment functions charged the late fee
 * the booking email had waived (November 10).
 *
 * Only a name in this deploy's own DETAILERS setting counts, and only for a
 * job they do, so a request cannot pick a calendar or claim a waiver.
 * Anything else is the owner.
 */
import { parseDetailers, waivesFeeAt, canDo, wireNeeds } from "./_pricing.mjs";

/**
 * The detailer for an id from a request body, or null for the owner.
 *
 * With the cart, only a detailer who does every part of that job: a request
 * naming Kris for an exterior job used to get his fee-free 6pm and his
 * calendar (engine check, November 10). The booking form never sends that;
 * only an edited request does.
 */
export function detailerFor(raw, cart) {
  const id = typeof raw === "string" ? raw.trim().slice(0, 40) : "";
  if (!id) return null;
  const { crew } = parseDetailers(process.env.DETAILERS);
  const d = crew.find((x) => x.id === id && !x.owner) ?? null;
  if (d && cart && !canDo(d, wireNeeds(cart))) return null;
  return d;
}

/** No early or late fee for this start, because this detailer works it anyway. */
export function timeFeeWaived(detailer, slotMs) {
  return Boolean(detailer && slotMs && waivesFeeAt(detailer, slotMs));
}
