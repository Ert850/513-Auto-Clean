/**
 * Slot computation. Pure: takes intervals in, gives intervals out.
 *
 * Availability comes from OPEN blocks on the Google Availability calendar.
 * Busy time comes from OUR database, never from Google: the database carries
 * the exclusion constraint and is transactionally correct, while Google is a
 * mirror with eventual consistency and rate limits.
 */

export interface Interval {
  /** Epoch ms. */
  start: number;
  end: number;
}

export interface SlotRequest {
  openBlocks: Interval[];
  /** Existing bookings, ALREADY expanded by their travel buffers. */
  busy: Interval[];
  /** Hands-on minutes. */
  serviceDurationMin: number;
  /** Measured drive time each way. Counts against the calendar. */
  travelBeforeMin: number;
  travelAfterMin: number;
  /** Slot starts land on this boundary. */
  granularityMin: number;
  /** Nothing earlier than this. Epoch ms. */
  notBefore: number;
  /** Nothing later than this. Epoch ms. */
  notAfter: number;
  /**
   * When set, only these local start times are offered.
   *
   * Elijah books almost everything at a handful of times: 8, 10, 4 and 6 on a
   * weekday, 10 and 4 at the weekend. Offering a wall of half-hour slots is
   * both harder to choose from and worse for his routing, since a 9:30 start
   * strands the rest of the morning. Presenting the times he actually works
   * makes the customer's decision easier AND the day pack better.
   *
   * Not a hard rule: computeSlots can be called again without this to surface
   * everything else that genuinely fits.
   */
  preferredStartsMin?: { weekday: number[]; weekend: number[] };
  timeZone?: string;
  /**
   * Hard bounds on what a customer may pick, separate from what is preferred.
   *
   * Elijah will start as early as 6am and as late as 8pm if that is what makes
   * a particular day work. Those are not his usual times and they carry the
   * premium, but they are genuinely bookable rather than hidden.
   */
  bookingWindow?: BookingWindow;
}

export interface BookingWindow {
  /** Earliest local start, minutes past midnight. */
  earliestStartMin: number;
  /** Latest local start. */
  latestStartMin: number;
  /**
   * The service itself must be finished by this local minute.
   *
   * This is the rule behind "4 hours max at 8pm, 6 hours max at 6pm": both
   * land exactly on midnight, so one end-time bound expresses the whole thing
   * and keeps working for a 7pm start without another special case.
   */
  serviceEndByMin: number;
}

export const DEFAULT_BOOKING_WINDOW: BookingWindow = {
  earliestStartMin: 6 * 60,
  latestStartMin: 20 * 60,
  serviceEndByMin: 24 * 60,
};

const MIN = 60_000;

/** Merge overlapping or touching intervals so subtraction is straightforward. */
export function mergeIntervals(list: Interval[]): Interval[] {
  if (list.length === 0) return [];
  const sorted = [...list].sort((a, b) => a.start - b.start);
  const out: Interval[] = [{ ...(sorted[0] as Interval) }];
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i] as Interval;
    const last = out[out.length - 1] as Interval;
    if (cur.start <= last.end) last.end = Math.max(last.end, cur.end);
    else out.push({ ...cur });
  }
  return out;
}

/** free = open minus busy. */
export function subtractIntervals(open: Interval[], busy: Interval[]): Interval[] {
  const merged = mergeIntervals(busy);
  let free: Interval[] = mergeIntervals(open);

  for (const b of merged) {
    const next: Interval[] = [];
    for (const f of free) {
      if (b.end <= f.start || b.start >= f.end) {
        next.push(f);
        continue;
      }
      if (b.start > f.start) next.push({ start: f.start, end: b.start });
      if (b.end < f.end) next.push({ start: b.end, end: f.end });
    }
    free = next;
  }
  return free;
}

/**
 * Candidate start times.
 *
 * A slot only fits when the WHOLE commitment fits inside one free interval:
 * drive out, do the work, drive back. That is the rule the outline states as
 * "a 4 hour detail plus an hour of travel needs a 5 hour window", and it is
 * why a long drive legitimately removes more slots than a short one.
 */
