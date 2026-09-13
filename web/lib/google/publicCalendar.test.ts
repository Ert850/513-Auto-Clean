/**
 * Reading availability off a public Google Calendar.
 *
 * This file exists because of one bug, and the bug could have sold the same
 * hour twice. `resolveWindow` returned `busy: []` in whitelist mode, on the
 * theory that an OPEN block is a positive statement about when work can
 * happen and everything else on that calendar is the owner's own business.
 *
 * Then the real calendar turned up: ten events titled "Open" AND a booked
 * "Full Interior" at 4pm, on the same calendar, because that is the obvious
 * way to use one. The job did not block. Nothing in the suite noticed,
 * because nothing in the suite had ever looked at this function.
 */
import { describe, expect, it } from "vitest";
import { calendarIds, resolveWindow, type RawEvent } from "./publicCalendar.js";

const DAY = 24 * 60 * 60 * 1000;
const from = Date.UTC(2026, 8, 14, 4, 0, 0); // 14 Sept 2026, local midnight
const to = from + 3 * DAY;

const at = (dayOffset: number, hour: number, hours: number): [number, number] => {
  const start = from + dayOffset * DAY + hour * 3600_000;
  return [start, start + hours * 3600_000];
};

const ev = (
  summary: string,
  span: [number, number],
  extra: Partial<RawEvent> = {},
): RawEvent => ({
  summary,
  start: span[0],
  end: span[1],
  allDay: false,
  transparent: false,
  ...extra,
});

describe("which calendars get read", () => {
  it("takes the primary and the extras, and drops blanks and repeats", () => {
    expect(calendarIds({ calendarId: "a", extraCalendarIds: ["b", "", "a", "  "] })).toEqual([
      "a",
      "b",
    ]);
  });

  it("survives a config with nothing in it", () => {
    expect(calendarIds({})).toEqual([]);
    expect(calendarIds({ calendarId: "", extraCalendarIds: [] })).toEqual([]);
  });
});

describe("whitelist mode, when OPEN blocks exist", () => {
  it("offers the OPEN blocks", () => {
    const w = resolveWindow([ev("Open", at(0, 6, 12))], from, to);
    expect(w.mode).toBe("whitelist");
    expect(w.open).toHaveLength(1);
  });

  it("BLOCKS a booked job sitting on the same calendar", () => {
    // The real shape of Elijah's calendar on 13 September 2026.
    const w = resolveWindow(
      [ev("Open", at(0, 6, 12)), ev("Full Interior", at(0, 16, 3))],
      from,
      to,
    );

    expect(w.mode).toBe("whitelist");
    expect(w.open, "the OPEN block is still the bookable window").toHaveLength(1);
    expect(w.busy, "the booked detail has to close its hours").toHaveLength(1);
    expect(w.busy[0]).toEqual({ start: at(0, 16, 3)[0], end: at(0, 16, 3)[1] });
  });

  it("lets an event opt out by being marked Free, not by being renamed", () => {
    // "CAREER FAIR", marked Free in Google Calendar. The Busy/Free setting is
    // a control Elijah already uses, in the app he already has open; a rule
    // about title prefixes is one more thing to remember at 11pm.
    const w = resolveWindow(
      [
        ev("Open", at(0, 6, 12)),
        ev("CAREER FAIR", at(0, 9, 6), { transparent: true }),
        ev("Full Interior", at(0, 16, 3)),
      ],
      from,
      to,
    );
    expect(w.busy, "only the job blocks, not the thing marked Free").toHaveLength(1);
  });

  it("counts an OPEN block however it is capitalised", () => {
    for (const title of ["OPEN", "Open", "open 9 to 6", "OPEN BOOKINGS"]) {
      expect(resolveWindow([ev(title, at(0, 6, 12))], from, to).mode).toBe("whitelist");
    }
    // But not something that merely mentions it.
    expect(resolveWindow([ev("Shop is open", at(0, 6, 12))], from, to).mode).toBe("blacklist");
  });
});

describe("blacklist mode, when nobody has written an OPEN block", () => {
  it("falls back to business hours minus everything on the calendar", () => {
    const w = resolveWindow([ev("Full Interior", at(0, 16, 3))], from, to);
    expect(w.mode).toBe("blacklist");
    expect(w.open.length, "business hours still get offered").toBeGreaterThan(0);
    expect(w.busy, "and the job still blocks").toHaveLength(1);
  });

  it("still ignores anything marked Free", () => {
    const w = resolveWindow([ev("Birthday", at(0, 9, 2), { transparent: true })], from, to);
    expect(w.busy).toHaveLength(0);
  });
});
