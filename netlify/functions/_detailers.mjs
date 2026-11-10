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
 * Only a name in this deploy's own DETAILERS setting counts, so a request
 * cannot pick a calendar or claim a waiver. Anything else is the owner.
 */
import { parseDetailers, waivesFeeAt } from "./_pricing.mjs";

/** The detailer for an id from a request body, or null for the owner. */
export function detailerFor(raw) {
  const id = typeof raw === "string" ? raw.trim().slice(0, 40) : "";
  if (!id) return null;
  const { crew } = parseDetailers(process.env.DETAILERS);
  return crew.find((d) => d.id === id && !d.owner) ?? null;
}

/** No early or late fee for this start, because this detailer works it anyway. */
export function timeFeeWaived(detailer, slotMs) {
  return Boolean(detailer && slotMs && waivesFeeAt(detailer, slotMs));
}
