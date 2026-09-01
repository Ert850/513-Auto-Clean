import { describe, expect, it } from "vitest";
import { averageOneWayMinutes, mileageFeeCents, travelCommitmentMinutes } from "./mileage.js";
import { computeRefund, rescheduleFeeCents } from "./refund.js";
import { DEFAULT_RULES as R } from "./rules.js";
import {
  computeSurcharge,
  earliestBookableDate,
  requiresPriorityBooking,
} from "./surcharge.js";
import { quote, type CartInput, type PackageRef } from "./quote.js";

const $ = (cents: number) => cents / 100;

// Canonical catalog, confirmed with Elijah.
const EXPRESS_INT: PackageRef = { id: "ei", name: "Express Interior", category: "interior", priceCents: 8500, durationMin: 75 };
const BASIC_INT: PackageRef = { id: "bi", name: "Basic Interior", category: "interior", priceCents: 11500, durationMin: 120 };
const FULL_INT: PackageRef = { id: "fi", name: "Full Interior", category: "interior", priceCents: 19500, durationMin: 240 };
const EXPRESS_EXT: PackageRef = { id: "ee", name: "Express Exterior", category: "exterior", priceCents: 6500, durationMin: 75 };
const FULL_EXT: PackageRef = { id: "fe", name: "Full Exterior", category: "exterior", priceCents: 19500, durationMin: 240 };

const cart = (over: Partial<CartInput> = {}): CartInput => ({
  vehicles: [{ label: "Test car", packages: [FULL_INT], addons: [] }],
  oneWayMinutes: null,
  surchargeContext: null,
  ...over,
});

describe("mileage ladder", () => {
  it("matches the two worked examples Elijah confirmed", () => {
    expect(mileageFeeCents(60, R.mileage)).toBe(6500); // $65
    expect(mileageFeeCents(120, R.mileage)).toBe(15500); // $155
  });

  it("is free inside the free window", () => {
    for (const t of [0, 1, 5, 9, 10]) expect(mileageFeeCents(t, R.mileage)).toBe(0);
  });

  it("rounds DOWN below 20 minutes, which makes anything under 15 min free", () => {
    expect(mileageFeeCents(12, R.mileage)).toBe(0); // raw $2 -> floor $5 -> $0
    expect(mileageFeeCents(14, R.mileage)).toBe(0); // raw $4 -> $0
    expect(mileageFeeCents(15, R.mileage)).toBe(500); // raw $5 -> $5, the first charge
    expect(mileageFeeCents(19, R.mileage)).toBe(500); // raw $9 -> floor -> $5
  });

  it("rounds to NEAREST between 20 and 30", () => {
    expect(mileageFeeCents(20, R.mileage)).toBe(1000); // raw $10 exact
    expect(mileageFeeCents(22, R.mileage)).toBe(1000); // raw $12 -> $10
    expect(mileageFeeCents(23, R.mileage)).toBe(1500); // raw $13 -> $15
    expect(mileageFeeCents(29, R.mileage)).toBe(2000); // raw $19 -> $20
  });

  it("rounds UP at and beyond 30", () => {
    expect(mileageFeeCents(30, R.mileage)).toBe(2000); // raw $20, already a multiple of 5
    expect(mileageFeeCents(31, R.mileage)).toBe(2500); // raw $21.50 -> ceil -> $25
    expect(mileageFeeCents(45, R.mileage)).toBe(4500); // raw $42.50 -> ceil -> $45
  });

  it("never decreases as drive time grows", () => {
    let prev = 0;
    for (let t = 0; t <= 180; t++) {
      const fee = mileageFeeCents(t, R.mileage);
      expect(fee).toBeGreaterThanOrEqual(prev);
      prev = fee;
    }
  });

  it("averages the two legs and sums them for the calendar commitment", () => {
    expect(averageOneWayMinutes(50, 70)).toBe(60);
    expect(travelCommitmentMinutes(50, 70)).toBe(120);
    // A round trip averaging 60 min one-way costs $65, per the example above.
    expect(mileageFeeCents(averageOneWayMinutes(50, 70), R.mileage)).toBe(6500);
  });
});

