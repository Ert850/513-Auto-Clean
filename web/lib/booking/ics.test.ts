import { describe, expect, it } from "vitest";
import { mergeBusy, parseIcsBusy } from "./ics.js";

/**
 * Fixtures are synthetic. The real feed is a personal calendar and has no
 * business in a repository, so these reproduce its SHAPE instead: folded
 * lines, named timezones, all-day entries, recurrence with exceptions, and
 * single-instance overrides.
 */
const wrap = (body: string) =>
  ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//test//EN", body, "END:VCALENDAR"].join("\r\n");

const ev = (lines: string[]) => ["BEGIN:VEVENT", ...lines, "END:VEVENT"].join("\r\n");

// 2026-09-14 is a Monday.
const MON = Date.UTC(2026, 8, 14);
const WINDOW = { from: Date.UTC(2026, 8, 1), to: Date.UTC(2026, 9, 15) };

const at = (b: { start: number }) =>
  new Date(b.start).toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

describe("ics parsing", () => {
  it("reads a plain event in a named timezone", () => {
    const busy = parseIcsBusy(
      wrap(ev(["UID:a", "DTSTART;TZID=America/New_York:20260914T140000", "DTEND;TZID=America/New_York:20260914T153000"])),
      WINDOW,
    );
    expect(busy).toHaveLength(1);
    expect(at(busy[0]!)).toBe("Sep 14, 2:00 PM");
    expect(busy[0]!.end - busy[0]!.start).toBe(90 * 60000);
  });

  it("reads a UTC event", () => {
    const busy = parseIcsBusy(
      wrap(ev(["UID:b", "DTSTART:20260914T180000Z", "DTEND:20260914T190000Z"])),
      WINDOW,
    );
    // 18:00 UTC in September is 2pm Eastern.
    expect(at(busy[0]!)).toBe("Sep 14, 2:00 PM");
  });

  it("gets daylight saving right on both sides of the change", () => {
    // US clocks go back on 2026-11-01, so the same wall clock is a different
    // instant either side of it. This is the bug that silently offsets a
    // whole calendar by an hour.
    const body = [
      ev(["UID:dst1", "DTSTART;TZID=America/New_York:20261025T090000", "DTEND;TZID=America/New_York:20261025T100000"]),
      ev(["UID:dst2", "DTSTART;TZID=America/New_York:20261108T090000", "DTEND;TZID=America/New_York:20261108T100000"]),
    ].join("\r\n");

    const busy = parseIcsBusy(wrap(body), { from: Date.UTC(2026, 9, 1), to: Date.UTC(2026, 11, 1) });
    expect(busy).toHaveLength(2);
    // EDT is UTC-4, EST is UTC-5, so the second one is an hour later in UTC.
    expect(new Date(busy[0]!.start).getUTCHours()).toBe(13);
    expect(new Date(busy[1]!.start).getUTCHours()).toBe(14);
  });

  it("unfolds wrapped lines instead of reading them as new properties", () => {
    const folded =
      "BEGIN:VEVENT\r\nUID:c\r\nDESCRIPTION:a very long description that Apple\r\n  wrapped onto another line\r\n" +
      "DTSTART;TZID=America/New_York:20260914T090000\r\nDTEND;TZID=America/New_York:20260914T100000\r\nEND:VEVENT";
    const busy = parseIcsBusy(wrap(folded), WINDOW);
    expect(busy).toHaveLength(1);
    expect(at(busy[0]!)).toBe("Sep 14, 9:00 AM");
  });

  it("takes DURATION when there is no DTEND", () => {
    const busy = parseIcsBusy(
      wrap(ev(["UID:d", "DTSTART;TZID=America/New_York:20260914T090000", "DURATION:PT2H30M"])),
      WINDOW,
    );
    expect(busy[0]!.end - busy[0]!.start).toBe(150 * 60000);
  });

  it("ignores all-day events by default and includes them on request", () => {
    const cal = wrap(ev(["UID:e", "DTSTART;VALUE=DATE:20260914", "DTEND;VALUE=DATE:20260915"]));
    expect(parseIcsBusy(cal, WINDOW)).toHaveLength(0);
    expect(parseIcsBusy(cal, { ...WINDOW, includeAllDay: true })).toHaveLength(1);
  });

  it("skips cancelled and free events", () => {
    const body = [
      ev(["UID:f", "STATUS:CANCELLED", "DTSTART:20260914T140000Z", "DTEND:20260914T150000Z"]),
      ev(["UID:g", "TRANSP:TRANSPARENT", "DTSTART:20260914T160000Z", "DTEND:20260914T170000Z"]),
    ].join("\r\n");
    expect(parseIcsBusy(wrap(body), WINDOW)).toHaveLength(0);
  });

  it("expands a weekly rule and honours COUNT", () => {
    const busy = parseIcsBusy(
      wrap(ev([
        "UID:h",
        "DTSTART;TZID=America/New_York:20260914T100000",
        "DTEND;TZID=America/New_York:20260914T110000",
        "RRULE:FREQ=WEEKLY;COUNT=3",
      ])),
      WINDOW,
    );
    expect(busy).toHaveLength(3);
    expect(busy.map(at)).toEqual(["Sep 14, 10:00 AM", "Sep 21, 10:00 AM", "Sep 28, 10:00 AM"]);
  });

  it("expands BYDAY across the week", () => {
    const busy = parseIcsBusy(
      wrap(ev([
        "UID:i",
        "DTSTART;TZID=America/New_York:20260914T100000",
        "DTEND;TZID=America/New_York:20260914T110000",
        "RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=20260921T000000Z",
      ])),
      WINDOW,
    );
    expect(busy.map(at)).toEqual(["Sep 14, 10:00 AM", "Sep 16, 10:00 AM", "Sep 18, 10:00 AM"]);
  });

  it("drops occurrences listed in EXDATE", () => {
    const busy = parseIcsBusy(
      wrap(ev([
        "UID:j",
        "DTSTART;TZID=America/New_York:20260914T100000",
        "DTEND;TZID=America/New_York:20260914T110000",
        "RRULE:FREQ=WEEKLY;COUNT=3",
        "EXDATE;TZID=America/New_York:20260921T100000",
      ])),
      WINDOW,
    );
    expect(busy.map(at)).toEqual(["Sep 14, 10:00 AM", "Sep 28, 10:00 AM"]);
  });

  it("lets a RECURRENCE-ID override replace one occurrence", () => {
    const body = [
      ev([
        "UID:k",
        "DTSTART;TZID=America/New_York:20260914T100000",
        "DTEND;TZID=America/New_York:20260914T110000",
        "RRULE:FREQ=WEEKLY;COUNT=2",
      ]),
      ev([
        "UID:k",
        "RECURRENCE-ID;TZID=America/New_York:20260921T100000",
        "DTSTART;TZID=America/New_York:20260921T150000",
        "DTEND;TZID=America/New_York:20260921T160000",
      ]),
    ].join("\r\n");
    const busy = parseIcsBusy(wrap(body), WINDOW);
    // The 21st moved to the afternoon; the original 10am must not survive.
    expect(busy.map(at)).toEqual(["Sep 14, 10:00 AM", "Sep 21, 3:00 PM"]);
  });

  it("does not mistake a VTIMEZONE rule for an event", () => {
    const body = [
      "BEGIN:VTIMEZONE",
      "TZID:America/New_York",
      "BEGIN:DAYLIGHT",
      "DTSTART:19700308T020000",
      "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
      "TZOFFSETFROM:-0500",
      "TZOFFSETTO:-0400",
      "END:DAYLIGHT",
      "END:VTIMEZONE",
      ev(["UID:l", "DTSTART:20260914T140000Z", "DTEND:20260914T150000Z"]),
    ].join("\r\n");
    // One event, not one event plus a phantom yearly series from 1970.
    expect(parseIcsBusy(wrap(body), WINDOW)).toHaveLength(1);
  });

  it("clips to the requested window", () => {
    const busy = parseIcsBusy(
      wrap(ev(["UID:m", "DTSTART:20260913T220000Z", "DTEND:20260916T020000Z"])),
      { from: MON, to: MON + 86400000 },
    );
    expect(busy[0]!.start).toBe(MON);
    expect(busy[0]!.end).toBe(MON + 86400000);
  });

  it("returns nothing for junk rather than throwing", () => {
    expect(parseIcsBusy("not a calendar", WINDOW)).toEqual([]);
    expect(parseIcsBusy("", WINDOW)).toEqual([]);
    expect(parseIcsBusy(wrap(ev(["UID:n", "DTSTART:garbage"])), WINDOW)).toEqual([]);
  });

  it("caps a runaway rule instead of hanging", () => {
    const busy = parseIcsBusy(
      wrap(ev([
        "UID:o",
        "DTSTART:20200101T090000Z",
        "DTEND:20200101T093000Z",
        "RRULE:FREQ=DAILY",
      ])),
      { from: MON, to: MON + 30 * 86400000, maxOccurrences: 40 },
    );
    expect(busy.length).toBeGreaterThan(0);
    expect(busy.length).toBeLessThanOrEqual(40);
  });
});

