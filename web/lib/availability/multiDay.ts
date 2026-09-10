/**
 * Scheduling a job too long for one day.
 *
 * A 30 hour correction is not a 30 hour calendar event. Elijah works it across
 * consecutive days, driving home each night, and the old placeholder just
 * booked the first day and left the rest to a phone call. This plans the whole
 * thing.
 *
 * Pure: minutes in, a plan out. No clock, no calendar, no I/O.
 *
 * THE RULES, in the order they bind:
 *
 *   1. The longest working day is 8am to midnight. Sixteen hours of hands on
 *      work, and the drive sits outside that envelope because a commute is
 *      Elijah's time, not the customer's.
 *   2. Anything at or under a day's capacity stays one day. A 14 hour detail
 *      is one day that has to start by 10am, which falls out of the arithmetic
 *      rather than being a special case: latest start is midnight minus the
 *      work.
 *   3. Past that it splits across the FEWEST days that fit, then BALANCES
 *      across them. A 20 hour job is 10 and 10, not 16 and 4. Two even days
 *      beat one brutal one and one short one: the finish quality on hour
 *      fifteen is not the finish quality on hour three.
 *   4. A long drive shortens the practical day. Sixteen hours of work either
 *      side of a forty minute commute is a seventeen hour day, so when work
 *      plus travel passes the humane limit, it takes another day instead.
 */

import { localDayStart, localTimeOnDay, localWeekday } from "../time/zone.js";
import type { Interval } from "./slots.js";

/** Earliest arrival and latest finish, local minutes past midnight. */
export interface DayWindow {
  startMin: number;
  endMin: number;
}

/** 8am to midnight. The customer facing working day. */
export const LONGEST_DAY: DayWindow = { startMin: 8 * 60, endMin: 24 * 60 };

/**
 * The most a single day may run once the commute is counted, door to door.
 *
 * Seventeen hours. Past this the day stops being long and starts being a
 * safety problem, and tired work on someone's paint is worse than no work.
 */
export const MAX_DOOR_TO_DOOR_MIN = 17 * 60;

/** Starts offered for a multi-day job. Early, because these days are long. */
export const LONG_JOB_STARTS = [8 * 60, 10 * 60];

export interface DayPlanRequest {
  /** Hands-on minutes for the whole job. */
  serviceMinutes: number;
  /** Drive out and drive home, each day. He goes home every night. */
  travelBeforeMin?: number;
  travelAfterMin?: number;
  window?: DayWindow;
  /** Preferred arrival times. The earliest that fits is used. */
  preferredStartsMin?: number[];
  /** Refuse rather than plan a job spanning more days than this. */
  maxDays?: number;
  /** Door to door ceiling, exposed for tests and for tuning. */
  maxDoorToDoorMin?: number;
}

export interface PlannedDay {
  /** 0 for the first day. */
  index: number;
  /** Arrival, local minutes past midnight. */
  startMin: number;
  /** Hands-on minutes this day. */
  workMin: number;
  /** Finish, local minutes past midnight. May pass 1440 only if allowed. */
  endMin: number;
  /** The whole commitment including the commute, for the calendar. */
  blockStartMin: number;
  blockEndMin: number;
}

export interface DayPlan {
  days: PlannedDay[];
  totalDays: number;
  serviceMinutes: number;
  /** True when no day is more than 30 minutes longer than any other. */
  balanced: boolean;
  /** The longest door to door day, for a sanity read. */
  longestDoorToDoorMin: number;
}

export type PlanFailure = { ok: false; reason: string };
export type PlanResult = ({ ok: true } & DayPlan) | PlanFailure;

/** Capacity of one day, in hands-on minutes. */
export function dayCapacityMin(
  window: DayWindow = LONGEST_DAY,
  travelBeforeMin = 0,
  travelAfterMin = 0,
  maxDoorToDoor = MAX_DOOR_TO_DOOR_MIN,
): number {
  const byClock = window.endMin - window.startMin;
  // The commute is outside the working window but inside the day Elijah
  // actually lives, so it eats into how much work a day can hold.
  const byStamina = maxDoorToDoor - travelBeforeMin - travelAfterMin;
  return Math.max(0, Math.min(byClock, byStamina));
}

