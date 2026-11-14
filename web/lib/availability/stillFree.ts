/**
 * Is a chosen start still free on the calendar as it is now?
 *
 * One check, used twice: by the booking form just before Confirm
 * (js/funnel.js verifySlot) and by the server just before it writes the job
 * (send-confirmation, calendar fix 1, November 14). Until then only the form
 * checked, so two people who picked the same time seconds apart both got it,
 * and so did a request edited by hand.
 *
 * Pure: the caller reads the calendar (checkRange says which days) and hands
 * the window in.
 */
import { computeSlots, travelBufferMin, IGNORE_RETURN_AFTER_MIN, IGNORE_OUTBOUND_BEFORE_MIN, type Interval } from "./slots.js";
import { fitsOneDay, LONGEST_DAY, LONG_JOB_STARTS, multiDayStillFits, planDays } from "./multiDay.js";
import { CORRECTION_RULES } from "../catalog/addons.js";
import { localDayStart } from "../time/zone.js";

const ZONE = "America/New_York";
const DAY = 86_400_000;

export interface StillFreeJob {
  slotMs: number;
  /** The time held: the work, or the advice hold. */
  serviceMin: number;
  /** One-way drive of whoever has the time, in minutes. */
  driveMin: number;
  hasExterior: boolean;
  correction: boolean;
  arrivalWindowMin?: number;
}

/** A job past one day's work is planned over days; null when it fits one day or can't be planned. */
function multiDayPlan(job: StillFreeJob) {
  if (fitsOneDay(job.serviceMin, LONGEST_DAY, job.driveMin, job.driveMin)) return null;
  const plan = planDays({
    serviceMinutes: job.serviceMin,
    travelBeforeMin: job.driveMin,
    travelAfterMin: job.driveMin,
    preferredStartsMin: job.correction ? CORRECTION_RULES.allowedStartsMin : LONG_JOB_STARTS,
  });
  return plan.ok ? plan : undefined;
}

/**
 * The stretch of calendar to read, from Cincinnati midnight: the day before
 * the start to two days after, or to the day after a multi-day job ends.
 * Null when a multi-day job can't be planned (nothing to check).
 */
export function checkRange(job: StillFreeJob): { from: number; to: number } | null {
  const day0 = localDayStart(job.slotMs, ZONE);
  const plan = multiDayPlan(job);
  if (plan === undefined) return null;
  return { from: day0 - DAY, to: day0 + ((plan ? plan.totalDays : 1) + 1) * DAY };
}

/**
 * Free, and how many minutes into the arrival window the planned arrival
 * falls (for the event's end). `busy` is everything spoken for: the jobs
 * calendars and, for Elijah, his personal calendar.
 */
export function slotStillFree(
  job: StillFreeJob,
  win: { open: Interval[]; busy: Interval[] },
): { free: boolean; lateMin: number } {
  const range = checkRange(job);
  if (!range) return { free: true, lateMin: 0 };
  const plan = multiDayPlan(job);
  if (plan) {
    const free = multiDayStillFits({
      plan,
      startMs: job.slotMs,
      openBlocks: win.open,
      busy: win.busy,
      allowedWeekdays: job.correction ? [0, 6] : undefined,
    });
    return { free, lateMin: 0 };
  }
  const buffer = travelBufferMin(job.driveMin);
  const late = new Map<number, number>();
  const slots = computeSlots({
    lateBy: late,
    openBlocks: win.open,
    busy: win.busy,
    serviceDurationMin: job.serviceMin,
    travelBeforeMin: buffer,
    travelAfterMin: buffer,
    granularityMin: 30,
    notBefore: range.from,
    notAfter: range.to,
    hasExterior: job.hasExterior,
    ignoreReturnAfterMin: IGNORE_RETURN_AFTER_MIN,
    ignoreOutboundBeforeMin: job.driveMin <= 60 ? IGNORE_OUTBOUND_BEFORE_MIN : undefined,
    arrivalWindowMin: job.arrivalWindowMin,
  });
  // To the minute, not the millisecond: the grid is rebuilt from a different
  // `now` and need not land on the same instant.
  const hit = slots.find((ms) => Math.abs(ms - job.slotMs) < 60_000);
  return { free: hit !== undefined, lateMin: hit !== undefined ? late.get(hit) ?? 0 : 0 };
}
