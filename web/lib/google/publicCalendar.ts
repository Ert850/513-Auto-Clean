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
  calendarId: string;
  apiKey: string;
  timeZone?: string;
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
  /** Everything treated as unavailable. Empty in whitelist mode. */
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
  const url =
    `${API}/${encodeURIComponent(cfg.calendarId)}/events` +
    `?key=${encodeURIComponent(cfg.apiKey)}` +
    `&timeMin=${new Date(fromMs).toISOString()}` +
    `&timeMax=${new Date(toMs).toISOString()}` +
    // Expands recurrence server side, so we never implement RRULE ourselves.
    `&singleEvents=true&orderBy=startTime&maxResults=2500`;

  const res = await fetch(url);
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
  openMin: 7 * 60, // the site advertises 7 AM to 10 PM, 7 days
  closeMin: 22 * 60,
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
    return {
      mode: "whitelist",
      open: openEvents.map((e) => ({ start: e.start, end: e.end })),
      busy: [],
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