/** Does this fit in a single day, so the ordinary slot engine can have it? */
export function fitsOneDay(
  serviceMinutes: number,
  window: DayWindow = LONGEST_DAY,
  travelBeforeMin = 0,
  travelAfterMin = 0,
): boolean {
  return serviceMinutes <= dayCapacityMin(window, travelBeforeMin, travelAfterMin);
}

/**
 * Split the work as evenly as the day count allows.
 *
 * The remainder goes on the EARLY days, so the last day is the short one.
 * Finishing early on the final day leaves room for the walk round, the
 * touch-ups and the handover, which is exactly when a job overruns.
 */
export function splitEvenly(totalMinutes: number, days: number): number[] {
  const base = Math.floor(totalMinutes / days);
  const extra = totalMinutes - base * days;
  return Array.from({ length: days }, (_, i) => base + (i < extra ? 1 : 0));
}

/** Round up to a tidy quarter hour, so a plan does not say "9 hrs 43 mins". */
function toQuarter(min: number): number {
  return Math.ceil(min / 15) * 15;
}

export function planDays(req: DayPlanRequest): PlanResult {
  const window = req.window ?? LONGEST_DAY;
  const before = Math.max(0, req.travelBeforeMin ?? 0);
  const after = Math.max(0, req.travelAfterMin ?? 0);
  const maxDoorToDoor = req.maxDoorToDoorMin ?? MAX_DOOR_TO_DOOR_MIN;
  const maxDays = req.maxDays ?? 5;
  const service = Math.max(0, Math.round(req.serviceMinutes));

  if (service <= 0) return { ok: false, reason: "Nothing to schedule." };

  const capacity = dayCapacityMin(window, before, after, maxDoorToDoor);
  if (capacity <= 0) {
    return { ok: false, reason: "The drive alone fills the day." };
  }

  const totalDays = Math.ceil(service / capacity);
  if (totalDays > maxDays) {
    return {
      ok: false,
      reason: `That is ${Math.round(service / 60)} hours of work, more than ${maxDays} days. Talk to us and we will plan it properly.`,
    };
  }

  // Even split, then rounded up to quarter hours per day. Rounding up can
  // overshoot the total, which is fine: it buys slack rather than owing it.
  const raw = splitEvenly(service, totalDays);
  const perDay = raw.map(toQuarter);

  const starts = (req.preferredStartsMin ?? LONG_JOB_STARTS)
    .filter((m) => m >= window.startMin)
    .sort((a, b) => a - b);

  const days: PlannedDay[] = [];

  for (let i = 0; i < totalDays; i++) {
    const workMin = perDay[i]!;
    const latestStart = window.endMin - workMin;

    if (latestStart < window.startMin) {
      // Cannot happen while capacity is honoured, but a caller passing an odd
      // window should get a reason rather than a nonsense plan.
      return { ok: false, reason: "That day is longer than the working day allows." };
    }

    // The earliest preferred start that still finishes inside the day. A long
    // day wants to begin as early as it is allowed to.
    const start = starts.find((m) => m <= latestStart) ?? window.startMin;

    days.push({
      index: i,
      startMin: start,
      workMin,
      endMin: start + workMin,
      blockStartMin: start - before,
      blockEndMin: start + workMin + after,
    });
  }

  const lengths = days.map((d) => d.workMin);
  const longestDoorToDoor = Math.max(...days.map((d) => d.blockEndMin - d.blockStartMin));

  return {
    ok: true,
    days,
    totalDays,
    serviceMinutes: service,
    balanced: Math.max(...lengths) - Math.min(...lengths) <= 30,
    longestDoorToDoorMin: longestDoorToDoor,
  };
}

/**
 * A sentence for the customer.
 *
 * Told plainly, because "we will be there two days" is something someone needs
 * to arrange their life around and should never be a surprise on the morning.
 */
