import type { Interval } from "../availability/slots.js";

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

export interface PublicCalendarConfig {
  /** The calendar carrying OPEN blocks, and usually the jobs too. */
  calendarId: string;
  /**
   * Anything else to read: a separate jobs calendar, a second van, whatever.
   * Every calendar is read the same way and the results are pooled, so it
   * makes no difference which one an OPEN block or a job lives on.
   */
  extraCalendarIds?: string[];
  apiKey: string;
  timeZone?: string;
}

/** Every calendar id to read, primary first, blanks and duplicates dropped. */
export function calendarIds(cfg: Partial<PublicCalendarConfig>): string[] {
  const all = [cfg.calendarId ?? "", ...(cfg.extraCalendarIds ?? [])]
    .map((s) => String(s ?? "").trim())
    .filter(Boolean);
  return all.filter((id, i) => all.indexOf(id) === i);
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
}

export function isConfigured(cfg: Partial<PublicCalendarConfig> | null | undefined): boolean {
  return Boolean(cfg && cfg.calendarId && cfg.apiKey);
}

export async function fetchEvents(
  cfg: PublicCalendarConfig,
  fromMs: number,
  toMs: number,
): Promise<RawEvent[]> {
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
      fetchOne(cfg.apiKey, id, fromMs, toMs).catch((err: unknown) => {
        // eslint-disable-next-line no-console
        console.warn(`[513] calendar ${id} unreadable:`, err);
        return [] as RawEvent[];
      }),
    ),
  );
  return settled.flat();
}

async function fetchOne(
  apiKey: string,
  calendarId: string,
  fromMs: number,
  toMs: number,
): Promise<RawEvent[]> {
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
  const json = (await res.json()) as { items?: GoogleEvent[] };

  return (json.items ?? [])
    .map((e): RawEvent | null => {
      const s = e.start?.dateTime ?? e.start?.date;
      const t = e.end?.dateTime ?? e.end?.date;
      if (!s || !t) return null;
      return {
        summary: (e.summary ?? "").trim(),
        start: new Date(s).getTime(),
        end: new Date(t).getTime(),
        allDay: Boolean(e.start?.date && !e.start?.dateTime),
        // "Free" events are things like reminders that should not block work.
        transparent: e.transparency === "transparent",
      };
    })
    .filter((e): e is RawEvent => e !== null);
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
  const out: Interval[] = [];
  const cursor = new Date(fromMs);
  cursor.setHours(0, 0, 0, 0);

  for (let guard = 0; cursor.getTime() < toMs && guard < 400; guard++) {
    if (hours.days.includes(cursor.getDay())) {
      const dayStart = new Date(cursor);
      const start = dayStart.getTime() + hours.openMin * 60_000;
      const end = dayStart.getTime() + hours.closeMin * 60_000;
      if (end > fromMs && start < toMs) {
        out.push({ start: Math.max(start, fromMs), end: Math.min(end, toMs) });
      }
    }
    cursor.setDate(cursor.getDate() + 1);
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
  const usable = events.filter((e) => !e.transparent);
  const openEvents = usable.filter((e) =>
    e.summary.toUpperCase().startsWith(AVAILABILITY_PREFIX),
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
    };
  }

  return {
    mode: "blacklist",
    open: businessHoursWindows(fromMs, toMs, hours),
    busy: usable.map((e) => ({ start: e.start, end: e.end })),
    events,
  };
}

export async function loadWindow(
  cfg: PublicCalendarConfig,
  fromMs: number,
  toMs: number,
  hours: BusinessHours = DEFAULT_HOURS,
): Promise<CalendarWindow> {
  const events = await fetchEvents(cfg, fromMs, toMs);
  return resolveWindow(events, fromMs, toMs, hours);
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
