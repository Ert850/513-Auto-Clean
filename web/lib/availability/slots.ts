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
  /**
   * Whether the cart contains any exterior work, which is bound by daylight
   * rather than by the general end of the day.
   */
  hasExterior?: boolean;
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
  /**
   * Local start minute at and after which the return drive stops counting.
   *
   * A late booking is the last job of the day, so the drive home does not
   * block anything and should not shorten what can be booked. Without this a
   * 4 hour job at 8pm needs the calendar open until half past midnight for a
   * drive nobody is waiting on.
   */
  ignoreReturnAfterMin?: number;
  /**
   * Local start minute at and before which the OUTBOUND drive stops counting.
   *
   * The mirror of ignoreReturnAfterMin, and it was missing. An OPEN block
   * from 6am did not offer 6am: the hour of drive time had to fit INSIDE the
   * block, so the earliest bookable start was 7am and the first hour of every
   * working day was unsellable.
   *
   * That is the wrong model for the first job. Nobody is waiting on the drive
   * out either: Elijah leaves home earlier and arrives at six. The calendar
   * says when he can be WORKING, not when he has to be awake.
   *
   * Deliberately capped by the caller at a drive short enough to absorb
   * before the day starts. An hour out to a first job is a normal morning; a
   * two hour drive is a different decision and should still show its cost.
   */
  ignoreOutboundBeforeMin?: number;
  /**
   * Restrict to these weekdays, 0 Sun to 6 Sat. Correction work uses it to
   * offer weekend starts only, since it runs across several days.
   */
  allowedWeekdays?: number[];
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
  /**
   * Latest a job containing ANY exterior work may start.
   *
   * Earlier than the general cut-off because it gets dark. You cannot judge a
   * wash or spot a missed panel by torchlight.
   */
  latestExteriorStartMin?: number;
}

export const DEFAULT_BOOKING_WINDOW: BookingWindow = {
  earliestStartMin: 6 * 60,
  // 10pm. Which does NOT mean any job can start at 10pm: serviceEndByMin
  // still has to be met, so a 10pm start is only ever available to a job of
  // two hours or less. The rule falls out of the arithmetic rather than
  // needing a clause of its own.
  latestStartMin: 22 * 60,
  serviceEndByMin: 24 * 60,
  // Washing a car you cannot see is how panels get missed and paint gets
  // marred. Exterior work has a harder cut-off than interior work.
  latestExteriorStartMin: 20 * 60,
};

/** From 6pm on, a booking is the last of the day. */
export const IGNORE_RETURN_AFTER_MIN = 18 * 60;

/**
 * Start at or before this and the drive out is treated as happening before
 * the day, not inside it. 10am, which covers the whole early band.
 */
export const IGNORE_OUTBOUND_BEFORE_MIN = 10 * 60;

/**
 * How much clearance a booking needs either side of the work itself.
 *
 * ONE HOUR, not the raw drive time. The hour covers the drive plus unloading,
 * setting up, packing down and the minutes that always go missing, and up to
 * 45 minutes of driving fits inside it with slack to spare. That slack is
 * deliberate: Elijah would rather take a job with a tight turnaround and work
 * a little faster than have the scheduler refuse it on his behalf.
 *
 * Past 45 minutes the drive is the binding constraint, so it sets the buffer
 * itself with a quarter hour on top.
 */
export const TRAVEL_FITS_IN_HOUR_MIN = 45;

