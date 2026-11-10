import type { Interval } from "../availability/slots.js";
import { localDayStart, localTimeOnDay, localWeekday, zonedToUtc } from "../time/zone.js";

/**
 * Reads a PUBLIC Google Calendar straight from the browser.
 *
 * A public calendar can be read with a plain API key, no OAuth, and the
 * Calendar API sends CORS headers, so the funnel can compute availability with
 * no backend at all. The service-account path in ./calendar.ts stays for the
 * server side, where writing booked jobs needs real credentials.
 *
 * TWO MODES, detected automatically, because Elijah's calendar today holds his
 * BUSY commitments rather than availability blocks:
 *
 *   whitelist  Events titled "OPEN..." exist in the window. Those events ARE
 *              the availability, and everything else is ignored.
 *   blacklist  No OPEN events. Availability is business hours MINUS every
 *              event on the calendar.
 *
 * This means it works with the calendar as it is now, and keeps working
 * unchanged the day he switches to recurring OPEN blocks.
 */

const API = "https://www.googleapis.com/calendar/v3/calendars";

export const AVAILABILITY_PREFIX = "OPEN";

/**
 * Best start times, set in Google Calendar rather than in code (owner,
 * November 10): an event titled "BEST..." on an availability calendar marks
 * an ideal start (Kris at 6pm; Elijah at 10am, 4pm and 6pm, no 6pm at
 * weekends). Only its START matters. It never blocks time, whatever its
 * Busy/Free setting. docs/CALENDAR-SETUP.md is the owner's guide.
 */
export const BEST_PREFIX = "BEST";

/**
 * An event's start or end. An all-day event gives a bare date, which
 * new Date() reads as midnight UTC: 7pm the evening before in Cincinnati,
 * so an all-day "Vacation" left its own evening bookable and blocked the
 * evening before (engine check, November 10). It means local midnight.
 */
export function eventTime(s: string): number {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return d ? zonedToUtc(Number(d[1]), Number(d[2]), Number(d[3]), 0, 0, 0, "America/New_York") : new Date(s).getTime();
}

/**
 * Is this title the keyword? "OPEN", "Open hours" and "BEST evening" are;
 * "Opening night" and "Bestie's wedding" are not. Whole word only: a plain
 * startsWith read them as working hours and best times (engine check,
 * November 10).
 */
export function titleIs(summary: string, word: string): boolean {
  return new RegExp("^" + word + "\\b", "i").test(summary.trim());
}

/**
 * Who is offered first, also set in Google Calendar: a line "Priority: 1" in
 * the calendar's own Description (Settings and sharing). Lower goes first.
 */
export function parsePriority(description: string | null | undefined): number | null {
  const m = /priority\s*[:=]?\s*(\d+)/i.exec(String(description ?? ""));
  return m ? Number(m[1]) : null;
}

export interface PublicCalendarConfig {
  /** The calendar carrying OPEN blocks, and usually the jobs too. */
  calendarId: string;
  /**
   * Anything else to read: a separate jobs calendar, a second van, whatever.
   * Every calendar is read the same way and the results are pooled, so it
   * makes no difference which one an OPEN block or a job lives on.
   */
  extraCalendarIds?: string[];
  /**
   * Calendars that hold JOBS, read through Google's free/busy endpoint: start
   * and end only, never a title, a name or an address. Such a calendar is
   * shared publicly as "See only free/busy (hide details)", so customer
   * details on it stay private. Never list a calendar with OPEN blocks here:
   * free/busy reports an OPEN block as busy. (Found November 10: the jobs
   * calendar was public with full details.)
   */
  busyOnlyIds?: string[];
  apiKey: string;
  timeZone?: string;
}

/** Every calendar id to read, primary first, blanks and duplicates dropped. */
export function calendarIds(cfg: Partial<PublicCalendarConfig>): string[] {
  const busyOnly = new Set(busyOnlyIds(cfg));
  const all = [cfg.calendarId ?? "", ...(cfg.extraCalendarIds ?? [])]
    .map((s) => String(s ?? "").trim())
    .filter((id) => id && !busyOnly.has(id));
  return all.filter((id, i) => all.indexOf(id) === i);
}

