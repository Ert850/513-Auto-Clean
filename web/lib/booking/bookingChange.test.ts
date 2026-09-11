import { describe, expect, it } from "vitest";
import { assessChange, bestFit, overlaps } from "./bookingChange.js";
import { DEFAULT_RULES as R } from "./../pricing/rules.js";

const H = 3_600_000;
const DAY0 = Date.UTC(2026, 9, 15, 14, 0, 0); // 10am Eastern
const SERVICE = 24_500;

/** A 4 hour booking at 10am. */
const original = { startMs: DAY0, endMs: DAY0 + 4 * H };

const change = (
  proposed: { startMs: number; endMs: number },
  hoursUntilStart: number,
  over: Record<string, unknown> = {},
) =>
  assessChange(
    { original, proposed, hoursUntilStart, newServiceCents: SERVICE, ...over },
    R,
  );

describe("adding services is free", () => {
  it("charges nothing to run longer from the same start, even an hour before", () => {
    const r = change({ startMs: DAY0, endMs: DAY0 + 6 * H }, 1);
    expect(r.changeFeeCents).toBe(0);
    expect(r.kind).toBe("grew_in_place");
    expect(r.growthMin).toBe(120);
  });

  it("charges nothing for a second vehicle on an otherwise empty day", () => {
    // The whole point: nobody loses a slot, so nobody pays for one.
    const r = change({ startMs: DAY0, endMs: DAY0 + 8 * H }, 2);
    expect(r.changeFeeCents).toBe(0);
  });

  it("charges nothing for shrinking either", () => {
    const r = change({ startMs: DAY0, endMs: DAY0 + 2 * H }, 2);
    expect(r.changeFeeCents).toBe(0);
    expect(r.growthMin).toBe(-120);
  });
});

describe("moving around a time you already had", () => {
  it("is free when the new window still touches the old one", () => {
    // 8am to 2pm still covers the 10am they had.
    const r = change({ startMs: DAY0 - 2 * H, endMs: DAY0 + 4 * H }, 12);
    expect(r.overlaps).toBe(true);
    expect(r.changeFeeCents).toBe(0);
    expect(r.kind).toBe("moved_overlapping");
  });

  it("is free even when it starts earlier and runs longer", () => {
    expect(change({ startMs: DAY0 - H, endMs: DAY0 + 7 * H }, 5).changeFeeCents).toBe(0);
  });

  it("treats a window that only touches at the edge as a different slot", () => {
    // Starting exactly when the old one ended is not an overlap.
    const r = change({ startMs: DAY0 + 4 * H, endMs: DAY0 + 8 * H }, 12);
    expect(r.overlaps).toBe(false);
  });
});

describe("taking a different slot", () => {
  it("charges 20% inside 72 hours, the example Elijah gave", () => {
    // 10am to 4pm, no overlap, the next day.
    const r = change({ startMs: DAY0 + 6 * H, endMs: DAY0 + 10 * H }, 20);
    expect(r.kind).toBe("moved_away_short_notice");
    expect(r.changeFeeBp).toBe(2000);
    expect(r.changeFeeCents).toBe(Math.round(SERVICE * 0.2));
  });

  it("charges nothing for the same move with plenty of notice", () => {
    const r = change({ startMs: DAY0 + 6 * H, endMs: DAY0 + 10 * H }, 100);
    expect(r.kind).toBe("moved_away_free");
    expect(r.changeFeeCents).toBe(0);
  });

  it("moves on the 72 hour line, not around it", () => {
    const far = { startMs: DAY0 + 6 * H, endMs: DAY0 + 10 * H };
    expect(change(far, 72).changeFeeCents).toBe(0);
    expect(change(far, 71.9).changeFeeCents).toBeGreaterThan(0);
  });

  it("explains itself in terms of what avoids the fee", () => {
    expect(change({ startMs: DAY0 + 6 * H, endMs: DAY0 + 10 * H }, 20).explanation)
      .toMatch(/keeping any part of your original time avoids it/i);
  });

  it("is free when we suggested the move", () => {
    expect(change({ startMs: DAY0 + 6 * H, endMs: DAY0 + 10 * H }, 2, { ownerInitiated: true }).changeFeeCents).toBe(0);
  });

  it("can be waived", () => {
    expect(change({ startMs: DAY0 + 6 * H, endMs: DAY0 + 10 * H }, 2, { waived: true }).changeFeeCents).toBe(0);
  });
});

describe("overlap itself", () => {
  it("is true for any genuine intersection", () => {
    expect(overlaps({ startMs: 0, endMs: 10 }, { startMs: 5, endMs: 15 })).toBe(true);
    expect(overlaps({ startMs: 5, endMs: 15 }, { startMs: 0, endMs: 10 })).toBe(true);
    expect(overlaps({ startMs: 0, endMs: 100 }, { startMs: 10, endMs: 20 })).toBe(true);
  });

  it("is false for windows that merely touch", () => {
    expect(overlaps({ startMs: 0, endMs: 10 }, { startMs: 10, endMs: 20 })).toBe(false);
  });
});

describe("suggesting where a longer booking fits", () => {
  const starts = [DAY0 - 4 * H, DAY0, DAY0 + 2 * H, DAY0 + 8 * H];

  it("puts the free options first, and staying put first of all", () => {
    const options = bestFit(original, starts, 6 * H, { hoursUntilStart: 12, newServiceCents: SERVICE }, R);
    expect(options[0]!.startMs).toBe(DAY0);
    expect(options[0]!.result.changeFeeCents).toBe(0);
  });

  it("puts a chargeable option last however convenient it is", () => {
    // A customer would rather move two hours for nothing than twenty minutes
    // for twenty percent.
    const options = bestFit(original, starts, 6 * H, { hoursUntilStart: 12, newServiceCents: SERVICE }, R);
    expect(options[options.length - 1]!.result.changeFeeCents).toBeGreaterThan(0);
  });

  it("says what each option would cost before anyone commits", () => {
    const options = bestFit(original, starts, 4 * H, { hoursUntilStart: 12, newServiceCents: SERVICE }, R);
    for (const o of options) expect(typeof o.result.explanation).toBe("string");
  });
});
