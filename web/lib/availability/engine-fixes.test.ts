/**
 * Bugs found by the engine check on November 10, one test each, so none of
 * them comes back quietly.
 */
import { describe, expect, it } from "vitest";
import { zonedToUtc } from "../time/zone.js";
import { computeSlots, localMinutesOfDay } from "./slots.js";
import { recommendBestDays } from "./week.js";
import { weatherVerdict } from "./weather.js";
import { eventTime, resolveWindow, titleIs, parsePriority, type RawEvent } from "../google/publicCalendar.js";
import { wireNeeds } from "../server-entry.js";

const TZ = "America/New_York";
const at = (d: number, h: number, m = 0) => zonedToUtc(2026, 11, d, h, m, 0, TZ);
const H = 3_600_000;

describe("all-day events are Cincinnati days, not UTC days", () => {
  it("a bare date is local midnight", () => {
    expect(eventTime("2026-11-20")).toBe(at(20, 0));
    expect(eventTime("2026-07-04")).toBe(zonedToUtc(2026, 7, 4, 0, 0, 0, TZ));
    expect(eventTime("2026-11-20T18:00:00-05:00")).toBe(at(20, 18));
  });

  it("an all-day Vacation blocks its own evening and leaves the evening before", () => {
    const ev: RawEvent = { summary: "Vacation", start: eventTime("2026-11-20"), end: eventTime("2026-11-21"), allDay: true, transparent: false };
    // Open around the clock, so only the Vacation decides (OPEN is needed for
    // anything to be bookable since November 11).
    const open: RawEvent = { summary: "OPEN", start: at(19, 0), end: at(22, 0), allDay: false, transparent: false };
    const win = resolveWindow([open, ev], at(19, 0), at(22, 0));
    const slots = computeSlots({ openBlocks: win.open, busy: win.busy, serviceDurationMin: 120, travelBeforeMin: 60, travelAfterMin: 60,
      granularityMin: 30, notBefore: at(19, 0), notAfter: at(22, 0), hasExterior: false, ignoreReturnAfterMin: 1080, ignoreOutboundBeforeMin: 600 });
    expect(slots.some((s) => s >= at(20, 0) && s < at(21, 0)), "nothing on the 20th").toBe(false);
    expect(slots).toContain(at(19, 19));
  });
});

describe("OPEN and BEST are whole words", () => {
  it("reads the keyword, not a word that starts with it", () => {
    expect(titleIs("OPEN", "OPEN")).toBe(true);
    expect(titleIs("Open hours", "OPEN")).toBe(true);
    expect(titleIs("BEST evening", "BEST")).toBe(true);
    expect(titleIs("Opening night", "OPEN")).toBe(false);
    expect(titleIs("Bestie's wedding", "BEST")).toBe(false);
  });
  it("a Bestie's wedding blocks like any other event", () => {
    const win = resolveWindow([{ summary: "Bestie's wedding", start: at(17, 12), end: at(17, 16), allDay: false, transparent: false }], at(17, 0), at(18, 0));
    expect(win.best ?? []).toEqual([]);
    expect(win.busy.length).toBe(1);
  });
  it("reads any Priority number", () => {
    expect(parsePriority("Priority: 1000")).toBe(1000);
  });
});

describe("the drive home from 6pm", () => {
  const base = { serviceDurationMin: 120, travelBeforeMin: 60, travelAfterMin: 60, granularityMin: 30,
    notBefore: at(17, 0), notAfter: at(18, 0), hasExterior: false, ignoreReturnAfterMin: 1080, ignoreOutboundBeforeMin: 600 };
  it("a block ending 8pm still offers 6pm (the scan used to stop at 5:30)", () => {
    const slots = computeSlots({ ...base, openBlocks: [{ start: at(17, 10), end: at(17, 20) }], busy: [] });
    expect(slots).toContain(at(17, 18));
  });
  it("is not ignored when a job follows: no start that leaves no drive to a 9pm job", () => {
    const slots = computeSlots({ ...base, openBlocks: [{ start: at(17, 5), end: at(18, 1) }], busy: [{ start: at(17, 21), end: at(17, 23) }] });
    const evening = slots.filter((s) => s >= at(17, 17) && s < at(17, 21)).map((s) => localMinutesOfDay(s, TZ) / 60);
    // 2 hours of work plus a 60 minute drive must end by 9pm: 6pm at the latest.
    expect(Math.max(...evening)).toBe(18);
  });
});

describe("recommended times prefer no fee over priority", () => {
  it("Elijah's fee-free 10am leads a day where Kris's best time carries the late fee", () => {
    const kris = { id: "kris", starts: [at(16, 17), at(16, 18), at(16, 19)], best: [at(16, 18)] };
    const elijah = { id: "elijah", starts: [at(16, 10), at(16, 16)], best: [at(16, 10), at(16, 16)] };
    const premium = (ms: number) => localMinutesOfDay(ms, TZ) >= 18 * 60;
    const picks = recommendBestDays({ members: [kris, elijah], travelGapMin: 60, isRush: () => false, nowMs: at(13, 9), isPremium: premium });
    const mon = picks.find((p) => p.dayStart === at(16, 0))!;
    expect(mon.ms).toBe(at(16, 10));
    expect(mon.who).toBe("elijah");
  });
});

describe("heat is checked in the job's own hours", () => {
  it("overcast during a 10am job passes, even when the hot span runs on into a clear evening", () => {
    const forecast = {
      tempF: [{ start: at(17, 10), end: at(17, 18), value: 101 }],
      rainMm: [],
      skyCover: [{ start: at(17, 10), end: at(17, 16), value: 90 }, { start: at(17, 16), end: at(17, 18), value: 5 }],
      until: at(17, 22),
    };
    expect(weatherVerdict({ startMs: at(17, 10), durationMin: 120, kind: "exterior", forecast, covered: false })).toEqual({ ok: true });
    expect(weatherVerdict({ startMs: at(17, 15), durationMin: 120, kind: "exterior", forecast, covered: false }).ok).toBe(false);
  });
});

describe("the server works out what a cart needs", () => {
  it("as the booking form does", () => {
    expect(wireNeeds({ vehicles: [{ packageIds: ["full-exterior"], addons: [] }] } as never)).toEqual(["exterior"]);
    expect(wireNeeds({ vehicles: [{ packageIds: ["basic-interior"], addons: [] }] } as never)).toEqual(["interior"]);
  });
});