/** The calendars read for busy time only, deduplicated. */
export function busyOnlyIds(cfg: Partial<PublicCalendarConfig>): string[] {
  const all = (cfg.busyOnlyIds ?? []).map((s) => String(s ?? "").trim()).filter(Boolean);
  return all.filter((id, i) => all.indexOf(id) === i);
}

/**
 * Busy time from calendars shared as free/busy only, as plain busy events.
 *
 * A failure THROWS rather than returning nothing: these are the jobs, and
 * offering a time on top of a job nobody could see is the double booking
 * this whole module exists to prevent.
 */
export async function fetchBusyOnly(
  apiKey: string,
  ids: string[],
  fromMs: number,
  toMs: number,
): Promise<RawEvent[]> {
  if (!ids.length) return [];
  const res = await fetch(`https://www.googleapis.com/calendar/v3/freeBusy?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      timeMin: new Date(fromMs).toISOString(),
      timeMax: new Date(toMs).toISOString(),
      items: ids.map((id) => ({ id })),
    }),
  });
  if (!res.ok) throw new Error(`Google free/busy ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as {
    calendars?: Record<string, { busy?: { start: string; end: string }[]; errors?: unknown[] }>;
  };
  const out: RawEvent[] = [];
  for (const id of ids) {
    const c = json.calendars?.[id];
    if (!c || (c.errors && c.errors.length)) throw new Error(`Google free/busy: ${id} unreadable`);
    for (const b of c.busy ?? []) {
      out.push({ summary: "Busy", start: Date.parse(b.start), end: Date.parse(b.end), allDay: false, transparent: false });
    }
  }
  return out;
}

export interface RawEvent {
  summary: string;
  start: number;
  end: number;
  allDay: boolean;
  transparent: boolean;
}

export type AvailabilityMode = "whitelist" | "blacklist" | "unconfigured";

export interface CalendarWindow {
  mode: AvailabilityMode;
  /** Bookable time, already resolved for whichever mode applied. */
  open: Interval[];
  /** Everything treated as unavailable, in either mode. */
  busy: Interval[];
  events: RawEvent[];
  /** Starts of BEST events in the window, sorted. Empty when none are set. */
  best?: number[];
  /** "Priority: N" from a calendar's description; null when none says. */
  priority?: number | null;
}

export function isConfigured(cfg: Partial<PublicCalendarConfig> | null | undefined): boolean {
  return Boolean(cfg && cfg.calendarId && cfg.apiKey);
}

export async function fetchEvents(
  cfg: PublicCalendarConfig,
  fromMs: number,
  toMs: number,
): Promise<RawEvent[]> {
  return (await readCalendars(cfg, fromMs, toMs)).events;
}

/** A detailer's calendars read together: the events, and the best Priority line. */
export interface CalendarRead {
  events: RawEvent[];
  priority: number | null;
}

export async function readCalendars(
  cfg: PublicCalendarConfig,
  fromMs: number,
  toMs: number,
): Promise<CalendarRead> {
  const ids = calendarIds(cfg);
  if (ids.length <= 1) return fetchOne(cfg.apiKey, ids[0] ?? "", fromMs, toMs);

  /*
   * All of them, in parallel, pooled.
   *
   * One calendar that fails must not take the others down with it: a booking
   * offered against slightly stale availability is recoverable, and a
   * scheduler that shows nothing is not. A failure that loses the JOBS
   * calendar is the dangerous direction, so it is logged loudly rather than
   * swallowed silently.
   */
  const settled = await Promise.all(
    ids.map((id) =>
      fetchOne(cfg.apiKey, id, fromMs, toMs).catch((err: unknown): CalendarRead => {
        // eslint-disable-next-line no-console
        console.warn(`[513] calendar ${id} unreadable:`, err);
        return { events: [], priority: null };
      }),
    ),
  );
  const ranks = settled.map((r) => r.priority).filter((n): n is number => n !== null);
  return { events: settled.flatMap((r) => r.events), priority: ranks.length ? Math.min(...ranks) : null };
}

async function fetchOne(
  apiKey: string,
  calendarId: string,
  fromMs: number,
  toMs: number,
): Promise<CalendarRead> {
  const cfg = { calendarId, apiKey };
  const url =
    `${API}/${encodeURIComponent(cfg.calendarId)}/events` +
    `?key=${encodeURIComponent(cfg.apiKey)}` +
    `&timeMin=${new Date(fromMs).toISOString()}` +
    `&timeMax=${new Date(toMs).toISOString()}` +
    // Expands recurrence server side, so we never implement RRULE ourselves.
    `&singleEvents=true&orderBy=startTime&maxResults=2500`;

  // NEVER from the browser cache. Availability is the one thing on this site
  // where a thirty second old answer is a double booking, and the customer
  // reloading the step has to be asking Google again, not asking memory.
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Google Calendar ${res.status}: ${await res.text()}`);
  }
  // The calendar's own Description rides along on every events list.
  const json = (await res.json()) as { items?: GoogleEvent[]; description?: string };

  const events = (json.items ?? [])
    .map((e): RawEvent | null => {
      const s = e.start?.dateTime ?? e.start?.date;
      const t = e.end?.dateTime ?? e.end?.date;
      if (!s || !t) return null;
      return {
        summary: (e.summary ?? "").trim(),
        start: eventTime(s),
        end: eventTime(t),
        allDay: Boolean(e.start?.date && !e.start?.dateTime),
        // "Free" events are things like reminders that should not block work.
        transparent: e.transparency === "transparent",
      };
    })
    .filter((e): e is RawEvent => e !== null);
  return { events, priority: parsePriority(json.description) };
}

interface GoogleEvent {
  summary?: string;
  transparency?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}

export interface BusinessHours {
  /** Minutes past local midnight. */
  openMin: number;
  closeMin: number;
  /** 0 Sun to 6 Sat. Days not listed are closed. */
  days: number[];
  timeZone: string;
}

export const DEFAULT_HOURS: BusinessHours = {
  /**
   * Wider than the bookable window on purpose, at BOTH ends.
   *
   * Customers may start as early as 6am, which means leaving before 6am, so
   * the block has to open earlier than the earliest start. It closes at 1am
   * because a service finishing at midnight still needs the drive home, and
   * the whole commitment has to fit inside one availability block. An hour
   * covers any return leg the fee ladder would realistically produce.
   *
   * What a customer can actually pick is bounded separately by
   * DEFAULT_BOOKING_WINDOW in ../availability/slots.ts, which is the thing to
   * change if the bookable hours move.
   */
  openMin: 5 * 60,
  closeMin: 25 * 60,
  days: [0, 1, 2, 3, 4, 5, 6],
  timeZone: "America/New_York",
};

/** Business-hours intervals for each day in a range, in the given zone. */
export function businessHoursWindows(
  fromMs: number,
  toMs: number,
  hours: BusinessHours = DEFAULT_HOURS,
): Interval[] {
  /*
   * IN CINCINNATI TIME. This built each day from the browser's own midnight
   * (setHours(0,0,0,0)) and ignored `hours.timeZone`, so for a visitor in
   * Europe "5am to 1am" became 11pm to 7pm in Cincinnati, and a two hour job
   * could not start after 4pm. Found November 10 on a Mac set to CET: the
   * week grid stopped at 5pm. Only the fallback (no calendar key) used it.
   */
  const tz = hours.timeZone ?? "America/New_York";
  const out: Interval[] = [];
  const day0 = localDayStart(fromMs, tz);

  for (let i = 0; i < 400; i++) {
    const dayStart = localTimeOnDay(day0, i, 0, tz);
    if (dayStart >= toMs) break;
    if (hours.days.includes(localWeekday(dayStart + 12 * 3_600_000, tz))) {
      const start = localTimeOnDay(day0, i, hours.openMin, tz);
      const end = localTimeOnDay(day0, i, hours.closeMin, tz);
      if (end > fromMs && start < toMs) {
        out.push({ start: Math.max(start, fromMs), end: Math.min(end, toMs) });
      }
    }
  }
  return out;
}

/**
 * Resolve a window of the calendar into bookable time.
 *
 * All-day events are treated as blocking the whole of that day in blacklist
 * mode, because an all-day "Vacation" should not leave the day bookable.
 */
export function resolveWindow(
  events: RawEvent[],
  fromMs: number,
  toMs: number,
  hours: BusinessHours = DEFAULT_HOURS,
): CalendarWindow {
  const isBest = (e: RawEvent) => titleIs(e.summary, BEST_PREFIX);
  // Best start times mark a time; they never take it away, Busy or Free.
  const best = [...new Set(events.filter((e) => isBest(e) && !e.allDay && e.start >= fromMs && e.start < toMs).map((e) => e.start))]
    .sort((a, b) => a - b);
  const usable = events.filter((e) => !e.transparent && !isBest(e));
  // OPEN blocks count whatever their Busy/Free setting. An OPEN event set to
  // Free used to be dropped with the other Free events, silently taking
  // those hours away (found by the calendar setup walkthrough, November 10).
  const openEvents = events.filter((e) =>
    !isBest(e) && titleIs(e.summary, AVAILABILITY_PREFIX),
  );

  if (openEvents.length > 0) {
    /*
     * BUSY IS NOT EMPTY HERE ANY MORE, AND THAT WAS A REAL BUG.
     *
     * This used to return `busy: []` in whitelist mode, on the theory that an
     * OPEN block is a positive statement and everything else on the calendar
     * is Elijah's own business. Then the jobs went on the same calendar as
     * the OPEN blocks, and a booked "Full Interior" at 4pm stopped blocking
     * anything: the site would cheerfully sell that hour a second time.
     *
     * So anything that is not an OPEN block is busy. The escape hatch is
     * Google Calendar's own Busy/Free setting: mark an event Free and it is
     * dropped by the transparency filter above, which is where a career fair
     * or a birthday belongs. That is a control Elijah already knows, in the
     * app he already uses, rather than a rule about titles he has to
     * remember.
     */
    const jobs = usable.filter((e) => !openEvents.includes(e));
    return {
      mode: "whitelist",
      open: openEvents.map((e) => ({ start: e.start, end: e.end })),
      busy: jobs.map((e) => ({ start: e.start, end: e.end })),
      events,
      best,
    };
  }

  return {
    mode: "blacklist",
    open: businessHoursWindows(fromMs, toMs, hours),
    busy: usable.map((e) => ({ start: e.start, end: e.end })),
    events,
    best,
  };
}

export async function loadWindow(
  cfg: PublicCalendarConfig,
  fromMs: number,
  toMs: number,
  hours: BusinessHours = DEFAULT_HOURS,
): Promise<CalendarWindow> {
  const [read, busy] = await Promise.all([
    calendarIds(cfg).length ? readCalendars(cfg, fromMs, toMs) : Promise.resolve({ events: [] as RawEvent[], priority: null }),
    fetchBusyOnly(cfg.apiKey, busyOnlyIds(cfg), fromMs, toMs),
  ]);
  return { ...resolveWindow(read.events.concat(busy), fromMs, toMs, hours), priority: read.priority };
}

/**
 * Fallback when no API key is configured: business hours with nothing removed.
 *
 * Deliberately labelled `unconfigured` so the UI can say the times still need
 * confirming, rather than presenting guesses as if they were real openings.
 */
export function unconfiguredWindow(
  fromMs: number,
  toMs: number,
  hours: BusinessHours = DEFAULT_HOURS,
): CalendarWindow {
  return {
    mode: "unconfigured",
    open: businessHoursWindows(fromMs, toMs, hours),
    busy: [],
    events: [],
  };
}
