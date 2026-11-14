/**
 * The scheduling numbers, from config/scheduling.json (calendar fix 5,
 * November 14). Both the browser bundle and the booking functions read this
 * file, so the form and the server cannot disagree. Checked on load: a bad
 * value throws, which fails the build and the tests.
 */
import raw from "../../../config/scheduling.json" with { type: "json" };

export interface Scheduling {
  minNoticeMinutes: number;
  shortNoticeHours: number;
  arrivalWindowMinutes: number;
  driveFallbackMinutes: number;
  correctionWeekdays: number[];
  bookAheadDays: number;
  acceptAheadDays: number;
}

export function checkScheduling(input: unknown): Scheduling {
  const o = (input ?? {}) as Record<string, unknown>;
  const bad = (field: string, what: string): never => {
    throw new Error(`config/scheduling.json: ${field}: ${what}`);
  };
  const whole = (field: string, min: number, max: number): number => {
    const v = o[field];
    return typeof v === "number" && Number.isInteger(v) && v >= min && v <= max
      ? v
      : bad(field, `must be a whole number from ${min} to ${max}`);
  };
  const days = o["correctionWeekdays"];
  if (!Array.isArray(days) || !days.length || days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
    bad("correctionWeekdays", "must be a list of days, 0 Sunday to 6 Saturday");
  }
  const s: Scheduling = {
    minNoticeMinutes: whole("minNoticeMinutes", 0, 7 * 24 * 60),
    shortNoticeHours: whole("shortNoticeHours", 0, 14 * 24),
    arrivalWindowMinutes: whole("arrivalWindowMinutes", 0, 240),
    driveFallbackMinutes: whole("driveFallbackMinutes", 0, 240),
    correctionWeekdays: [...new Set(days as number[])].sort(),
    bookAheadDays: whole("bookAheadDays", 1, 730),
    acceptAheadDays: whole("acceptAheadDays", 1, 800),
  };
  if (s.acceptAheadDays < s.bookAheadDays) bad("acceptAheadDays", "must be at least bookAheadDays, or the server refuses times the form offers");
  return s;
}

export const SCHEDULING: Scheduling = checkScheduling(raw);
