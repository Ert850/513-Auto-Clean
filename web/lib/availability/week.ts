/**
 * The weekly time picker's grid: Sunday to Saturday, one row per start hour.
 *
 * Pure layout over starts that computeSlots() has already validated. Nothing
 * here decides whether a time is bookable; it only sorts bookable starts into
 * day columns and hour rows, in Cincinnati time, and marks which ones we
 * suggest. So the grid can never offer a time the old band picker would not.
 */
import { localDayStart, localParts, localTimeOnDay, localWeekday } from "../time/zone.js";
import { bandOf, DEFAULT_BOOKING_WINDOW, localMinutesOfDay, recommendStarts, type Interval } from "./slots.js";

const TZ = "America/New_York";
const HOUR = 60;

export interface WeekCell {
  /** Minutes past local midnight that this row starts at: 600 is 10am. */
  hourMin: number;
  /** Every valid start inside [hourMin, hourMin + 60), ascending. */
  starts: number[];
  /** The start a tap on this cell books, or null when the cell is unavailable. */
  pick: number | null;
  /** Early or late start fee (before 10am, from 6pm). */
  premium: boolean;
  /** One of the day's suggested starts, the ones that keep the day packable. */
  suggested: boolean;
}

export interface WeekDay {
  dayStart: number;
  weekday: number;
  y: number;
  mo: number;
  d: number;
  /** Inside the rush window: every start this day carries the rush fee. */
  rush: boolean;
  /** Before today. */
  past: boolean;
  cells: WeekCell[];
}

export interface Week {
  weekStart: number;
  days: WeekDay[];
  /** The hour rows to draw, as minutes past midnight. */
  rows: number[];
  /** Number of cells a customer can pick. */
  openCount: number;
}

/** Local midnight of the Sunday on or before `ms`. */
export function weekStartOf(ms: number, timeZone = TZ): number {
  const day = localDayStart(ms, timeZone);
  return localTimeOnDay(day, -localWeekday(day + 12 * 3600_000, timeZone), 0, timeZone);
}

/** The Sunday `n` weeks from `weekStart`, safe across clock changes. */
export function addWeeks(weekStart: number, n: number, timeZone = TZ): number {
  return localTimeOnDay(weekStart, 7 * n, 0, timeZone);
}

/**
 * Rows: every start hour of the booking window, 6am to 10pm (the site's
 * standard last start), plus only the rows THIS job needs to finish in.
 *
 * - They once stopped at the week's latest open hour (never before 5pm), so a
 *   week with no evening openings ended at 5pm and read as "we close at 5".
 *   Every start hour is drawn now, grey where nothing fits.
 * - They then stopped at the last START hour, but the block drawn for a chosen
 *   time is the whole job, and a job runs past its start: a 4 hour detail from
 *   8pm ends at midnight, and its block ran off the bottom of the grid
 *   (November 10).
 *
 * So the extra rows come from the job's length and the booking rules
 * (lastRowFor), not from this week's openings: the grid keeps its shape from
 * week to week and grows only for a job that can end later. Those rows are
 * never start times, so they are always grey.
 */
export const FIRST_ROW_MIN = DEFAULT_BOOKING_WINDOW.earliestStartMin;
export const LAST_START_ROW_MIN = Math.floor(DEFAULT_BOOKING_WINDOW.latestStartMin / HOUR) * HOUR;

/** The last row a job of this length can still be running in. */
export function lastRowFor(durationMin: number, hasExterior = false, win = DEFAULT_BOOKING_WINDOW): number {
  let latestStart = Math.min(win.latestStartMin, win.serviceEndByMin - durationMin);
  if (hasExterior && win.latestExteriorStartMin !== undefined) latestStart = Math.min(latestStart, win.latestExteriorStartMin);
  const end = latestStart + Math.max(0, durationMin);
  const endRow = Math.ceil(end / HOUR) * HOUR - HOUR;
  return Math.min(Math.max(LAST_START_ROW_MIN, endRow), win.serviceEndByMin - HOUR);
}

