/**
 * Elijah's personal calendar, as a conflict source for the booking funnel.
 *
 * Runs server side for two reasons, and both matter.
 *
 * 1. iCloud sends no CORS headers, so a browser cannot read the feed at all.
 * 2. The published URL is a bearer token in disguise. Anyone holding it can
 *    read the whole calendar: titles, locations, attendees, everything. It
 *    lives in an environment variable and never reaches the page.
 *
 * WHAT THIS RETURNS: start and end times. Nothing else. Not a title, not a
 * location, not a name. The funnel only needs to know that 2pm on Thursday is
 * spoken for, and it cannot leak what it was never sent.
 */
import { parseIcsBusy } from "./_pricing.mjs";

const CACHE_SECONDS = 600;
const WINDOW_DAYS = 120;

const json = (status, body, cacheable) => ({
  statusCode: status,
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": cacheable
      ? `public, max-age=${CACHE_SECONDS}, stale-while-revalidate=3600`
      : "no-store",
  },
  body: JSON.stringify(body),
});

/** Warm containers reuse the parse rather than refetching 400KB per visitor. */
let cache = null;

export async function handler() {
  const raw = process.env.PERSONAL_CALENDAR_ICS;
  if (!raw) return json(503, { error: "unconfigured" }, false);

  // webcal:// is just https:// wearing a hat, so accept either.
  const url = raw.replace(/^webcal:\/\//i, "https://");

  const now = Date.now();
  if (cache && now - cache.at < CACHE_SECONDS * 1000) {
    return json(200, cache.body, true);
  }

  try {
    const res = await fetch(url, {
      headers: { Accept: "text/calendar" },
      redirect: "follow",
    });
    if (!res.ok) return json(502, { error: "feed_failed", status: res.status }, false);

    const text = await res.text();
    if (!text.includes("BEGIN:VCALENDAR")) {
      return json(502, { error: "not_a_calendar" }, false);
    }

    const busy = parseIcsBusy(text, {
      from: now,
      to: now + WINDOW_DAYS * 86400000,
      timeZone: "America/New_York",
      // All-day entries are birthdays and holidays far more often than they
      // are "I am unavailable". Closing whole days on that guess would cost
      // bookings silently. See ics.ts.
      includeAllDay: false,
    });

    const body = { busy, count: busy.length, windowDays: WINDOW_DAYS, fetchedAt: now };
    cache = { at: now, body };
    return json(200, body, true);
  } catch (err) {
    return json(502, { error: "feed_error" }, false);
  }
}
