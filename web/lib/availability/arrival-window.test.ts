/**
 * A start time is an arrival window (owner, November 11): "6pm" means we
 * arrive between 6 and 7pm, so the drive may use that hour, after an OPEN
 * block begins or after a previous job ends.
 */
import { describe, expect, it } from "vitest";
import { zonedToUtc } from "../time/zone.js";
import { ARRIVAL_WINDOW_MIN, computeSlots, localMinutesOfDay } from "./slots.js";
import { parseDetailers } from "./crew.js";

const TZ = "America/New_York";
const at = (d: number, h: number, m = 0) => zonedToUtc(2026, 11, d, h, m, 0, TZ);
const hours = (list: number[]) => list.map((ms) => localMinutesOfDay(ms, TZ) / 60);
const base = { serviceDurationMin: 120, travelBeforeMin: 60, travelAfterMin: 60, granularityMin: 30,
  notBefore: at(17, 0), notAfter: at(18, 0), hasExterior: false, ignoreReturnAfterMin: 1080, ignoreOutboundBeforeMin: 600 };

describe("the drive may use the arrival hour", () => {
  it("Kris, OPEN 6pm to midnight: 6pm is offered with the window, not without", () => {
    const open = [{ start: at(17, 18), end: at(18, 0) }];
    expect(hours(computeSlots({ ...base, openBlocks: open, busy: [], arrivalWindowMin: 60 }))[0]).toBe(18);
    expect(hours(computeSlots({ ...base, openBlocks: open, busy: [] }))[0]).toBe(19);
  });

  it("after a previous job too: free at 2pm, 2pm is offered", () => {
    const open = [{ start: at(17, 8), end: at(17, 23) }];
    const busy = [{ start: at(17, 10), end: at(17, 14) }];
    const got = hours(computeSlots({ ...base, openBlocks: open, busy, arrivalWindowMin: 60 }));
    expect(got).toContain(14);
  });

  it("plans the job from the late arrival: a start that would end past midnight is not offered", () => {
    // OPEN from 9:30pm: a 10pm start arrives 10:30pm, a 2 hour job ends 12:30am.
    const open = [{ start: at(17, 21, 30), end: at(18, 2) }];
    const got = hours(computeSlots({ ...base, openBlocks: open, busy: [], arrivalWindowMin: 60 }));
    expect(got).not.toContain(22);
  });

  it("a drive longer than the window still has to fit before it", () => {
    const open = [{ start: at(17, 18), end: at(18, 0) }];
    const got = hours(computeSlots({ ...base, travelBeforeMin: 90, travelAfterMin: 90, openBlocks: open, busy: [], arrivalWindowMin: 60 }));
    expect(got[0]).toBe(18.5);
  });
});

describe("the arrival window is set per detailer", () => {
  const KRIS = { name: "Kris", does: "interior", availability: "a@group.calendar.google.com", bookings: "b@group.calendar.google.com" };
  it("60 minutes when left out, any whole minutes 0 to 120 when set", () => {
    expect(parseDetailers(JSON.stringify([KRIS])).crew[0]!.arrivalWindowMin).toBe(ARRIVAL_WINDOW_MIN);
    expect(parseDetailers(JSON.stringify([{ ...KRIS, arrivalWindow: 30 }])).crew[0]!.arrivalWindowMin).toBe(30);
    const bad = parseDetailers(JSON.stringify([{ ...KRIS, arrivalWindow: "soon" }]));
    expect(bad.crew[0]!.arrivalWindowMin).toBe(60);
    expect(bad.problems[0]).toMatch(/arrivalWindow/);
  });
});

describe("touching OPEN blocks are one working stretch (live-site check, November 11)", () => {
  it("a price split at 10am is not the start of a day: no 10am start straight after a job ending at 10", () => {
    const split = [{ start: at(21, 6), end: at(21, 10) }, { start: at(21, 10), end: at(21, 18) }, { start: at(21, 18), end: at(22, 0) }];
    const busy = [{ start: at(21, 8), end: at(21, 10) }];
    const got = hours(computeSlots({ ...base, notBefore: at(21, 0), notAfter: at(22, 0), openBlocks: split, busy }));
    const single = hours(computeSlots({ ...base, notBefore: at(21, 0), notAfter: at(22, 0), openBlocks: [{ start: at(21, 6), end: at(22, 0) }], busy }));
    expect(got).toEqual(single);
    expect(got).not.toContain(10);
  });
});
