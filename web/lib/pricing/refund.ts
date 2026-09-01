import type { PricingRules } from "./rules.js";

export type RefundBucket =
  | "owner_cancelled"
  | "gt72h"
  | "24h_to_72h"
  | "lt24h";

export interface RefundInput {
  /** Deposit actually captured, in cents. */
  depositPaidCents: number;
  /** Everything captured, including a pay-in-full amount above the deposit. */
  totalPaidCents: number;
  /** Hours between "now" and the appointment start. Negative if already past. */
  hoursUntilStart: number;
  /** Elijah cancelled rather than the customer. */
  ownerCancelled: boolean;
}

export interface RefundResult {
  bucket: RefundBucket;
  /** What goes back to the customer. */
  refundCents: number;
  /** What 513 Auto Clean keeps. */
  retainedCents: number;
  /** Plain-English line shown in the admin confirm dialog and the customer email. */
  explanation: string;
}

/**
 * Cancellation refund ladder. Pure.
 *
 *   Elijah cancels    -> everything back, no exceptions
 *   >= 72 hrs out     -> deposit minus a $25 booking fee (floor $0)
 *   24-72 hrs out     -> 50% of the deposit
 *   < 24 hrs out      -> nothing
 *
 * Anything paid ABOVE the deposit (i.e. a pay-in-full customer) is always fully
 * refundable — only the deposit portion is at risk. That keeps the policy
 * defensible: the customer is never worse off for having paid early.
 *
 * The $25 exists because Stripe does NOT return its processing fee on a
 * refund, so a >=72hr cancellation would otherwise cost real money.
 */
export function computeRefund(input: RefundInput, r: PricingRules): RefundResult {
  const { depositPaidCents, totalPaidCents, hoursUntilStart, ownerCancelled } = input;

  // Amount paid beyond the deposit is never subject to the ladder.
  const aboveDeposit = Math.max(0, totalPaidCents - depositPaidCents);

  if (ownerCancelled) {
    return {
      bucket: "owner_cancelled",
      refundCents: totalPaidCents,
      retainedCents: 0,
      explanation: "We cancelled, so everything you paid is refunded in full.",
    };
  }

  let depositRefund: number;
  let bucket: RefundBucket;
  let explanation: string;

  if (hoursUntilStart >= r.refundFullWindowHours) {
    bucket = "gt72h";
    depositRefund = Math.max(0, depositPaidCents - r.cancellationFlatFeeCents);
    explanation = `Cancelled more than ${r.refundFullWindowHours} hours ahead: deposit refunded less the $${
      r.cancellationFlatFeeCents / 100
    } booking fee.`;
  } else if (hoursUntilStart >= r.refundMidWindowHours) {
    bucket = "24h_to_72h";
    depositRefund = Math.floor((depositPaidCents * r.refundMidWindowBp) / 10_000);
    explanation = `Cancelled between ${r.refundMidWindowHours} and ${r.refundFullWindowHours} hours ahead: half the deposit is refunded.`;
  } else {
    bucket = "lt24h";
    depositRefund = 0;
    explanation = `Cancelled within ${r.refundMidWindowHours} hours of the appointment: the deposit is not refunded.`;
  }

  const refundCents = depositRefund + aboveDeposit;
  return {
    bucket,
    refundCents,
    retainedCents: totalPaidCents - refundCents,
    explanation,
  };
}

/**
 * Rescheduling uses the same ladder, charged as a fee rather than withheld from
 * a refund: the deposit moves to the new booking and the customer is charged
 * whatever they would NOT have got back had they simply cancelled.
 *
 * Moving the deposit is a bookkeeping entry against the new booking, never a
 * refund-and-recharge — that would cost two processing fees and strand the
 * money for days.
 */
export function rescheduleFeeCents(input: RefundInput, r: PricingRules): number {
  const { refundCents } = computeRefund(input, r);
  const depositRefundPortion = Math.max(
    0,
    refundCents - Math.max(0, input.totalPaidCents - input.depositPaidCents),
  );
  return input.depositPaidCents - depositRefundPortion;
}
