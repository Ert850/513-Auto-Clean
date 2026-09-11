import { describe, expect, it } from "vitest";
import { cancellationLadder, computeCancellation, rescheduleFeeCents } from "./cancellation.js";
import { DEFAULT_RULES as R } from "./rules.js";

const BOOKING = 24_500; // $245, a Full Exterior

const at = (hoursUntilStart: number, over: Partial<Parameters<typeof computeCancellation>[0]> = {}) =>
  computeCancellation({ totalCents: BOOKING, hoursUntilStart, ...over }, R);

describe("the cancellation ladder", () => {
  it("charges nothing at 72 hours or more", () => {
    expect(at(100).feeCents).toBe(0);
    expect(at(72).feeCents).toBe(0);
    expect(at(72).bucket).toBe("gte72h");
  });

  it("charges half between 24 and 72 hours", () => {
    expect(at(71).feeCents).toBe(BOOKING / 2);
    expect(at(24).feeCents).toBe(BOOKING / 2);
    expect(at(48).bucket).toBe("24h_to_72h");
  });

  it("charges the full booking inside 24 hours", () => {
    expect(at(23).feeCents).toBe(BOOKING);
    expect(at(1).feeCents).toBe(BOOKING);
    expect(at(0).bucket).toBe("lt24h");
  });

  it("does not soften after the appointment has passed", () => {
    expect(at(-5).feeCents).toBe(BOOKING);
  });

  it("moves on the exact hour, not a minute either side", () => {
    // The boundaries have to be unambiguous or an argument at 72.0 hours is
    // a coin toss.
    expect(at(72).feeCents).toBe(0);
    expect(at(71.99).feeCents).toBe(BOOKING / 2);
    expect(at(24).feeCents).toBe(BOOKING / 2);
    expect(at(23.99).feeCents).toBe(BOOKING);
  });
});

describe("rescheduling is always free", () => {
  it("costs nothing at any notice, including an hour before", () => {
    for (const hrs of [100, 72, 48, 24, 2, 0.5, -1]) {
      const r = at(hrs, { rescheduling: true });
      expect(r.feeCents, `${hrs}h`).toBe(0);
      expect(r.bucket, `${hrs}h`).toBe("rescheduled");
    }
    expect(rescheduleFeeCents()).toBe(0);
  });

  it("beats cancelling at every rung, which is the entire point", () => {
    for (const hrs of [48, 12]) {
      expect(at(hrs, { rescheduling: true }).feeCents).toBeLessThan(at(hrs).feeCents);
    }
  });

  it("carries a payment over rather than refunding and recharging", () => {
    const r = at(12, { rescheduling: true, paidCents: BOOKING });
    expect(r.refundCents).toBe(BOOKING);
    expect(r.dueCents).toBe(0);
    expect(r.explanation).toMatch(/moves to the new booking/i);
  });
});

describe("when nobody should be charged", () => {
  it("charges nothing when we cancel, at any notice", () => {
    expect(at(2, { ownerCancelled: true }).feeCents).toBe(0);
    expect(at(2, { ownerCancelled: true, paidCents: BOOKING }).refundCents).toBe(BOOKING);
  });

  it("supports waiving the fee outright", () => {
    // Discretion for emergencies lives here as a flag rather than as a rule,
    // because any rule defining "emergency" gets it wrong in the cases that
    // actually matter.
    const r = at(1, { waived: true });
    expect(r.feeCents).toBe(0);
    expect(r.bucket).toBe("waived");
  });

  it("owner cancelling beats every other consideration", () => {
    expect(at(1, { ownerCancelled: true, rescheduling: false }).feeCents).toBe(0);
  });
});

describe("money already collected", () => {
  it("asks for the balance when nothing was paid", () => {
    const r = at(12);
    expect(r.dueCents).toBe(BOOKING);
    expect(r.refundCents).toBe(0);
  });

  it("refunds the difference when they paid in full and cancelled early", () => {
    const r = at(100, { paidCents: BOOKING });
    expect(r.refundCents).toBe(BOOKING);
    expect(r.dueCents).toBe(0);
  });

  it("refunds half when they paid in full and cancelled inside 72 hours", () => {
    const r = at(48, { paidCents: BOOKING });
    expect(r.refundCents).toBe(BOOKING / 2);
    expect(r.dueCents).toBe(0);
  });

  it("never refunds and charges at the same time", () => {
    for (const hrs of [100, 48, 12]) {
      for (const paid of [0, BOOKING / 2, BOOKING]) {
        const r = at(hrs, { paidCents: paid });
        expect(r.dueCents > 0 && r.refundCents > 0, `${hrs}h paid ${paid}`).toBe(false);
      }
    }
  });

  it("never charges more than the booking", () => {
    for (const hrs of [100, 48, 12, -2]) {
      expect(at(hrs).feeCents).toBeLessThanOrEqual(BOOKING);
    }
  });
});

describe("the ladder as published", () => {
  it("matches what computeCancellation actually does", () => {
    const rows = cancellationLadder(R);
    expect(rows.map((r) => r.bp)).toEqual([0, at(48).feeCents / BOOKING * 10_000, 10_000]);
    expect(rows[0]!.charge).toBe("No charge");
    expect(rows[2]!.charge).toBe("The full booking");
  });
});
