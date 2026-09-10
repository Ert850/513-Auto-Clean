/**
 * Wall clock to instant, in a named timezone.
 *
 * Via Intl rather than a table of offsets: the platform ships the whole IANA
 * database and keeps it patched, which is strictly better than anything we
 * would maintain by hand. Extracted because the calendar reader and the
 * multi-day scheduler both need it, and a second copy of DST arithmetic is a
 * second chance to get DST wrong.
 */

const DAY_MS = 86_400_000;

/** Offset of a named zone at a given instant, in milliseconds. */
export function zoneOffsetMs(utcMs: number, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(new Date(utcMs));
  const get = (type: string): number => {
    const p = parts.find((x) => x.type === type);
    return p ? Number(p.value) : 0;
  };
  const asIfUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  return asIfUtc - utcMs;
}

/**
 * A wall clock reading in a named zone, as an instant.
 *
 * Two passes settles the DST edges: the first guess uses the offset at the
 * wrong moment, the second uses the offset at the moment the first landed on.
 */
export function zonedToUtc(
  y: number,
  mo: number,
  d: number,
  h: number,
  mi: number,
  s: number,
  timeZone: string,
): number {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  const once = guess - zoneOffsetMs(guess, timeZone);
  return guess - zoneOffsetMs(once, timeZone);
}

/** Year, month and day as they read on a wall calendar in that zone. */
export function localParts(ms: number, timeZone: string): { y: number; mo: number; d: number } {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [y, mo, d] = dtf.format(new Date(ms)).split("-").map(Number);
  return { y: y!, mo: mo!, d: d! };
}

/** Midnight at the start of the local day containing this instant. */
export function localDayStart(ms: number, timeZone: string): number {
  const { y, mo, d } = localParts(ms, timeZone);
  return zonedToUtc(y, mo, d, 0, 0, 0, timeZone);
}

/**
 * A local minute-of-day on the Nth day after a given local day.
 *
 * Going through the calendar date rather than adding 86.4 million
 * milliseconds is what keeps "10am on the following day" at 10am across a
 * daylight saving change, where the day is 23 or 25 hours long.
 */
export function localTimeOnDay(
  dayStartMs: number,
  daysAhead: number,
  minutesOfDay: number,
  timeZone: string,
): number {
  const { y, mo, d } = localParts(dayStartMs + daysAhead * DAY_MS + DAY_MS / 2, timeZone);
  return zonedToUtc(y, mo, d, 0, minutesOfDay, 0, timeZone);
}

/** 0 for Sunday, 6 for Saturday, as read in that zone. */
export function localWeekday(ms: number, timeZone: string): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(new Date(ms));
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(name);
}
