import type { BookingWindowRules, SurchargeRules } from "./rules.js";

export interface SurchargeContext {
  /**
   * Minutes past local midnight at which the job is scheduled to START.
   * Not when it ends. 7:30 AM = 450, 6:01 PM = 1081.
   */
  startMinutesLocal: number;
  /** Customer opted into Priority Booking to reach a slot inside the lead window. */
  priorityBooking: boolean;
}

/** Convenience for building a context from a wall clock. */
export function minutesOfDay(hour: number, minute = 0): number {
  return hour * 60 + minute;
}

export interface SurchargeBreakdown {
  timeOfDayBp: number;
  priorityBp: number;
  /** Sum of the two, after the cap. This is what actually gets charged. */
  appliedBp: number;
  /** True when the cap bit, i.e. both surcharges fired but only one is charged. */
  capped: boolean;
}

/**
 * Premium pricing. Two independent +20% surcharges, but the cap equals a
 * single surcharge, so they never compound: a 7am-tomorrow booking pays one
 * flat 20%, not 40%.
 *
 * IMPORTANT: judged on the START time only. A 4pm job that runs until 8pm is
 * not an evening job. Elijah was explicit about this.
 *
 * Morning is exclusive, evening is inclusive: 09:59 is premium and 10:00 is
 * not, while 18:00 itself IS premium.
 */
export function computeSurcharge(ctx: SurchargeContext, r: SurchargeRules): SurchargeBreakdown {
  const isEarlyOrLate =
    ctx.startMinutesLocal < r.earlyBeforeMinutes ||
    ctx.startMinutesLocal >= r.lateFromMinutes;

  const timeOfDayBp = isEarlyOrLate ? r.timeOfDayBp : 0;
  const priorityBp = ctx.priorityBooking ? r.priorityBp : 0;
  const uncapped = timeOfDayBp + priorityBp;
  const appliedBp = Math.min(uncapped, r.maxTotalBp);

  return { timeOfDayBp, priorityBp, appliedBp, capped: uncapped > r.maxTotalBp };
}

/**
 * Apply a basis-point surcharge to a cent amount.
 *
 * The base is service + add-ons ONLY. The travel fee is deliberately excluded:
 * it is cost recovery, and marking it up 20% is not defensible to a customer
 * who asks why. See quote.ts for where this sits in the order of operations.
 */
export function applySurchargeCents(baseCents: number, appliedBp: number): number {
  return Math.round((baseCents * appliedBp) / 10_000);
}

/**
 * The earliest date a customer may book WITHOUT Priority Booking.
 *
 * Date-based, not a rolling 24h clock: on Monday the answer is Thursday, and
 * the moment it ticks over to Tuesday it becomes Friday. `today` must already
 * be a local-midnight date in America/New_York.
 */
export function earliestBookableDate(today: Date, r: BookingWindowRules): Date {
  const d = new Date(today.getTime());
  d.setDate(d.getDate() + r.minLeadDays);
  return d;
}

/**
 * Does this date need Priority Booking to be reachable?
 * Both arguments must be local-midnight dates.
 */
export function requiresPriorityBooking(
  slotDate: Date,
  today: Date,
  r: BookingWindowRules,
): boolean {
  return slotDate.getTime() < earliestBookableDate(today, r).getTime();
}
