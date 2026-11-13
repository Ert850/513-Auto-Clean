/**
 * Fee standard B (owner, November 10): the OPEN block a start falls in sets
 * its early or late fee. "OPEN" is standard price, "OPEN +20%" adds 20%,
 * any percentage per block. No OPEN blocks: the clock rule, as before.
 */
import { describe, expect, it } from "vitest";
import { computeSurcharge } from "./surcharge.js";
import { DEFAULT_RULES } from "./rules.js";
import { blockFeeAt, openFeeBp, resolveWindow, type RawEvent } from "../google/publicCalendar.js";
import { zonedToUtc } from "../time/zone.js";

const S = DEFAULT_RULES.surcharge;
const at = (d: number, h: number, m = 0) => zonedToUtc(2026, 11, d, h, m, 0, "America/New_York");
const ev = (summary: string, a: number, b: number): RawEvent => ({ summary, start: a, end: b, allDay: false, transparent: false });

describe("the fee in an OPEN block's title", () => {
  it("reads the percentage", () => {
    expect(openFeeBp("OPEN")).toBe(0);
    expect(openFeeBp("OPEN +20%")).toBe(2000);
    expect(openFeeBp("Open +35 %")).toBe(3500);
    expect(openFeeBp("OPEN +12.5%")).toBe(1250);
    expect(openFeeBp("OPEN evenings")).toBe(0);
  });

  it("each start takes its own block's fee", () => {
    const win = resolveWindow([ev("OPEN +20%", at(15, 8), at(15, 10)), ev("OPEN", at(15, 10), at(15, 18)), ev("OPEN +25%", at(15, 18), at(16, 0))], at(15, 0), at(16, 0));
    expect(blockFeeAt(win, at(15, 9))).toBe(2000);
    expect(blockFeeAt(win, at(15, 10))).toBe(0);
    expect(blockFeeAt(win, at(15, 17, 30))).toBe(0);
    expect(blockFeeAt(win, at(15, 18))).toBe(2500);
  });

  it("no OPEN blocks means the clock rule", () => {
    const win = resolveWindow([ev("Dentist", at(15, 12), at(15, 13))], at(15, 0), at(16, 0));
    expect(blockFeeAt(win, at(15, 19))).toBeNull();
  });
});

describe("the surcharge with a calendar fee", () => {
  const ctx = (h: number, rush: boolean, blockFeeBp?: number | null) =>
    computeSurcharge({ startMinutesLocal: h * 60, priorityBooking: rush, blockFeeBp }, S).appliedBp;

  it("replaces the clock: a 6pm standard block is free, a 2pm +20% block is not", () => {
    expect(ctx(18, false, 0)).toBe(0);
    expect(ctx(14, false, 2000)).toBe(2000);
  });
  it("keeps the 30% cap with a rush, unless the block alone asks for more", () => {
    expect(ctx(19, true, 2000)).toBe(3000);
    expect(ctx(19, true, 2500)).toBe(3000);
    expect(ctx(19, true, 4000)).toBe(4000);
    expect(ctx(19, true, 0)).toBe(2000);
  });
  it("null is the clock rule, unchanged", () => {
    expect(ctx(19, false, null)).toBe(2000);
    expect(ctx(12, false, null)).toBe(0);
    expect(ctx(7, true, undefined)).toBe(3000);
  });
});

describe("fee blocks over a plain OPEN day (live-safe layout, November 11)", () => {
  it("the higher fee wins where blocks overlap", () => {
    const win = resolveWindow([
      ev("OPEN", at(16, 6), at(17, 0)),
      { ...ev("OPEN +20%", at(16, 6), at(16, 10)), transparent: true },
      { ...ev("OPEN +20%", at(16, 18), at(17, 0)), transparent: true },
    ], at(16, 0), at(17, 0));
    expect(blockFeeAt(win, at(16, 7))).toBe(2000);
    expect(blockFeeAt(win, at(16, 10))).toBe(0);
    expect(blockFeeAt(win, at(16, 18))).toBe(2000);
  });
});
