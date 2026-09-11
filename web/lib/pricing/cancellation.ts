import type { PricingRules } from "./rules.js";

/**
 * What a cancellation costs, and what a reschedule costs instead.
 *
 * Pure: amounts and hours in, amounts out. No clock, no network.
 *
 * THE POLICY, and the reasoning behind each rung, because the reasoning is
 * what makes it defensible to a customer and to a card network:
 *
 *   72 hours or more   nothing. There is time to fill the slot.
 *   24 to 72 hours     half. The day is half committed and hard to refill.
 *   under 24 hours     the full amount. That slot is gone; the people who
 *                      wanted it have booked elsewhere.
 *
 * RESCHEDULING IS ALWAYS FREE, at any notice, and that is the whole design.
 * The fee is not there to earn money from cancellations; it is there to make
 * moving a booking obviously better than dropping it. Someone whose morning
 * falls apart should reach for "move it" and not think twice, and the pricing
 * should make that the easy choice rather than a negotiation.
 *
 * This is also why a card is collected at booking: not to charge it up front,
 * but so a late cancellation is not simply free to the person cancelling and
 * expensive to everyone still waiting for a slot.
 *
 * Elijah waives it at his discretion for emergencies. That is stated in the
 * terms and is deliberately not encoded here: discretion is a judgement, and
 * a rule that tried to define "emergency" would get it wrong in exactly the
 * cases that matter.
 */

export type CancelBucket =
  | "owner_cancelled"
  | "rescheduled"
  | "waived"
  | "gte72h"
  | "24h_to_72h"
  | "lt24h";

export interface CancelInput {
  /** The full price of the booking, in cents. The fee is a share of this. */
  totalCents: number;
  /** Anything already captured, which is usually zero until the work is done. */
  paidCents?: number;
  /** Hours between now and the appointment. Negative once it has passed. */
  hoursUntilStart: number;
  /** Elijah cancelled rather than the customer. */
  ownerCancelled?: boolean;
  /** Moving the booking rather than dropping it. Always free. */
  rescheduling?: boolean;
  /** Discretion, for the emergencies that a rule cannot anticipate. */
  waived?: boolean;
}

export interface CancelResult {
  bucket: CancelBucket;
  /** What the customer owes for cancelling. Zero on a reschedule. */
  feeCents: number;
  /** Still to collect from the card on file. */
  dueCents: number;
  /** Going back to the customer, when they had already paid. */
  refundCents: number;
  /** One line, shown to the customer and in the admin dialog. */
  explanation: string;
}

function settle(
  bucket: CancelBucket,
  feeCents: number,
  paidCents: number,
  explanation: string,
): CancelResult {
  return {
    bucket,
    feeCents,
    dueCents: Math.max(0, feeCents - paidCents),
    refundCents: Math.max(0, paidCents - feeCents),
    explanation,
  };
}

export function computeCancellation(input: CancelInput, r: PricingRules): CancelResult {
  const total = Math.max(0, Math.round(input.totalCents));
  const paid = Math.max(0, Math.round(input.paidCents ?? 0));

  if (input.ownerCancelled) {
    return settle(
      "owner_cancelled",
      0,
      paid,
      "We cancelled, so there is no charge and anything you paid comes back in full.",
    );
  }

  // Checked before the clock: a reschedule is free however late it is, and
  // that has to be true even at an hour's notice or the incentive collapses
  // exactly when it is needed most.
  if (input.rescheduling) {
    return settle(
      "rescheduled",
      0,
      paid,
      "Rescheduled at no charge. Anything you have paid moves to the new booking.",
    );
  }

  if (input.waived) {
    return settle("waived", 0, paid, "Cancellation fee waived.");
  }

  const hrs = input.hoursUntilStart;

  if (hrs >= r.refundFullWindowHours) {
    return settle(
      "gte72h",
      0,
      paid,
      `Cancelled more than ${r.refundFullWindowHours} hours ahead, so there is no charge.`,
    );
  }

  if (hrs >= r.refundMidWindowHours) {
    const fee = Math.round((total * r.cancelMidWindowBp) / 10_000);
    return settle(
      "24h_to_72h",
      fee,
      paid,
      `Cancelled inside ${r.refundFullWindowHours} hours, so ${r.cancelMidWindowBp / 100}% of the booking applies. ` +
        "Rescheduling instead is free.",
    );
  }

  const fee = Math.round((total * r.cancelLateWindowBp) / 10_000);
  return settle(
    "lt24h",
    fee,
    paid,
    `Cancelled inside ${r.refundMidWindowHours} hours, so the booking is charged in full. ` +
      "Rescheduling instead is free, at any notice.",
  );
}

/** Rescheduling is free. Here so calling code reads as the policy does. */
export function rescheduleFeeCents(): number {
  return 0;
}

/** The ladder as rows, for the terms page and the admin panel. */
export function cancellationLadder(r: PricingRules) {
  return [
    {
      id: "gte72h",
      when: `${r.refundFullWindowHours} hours or more before`,
      charge: "No charge",
      bp: 0,
    },
    {
      id: "24h_to_72h",
      when: `${r.refundMidWindowHours} to ${r.refundFullWindowHours} hours before`,
      charge: `${r.cancelMidWindowBp / 100}% of the booking`,
      bp: r.cancelMidWindowBp,
    },
    {
      id: "lt24h",
      when: `Less than ${r.refundMidWindowHours} hours before`,
      charge: "The full booking",
      bp: r.cancelLateWindowBp,
    },
  ];
}