export function describePlan(plan: DayPlan): string {
  if (plan.totalDays === 1) {
    const only = plan.days[0]!;
    return `One day, about ${hours(only.workMin)}, starting at ${clock(only.startMin)}.`;
  }

  const each = plan.days.map((d) => hours(d.workMin));
  const same = each.every((h) => h === each[0]);
  const startsSame = plan.days.every((d) => d.startMin === plan.days[0]!.startMin);

  return (
    `${plan.totalDays} days back to back, ` +
    (same ? `about ${each[0]} each` : `about ${each.join(" then ")}`) +
    (startsSame ? `, starting at ${clock(plan.days[0]!.startMin)} each morning.` : ".")
  );
}

function hours(min: number): string {
  const h = min / 60;
  return Number.isInteger(h) ? `${h} hrs` : `${h.toFixed(1)} hrs`;
}

function clock(min: number): string {
  const h24 = Math.floor(min / 60) % 24;
  const m = min % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}${m ? ":" + String(m).padStart(2, "0") : ""}${h24 < 12 ? "am" : "pm"}`;
}

/* ================= placing a plan on the calendar ================= */


export interface MultiDaySearch {
  plan: DayPlan;
  /** OPEN blocks from the availability calendar. */
  openBlocks: Interval[];
  /** Everything already spoken for, jobs and personal commitments alike. */
  busy: Interval[];
  /** Earliest and latest the FIRST day may fall. Epoch ms. */
  notBefore: number;
  notAfter: number;
  timeZone?: string;
  /** 0 Sun to 6 Sat. Correction work uses this to insist on weekends. */
  allowedWeekdays?: number[];
  /** Stop after this many, since a customer picks from a short list. */
  limit?: number;
}

export interface MultiDayOption {
  /** Arrival on the first day. What the customer picks. */
  startMs: number;
  /** One entry per day, in order. */
  days: { startMs: number; endMs: number; workMin: number }[];
  /** Every block that gets reserved, travel included. */
  blocks: Interval[];
}

const covered = (block: Interval, open: Interval[]): boolean =>
  open.some((o) => o.start <= block.start && o.end >= block.end);

const clashes = (block: Interval, busy: Interval[]): boolean =>
  busy.some((b) => b.start < block.end && b.end > block.start);

/**
 * First days on which the WHOLE plan fits.
 *
 * Every day of the plan has to land inside an OPEN block and clash with
 * nothing, which is what "a day when I am fully available" means. Partial
 * fits are no use: starting a two day job on a day when the second day is
 * already booked is worse than not offering it at all.
 *
 * Days run back to back. A correction left half done over a gap means the
 * paint sits in a half-corrected state, and the panels no longer match.
 */
export function findMultiDayStarts(req: MultiDaySearch): MultiDayOption[] {
  const tz = req.timeZone ?? "America/New_York";
  const limit = req.limit ?? 12;
  const out: MultiDayOption[] = [];

  let cursor = localDayStart(req.notBefore, tz);

  // A generous ceiling on iterations rather than a date computation, so a
  // strange window cannot spin.
  for (let guard = 0; guard < 400 && cursor <= req.notAfter && out.length < limit; guard++) {
    const nextDay = localTimeOnDay(cursor, 1, 0, tz);

    if (req.allowedWeekdays && !req.allowedWeekdays.includes(localWeekday(cursor, tz))) {
      cursor = nextDay;
      continue;
    }

    const blocks: Interval[] = [];
    const days: MultiDayOption["days"] = [];
    let fits = true;

    for (const day of req.plan.days) {
      const block: Interval = {
        start: localTimeOnDay(cursor, day.index, day.blockStartMin, tz),
        end: localTimeOnDay(cursor, day.index, day.blockEndMin, tz),
      };

      if (block.start < req.notBefore || !covered(block, req.openBlocks) || clashes(block, req.busy)) {
        fits = false;
        break;
      }

      blocks.push(block);
      days.push({
        startMs: localTimeOnDay(cursor, day.index, day.startMin, tz),
        endMs: localTimeOnDay(cursor, day.index, day.endMin, tz),
        workMin: day.workMin,
      });
    }

    if (fits && days.length === req.plan.days.length) {
      out.push({ startMs: days[0]!.startMs, days, blocks });
    }

    cursor = nextDay;
  }

  return out;
}
