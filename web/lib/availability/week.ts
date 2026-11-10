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
 * How "Our recommended times" is built (owner, November 10, round 15). One
 * place to tune it, and the hook analytics plugs into.
 *
 *   version         sent with every analytics event about these picks
 *   reasons         tried in order, each on a day no other pick uses:
 *                   "soonest"    the first day with a best time
 *                   "afterRush"  the first day past the rush window, shown to
 *                                the customer as "In 4 days", not as a price
 *                   "weekend"    the first Saturday or Sunday
 *   shown           picks always shown (when there are that many)
 *   extraWhenRoom   more ("also") days, only when the screen has room
 */
export const TIME_RECOMMENDATION_RULES = {
  version: "best-1",
  reasons: ["soonest", "afterRush", "weekend"] as DayReason[],
  shown: 3,
  extraWhenRoom: 2,
};

export type DayReason = "soonest" | "afterRush" | "weekend";
export type PickReason = DayReason | "also";

/** One detailer's offer, in priority order (Kris before Elijah). */
export interface MemberTimes {
  id: string;
  /** Every start this person is free for the whole job (already weather-checked). */
  starts: number[];
  /** BEST starts from their calendar in the window; null when they set none. */
  best: number[] | null;
  /** Busy time, for the fallback suggestions. */
  busy?: Interval[];
}

export interface RecommendedDay {
  dayStart: number;
  reason: PickReason;
  /** The headline start: the first-priority detailer's best time that day. */
  ms: number;
  /** Who it goes to. */
  who: string;
  /** The other best times that day, any detailer, soonest first. */
  more: number[];
  /** Whole days from today to this day, for "In 4 days". */
  daysAway: number;
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
 * "Our recommended times", from the best times set in each detailer's Google
 * Calendar (owner, November 10, round 15). Each pick is a DAY:
 *
 *   - its headline is the first-priority detailer's best time that day (Kris
 *     at 6pm); a detailer who is not free for the whole job at a best time is
 *     skipped, so the next one's best time leads instead;
 *   - "more" is everyone's other best times that day (Elijah's 10am, 4pm and
 *     6pm), never every half hour;
 *   - a detailer with no BEST events at all falls back to daySuggestions;
 *   - a best time leads only if it adds no early or late fee when another
 *     best time that day does not (`isPremium`): 10am before 6pm.
 */
export function recommendBestDays(req: {
  members: MemberTimes[];
  travelGapMin: number;
  /** Is this start inside the rush window? */
  isRush: (ms: number) => boolean;
  /** Does this start carry an early or late fee? Defaults to the clock. */
  isPremium?: (ms: number) => boolean;
  /** Optional, e.g. from analytics: reorders a day's best times, best first. */
  scoreFor?: (ms: number) => number;
  nowMs?: number;
  rules?: Omit<typeof TIME_RECOMMENDATION_RULES, "version"> & { version?: string };
  timeZone?: string;
}): RecommendedDay[] {
  const tz = req.timeZone ?? TZ;
  const rules = req.rules ?? TIME_RECOMMENDATION_RULES;
  const premium = req.isPremium ?? ((ms: number) => Boolean(bandOf(localMinutesOfDay(ms, tz))?.premium));
  const today = localDayStart(req.nowMs ?? Date.now(), tz);

  // Each member's offered times by day, in priority order.
  type Offer = { id: string; ms: number };
  const byDay = new Map<number, Offer[]>();
  for (const m of req.members) {
    const free = new Set(m.starts);
    let offered: number[];
    if (m.best && m.best.length) {
      offered = m.best.filter((ms) => free.has(ms));
    } else {
      // No best times set: the day-packing suggestions, day by day.
      const days = new Map<number, number[]>();
      for (const ms of m.starts) {
        const d = localDayStart(ms, tz);
        const list = days.get(d);
        if (list) list.push(ms);
        else days.set(d, [ms]);
      }
      offered = [...days.values()].flatMap((list) =>
        daySuggestions({ starts: list, busy: m.busy ?? [], travelGapMin: req.travelGapMin, isPremium: premium, timeZone: tz }));
    }
    for (const ms of offered) {
      const d = localDayStart(ms, tz);
      const list = byDay.get(d) ?? [];
      // A time a higher-priority detailer already offers stays theirs.
      if (!list.some((o) => o.ms === ms)) list.push({ id: m.id, ms });
      byDay.set(d, list);
    }
  }

  const order = (offers: Offer[]) => {
    const rank = new Map(req.members.map((m, i) => [m.id, i]));
    return offers.slice().sort((a, b) =>
      (rank.get(a.id)! - rank.get(b.id)!) ||
      (req.scoreFor ? req.scoreFor(b.ms) - req.scoreFor(a.ms) : 0) ||
      (Number(premium(a.ms)) - Number(premium(b.ms))) ||
      a.ms - b.ms);
  };

  const days = [...byDay.keys()].sort((a, b) => a - b).map((dayStart) => {
    const offers = order(byDay.get(dayStart)!);
    const lead = offers[0]!;
    return {
      dayStart,
      ms: lead.ms,
      who: lead.id,
      more: offers.slice(1).map((o) => o.ms).sort((a, b) => a - b),
      daysAway: Math.round((dayStart - today) / 86_400_000),
      weekday: localWeekday(dayStart + 12 * 3600_000, tz),
    };
  });

  const picks: RecommendedDay[] = [];
  const used = new Set<number>();
  const take = (d: (typeof days)[number], reason: PickReason) => {
    used.add(d.dayStart);
    picks.push({ dayStart: d.dayStart, reason, ms: d.ms, who: d.who, more: d.more, daysAway: d.daysAway });
  };
  const avail = () => days.filter((d) => !used.has(d.dayStart));
  for (const reason of rules.reasons) {
    if (reason === "soonest") { const d = avail()[0]; if (d) take(d, "soonest"); }
    if (reason === "afterRush") { const d = avail().find((x) => !req.isRush(x.ms)); if (d) take(d, "afterRush"); }
    if (reason === "weekend") { const d = avail().find((x) => x.weekday === 0 || x.weekday === 6); if (d) take(d, "weekend"); }
  }
  for (const d of avail()) {
    if (picks.length >= rules.shown + rules.extraWhenRoom) break;
    take(d, "also");
  }
  return picks;
}
