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
import { afterEach, describe, expect, it, vi } from "vitest";
import { busyOnlyIds, businessHoursWindows, calendarIds, loadWindow, parsePriority, resolveWindow, type RawEvent } from "./publicCalendar.js";
import { localMinutesOfDay } from "../availability/slots.js";
import { zonedToUtc } from "../time/zone.js";

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

describe("best start times and priority, set in Google Calendar (November 10)", () => {
  it("collects BEST starts, and a BEST event never blocks, Busy or Free", () => {
    const w = resolveWindow(
      [ev("OPEN", at(0, 6, 16)), ev("BEST", at(0, 18, 0.25)), ev("Best evening", at(1, 18, 0.25), { transparent: true }), ev("Full Interior", at(0, 10, 2))],
      from, to,
    );
    expect(w.best).toEqual([at(0, 18, 0)[0], at(1, 18, 0)[0]]);
    expect(w.busy, "only the job blocks").toEqual([{ start: at(0, 10, 2)[0], end: at(0, 10, 2)[1] }]);
  });

  it("an OPEN block set to Free still counts as open hours", () => {
    const w = resolveWindow([ev("OPEN", at(0, 18, 6), { transparent: true }), ev("Job", at(0, 19, 2))], from, to);
    expect(w.mode).toBe("whitelist");
    expect(w.open).toEqual([{ start: at(0, 18, 6)[0], end: at(0, 18, 6)[1] }]);
    expect(w.busy).toEqual([{ start: at(0, 19, 2)[0], end: at(0, 19, 2)[1] }]);
  });

  it("keeps BEST times and busy events when there are no OPEN blocks", () => {
    const w = resolveWindow([ev("BEST", at(0, 10, 0.25)), ev("Dentist", at(0, 14, 1))], from, to);
    expect(w.mode).toBe("noOpen");
    expect(w.best).toEqual([at(0, 10, 0)[0]]);
    expect(w.busy).toHaveLength(1);
  });

  it("reads 'Priority: 1' from a calendar description, however it is written", () => {
    expect(parsePriority("Priority: 1")).toBe(1);
    expect(parsePriority("Kris's hours.\npriority 2")).toBe(2);
    expect(parsePriority("PRIORITY=3")).toBe(3);
    expect(parsePriority("")).toBeNull();
    expect(parsePriority(undefined)).toBeNull();
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
    expect(resolveWindow([ev("Shop is open", at(0, 6, 12))], from, to).mode).toBe("noOpen");
  });
});

describe("no OPEN block in the window (owner, November 11: no OPEN, no booking)", () => {
  it("offers nothing, where it used to offer 5am to 1am minus the calendar", () => {
    // A detailer who deleted their OPEN events for a holiday was offered every
    // hour of it. Now: if it doesn't say open, it can't be booked.
    const w = resolveWindow([ev("Full Interior", at(0, 16, 3))], from, to);
    expect(w.mode).toBe("noOpen");
    expect(w.open, "nothing bookable").toEqual([]);
    expect(w.busy, "the job is still read").toHaveLength(1);
  });

  it("still ignores anything marked Free", () => {
    const w = resolveWindow([ev("Birthday", at(0, 9, 2), { transparent: true })], from, to);
    expect(w.busy).toHaveLength(0);
  });
});

describe("businessHoursWindows (the fallback with no calendar key)", () => {
  it("opens at 5am and closes at 1am in Cincinnati, whatever the visitor's clock", () => {
    // Run under TZ=Europe/Paris this used to open at 11pm and close at 7pm
    // Cincinnati time, so the week grid stopped at 5pm (November 10).
    const from = zonedToUtc(2026, 11, 17, 0, 0, 0, "America/New_York");
    const to = zonedToUtc(2026, 11, 19, 0, 0, 0, "America/New_York");
    const w = businessHoursWindows(from, to);
    expect(w).toHaveLength(2);
    expect(localMinutesOfDay(w[0]!.start)).toBe(5 * 60);
    expect(localMinutesOfDay(w[0]!.end)).toBe(60);
    expect(w[0]!.end - w[0]!.start).toBe(20 * 3_600_000);
  });
});

describe("jobs calendars read busy-only (free/busy, no titles)", () => {
  afterEach(() => vi.unstubAllGlobals());
  const from = Date.parse("2026-11-17T05:00:00Z");
  const to = Date.parse("2026-11-18T05:00:00Z");
  const cfg = { calendarId: "open@x", extraCalendarIds: ["jobs@x"], busyOnlyIds: ["jobs@x"], apiKey: "k" };

  it("never reads a busy-only calendar's events", () => {
    expect(calendarIds(cfg)).toEqual(["open@x"]);
    expect(busyOnlyIds(cfg)).toEqual(["jobs@x"]);
  });

  it("counts its busy time against the OPEN blocks", async () => {
    const urls: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      urls.push(String(url));
      if (String(url).includes("/freeBusy")) {
        return new Response(JSON.stringify({ calendars: { "jobs@x": { busy: [
          { start: "2026-11-17T15:00:00Z", end: "2026-11-17T17:00:00Z" },
        ] } } }));
      }
      return new Response(JSON.stringify({ items: [
        { summary: "OPEN", start: { dateTime: "2026-11-17T11:00:00Z" }, end: { dateTime: "2026-11-18T03:00:00Z" } },
      ] }));
    });
    const w = await loadWindow(cfg, from, to);
    expect(w.mode).toBe("whitelist");
    expect(w.busy).toEqual([{ start: Date.parse("2026-11-17T15:00:00Z"), end: Date.parse("2026-11-17T17:00:00Z") }]);
    expect(urls.some((u) => u.includes(encodeURIComponent("jobs@x") + "/events")), "no event list for the jobs calendar").toBe(false);
  });

  it("refuses to guess when the jobs calendar cannot be read", async () => {
    vi.stubGlobal("fetch", async (url: string) =>
      String(url).includes("/freeBusy")
        ? new Response(JSON.stringify({ calendars: { "jobs@x": { errors: [{ reason: "notFound" }] } } }))
        : new Response(JSON.stringify({ items: [] })));
    await expect(loadWindow(cfg, from, to)).rejects.toThrow(/unreadable/);
  });
});
