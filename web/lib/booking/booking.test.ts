import { describe, expect, it } from "vitest";
import { blockedReason, displaceableBookings, evaluateSlot } from "./provisional.js";
import {
  computeSlots,
  matchWindows,
  mergeIntervals,
  subtractIntervals,
  type Interval,
} from "../availability/slots.js";

const MIN = 60_000;
const at = (h: number, m = 0, day = 1) => new Date(2026, 8, day, h, m).getTime();
const iv = (a: number, b: number): Interval => ({ start: a, end: b });

describe("provisional slots", () => {
  const base = { depositPaidCents: 0, hoursUntilStart: 200, displacedByDeposit: false };

  it("locks the slot as soon as a deposit is paid", () => {
    const v = evaluateSlot({ ...base, depositPaidCents: 9750 });
    expect(v.standing).toBe("confirmed_by_deposit");
    expect(v.locked).toBe(true);
    expect(v.displaceable).toBe(false);
  });

  it("leaves an undeposited booking takeable", () => {
    const v = evaluateSlot(base);
    expect(v.standing).toBe("provisional");
    expect(v.displaceable).toBe(true);
    expect(v.locked).toBe(false);
  });

  it("firms up on its own inside 48 hours", () => {
    expect(evaluateSlot({ ...base, hoursUntilStart: 49 }).standing).toBe("provisional");
    expect(evaluateSlot({ ...base, hoursUntilStart: 48 }).standing).toBe("confirmed_by_time");
    expect(evaluateSlot({ ...base, hoursUntilStart: 12 }).locked).toBe(true);
  });

  it("reports a displaced booking clearly", () => {
    const v = evaluateSlot({ ...base, displacedByDeposit: true });
    expect(v.standing).toBe("displaced");
    expect(v.locked).toBe(false);
  });

  it("only offers up genuinely displaceable bookings", () => {
    const rows = [
      { id: "paid", ...base, depositPaidCents: 5000 },
      { id: "firm", ...base, hoursUntilStart: 10 },
      { id: "takeable", ...base },
    ];
    expect(displaceableBookings(rows).map((r) => r.id)).toEqual(["takeable"]);
  });

  it("blocks anyone from taking a paid slot, deposit or not", () => {
    const paid = [{ ...base, depositPaidCents: 5000 }];
    expect(blockedReason(9750, paid)).toMatch(/already been reserved/);
    expect(blockedReason(0, paid)).toMatch(/already been reserved/);
  });

  it("lets a deposit take a provisional slot, but not another no-deposit booking", () => {
    const held = [base];
    expect(blockedReason(9750, held)).toBe(null); // deposit wins it
    expect(blockedReason(0, held)).toMatch(/Place a deposit/);
  });
});

describe("interval maths", () => {
  it("merges overlapping and touching blocks", () => {
    const m = mergeIntervals([iv(at(9), at(11)), iv(at(10), at(12)), iv(at(12), at(13))]);
    expect(m).toHaveLength(1);
    expect(m[0]).toEqual(iv(at(9), at(13)));
  });

  it("subtracts a busy block from the middle, leaving two", () => {
    const free = subtractIntervals([iv(at(9), at(17))], [iv(at(12), at(13))]);
    expect(free).toEqual([iv(at(9), at(12)), iv(at(13), at(17))]);
  });

  it("removes a fully covered block", () => {
    expect(subtractIntervals([iv(at(9), at(11))], [iv(at(8), at(12))])).toEqual([]);
  });
});

describe("slot fitting", () => {
  const req = {
    openBlocks: [iv(at(9), at(17))],
    busy: [],
    serviceDurationMin: 240, // 4 hours
    travelBeforeMin: 30,
    travelAfterMin: 30,
    granularityMin: 30,
    notBefore: at(0),
    notAfter: at(23),
  };

  it("requires the whole commitment to fit, travel included", () => {
    // 9am to 5pm open, 4hr job + 1hr travel = 5hr commitment.
    // Earliest customer-facing start is 9:30 (drive out fits from 9:00),
    // latest is 12:30 (finishes 16:30, drive back ends 17:00).
    const slots = computeSlots(req);
    expect(slots[0]).toBe(at(9, 30));
    expect(slots[slots.length - 1]).toBe(at(12, 30));
  });

  it("offers fewer slots when the drive is longer", () => {
    const near = computeSlots({ ...req, travelBeforeMin: 5, travelAfterMin: 5 });
    const far = computeSlots({ ...req, travelBeforeMin: 60, travelAfterMin: 60 });
    expect(far.length).toBeLessThan(near.length);
  });

  it("returns nothing when the job cannot fit at all", () => {
    expect(computeSlots({ ...req, serviceDurationMin: 600 })).toEqual([]);
  });

  it("respects an existing booking, buffers and all", () => {
    const slots = computeSlots({ ...req, busy: [iv(at(11), at(15))] });
    // Only the 9:00 to 11:00 gap remains, too small for a 5 hour commitment.
    expect(slots).toEqual([]);
  });

  it("never starts before notBefore", () => {
    const slots = computeSlots({ ...req, notBefore: at(11) });
    expect(Math.min(...slots)).toBeGreaterThanOrEqual(at(11));
  });
});

describe("preferred time windows", () => {
  it("splits candidate slots into preferred and everything else", () => {
    const slots = [at(7), at(11), at(13), at(19)];
    const { inPreferred, outsidePreferred } = matchWindows(slots, ["morning", "afternoon"]);
    expect(inPreferred).toEqual([at(11), at(13)]);
    expect(outsidePreferred).toEqual([at(7), at(19)]);
  });

  it("treats early and late as their own windows", () => {
    const { inPreferred } = matchWindows([at(7), at(12), at(19)], ["early", "late"]);
    expect(inPreferred).toEqual([at(7), at(19)]);
  });
});
