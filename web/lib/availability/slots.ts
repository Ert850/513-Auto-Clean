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
}

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

  for (const f of free) {
    // Earliest the CUSTOMER-FACING start can be: the drive out has to fit
    // inside the free interval ahead of it.
    let t = ceilTo(Math.max(f.start + req.travelBeforeMin * MIN, req.notBefore), step);

    while (true) {
      const commitmentStart = t - req.travelBeforeMin * MIN;
      const commitmentEnd = t + (req.serviceDurationMin + req.travelAfterMin) * MIN;
      if (commitmentEnd > f.end) break;
      if (t > req.notAfter) break;
      if (commitmentStart >= f.start) out.push(t);
      t += step;
    }
  }
  return out.sort((a, b) => a - b);
}

function ceilTo(ms: number, step: number): number {
  return Math.ceil(ms / step) * step;
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
