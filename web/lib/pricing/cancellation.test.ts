import { describe, expect, it } from "vitest";
import {
  cancellationLadder,
  computeCancellation,
  computeReschedule,
} from "./cancellation.js";
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

describe("rescheduling: the same money, credited instead of kept", () => {
  const move = (hoursUntilStart: number, over: Partial<Parameters<typeof computeReschedule>[0]> = {}) =>
    computeReschedule({ totalCents: BOOKING, hoursUntilStart, ...over }, R);

  it("is genuinely free with more than 72 hours notice", () => {
    const r = move(100);
    expect(r.prepayCents).toBe(0);
    expect(r.dueNowCents).toBe(0);
    expect(r.lateFeeCents).toBe(0);
  });

  it("takes half inside 72 hours and credits every cent of it", () => {
    const r = move(48);
    expect(r.prepayCents).toBe(BOOKING / 2);
    expect(r.creditCents).toBe(BOOKING / 2);
    expect(r.lateFeeCents).toBe(0);
    expect(r.creditValidDays).toBe(R.rescheduleCreditDays);
  });

  it("takes the whole booking inside 24 hours and credits it for 30 days", () => {
    const r = move(12);
    expect(r.prepayCents).toBe(BOOKING);
    expect(r.creditCents).toBe(BOOKING);
    expect(r.creditValidDays).toBe(30);
  });

  it("adds 10% for moving inside 24 hours", () => {
    expect(move(12).lateFeeBp).toBe(1000);
    expect(move(12).lateFeeCents).toBe(Math.round(BOOKING * 0.1));
  });

  it("charges the SAME flat 10% on every late move, never an escalating rate", () => {
    // 10% each time, not 10 then 20 then 30. Someone who has moved twice
    // before pays exactly what they paid the first time.
    for (const priorMoves of [0, 1, 2, 5]) {
      const r = move(12, { lateMoves: priorMoves });
      expect(r.lateFeeBp, `after ${priorMoves} moves`).toBe(1000);
      expect(r.lateFeeCents, `after ${priorMoves} moves`).toBe(Math.round(BOOKING * 0.1));
    }
  });

  it("still says which late move this is, without changing the rate", () => {
    expect(move(12, { lateMoves: 2 }).explanation).toMatch(/late move number 3/i);
    expect(move(12, { lateMoves: 2 }).explanation).toMatch(/same 10%/i);
  });

  it("charges no late fee outside 24 hours however many times they have moved", () => {
    expect(move(48, { lateMoves: 5 }).lateFeeCents).toBe(0);
    expect(move(100, { lateMoves: 5 }).lateFeeCents).toBe(0);
  });

  it("credits at least what they already paid", () => {
    const r = move(48, { paidCents: BOOKING });
    expect(r.creditCents).toBe(BOOKING);
    expect(r.dueNowCents).toBe(0);
  });

  it("beats cancelling at every rung, because the money survives", () => {
    for (const hrs of [48, 12]) {
      expect(move(hrs).creditCents).toBeGreaterThan(0);
      expect(computeCancellation({ totalCents: BOOKING, hoursUntilStart: hrs }, R).feeCents)
        .toBe(move(hrs).prepayCents);
    }
  });

  it("costs nothing when we move it", () => {
    expect(move(2, { ownerInitiated: true }).prepayCents).toBe(0);
    expect(move(2, { ownerInitiated: true }).lateFeeCents).toBe(0);
  });

  it("can be waived outright", () => {
    expect(move(1, { waived: true }).prepayCents).toBe(0);
    expect(move(1, { waived: true }).lateFeeCents).toBe(0);
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

  it("owner cancelling beats the clock entirely", () => {
    expect(at(1, { ownerCancelled: true }).feeCents).toBe(0);
    expect(at(-10, { ownerCancelled: true }).feeCents).toBe(0);
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
    expect(rows[0]!.cancel).toBe("No charge");
    expect(rows[2]!.cancel).toBe("The full booking, kept");
    expect(rows[2]!.reschedule).toMatch(/credited for 30 days/);
  });
});
