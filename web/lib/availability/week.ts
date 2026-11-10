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
 * standard last start), plus only the rows an offered job really runs into.
 *
 * - They once stopped at the week's latest open hour (never before 5pm), so a
 *   week with no evening openings ended at 5pm and read as "we close at 5".
 *   Every start hour is drawn now, grey where nothing fits.
 * - They then stopped at the last START hour, but the block drawn for a chosen
 *   time is the whole job, and a job runs past its start: a 4 hour detail from
 *   8pm ends at midnight, and its block ran off the bottom of the grid.
 * - Then lastRowFor worked the extra rows out from the job's length and the
 *   booking-window rules (November 10). It missed a rule: before 6pm the
 *   drive home has to fit too, and the OPEN hours can end before midnight.
 *   So a 7 hour job got an 11pm row for a 5pm start that is never offered
 *   (5pm + 7 hours + the drive home runs past midnight); its latest real
 *   block, 4pm to 11pm, ends at the top of that row, and the row could
 *   never be reached (owner's screenshot, November 10).
 *
 * So the extra rows now come from the starts actually offered: the row the
 * latest-finishing one ends in. Whatever rule removed a start, its row goes
 * with it. Those rows are never start times, so they are always grey.
 */
export const FIRST_ROW_MIN = DEFAULT_BOOKING_WINDOW.earliestStartMin;
export const LAST_START_ROW_MIN = Math.floor(DEFAULT_BOOKING_WINDOW.latestStartMin / HOUR) * HOUR;

/** The last row any offered job of this length is still running in. */
export function lastRowForSlots(slots: number[], durationMin: number, timeZone = TZ): number {
  let end = 0;
  for (const ms of slots) end = Math.max(end, localMinutesOfDay(ms, timeZone) + Math.max(0, durationMin));
  const endRow = Math.ceil(end / HOUR) * HOUR - HOUR;
  return Math.min(Math.max(LAST_START_ROW_MIN, endRow), 24 * HOUR - HOUR);
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
  /** The last row to draw, from lastRowForSlots(). Defaults to the last start hour. */
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
 * How "Our recommended times" is built (owner, November 10: top picks, each
 * with its reason). One place to tune it, and the hook analytics plugs into.
 *
 *   version         sent with every analytics event about these picks, so
 *                   results can be compared when the rules change
 *   reasons         tried in this order; each finds at most one pick, on a
 *                   day no other pick uses
 *   shown           picks always shown (when there are that many)
 *   extraWhenRoom   more picks the funnel shows only when the screen has room
 *   maxFeePicks     at most this many picks carry a fee. Owner, November 10:
 *                   only one or two of the times offered should be upsells,
 *                   so a customer who does not want to pay extra always has
 *                   a quick choice. Only "soonest" may carry one.
 */
export const TIME_RECOMMENDATION_RULES = {
  version: "picks-1",
  reasons: ["soonest", "standard", "weekend", "otherHalf", "nextWeek"] as ReasonRule[],
  shown: 3,
  extraWhenRoom: 2,
  maxFeePicks: 1,
};

/** A reason in the rules; "otherHalf" turns into "morning" or "afternoon". */
export type ReasonRule = "soonest" | "standard" | "weekend" | "otherHalf" | "nextWeek";

/** Why a time is offered. "also" fills the list when the reasons run out. */
export type PickReason = "soonest" | "standard" | "weekend" | "morning" | "afternoon" | "nextWeek" | "also";

export interface RecommendedPick {
  ms: number;
  dayStart: number;
  reason: PickReason;
  /** This start carries a fee (rush, or early or late). */
  fee: boolean;
}

/**
 * A day's suggested starts, best first: the ones that keep the day packable
 * (straight after an existing job, else 10am and 4pm, and 1pm at weekends),
 * never an early or late start unless `isPremium` says the detailer taking
 * it charges no fee for it. The funnel's bottom-bar suggestion uses this too.
 */
export function daySuggestions(req: {
  starts: number[];
  busy?: Interval[];
  travelGapMin: number;
  isPremium?: (ms: number) => boolean;
  timeZone?: string;
}): number[] {
  const tz = req.timeZone ?? TZ;
  if (!req.starts.length) return [];
  const premium = req.isPremium ?? ((ms: number) => Boolean(bandOf(localMinutesOfDay(ms, tz))?.premium));
  const weekday = localWeekday(localDayStart(req.starts[0]!, tz) + 12 * 3600_000, tz);
  const open = req.starts.filter((ms) => !premium(ms));
  return recommendStarts({
    starts: open,
    busy: req.busy ?? [],
    travelGapMin: req.travelGapMin,
    limit: weekday === 0 || weekday === 6 ? 3 : 2,
    timeZone: tz,
  }).map((r) => r.ms);
}

/**
 * "Our recommended times": a few one-tap picks, each on its own day and each
 * with the reason it is offered, so a jump from Tuesday to Friday explains
 * itself ("Soonest", then "First at the standard price").
 *
 *   - a start the first-choice detailer can take wins within a day;
 *   - `scoreFor` (optional, e.g. from analytics: how often a start is booked)
 *     reorders each day's suggestions, best first;
 *   - only "soonest" may carry a fee, and only `maxFeePicks` of them;
 *   - when the reasons run out, the soonest standard-price days fill in
 *     ("also"), and fee days only when nothing else is open.
 */
export function recommendPicks(req: {
  slots: number[];
  busy?: Interval[];
  travelGapMin: number;
  /** Starts the first-choice detailer is free for (Kris before Elijah). */
  preferred?: Set<number>;
  /** Does this start carry an early or late fee? Defaults to the clock. */
  isPremium?: (ms: number) => boolean;
  /** Does this start carry any fee at all (rush included)? */
  isFee?: (ms: number) => boolean;
  scoreFor?: (ms: number) => number;
  nowMs?: number;
  rules?: Omit<typeof TIME_RECOMMENDATION_RULES, "version"> & { version?: string };
  timeZone?: string;
}): RecommendedPick[] {
  const tz = req.timeZone ?? TZ;
  const rules = req.rules ?? TIME_RECOMMENDATION_RULES;
  const premium = req.isPremium ?? ((ms: number) => Boolean(bandOf(localMinutesOfDay(ms, tz))?.premium));
  const isFee = req.isFee ?? premium;

  const byDay = new Map<number, number[]>();
  for (const ms of [...new Set(req.slots)].sort((a, b) => a - b)) {
    const day = localDayStart(ms, tz);
    const list = byDay.get(day);
    if (list) list.push(ms);
    else byDay.set(day, [ms]);
  }

  type Day = { dayStart: number; weekday: number; starts: number[] };
  const days: Day[] = [];
  for (const [dayStart, all] of [...byDay].sort((a, b) => a[0] - b[0])) {
    const theirs = req.preferred ? all.filter((ms) => req.preferred!.has(ms)) : [];
    let starts = daySuggestions({
      starts: theirs.length ? theirs : all,
      busy: req.busy ?? [],
      travelGapMin: req.travelGapMin,
      isPremium: premium,
      timeZone: tz,
    });
    if (req.scoreFor) starts = starts.slice().sort((a, b) => req.scoreFor!(b) - req.scoreFor!(a) || a - b);
    if (starts.length) days.push({ dayStart, weekday: localWeekday(dayStart + 12 * 3600_000, tz), starts });
  }

  const picks: RecommendedPick[] = [];
  const used = new Set<number>();
  const total = rules.shown + rules.extraWhenRoom;
  let feePicks = 0;
  const free = (d: Day) => d.starts.filter((ms) => !isFee(ms));
  const avail = () => days.filter((d) => !used.has(d.dayStart));
  const take = (d: Day, ms: number, reason: PickReason) => {
    const fee = isFee(ms);
    if (fee) feePicks++;
    used.add(d.dayStart);
    picks.push({ ms, dayStart: d.dayStart, reason, fee });
  };
  const isPm = (ms: number) => localMinutesOfDay(ms, tz) >= 12 * HOUR;
  const thisWeek = weekStartOf(req.nowMs ?? Date.now(), tz);

  for (const reason of rules.reasons) {
    if (picks.length >= total) break;
    if (reason === "soonest") {
      const d = avail()[0];
      if (!d) continue;
      const ms = Math.min(...d.starts);
      if (!isFee(ms) || feePicks < rules.maxFeePicks) take(d, ms, "soonest");
    } else if (reason === "standard") {
      // "First at the standard price" says nothing when a pick already is.
      if (picks.some((p) => !p.fee)) continue;
      const d = avail().find((x) => free(x).length);
      if (d) take(d, free(d)[0]!, "standard");
    } else if (reason === "weekend") {
      const d = avail().find((x) => (x.weekday === 0 || x.weekday === 6) && free(x).length);
      if (d) take(d, free(d)[0]!, "weekend");
    } else if (reason === "otherHalf") {
      // Every pick so far in the morning: offer an afternoon, and the reverse.
      if (!picks.length) continue;
      const pm = picks.map((p) => isPm(p.ms));
      if (pm.some((x) => x) && pm.some((x) => !x)) continue;
      const wantPm = !pm[0];
      for (const d of avail()) {
        const ms = free(d).find((x) => isPm(x) === wantPm);
        if (ms !== undefined) { take(d, ms, wantPm ? "afternoon" : "morning"); break; }
      }
    } else if (reason === "nextWeek") {
      const d = avail().find((x) => weekStartOf(x.dayStart, tz) > thisWeek && free(x).length);
      if (d) take(d, free(d)[0]!, "nextWeek");
    }
  }
  // The reasons ran out: the soonest standard-price days, then (only when
  // nothing else is open) fee days, up to the number always shown.
  for (const d of avail()) {
    if (picks.length >= total) break;
    if (free(d).length) take(d, free(d)[0]!, "also");
  }
  for (const d of avail()) {
    if (picks.length >= rules.shown) break;
    take(d, d.starts[0]!, "also");
  }
  return picks;
}
