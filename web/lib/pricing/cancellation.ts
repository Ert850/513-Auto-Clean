import type { PricingRules } from "./rules.js";

/**
 * What a cancellation costs, and what a reschedule costs instead.
 *
 * Pure: amounts and hours in, amounts out. No clock, no network.
 *
 * ONE LADDER, TWO OUTCOMES. The amount is the same either way; what differs
 * is where the money goes.
 *
 *   72 hours or more   nothing charged. There is time to refill the slot.
 *   24 to 72 hours     half the booking.
 *   under 24 hours     the whole booking. That day is gone: everyone who
 *                      wanted it has booked elsewhere.
 *
 * CANCEL and the charge is kept. RESCHEDULE and the identical charge becomes
 * CREDIT against the new date, so the customer loses nothing by moving a
 * booking they cannot keep. That is the point of the whole design: moving is
 * always better than dropping, and the money follows you.
 *
 * The one exception is a reschedule inside 24 hours, which adds a FLAT 10% to
 * the detail. Flat, and charged again at the same 10% on each further late
 * move: it is 10% every time, not 10% then 20% then 30%. Being able to
 * shuffle a slot on the morning at no cost is how a day gets destroyed by one
 * customer changing their mind three times, and a charge that lands every
 * time makes the third move something you think about first.
 *
 * Elijah waives any of it at his discretion for emergencies. That is stated
 * in the terms and is deliberately NOT encoded here: discretion is a
 * judgement, and a rule that tried to define "emergency" would get it wrong
 * in exactly the cases that matter.
 */

export type CancelBucket =
  | "owner_cancelled"
  | "waived"
  | "gte72h"
  | "24h_to_72h"
  | "lt24h";

/** Share of the booking that the notice given puts at stake. */
export function chargeBpForNotice(hoursUntilStart: number, r: PricingRules): number {
  if (hoursUntilStart >= r.refundFullWindowHours) return 0;
  if (hoursUntilStart >= r.refundMidWindowHours) return r.cancelMidWindowBp;
  return r.cancelLateWindowBp;
}

export function bucketForNotice(hoursUntilStart: number, r: PricingRules): CancelBucket {
  if (hoursUntilStart >= r.refundFullWindowHours) return "gte72h";
  if (hoursUntilStart >= r.refundMidWindowHours) return "24h_to_72h";
  return "lt24h";
}

/* ================= cancelling ================= */

export interface CancelInput {
  /** The full price of the booking, in cents. */
  totalCents: number;
  /** Anything already captured. Usually zero until the work is done. */
  paidCents?: number;
  /** Hours between now and the appointment. Negative once it has passed. */
  hoursUntilStart: number;
  ownerCancelled?: boolean;
  /** Discretion, for the emergencies a rule cannot anticipate. */
  waived?: boolean;
}

export interface CancelResult {
  bucket: CancelBucket;
  /** Kept by 513 Auto Clean. Gone, unlike a reschedule credit. */
  feeCents: number;
  /** Still to collect from the card on file. */
  dueCents: number;
  /** Going back, where they had already paid more than the fee. */
  refundCents: number;
  explanation: string;
}

export function computeCancellation(input: CancelInput, r: PricingRules): CancelResult {
  const total = Math.max(0, Math.round(input.totalCents));
  const paid = Math.max(0, Math.round(input.paidCents ?? 0));

  const settle = (bucket: CancelBucket, fee: number, explanation: string): CancelResult => ({
    bucket,
    feeCents: fee,
    dueCents: Math.max(0, fee - paid),
    refundCents: Math.max(0, paid - fee),
    explanation,
  });

  if (input.ownerCancelled) {
    return settle(
      "owner_cancelled",
      0,
      "We cancelled, so there is no charge and anything you paid comes back in full.",
    );
  }
  if (input.waived) return settle("waived", 0, "Cancellation fee waived.");

  const bucket = bucketForNotice(input.hoursUntilStart, r);
  const fee = Math.round((total * chargeBpForNotice(input.hoursUntilStart, r)) / 10_000);

  if (bucket === "gte72h") {
    return settle(
      bucket,
      0,
      `Cancelled more than ${r.refundFullWindowHours} hours ahead, so there is no charge.`,
    );
  }
  if (bucket === "24h_to_72h") {
    return settle(
      bucket,
      fee,
      `Cancelled inside ${r.refundFullWindowHours} hours, so ${r.cancelMidWindowBp / 100}% of the booking applies. ` +
        "Rescheduling instead puts the same amount toward your new date.",
    );
  }
  return settle(
    bucket,
    fee,
    `Cancelled inside ${r.refundMidWindowHours} hours, so the booking is charged in full. ` +
      "Rescheduling instead puts the whole amount toward your new date.",
  );
}

/* ================= rescheduling ================= */