describe("premium surcharges", () => {
  const s = (hour: number, priority: boolean) =>
    computeSurcharge({ startHourLocal: hour, priorityBooking: priority }, R.surcharge);

  it("charges 20% before 10am and from 6pm", () => {
    expect(s(7, false).appliedBp).toBe(2000);
    expect(s(9, false).appliedBp).toBe(2000);
    expect(s(18, false).appliedBp).toBe(2000);
    expect(s(20, false).appliedBp).toBe(2000);
  });

  it("charges nothing during normal hours", () => {
    for (const h of [10, 12, 15, 17]) expect(s(h, false).appliedBp).toBe(0);
  });

  it("judges the START time only, so a job running late is not premium", () => {
    // 4pm start is normal even though a 4-hour Full Interior ends at 8pm.
    expect(s(16, false).appliedBp).toBe(0);
  });

  it("adds priority to time-of-day but caps the total at 30%", () => {
    expect(s(12, true).appliedBp).toBe(2000); // priority only
    const both = s(7, true);
    expect(both.timeOfDayBp + both.priorityBp).toBe(4000); // would be 40%
    expect(both.appliedBp).toBe(3000); // capped
    expect(both.capped).toBe(true);
  });
});

describe("booking window", () => {
  const mondayMidnight = new Date(2026, 8, 7); // Mon 7 Sep 2026, local midnight

  it("puts Monday's earliest booking on Thursday", () => {
    expect(earliestBookableDate(mondayMidnight, R.window).getDay()).toBe(4); // Thu
  });

  it("shifts to Friday the moment it becomes Tuesday", () => {
    const tuesday = new Date(2026, 8, 8);
    expect(earliestBookableDate(tuesday, R.window).getDay()).toBe(5); // Fri
  });

  it("flags nearer dates as needing Priority Booking", () => {
    const needs = (dayOffset: number) =>
      requiresPriorityBooking(new Date(2026, 8, 7 + dayOffset), mondayMidnight, R.window);
    expect(needs(0)).toBe(true); // today
    expect(needs(1)).toBe(true);
    expect(needs(2)).toBe(true);
    expect(needs(3)).toBe(false); // Thursday is freely bookable
    expect(needs(7)).toBe(false);
  });
});

describe("quote engine", () => {
  it("prices a plain Full Interior with no slot chosen yet", () => {
    const q = quote(cart(), R);
    expect(q.serviceSubtotalCents).toBe(19500);
    expect(q.totalCents).toBe(19500);
    expect(q.depositCents).toBe(9750); // 50%
    expect(q.balanceCents).toBe(9750);
    expect(q.travelIsEstimate).toBe(true);
    expect(q.payAfterEligible).toBe(true); // exactly at the $195 ceiling
  });

  it("drops pay-after as soon as travel pushes past $195", () => {
    const q = quote(cart({ oneWayMinutes: 25 }), R); // $15 travel
    expect(q.travelCents).toBe(1500);
    expect(q.totalCents).toBe(21000);
    expect(q.payAfterEligible).toBe(false);
  });

  it("applies the combo discount per vehicle", () => {
    const both = { label: "A", packages: [FULL_INT, FULL_EXT], addons: [] };
    const one = quote(cart({ vehicles: [both] }), R);
    expect(one.serviceSubtotalCents).toBe(19500 + 19500 - 1500);

    const two = quote(cart({ vehicles: [both, { ...both, label: "B" }] }), R);
    expect(two.serviceSubtotalCents).toBe(2 * (19500 + 19500 - 1500)); // earned twice
  });

  it("does not give the combo across different vehicles", () => {
    const q = quote(
      cart({
        vehicles: [
          { label: "A", packages: [FULL_INT], addons: [] },
          { label: "B", packages: [FULL_EXT], addons: [] },
        ],
      }),
      R,
    );
    expect(q.serviceSubtotalCents).toBe(39000); // no discount
  });

  it("bills add-ons at $50/hr with a 1-hour minimum", () => {
    const q = quote(
      cart({
        vehicles: [
          { label: "A", packages: [EXPRESS_INT], addons: [{ id: "ph", name: "Pet Hair Removal", hours: 0.25 }] },
        ],
      }),
      R,
    );
    expect(q.serviceSubtotalCents).toBe(8500 + 5000); // floored up to 1hr
    expect(q.serviceDurationMin).toBe(75 + 60);
  });

  it("charges travel once per appointment, not per vehicle", () => {
    const v = { label: "x", packages: [EXPRESS_EXT], addons: [] };
    const one = quote(cart({ vehicles: [v], oneWayMinutes: 60 }), R);
    const three = quote(cart({ vehicles: [v, v, v], oneWayMinutes: 60 }), R);
    expect(one.travelCents).toBe(6500);
    expect(three.travelCents).toBe(6500);
  });

  it("applies the surcharge to service only, never to travel", () => {
    const q = quote(
      cart({
        vehicles: [{ label: "A", packages: [FULL_INT], addons: [] }],
        oneWayMinutes: 60, // $65 travel
        surchargeContext: { startHourLocal: 7, priorityBooking: false }, // +20%
      }),
      R,
    );
    expect(q.serviceSubtotalCents).toBe(19500);
    expect(q.surchargeCents).toBe(3900); // 20% of 195, NOT of 260
    expect(q.travelCents).toBe(6500);
    expect(q.totalCents).toBe(19500 + 3900 + 6500);
  });

  it("caps a 7am priority booking at +30%", () => {
    const q = quote(
      cart({ surchargeContext: { startHourLocal: 7, priorityBooking: true } }),
      R,
    );
    expect(q.surchargeBp).toBe(3000);
    expect(q.surchargeCents).toBe(5850); // 30% of $195
    expect($(q.totalCents)).toBe(253.5);
  });

  it("keeps every line item reconciling to the total", () => {
    const q = quote(
      cart({
        vehicles: [
          { label: "A", packages: [FULL_INT, FULL_EXT], addons: [{ id: "oz", name: "Ozone", hours: 2 }] },
          { label: "B", packages: [BASIC_INT], addons: [] },
        ],
        oneWayMinutes: 45,
        surchargeContext: { startHourLocal: 19, priorityBooking: false },
      }),
      R,
    );
    const summed = q.lines.reduce((s, l) => s + l.amountCents, 0);
    expect(summed).toBe(q.totalCents);
    expect(q.depositCents + q.balanceCents).toBe(q.totalCents);
  });
});