export function computeSlots(req: SlotRequest): number[] {
  const commitmentMs =
    (req.travelBeforeMin + req.serviceDurationMin + req.travelAfterMin) * MIN;
  if (commitmentMs <= 0) return [];

  const free = subtractIntervals(req.openBlocks, req.busy);
  const step = Math.max(1, req.granularityMin) * MIN;
  const out: number[] = [];
  const wanted = req.preferredStartsMin;
  const win = req.bookingWindow ?? DEFAULT_BOOKING_WINDOW;

  for (const f of free) {
    // Earliest the CUSTOMER-FACING start can be: the drive out has to fit
    // inside the free interval ahead of it.
    let t = ceilTo(Math.max(f.start + req.travelBeforeMin * MIN, req.notBefore), step);

    while (true) {
      const commitmentStart = t - req.travelBeforeMin * MIN;
      const commitmentEnd = t + (req.serviceDurationMin + req.travelAfterMin) * MIN;
      if (commitmentEnd > f.end) break;
      if (t > req.notAfter) break;
      if (
        commitmentStart >= f.start &&
        withinBookingWindow(t, req.serviceDurationMin, win, req.timeZone) &&
        matchesPreferred(t, wanted, req.timeZone)
      ) {
        out.push(t);
      }
      t += step;
    }
  }
  return out.sort((a, b) => a - b);
}

function ceilTo(ms: number, step: number): number {
  return Math.ceil(ms / step) * step;
}

/** Elijah's usual start times. Weekends are quieter, so fewer of them. */
export const PREFERRED_STARTS = {
  weekday: [8 * 60, 10 * 60, 16 * 60, 18 * 60],
  weekend: [10 * 60, 16 * 60],
};

/**
 * A start is allowed when it falls inside the bookable window AND the service
 * finishes by the end bound. A 6 hour job cannot start at 8pm, but a 4 hour
 * one can, which is exactly the behaviour Elijah described.
 */
function withinBookingWindow(
  ms: number,
  serviceDurationMin: number,
  win: BookingWindow,
  timeZone?: string,
): boolean {
  const startMin = localMinutesOfDay(ms, timeZone);
  if (startMin < win.earliestStartMin || startMin > win.latestStartMin) return false;
  return startMin + serviceDurationMin <= win.serviceEndByMin;
}

function matchesPreferred(
  ms: number,
  wanted: { weekday: number[]; weekend: number[] } | undefined,
  timeZone?: string,
): boolean {
  if (!wanted) return true;
  const mins = localMinutesOfDay(ms, timeZone);
  const day = new Date(ms).getDay();
  const list = day === 0 || day === 6 ? wanted.weekend : wanted.weekday;
  return list.includes(mins);
}

/**
 * Preferred starts first, then anything else that fits.
 *
 * Returning them separately lets the funnel lead with the two or three times
 * Elijah actually wants, and keep the rest behind a "more times" affordance
 * rather than dumping everything at once.
 */
export function computeSlotsTiered(req: SlotRequest): { preferred: number[]; other: number[] } {
  const preferred = computeSlots({ ...req, preferredStartsMin: PREFERRED_STARTS });
  // Omit the key rather than setting it undefined: exactOptionalPropertyTypes
  // treats an explicit undefined as a distinct, disallowed value.
  const { preferredStartsMin: _ignored, ...unrestricted } = req;
  const all = computeSlots(unrestricted);
  const set = new Set(preferred);
  return { preferred, other: all.filter((t) => !set.has(t)) };
}

/**
 * Group candidate starts into the customer's preferred windows, then fall back
 * outward. The funnel shows a small number of real options rather than a wall
 * of times: nearest match first, then anything else that day.
 */
export interface TimeWindow {
  id: string;
  label: string;
  /** Minutes past local midnight. */
  fromMin: number;
  toMin: number;
  premium: boolean;
}

export const TIME_WINDOWS: TimeWindow[] = [
  { id: "early", label: "Early", fromMin: 6 * 60, toMin: 8 * 60, premium: true },
  { id: "morning", label: "Morning", fromMin: 10 * 60, toMin: 12 * 60, premium: false },
  { id: "afternoon", label: "Afternoon", fromMin: 12 * 60, toMin: 16 * 60, premium: false },
  { id: "evening", label: "Evening", fromMin: 16 * 60, toMin: 18 * 60, premium: false },
  { id: "late", label: "Late", fromMin: 18 * 60, toMin: 20 * 60, premium: true },
];

/** Local minutes past midnight for an epoch ms, in a given IANA zone. */
export function localMinutesOfDay(ms: number, timeZone = "America/New_York"): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(ms));
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return (h % 24) * 60 + m;
}

export function inWindow(ms: number, w: TimeWindow, timeZone?: string): boolean {
  const mins = localMinutesOfDay(ms, timeZone);
  return mins >= w.fromMin && mins < w.toMin;
}

export function matchWindows(
  slots: number[],
  windowIds: string[],
  timeZone?: string,
): { inPreferred: number[]; outsidePreferred: number[] } {
  const wanted = TIME_WINDOWS.filter((w) => windowIds.includes(w.id));
  const inPreferred: number[] = [];
  const outsidePreferred: number[] = [];
  for (const s of slots) {
    (wanted.some((w) => inWindow(s, w, timeZone)) ? inPreferred : outsidePreferred).push(s);
  }
  return { inPreferred, outsidePreferred };
}