export interface RescheduleInput {
  totalCents: number;
  paidCents?: number;
  hoursUntilStart: number;
  /**
   * How many times this booking has ALREADY been moved at under 24 hours
   * notice. Used to say which move this is, NOT to change the rate.
   */
  lateMoves?: number;
  ownerInitiated?: boolean;
  waived?: boolean;
}

export interface RescheduleResult {
  bucket: CancelBucket;
  /** Collected now, and credited in full against the new date. */
  prepayCents: number;
  /** Still to take from the card, given what is already paid. */
  dueNowCents: number;
  /** What the new booking starts with already covered. */
  creditCents: number;
  /** Added for moving inside 24 hours. Flat rate, charged each time. */
  lateFeeCents: number;
  lateFeeBp: number;
  /** Days the credit stays good. Zero when nothing was prepaid. */
  creditValidDays: number;
  explanation: string;
}

export function computeReschedule(input: RescheduleInput, r: PricingRules): RescheduleResult {
  const total = Math.max(0, Math.round(input.totalCents));
  const paid = Math.max(0, Math.round(input.paidCents ?? 0));
  const priorLate = Math.max(0, Math.floor(input.lateMoves ?? 0));

  const free = (bucket: CancelBucket, explanation: string): RescheduleResult => ({
    bucket,
    prepayCents: 0,
    dueNowCents: 0,
    creditCents: paid,
    lateFeeCents: 0,
    lateFeeBp: 0,
    creditValidDays: paid > 0 ? r.rescheduleCreditDays : 0,
    explanation,
  });

  if (input.ownerInitiated) {
    return free("owner_cancelled", "We moved it, so there is nothing to pay and nothing changes.");
  }
  if (input.waived) return free("waived", "Reschedule charge waived.");

  const bucket = bucketForNotice(input.hoursUntilStart, r);

  if (bucket === "gte72h") {
    return free(
      "gte72h",
      `Moved with more than ${r.refundFullWindowHours} hours notice, so there is nothing to pay.`,
    );
  }

  const prepay = Math.round((total * chargeBpForNotice(input.hoursUntilStart, r)) / 10_000);

  if (bucket === "24h_to_72h") {
    return {
      bucket,
      prepayCents: prepay,
      dueNowCents: Math.max(0, prepay - paid),
      creditCents: Math.max(prepay, paid),
      lateFeeCents: 0,
      lateFeeBp: 0,
      creditValidDays: r.rescheduleCreditDays,
      explanation:
        `Moved inside ${r.refundFullWindowHours} hours, so ${r.cancelMidWindowBp / 100}% is taken now ` +
        "and goes straight onto your new booking. No fee for moving it.",
    };
  }

  // Inside 24 hours. Prepay the lot, and pay the late move fee. The rate is
  // FLAT: the same 10% applies to a third late move as to a first. It is
  // charged each time rather than escalating, so the total someone has paid
  // across three moves is three lots of 10%, never 10 then 20 then 30.
  const lateFeeBp = r.lateRescheduleFeeBp;
  const lateFeeCents = Math.round((total * lateFeeBp) / 10_000);

  return {
    bucket,
    prepayCents: prepay,
    dueNowCents: Math.max(0, prepay - paid),
    creditCents: Math.max(prepay, paid),
    lateFeeCents,
    lateFeeBp,
    creditValidDays: r.rescheduleCreditDays,
    explanation:
      `Moved inside ${r.refundMidWindowHours} hours, so the booking is taken in full now and held ` +
      `as credit for ${r.rescheduleCreditDays} days. A ${r.lateRescheduleFeeBp / 100}% late move fee applies` +
      (priorLate > 0
        ? `, the same ${lateFeeBp / 100}% as last time. This is late move number ${priorLate + 1}.`
        : "."),
  };
}

/** The ladder as rows, for the terms page and the admin panel. */
export function cancellationLadder(r: PricingRules) {
  return [
    {
      id: "gte72h",
      when: `${r.refundFullWindowHours} hours or more before`,
      cancel: "No charge",
      reschedule: "Free, nothing to pay",
      bp: 0,
    },
    {
      id: "24h_to_72h",
      when: `${r.refundMidWindowHours} to ${r.refundFullWindowHours} hours before`,
      cancel: `${r.cancelMidWindowBp / 100}% of the booking, kept`,
      reschedule: `${r.cancelMidWindowBp / 100}% taken now, all of it credited to the new date`,
      bp: r.cancelMidWindowBp,
    },
    {
      id: "lt24h",
      when: `Less than ${r.refundMidWindowHours} hours before`,
      cancel: "The full booking, kept",
      reschedule: `Paid in full now, credited for ${r.rescheduleCreditDays} days, plus a flat ${r.lateRescheduleFeeBp / 100}% late move fee`,
      bp: r.cancelLateWindowBp,
    },
  ];
}
