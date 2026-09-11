import { describe, expect, it } from "vitest";
import { assessChange, bestFit, keepsAllOf, overlaps } from "./bookingChange.js";
import { DEFAULT_RULES as R } from "./../pricing/rules.js";

const H = 3_600_000;
/** 10am Eastern, and a 4 hour booking: 10am to 2pm. */
const TEN = Date.UTC(2026, 9, 15, 14, 0, 0);
const original = { startMs: TEN, endMs: TEN + 4 * H };

const INTERIOR = 21_500; // what they booked, a Full Interior
const EXTERIOR = 12_500; // what they are adding, a Basic Exterior
const BOTH = INTERIOR + EXTERIOR;

const at = (
  startHoursFromTen: number,
  endHoursFromTen: number,
  hoursUntilStart: number,
  over: Record<string, unknown> = {},
) =>
  assessChange(
    {
      original,
      proposed: { startMs: TEN + startHoursFromTen * H, endMs: TEN + endHoursFromTen * H },
      hoursUntilStart,
      newServiceCents: BOTH,
      originalServiceCents: INTERIOR,
      ...over,
    },
    R,
  );

describe("Elijah's two worked examples, inside 72 hours", () => {
  it("10am-2pm to 8am-2pm charges 20% on the ADDED service only", () => {
    // They kept every minute they had and took two more hours in front.
    const r = at(-2, 4, 20);
    expect(r.keptOriginal).toBe(true);
    expect(r.kind).toBe("added_short_notice");
    expect(r.chargedOn).toBe("added");
    expect(r.addedServiceCents).toBe(EXTERIOR);
    expect(r.changeFeeCents).toBe(Math.round(EXTERIOR * 0.2)); // $25, not $68
  });

  it("10am-2pm to 8am-12pm charges 20% on the WHOLE booking", () => {
    // They gave back 12pm to 2pm and took 8am to 10am, so it is a different
    // booking rather than a longer one.
    const r = at(-2, 2, 20);
    expect(r.keptOriginal).toBe(false);
    expect(r.overlaps).toBe(true);
    expect(r.kind).toBe("shifted_short_notice");
    expect(r.chargedOn).toBe("whole_booking");
    expect(r.changeFeeCents).toBe(Math.round(BOTH * 0.2));
  });

  it("charges far less to add than to shift, which is the whole point", () => {
    expect(at(-2, 4, 20).changeFeeCents).toBeLessThan(at(-2, 2, 20).changeFeeCents);
  });
});

describe("adding time you did not have", () => {
  it("charges only the extra when running later from the same start", () => {
    const r = at(0, 6, 20);
    expect(r.chargedOn).toBe("added");
    expect(r.changeFeeCents).toBe(Math.round(EXTERIOR * 0.2));
  });

  it("charges nothing when the booking grows but the price does not", () => {
    const r = at(0, 6, 20, { newServiceCents: INTERIOR, originalServiceCents: INTERIOR });
    expect(r.changeFeeCents).toBe(0);
    expect(r.kind).toBe("added_free");
  });

  it("charges nothing for finishing earlier", () => {
    const r = at(0, 2, 20, { newServiceCents: INTERIOR, originalServiceCents: INTERIOR });
    expect(r.kind).toBe("shrank");
    expect(r.changeFeeCents).toBe(0);
  });

  it("charges nothing for starting later inside your own slot", () => {
    // 12pm to 2pm, entirely within the 10am to 2pm they had. Handing time
    // back is a favour to us, so it is free however short the notice.
    const r = at(2, 4, 1, { newServiceCents: INTERIOR, originalServiceCents: INTERIOR });
    expect(r.kind).toBe("shrank");
    expect(r.changeFeeCents).toBe(0);
  });
});

describe("outside 72 hours nothing is charged at all", () => {
  it("is free to add", () => {
    expect(at(-2, 4, 100).changeFeeCents).toBe(0);
  });

  it("is free to shift", () => {
    expect(at(-2, 2, 100).changeFeeCents).toBe(0);
  });

  it("is free to take a completely different slot", () => {
    expect(at(8, 12, 100).changeFeeCents).toBe(0);
  });

  it("switches on at the 72 hour line, not around it", () => {
    expect(at(-2, 4, 72).changeFeeCents).toBe(0);
    expect(at(-2, 4, 71.9).changeFeeCents).toBeGreaterThan(0);
  });
});

describe("a completely different slot", () => {
  it("charges the whole booking inside 72 hours", () => {
    const r = at(8, 12, 20);
    expect(r.overlaps).toBe(false);
    expect(r.kind).toBe("moved_away_short_notice");
    expect(r.changeFeeCents).toBe(Math.round(BOTH * 0.2));
  });

  it("says how to avoid it", () => {
    expect(at(-2, 2, 20).explanation).toMatch(/keeping all of your original time/i);
  });
});

describe("nobody is charged when it was not their doing", () => {
  it("costs nothing when we suggested it", () => {
    expect(at(8, 12, 2, { ownerInitiated: true }).changeFeeCents).toBe(0);
  });

  it("can be waived", () => {
    expect(at(8, 12, 2, { waived: true }).changeFeeCents).toBe(0);
  });

  it("costs nothing when nothing changed", () => {
    expect(at(0, 4, 2).kind).toBe("no_change");
  });
});

describe("the window tests themselves", () => {
  it("keepsAllOf is true only when the original is fully covered", () => {
    expect(keepsAllOf(original, { startMs: TEN - H, endMs: TEN + 5 * H })).toBe(true);
    expect(keepsAllOf(original, original)).toBe(true);
    expect(keepsAllOf(original, { startMs: TEN - 2 * H, endMs: TEN + 2 * H })).toBe(false);
    expect(keepsAllOf(original, { startMs: TEN + H, endMs: TEN + 5 * H })).toBe(false);
  });

  it("overlaps is false for windows that merely touch", () => {
    expect(overlaps({ startMs: 0, endMs: 10 }, { startMs: 10, endMs: 20 })).toBe(false);
    expect(overlaps({ startMs: 0, endMs: 10 }, { startMs: 9, endMs: 20 })).toBe(true);
  });
});

describe("suggesting where a longer booking fits", () => {
  const starts = [TEN - 4 * H, TEN - 2 * H, TEN, TEN + 8 * H];

  it("puts staying put first, because it costs least", () => {
    const options = bestFit(
      original,
      starts,
      6 * H,
      { hoursUntilStart: 20, newServiceCents: BOTH, originalServiceCents: INTERIOR },
      R,
    );
    expect(options[0]!.startMs).toBe(TEN);
  });

  it("ranks a shift above a completely different slot, both being chargeable", () => {
    const options = bestFit(
      original,
      starts,
      4 * H,
      { hoursUntilStart: 20, newServiceCents: BOTH, originalServiceCents: INTERIOR },
      R,
    );
    expect(options[options.length - 1]!.startMs).toBe(TEN + 8 * H);
  });
});