describe("merging busy time", () => {
  it("coalesces overlapping and touching intervals", () => {
    expect(mergeBusy([
      { start: 100, end: 200 },
      { start: 150, end: 300 },
      { start: 300, end: 400 },
      { start: 900, end: 1000 },
    ])).toEqual([{ start: 100, end: 400 }, { start: 900, end: 1000 }]);
  });

  it("sorts input it is given out of order", () => {
    expect(mergeBusy([{ start: 500, end: 600 }, { start: 100, end: 200 }])).toEqual([
      { start: 100, end: 200 },
      { start: 500, end: 600 },
    ]);
  });

  it("handles an empty list", () => {
    expect(mergeBusy([])).toEqual([]);
  });
});

describe("time zones the feed might carry", () => {
  const from = Date.parse("2026-09-01T00:00:00Z");
  const to = Date.parse("2026-09-30T00:00:00Z");
  const feed = (tzid: string) =>
    "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:a\r\n" +
    `DTSTART;TZID=${tzid}:20260905T100000\r\nDTEND;TZID=${tzid}:20260905T110000\r\n` +
    "END:VEVENT\r\nBEGIN:VEVENT\r\nUID:b\r\nDTSTART:20260906T140000Z\r\nDTEND:20260906T150000Z\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n";

  it("an Outlook style Windows zone name is mapped, not fatal", () => {
    const busy = parseIcsBusy(feed("Eastern Standard Time"), { from, to, timeZone: "America/New_York" });
    expect(busy).toHaveLength(2);
    // 10am Eastern on 5 September is 14:00Z.
    expect(busy[0]!.start).toBe(Date.parse("2026-09-05T14:00:00Z"));
  });

  it("an unknown zone falls back to the calendar's zone and keeps the other events", () => {
    const busy = parseIcsBusy(feed("Mars/Olympus"), { from, to, timeZone: "America/New_York" });
    expect(busy).toHaveLength(2);
    expect(busy[0]!.start).toBe(Date.parse("2026-09-05T14:00:00Z"));
  });

  it("a zone that looks like a path is not a crash either", () => {
    expect(() => parseIcsBusy(feed("../../etc"), { from, to })).not.toThrow();
  });
});