export function travelBufferMin(oneWayMinutes: number): number {
  const drive = Number.isFinite(oneWayMinutes) ? Math.max(0, oneWayMinutes) : 0;
  return drive <= TRAVEL_FITS_IN_HOUR_MIN ? 60 : drive + 15;
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
  // Where the working day actually opens, as opposed to where a gap happens
  // to open after a job. Only the former lets the drive out sit outside it.
  const dayOpens = new Set(req.openBlocks.map((b) => b.start));
  const step = Math.max(1, req.granularityMin) * MIN;
  const out: number[] = [];
  const wanted = req.preferredStartsMin;
  const win = req.bookingWindow ?? DEFAULT_BOOKING_WINDOW;

  for (const f of free) {
    /**
     * Is `start` early enough that the drive out happens before the day?
     *
     * Only at the very front of a free interval. A gap that opens at 1pm
     * because a morning job ended is not "the start of the day", and the
     * drive to it genuinely does have to fit.
     */
    const outboundFree = (start: number): boolean =>
      req.ignoreOutboundBeforeMin !== undefined &&
      localMinutesOfDay(start, req.timeZone) <= req.ignoreOutboundBeforeMin &&
      // This free interval has to BEGIN where availability begins. A gap that
      // opens at 9am because a job finished is not the start of the day, and
      // the drive to the next customer genuinely does have to fit in it:
      // without this check, two jobs could be booked back to back with no
      // time to drive between them.
      dayOpens.has(f.start) &&
      // And only for a start the drive could not have fitted in front of.
      // 7am with an hour's drive fits inside a 6am opening on its own.
      start - f.start < req.travelBeforeMin * MIN;

    // Earliest the CUSTOMER-FACING start can be. The drive out normally has to
    // fit inside the free interval ahead of it; at the very start of the day
    // it does not, because it happened before the day began.
    const earliest = outboundFree(ceilTo(Math.max(f.start, req.notBefore), step))
      ? Math.max(f.start, req.notBefore)
      : Math.max(f.start + req.travelBeforeMin * MIN, req.notBefore);
    let t = ceilTo(earliest, step);

    while (true) {
      const commitmentStart = outboundFree(t) ? t : t - req.travelBeforeMin * MIN;
      // Last job of the day: nobody is waiting on the drive home, so it does
      // not need to fit inside the availability block.
      const returnMin =
        req.ignoreReturnAfterMin !== undefined &&
        localMinutesOfDay(t, req.timeZone) >= req.ignoreReturnAfterMin
          ? 0
          : req.travelAfterMin;
      const commitmentEnd = t + (req.serviceDurationMin + returnMin) * MIN;
      if (commitmentEnd > f.end) break;
      if (t > req.notAfter) break;
      if (
        commitmentStart >= f.start &&
        (!req.allowedWeekdays || req.allowedWeekdays.includes(new Date(t).getDay())) &&
        withinBookingWindow(t, req.serviceDurationMin, win, req.timeZone, req.hasExterior) &&
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

/**
 * The four bands a customer chooses between.
 *
 * THESE ARE START TIMES, not the length of the visit. Picking "Early Morning"
 * means the detail begins somewhere between 6am and 10am, not that it is over
 * by 10am. The funnel says so in as many words, because the old six-chip list
 * read as a menu of appointment windows and it is not one.
 *
 * The two middle bands are standard price and carry the defaults, because
 * they are what most people should take. The outer two carry the premium and
 * exist for someone who needs a particular day to work.
 *
 * The boundaries deliberately match the surcharge rule exactly: premium
 * before 10am and from 6pm. A band that straddled that line would charge a
 * premium for a time the customer was told was standard, which is how the
 * old 6am-and-8am-under-"morning" arrangement went wrong.
 */
export interface TimeBand {
  id: string;
  label: string;
  /** Minutes past local midnight. `toMin` is exclusive. */
  fromMin: number;
  toMin: number;
  premium: boolean;
  /** The start to land on when it is free. */
  preferMin: number;
  /**
   * The hours themselves, in the customer's words: "6am to 10am".
   *
   * One string, used by both places that name a band: the slot picker, which
   * writes "Starts 6am to 10am" because these are START times, and the
   * preferred-time picker on the inquiry path. Those two used to carry their
   * own wording, and the second one had drifted to a completely different set
   * of hours (8am to 12pm, 12pm to 4pm, 4pm to 8pm) that matched neither the
   * bands nor the surcharge.
   */
  range: string;
}

/**
 * FOUR BANDS, and their edges are the surcharge edges.
 *
 *   6am to 10am   Early Morning   premium
 *   10am to 2pm   Midday          standard, defaults to 10am
 *   2pm to 6pm    Afternoon       standard, defaults to 4pm
 *   6pm to 10pm   Late Evening    premium, pushed as early as it can go
 *
 * `fromMin` of the first premium band and `toMin` of the last standard one
 * are the same numbers as `earlyBeforeMinutes` and `lateFromMinutes` in the
 * pricing rules, and a test walks every quarter hour to prove it. That is
 * what stops the oldest bug in this feature coming back: a time sold inside
 * a band labelled standard, then billed at the premium rate.
 */
export const TIME_BANDS: TimeBand[] = [
  {
    id: "early",
    label: "Early Morning",
    fromMin: 6 * 60,
    toMin: 10 * 60,
    premium: true,
    preferMin: 8 * 60,
    range: "6am to 10am",
  },
  {
    id: "midday",
    label: "Midday",
    fromMin: 10 * 60,
    toMin: 14 * 60,
    premium: false,
    preferMin: 10 * 60,
    range: "10am to 2pm",
  },
  {
    id: "afternoon",
    label: "Afternoon",
    fromMin: 14 * 60,
    toMin: 18 * 60,
    premium: false,
    preferMin: 16 * 60,
    range: "2pm to 6pm",
  },
  {
    id: "evening",
    label: "Late Evening",
    fromMin: 18 * 60,
    // Exclusive, and a 10pm start is allowed, so this is a minute past it.
    toMin: 22 * 60 + 1,
    premium: true,
    // Earliest in the band rather than a fixed hour: a late job should be as
    // early as it can be, not as late as it is allowed to be.
    preferMin: 18 * 60,
    range: "6pm to 10pm",
  },
];

export function bandOf(minutesOfDay: number): TimeBand | null {
  return TIME_BANDS.find((b) => minutesOfDay >= b.fromMin && minutesOfDay < b.toMin) ?? null;
}

export interface BandedSlots {
  band: TimeBand;
  /** Every start that fits, ascending. */
  starts: number[];
  /** The one to preselect: nearest to the band's preferred hour. */
  suggested: number;
}

/**
 * Group candidate starts into the four bands, with a suggestion per band.
 *
 * Bands with nothing in them are dropped rather than shown empty, so the
 * customer only ever sees parts of the day that are genuinely available.
 */
export function groupIntoBands(slots: number[], timeZone?: string): BandedSlots[] {
  const buckets = new Map<string, number[]>();

  for (const ms of slots) {
    const band = bandOf(localMinutesOfDay(ms, timeZone));
    if (!band) continue;
    const list = buckets.get(band.id);
    if (list) list.push(ms);
    else buckets.set(band.id, [ms]);
  }

  const out: BandedSlots[] = [];

  for (const band of TIME_BANDS) {
    const starts = (buckets.get(band.id) ?? []).sort((a, b) => a - b);
    if (!starts.length) continue;

    // Closest to the band's preferred hour, earliest wins a tie, which is
    // what makes the evening band lean early rather than late.
    let suggested = starts[0]!;
    let best = Infinity;
    for (const ms of starts) {
      const gap = Math.abs(localMinutesOfDay(ms, timeZone) - band.preferMin);
      if (gap < best) {
        best = gap;
        suggested = ms;
      }
    }
    out.push({ band, starts, suggested });
  }

  return out;
}

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
  hasExterior?: boolean,
): boolean {
  const startMin = localMinutesOfDay(ms, timeZone);
  if (startMin < win.earliestStartMin || startMin > win.latestStartMin) return false;
  if (
    hasExterior &&
    win.latestExteriorStartMin !== undefined &&
    startMin > win.latestExteriorStartMin
  ) {
    return false;
  }
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

/* ------------------------------------------------------------------ *
 * Recommending a start, rather than offering forty of them
 * ------------------------------------------------------------------ */

/**
 * The start times a day is built around.
 *
 * A customer picking freely from every half hour picks the one that suits
 * them and leaves the day in pieces: a 1pm start makes both 10am and 4pm
 * impossible, so one booking costs two. Offering two good starts, with
 * everything else one tap further away, keeps most days packable without
 * ever refusing somebody who genuinely needs 11:30.
 *
 * Weekends get three, closer together, because they are the days worth
 * filling hardest.
 */
export const DAY_ANCHORS_MIN = {
  weekday: [10 * 60, 16 * 60],
  // Three on a weekend, because those are the days worth filling hardest.
  // All inside standard hours: recommending 8am would be steering somebody
  // into a 20% early-start premium they never asked for, which is the one
  // thing a recommendation must never do.
  weekend: [10 * 60, 13 * 60, 16 * 60],
} as const;

export interface Recommendation {
  ms: number;
  /** Why this one, in the customer's terms. */
  why: string;
}

/**
 * Pick the few starts worth putting in front of somebody.
 *
 * In order of preference:
 *
 *   1. STRAIGHT AFTER AN EXISTING JOB, travel included. This is the one that
 *      actually condenses a day: a booking that begins when the last one ends
 *      costs no extra dead time at all.
 *   2. THE DAY'S ANCHORS, 10am and 4pm on a weekday. Two jobs, no gap worth
 *      selling in between.
 *   3. THE EARLIEST THING AVAILABLE, so a day with an awkward shape still
 *      offers something rather than nothing.
 *
 * Returns at most `limit`, in time order, deduplicated. Every one is taken
 * from `starts`, so nothing is ever recommended that cannot be booked.
 */
export function recommendStarts(req: {
  starts: number[];
  busy?: Interval[];
  /** Minutes to allow between the end of one job and the start of the next. */
  travelGapMin: number;
  /**
   * The hour this set of starts is built around, when called for one band
   * rather than a whole day. The early band prefers 8am, midday 10am,
   * afternoon 4pm, evening 6pm: the times that leave the rest of the day
   * sellable. Ranks above the day anchors, because within a band the band's
   * own preference IS the anchor.
   */
  preferMin?: number;
  limit?: number;
  timeZone?: string;
}): Recommendation[] {
  const all = [...new Set(req.starts)].sort((a, b) => a - b);
  if (!all.length) return [];

  /*
   * NEVER RECOMMEND A PREMIUM START while a standard one exists.
   *
   * Early mornings and late evenings carry 20%. They are genuinely bookable
   * and stay one tap away under "See additional times", which is what somebody
   * who actually wants 7am is looking for. But putting one at the top of the
   * screen, labelled as our recommendation, is steering a customer into a
   * surcharge to suit our day. That is the one thing this must not do.
   *
   * The rush fee is different and is not filtered here: it applies to every
   * hour of a near-term day, so no choice within that day avoids it.
   */
  const standard = all.filter((ms) => !bandOf(localMinutesOfDay(ms, req.timeZone))?.premium);
  const starts = standard.length ? standard : all;

  const limit = req.limit ?? 2;
  const gapMs = Math.max(0, req.travelGapMin) * MIN;
  const scored = new Map<number, { rank: number; why: string }>();

  const offer = (ms: number | undefined, rank: number, why: string) => {
    if (ms === undefined) return;
    const seen = scored.get(ms);
    if (!seen || rank < seen.rank) scored.set(ms, { rank, why });
  };

  /** The start closest to a target, within half an hour of it. */
  const nearest = (target: number): number | undefined => {
    let best: number | undefined;
    let bestGap = Infinity;
    for (const s of starts) {
      const d = Math.abs(s - target);
      if (d < bestGap && d <= 30 * MIN) { best = s; bestGap = d; }
    }
    return best;
  };

  // 1. Back to back with something already booked.
  for (const b of req.busy ?? []) {
    if (b.end <= starts[0]! - 12 * 60 * MIN || b.end >= starts[starts.length - 1]! + 12 * 60 * MIN) {
      continue;
    }
    offer(nearest(b.end + gapMs), 0, "Fits neatly into this day");
  }

  // 2. The hour this band is built around.
  if (req.preferMin !== undefined) {
    const exact = starts.find((s2) => localMinutesOfDay(s2, req.timeZone) === req.preferMin);
    offer(exact, 1, "Our usual start time");
  }

  // 3. The anchors for this weekday.
  const day = new Date(starts[0]!).getDay();
  const anchors = day === 0 || day === 6 ? DAY_ANCHORS_MIN.weekend : DAY_ANCHORS_MIN.weekday;
  for (const mins of anchors) {
    const hit = starts.find((s2) => localMinutesOfDay(s2, req.timeZone) === mins);
    offer(hit, 2, "Our usual start time");
  }

  // 4. Something, rather than nothing.
  offer(starts[0], 3, "Earliest we can be there");

  return [...scored.entries()]
    .sort((a, b) => a[1].rank - b[1].rank || a[0] - b[0])
    .slice(0, limit)
    .map(([ms, v]) => ({ ms, why: v.why }))
    .sort((a, b) => a.ms - b.ms);
}