describe("refund ladder", () => {
  const base = { depositPaidCents: 9750, totalPaidCents: 9750, ownerCancelled: false };

  it("refunds everything when Elijah cancels, however late", () => {
    const r = computeRefund({ ...base, hoursUntilStart: 1, ownerCancelled: true }, R);
    expect(r.refundCents).toBe(9750);
    expect(r.retainedCents).toBe(0);
  });

  it("keeps the $25 booking fee beyond 72 hours", () => {
    const r = computeRefund({ ...base, hoursUntilStart: 100 }, R);
    expect(r.bucket).toBe("gt72h");
    expect(r.refundCents).toBe(9750 - 2500);
  });

  it("returns half the deposit between 24 and 72 hours", () => {
    expect(computeRefund({ ...base, hoursUntilStart: 71 }, R).refundCents).toBe(4875);
    expect(computeRefund({ ...base, hoursUntilStart: 24 }, R).refundCents).toBe(4875);
  });

  it("returns nothing inside 24 hours", () => {
    expect(computeRefund({ ...base, hoursUntilStart: 23 }, R).refundCents).toBe(0);
    expect(computeRefund({ ...base, hoursUntilStart: 0 }, R).refundCents).toBe(0);
  });

  it("is exact at the tier boundaries", () => {
    expect(computeRefund({ ...base, hoursUntilStart: 72 }, R).bucket).toBe("gt72h");
    expect(computeRefund({ ...base, hoursUntilStart: 71.9 }, R).bucket).toBe("24h_to_72h");
  });

  it("never withholds more than the deposit from a pay-in-full customer", () => {
    // Paid $195 in full; deposit portion was $97.50.
    const r = computeRefund(
      { depositPaidCents: 9750, totalPaidCents: 19500, hoursUntilStart: 2, ownerCancelled: false },
      R,
    );
    expect(r.refundCents).toBe(9750); // the half above the deposit comes back
    expect(r.retainedCents).toBe(9750); // at most the deposit is kept
  });

  it("floors the >=72h refund at zero for a tiny deposit", () => {
    const r = computeRefund(
      { depositPaidCents: 1000, totalPaidCents: 1000, hoursUntilStart: 100, ownerCancelled: false },
      R,
    );
    expect(r.refundCents).toBe(0); // $10 deposit, $25 fee -> floor, not negative
  });

  it("charges a reschedule fee equal to what would have been withheld", () => {
    expect(rescheduleFeeCents({ ...base, hoursUntilStart: 100 }, R)).toBe(2500);
    expect(rescheduleFeeCents({ ...base, hoursUntilStart: 48 }, R)).toBe(4875);
    expect(rescheduleFeeCents({ ...base, hoursUntilStart: 5 }, R)).toBe(9750);
  });
});
