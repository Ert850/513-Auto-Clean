/**
 * The weekly time picker's grid: Sunday to Saturday, one row per start hour.
 *
 * Pure layout over starts that computeSlots() has already validated. Nothing
 * here decides whether a time is bookable; it only sorts bookable starts into
 * day columns and hour rows, in Cincinnati time, and marks which ones we
 * suggest. So the grid can never offer a time the old band picker would not.
 */
import { localDayStart, localParts, localTimeOnDay, localWeekday } from "../time/zone.js";
import { bandOf, localMinutesOfDay, recommendStarts, type Interval } from "./slots.js";

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
 * Rows always cover 10am to 5pm, the standard-price hours, so the block a
 * customer is most likely to want stays in the same place from week to week.
 * Earlier and later rows appear only when this week has something in them.
 */
const ALWAYS_FROM = 10 * HOUR;
const ALWAYS_TO = 17 * HOUR;

export function buildWeek(req: {
  /** Valid starts from computeSlots(), any range; only this week's are used. */
  slots: number[];
  weekStart: number;
  busy?: Interval[];
  travelGapMin: number;
  nowMs: number;
  /** Is this start inside the rush window? (slotNeedsPriority in the funnel.) */
  needsPriority: (ms: number) => boolean;
  timeZone?: string;
}): Week {
  const tz = req.timeZone ?? TZ;
  const today = localDayStart(req.nowMs, tz);
  const days: WeekDay[] = [];
  let openCount = 0;
  let lo = ALWAYS_FROM;
  let hi = ALWAYS_TO;

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
      lo = Math.min(lo, h);
      hi = Math.max(hi, h);
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
  for (let h = lo; h <= hi; h += HOUR) rows.push(h);

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
 * The time to preselect when someone lands on a week with nothing chosen.
 *
 * The owner's steer: a suggested standard-price start (10am or 4pm on a
 * weekday) on the first day that does not carry the rush fee. Only when the
 * week has nothing outside the rush window does it fall back to a rush day,
 * and never to an early or late start, because a preselected surcharge is a
 * fee the customer did not choose.
 */
export function defaultPick(week: Week): number | null {
  const pickFrom = (allowRush: boolean): number | null => {
    for (const day of week.days) {
      if (day.past || (day.rush && !allowRush)) continue;
      const cell = day.cells.find((c) => c.suggested && !c.premium && c.pick !== null);
      if (cell) return cell.pick;
    }
    return null;
  };
  return pickFrom(false) ?? pickFrom(true);
}
