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
 * WHAT THIS RETURNS: busy intervals. Nothing else. Not a title, not a
 * location, not a name. And even those are blurred before they leave:
 *
 *   - rounded OUTWARD to the half hour, so a 2:10 to 2:50 appointment reads
 *     as 2:00 to 3:00. The funnel books in half-hour steps anyway;
 *   - merged, so back-to-back entries become one block;
 *   - cut to the booking horizon.
 *
 * The funnel only needs to know that Thursday afternoon is spoken for. A
 * stranger reading this endpoint learns that too, and nothing finer. The
 * proper fix, computing availability entirely on the server and returning
 * bookable starts, is on the roadmap; this is the largest reduction that
 * does not change the funnel.
 */
import { mergeBusy, parseIcsBusy } from "./_pricing.mjs";
import { limited } from "./_ratelimit.mjs";

const CACHE_SECONDS = 600;
const WINDOW_DAYS = 120;
const GRAIN_MS = 30 * 60_000;

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

export function coarsen(busy, grainMs = GRAIN_MS) {
  const rounded = busy
    .filter((b) => Number.isFinite(b.start) && Number.isFinite(b.end) && b.end > b.start)
    .map((b) => ({
      start: Math.floor(b.start / grainMs) * grainMs,
      end: Math.ceil(b.end / grainMs) * grainMs,
    }));
  return mergeBusy(rounded);
}

export async function handler(event) {
  if (limited(event, "personal-busy", 20)) return json(429, { error: "slow_down" }, false);

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

    const busy = coarsen(
      parseIcsBusy(text, {
        from: now,
        to: now + WINDOW_DAYS * 86400000,
        timeZone: "America/New_York",
        // All-day entries are birthdays and holidays far more often than they
        // are "I am unavailable". Closing whole days on that guess would cost
        // bookings silently. See ics.ts.
        includeAllDay: false,
      }),
    );

    const body = { busy, count: busy.length, windowDays: WINDOW_DAYS, grainMinutes: GRAIN_MS / 60_000, fetchedAt: now };
    cache = { at: now, body };
    return json(200, body, true);
  } catch {
    return json(502, { error: "feed_error" }, false);
  }
}