export function buildWeek(req: {
  /** Valid starts from computeSlots(), any range; only this week's are used. */
  slots: number[];
  weekStart: number;
  busy?: Interval[];
  travelGapMin: number;
  nowMs: number;
  /** Is this start inside the rush window? (slotNeedsPriority in the funnel.) */
  needsPriority: (ms: number) => boolean;
  /** The last row to draw, from lastRowFor(). Defaults to the last start hour. */
  lastRowMin?: number;
  timeZone?: string;
}): Week {
  const tz = req.timeZone ?? TZ;
  const today = localDayStart(req.nowMs, tz);
  const days: WeekDay[] = [];
  let openCount = 0;

  for (let i = 0; i < 7; i++) {
    const dayStart = localTimeOnDay(req.weekStart, i, 0, tz);
    const next = localTimeOnDay(req.weekStart, i + 1, 0, tz);
    const starts = req.slots.filter((ms) => ms >= dayStart && ms < next).sort((a, b) => a - b);
    const weekday = localWeekday(dayStart + 12 * 3600_000, tz);

    // The day's suggestions: straight after an existing job first, then
    // 10am and 4pm (and 1pm at weekends). Never an early or late start.
    const suggestedSet = new Set(
      recommendStarts({
        starts,
        busy: req.busy ?? [],
        travelGapMin: req.travelGapMin,
        limit: weekday === 0 || weekday === 6 ? 3 : 2,
        timeZone: tz,
      }).map((r) => r.ms),
    );

    const byHour = new Map<number, number[]>();
    for (const ms of starts) {
      const h = Math.floor(localMinutesOfDay(ms, tz) / HOUR) * HOUR;
      const list = byHour.get(h);
      if (list) list.push(ms);
      else byHour.set(h, [ms]);
    }

    const cells: WeekCell[] = [];
    for (const [hourMin, list] of byHour) {
      const suggested = list.find((ms) => suggestedSet.has(ms));
      // A suggested start wins; otherwise on the hour, otherwise the first.
      const pick = suggested ?? list.find((ms) => localMinutesOfDay(ms, tz) === hourMin) ?? list[0]!;
      const premium = Boolean(bandOf(hourMin)?.premium);
      cells.push({
        hourMin,
        starts: list,
        pick,
        premium,
        // recommendStarts falls back to an early or late start on a day that
        // has nothing else. We never put a star on a fee.
        suggested: suggested !== undefined && !premium,
      });
      openCount++;
    }

    const p = localParts(dayStart + 12 * 3600_000, tz);
    days.push({
      dayStart,
      weekday,
      y: p.y,
      mo: p.mo,
      d: p.d,
      rush: dayStart + 12 * 3600_000 >= today && req.needsPriority(dayStart + 12 * 3600_000),
      past: dayStart < today,
      cells,
    });
  }

  const rows: number[] = [];
  const lastRow = Math.max(LAST_START_ROW_MIN, req.lastRowMin ?? LAST_START_ROW_MIN);
  for (let h = FIRST_ROW_MIN; h <= lastRow; h += HOUR) rows.push(h);

  // Fill the gaps so every day has a cell for every row.
  for (const day of days) {
    const have = new Map(day.cells.map((c) => [c.hourMin, c]));
    day.cells = rows.map(
      (h) =>
        have.get(h) ?? { hourMin: h, starts: [], pick: null, premium: Boolean(bandOf(h)?.premium), suggested: false },
    );
  }

  return { weekStart: req.weekStart, days, rows, openCount };
}

/**
 * "Our recommended times": the three we would most like this customer to take.
 *
 * Owner, November 10: few choices, sooner is better even with the rush fee,
 * and Kris before Elijah. So:
 *   - soonest day first, rush days included;
 *   - on each day, the starts that pack it (straight after an existing job,
 *     else 10am and 4pm, 10am, 1pm and 4pm at weekends), never an early or
 *     late hour;
 *   - within a day, a start the preferred detailer can take comes first;
 *   - at most two from one day, so the three are a real choice.
 */
export function recommendTimes(req: {
  slots: number[];
  busy?: Interval[];
  travelGapMin: number;
  /** Starts the first-choice detailer is free for (Kris before Elijah). */
  preferred?: Set<number>;
  limit?: number;
  perDay?: number;
  timeZone?: string;
}): number[] {
  const tz = req.timeZone ?? TZ;
  const limit = req.limit ?? 3;
  const perDay = req.perDay ?? 2;
  const byDay = new Map<number, number[]>();
  for (const ms of [...new Set(req.slots)].sort((a, b) => a - b)) {
    if (bandOf(localMinutesOfDay(ms, tz))?.premium) continue;
    const day = localDayStart(ms, tz);
    const list = byDay.get(day);
    if (list) list.push(ms);
    else byDay.set(day, [ms]);
  }

  const out: number[] = [];
  for (const [day, starts] of [...byDay].sort((a, b) => a[0] - b[0])) {
    if (out.length >= limit) break;
    const weekday = localWeekday(day + 12 * 3600_000, tz);
    const theirs = req.preferred ? starts.filter((ms) => req.preferred!.has(ms)) : [];
    const pool = theirs.length ? theirs : starts;
    const picks = recommendStarts({
      starts: pool,
      busy: req.busy ?? [],
      travelGapMin: req.travelGapMin,
      limit: weekday === 0 || weekday === 6 ? 3 : 2,
      timeZone: tz,
    }).map((r) => r.ms);
    for (const ms of picks.slice(0, perDay)) {
      if (out.length < limit) out.push(ms);
    }
  }
  return out;
}
