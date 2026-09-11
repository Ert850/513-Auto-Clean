import { describe, expect, it } from "vitest";
import { averageOneWayMinutes, mileageFeeCents, travelCommitmentMinutes } from "./mileage.js";
import { DEFAULT_RULES as R } from "./rules.js";
import {
  computeSurcharge,
  earliestBookableDate,
  minutesOfDay,
  requiresPriorityBooking,
} from "./surcharge.js";
import { quote, type CartInput, type PackageRef } from "./quote.js";

const $ = (cents: number) => cents / 100;

// Canonical catalog, confirmed with Elijah.
const MAINT_INT: PackageRef = { id: "mi", name: "Maintenance", category: "interior", priceCents: 9500, durationMin: 105 };
const BASIC_INT: PackageRef = { id: "bi", name: "Basic Interior", category: "interior", priceCents: 12500, durationMin: 120 };
const FULL_INT: PackageRef = { id: "fi", name: "Full Interior", category: "interior", priceCents: 21500, durationMin: 240 };
const SHOWROOM_INT: PackageRef = { id: "si", name: "Showroom Ready", category: "interior", priceCents: 39500, durationMin: 420 };
const EXPRESS_EXT: PackageRef = { id: "ee", name: "Express Exterior", category: "exterior", priceCents: 6500, durationMin: 75 };
const FULL_EXT: PackageRef = { id: "fe", name: "Full Exterior", category: "exterior", priceCents: 21000, durationMin: 240 };

const cart = (over: Partial<CartInput> = {}): CartInput => ({
  vehicles: [{ label: "Test car", packages: [FULL_INT], addons: [] }],
  oneWayMinutes: null,
  surchargeContext: null,
  zip: null,
  ...over,
});

/** Flat-priced add-on tier, the shape the funnel now builds. */
const addon = (id: string, name: string, tierLabel: string, priceCents: number, durationMin = 60) => ({
  id, name, tierId: "t", tierLabel, priceCents, durationMin,
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
  const s = (h: number, m: number, priority: boolean) =>
    computeSurcharge({ startMinutesLocal: minutesOfDay(h, m), priorityBooking: priority }, R.surcharge);

  it("is premium strictly BEFORE 10am, 9:59 yes, 10:00 no", () => {
    expect(s(9, 59, false).appliedBp).toBe(2000);
    expect(s(10, 0, false).appliedBp).toBe(0);
    expect(s(10, 1, false).appliedBp).toBe(0);
    expect(s(7, 0, false).appliedBp).toBe(2000);
  });

  it("is premium from 6pm onward, 5:59 no, 6:00 yes", () => {
    expect(s(17, 59, false).appliedBp).toBe(0);
    expect(s(18, 0, false).appliedBp).toBe(2000); // 6:00 PM IS premium
    expect(s(18, 1, false).appliedBp).toBe(2000);
    expect(s(20, 30, false).appliedBp).toBe(2000);
  });

  it("charges nothing during normal hours", () => {
    for (const h of [10, 12, 15, 17]) expect(s(h, 0, false).appliedBp).toBe(0);
  });

  it("judges the START time only, so a job running late is not premium", () => {
    // 4pm start is normal even though a 4-hour Full Interior ends at 8pm.
    expect(s(16, 0, false).appliedBp).toBe(0);
  });

  it("stacks to +30%, not +40%, when a slot is both early and inside 3 days", () => {
    expect(s(12, 0, true).appliedBp).toBe(2000); // inside 3 days, standard time
    expect(s(7, 0, false).appliedBp).toBe(2000); // early, further out
    const both = s(7, 0, true);
    expect(both.timeOfDayBp + both.priorityBp).toBe(4000); // uncapped would be 40%
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
    expect(q.serviceSubtotalCents).toBe(21500);
    expect(q.totalCents).toBe(21500);
    expect(q.travelIsEstimate).toBe(true);
  });

  it("takes no deposit: a card on file confirms the slot instead", () => {
    const q = quote(cart(), R);
    expect(q.depositCents).toBe(0);
    expect(q.balanceCents).toBe(q.totalCents);
  });

  it("offers 5% off for paying in full, and shows the saving either way", () => {
    const normal = quote(cart(), R);
    expect(normal.payInFullDiscountCents).toBe(0);
    expect(normal.payInFullSavingsCents).toBe(Math.round(21500 * 0.05)); // $10.75

    const paid = quote(cart({ payInFull: true }), R);
    expect(paid.payInFullDiscountCents).toBe(1075);
    expect(paid.totalCents).toBe(21500 - 1075);
    expect(paid.lines.some((l) => l.kind === "pay_in_full_discount")).toBe(true);
  });

  it("discounts the whole total including tax and travel, not just service", () => {
    const gross = quote(cart({ zip: "45220", oneWayMinutes: 60 }), R);
    const paid = quote(cart({ zip: "45220", oneWayMinutes: 60, payInFull: true }), R);
    expect(paid.payInFullDiscountCents).toBe(Math.round(gross.totalCents * 0.05));
    expect(paid.totalCents).toBe(gross.totalCents - paid.payInFullDiscountCents);
  });

  it("charges the vehicle size upcharge once per vehicle, not per package", () => {
    const both = {
      label: "Tahoe", sizeUpchargeCents: 2500, sizeLabel: "Large",
      packages: [FULL_INT, FULL_EXT], addons: [],
    };
    const q = quote(cart({ vehicles: [both] }), R);
    const upcharges = q.lines.filter((l) => l.kind === "size_upcharge");
    expect(upcharges).toHaveLength(1);
    expect(upcharges[0]?.amountCents).toBe(2500);
  });

  it("does not add a size upcharge to a vehicle with no work on it", () => {
    const q = quote(
      cart({ vehicles: [{ label: "empty", sizeUpchargeCents: 2500, packages: [], addons: [] }] }),
      R,
    );
    expect(q.lines.filter((l) => l.kind === "size_upcharge")).toHaveLength(0);
    expect(q.totalCents).toBe(0);
  });

  it("applies size upcharges per vehicle across a multi-vehicle booking", () => {
    const q = quote(
      cart({
        vehicles: [
          { label: "A", sizeUpchargeCents: 0, packages: [BASIC_INT], addons: [] },
          { label: "B", sizeUpchargeCents: 2500, sizeLabel: "Large", packages: [BASIC_INT], addons: [] },
        ],
      }),
      R,
    );
    expect(q.lines.filter((l) => l.kind === "size_upcharge")).toHaveLength(1);
    // 125 + (125 + 25), then 10% off the lot.
    expect(q.serviceSubtotalCents).toBe(Math.round(27500 * 0.9));
  });

  it("applies the combo discount per vehicle", () => {
    const both = { label: "A", packages: [FULL_INT, FULL_EXT], addons: [] };
    const one = quote(cart({ vehicles: [both] }), R);
    expect(one.serviceSubtotalCents).toBe(21500 + 21000 - 2500); // $400

    // Second vehicle earns the combo again, then 10% comes off the lot.
    const two = quote(cart({ vehicles: [both, { ...both, label: "B" }] }), R);
    expect(two.serviceSubtotalCents).toBe(Math.round(80000 * 0.9));
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
    // No combo (different vehicles), but the whole booking still gets 10% off.
    expect(q.serviceSubtotalCents).toBe(Math.round(42500 * 0.9));
  });

  it("prices add-ons from their chosen severity tier", () => {
    const q = quote(
      cart({
        vehicles: [
          { label: "A", packages: [BASIC_INT], addons: [addon("stain", "Stain Treatment", "Moderate to major removal", 10000, 120)] },
        ],
      }),
      R,
    );
    expect(q.serviceSubtotalCents).toBe(12500 + 10000);
    expect(q.serviceDurationMin).toBe(120 + 120);
    expect(q.lines.find((l) => l.kind === "addon")?.label).toBe("Stain Treatment: Moderate to major removal");
  });

  it("prices Showroom Ready as a flat anchor, with no hourly path left", () => {
    const q = quote(cart({ vehicles: [{ label: "A", packages: [SHOWROOM_INT], addons: [] }] }), R);
    expect(q.serviceSubtotalCents).toBe(39500);
    // The anchor only works if it clears Full by a wide margin.
    expect(SHOWROOM_INT.priceCents).toBeGreaterThan(FULL_INT.priceCents * 1.5);
  });

  it("adds the correction tier on top of the Full Exterior base", () => {
    const q = quote(
      cart({
        vehicles: [{
          label: "A", packages: [FULL_EXT], addons: [],
          correction: {
            tierId: "two-step", tierLabel: "2 step paint correction, then coating",
            addCents: 150000, addMin: 18 * 60,
            coatingId: "5yr", coatingLabel: "5 year", coatingAddCents: 15000,
          },
        }],
      }),
      R,
    );
    expect(q.serviceSubtotalCents).toBe(21000 + 150000 + 15000);
    expect(q.serviceDurationMin).toBe(240 + 18 * 60);
  });

  it("charges the canopy only when there is no garage", () => {
    const base = {
      tierId: "one-step", tierLabel: "1 step", addCents: 85000, addMin: 720,
      coatingId: "3yr", coatingLabel: "3 year", coatingAddCents: 0,
    };
    const garage = quote(cart({ vehicles: [{ label: "A", packages: [FULL_EXT], addons: [], correction: base }] }), R);
    const none = quote(cart({
      vehicles: [{ label: "A", packages: [FULL_EXT], addons: [], correction: { ...base, canopyCents: 5000 } }],
    }), R);
    expect(none.serviceSubtotalCents - garage.serviceSubtotalCents).toBe(5000);
    expect(garage.lines.some((l) => l.kind === "canopy")).toBe(false);
    expect(none.lines.some((l) => l.kind === "canopy")).toBe(true);
  });

  it("charges travel once per appointment, not per vehicle", () => {
    const v = { label: "x", packages: [EXPRESS_EXT], addons: [] };
    const one = quote(cart({ vehicles: [v], oneWayMinutes: 60 }), R);
    const three = quote(cart({ vehicles: [v, v, v], oneWayMinutes: 60 }), R);
    expect(one.travelCents).toBe(6500);
    expect(three.travelCents).toBe(6500);
  });

  it("takes 10% off the WHOLE booking once there are two vehicles", () => {
    const v = { label: "x", packages: [FULL_INT], addons: [] }; // $215 each

    // One vehicle: no discount at all.
    expect(quote(cart({ vehicles: [v] }), R).serviceSubtotalCents).toBe(21500);

    // Two: the first vehicle's price comes down as well, which is the point.
    const two = quote(cart({ vehicles: [v, v] }), R);
    expect(two.serviceSubtotalCents).toBe(Math.round(43000 * 0.9));
    expect(two.multiVehicleDiscountCents).toBe(4300);
    // The struck-through figure must be a like-for-like total, so the saving
    // between them equals the discount exactly.
    expect(two.grossBeforeMultiCents - two.totalCents).toBe(4300);

    const three = quote(cart({ vehicles: [v, v, v] }), R);
    expect(three.serviceSubtotalCents).toBe(Math.round(64500 * 0.9));
  });

  it("keeps the struck-through total comparable once tax and travel apply", () => {
    const v = { label: "x", packages: [FULL_INT], addons: [] };
    const q = quote(cart({ vehicles: [v, v], oneWayMinutes: 60, zip: "45220" }), R);
    // Never show a "was" price lower than the price being paid.
    expect(q.grossBeforeMultiCents).toBeGreaterThan(q.totalCents);
    // And the gap is the discount plus the tax that would have been charged on it.
    const taxOnDiscount = Math.round(q.multiVehicleDiscountCents * (q.taxRateBp / 10000));
    expect(q.grossBeforeMultiCents - q.totalCents).toBe(q.multiVehicleDiscountCents + taxOnDiscount);
  });

  it("makes adding a second vehicle cheaper than it looks", () => {
    const big = { label: "big", packages: [FULL_INT], addons: [] }; // $215
    const small = { label: "small", packages: [EXPRESS_EXT], addons: [] }; // $65
    const alone = quote(cart({ vehicles: [big] }), R);
    const both = quote(cart({ vehicles: [big, small] }), R);

    // The $65 car adds less than $65, because the $215 one drops 10% too.
    expect(both.totalCents - alone.totalCents).toBeLessThan(6500);
    expect(both.multiVehicleDiscountCents).toBe(Math.round(28000 * 0.1));
    // One discount line covering the booking, not one per vehicle.
    expect(both.lines.filter((l) => l.kind === "additional_vehicle_discount")).toHaveLength(1);
  });

  it("charges travel once per visit, so split times cost twice", () => {
    const v = { label: "x", packages: [FULL_INT], addons: [] };
    const together = quote(cart({ vehicles: [v, v], oneWayMinutes: 60 }), R);
    const apart = quote(cart({ vehicles: [v, v], oneWayMinutes: 60, visits: 2 }), R);
    expect(together.travelCents).toBe(6500);
    expect(apart.travelCents).toBe(13000);
    expect(apart.totalCents - together.totalCents).toBe(6500);
    // The service discount is unaffected by how many trips it takes.
    expect(apart.multiVehicleDiscountCents).toBe(together.multiVehicleDiscountCents);
  });

  it("applies the surcharge to service only, never to travel", () => {
    const q = quote(
      cart({
        vehicles: [{ label: "A", packages: [FULL_INT], addons: [] }],
        oneWayMinutes: 60, // $65 travel
        surchargeContext: { startMinutesLocal: minutesOfDay(7), priorityBooking: false }, // +20%
      }),
      R,
    );
    expect(q.serviceSubtotalCents).toBe(21500);
    expect(q.surchargeCents).toBe(4300); // 20% of 215, NOT of the travel too
    expect(q.travelCents).toBe(6500);
    expect(q.totalCents).toBe(21500 + 4300 + 6500);
  });

  it("charges +30% for a 7am booking inside 3 days, not +40%", () => {
    const q = quote(
      cart({ surchargeContext: { startMinutesLocal: minutesOfDay(7), priorityBooking: true } }),
      R,
    );
    expect(q.surchargeBp).toBe(3000);
    expect(q.surchargeCents).toBe(6450); // 30% of $215
    expect($(q.totalCents)).toBe(279.5);
  });

  it("keeps every line item reconciling to the total", () => {
    const q = quote(
      cart({
        vehicles: [
          { label: "A", packages: [FULL_INT, FULL_EXT], addons: [addon("ozone", "Ozone Odor Reset", "One hour treatment", 5000)] },
          { label: "B", packages: [BASIC_INT], addons: [] },
        ],
        oneWayMinutes: 45,
        zip: "45220",
        surchargeContext: { startMinutesLocal: minutesOfDay(19), priorityBooking: false },
      }),
      R,
    );
    const summed = q.lines.reduce((s, l) => s + l.amountCents, 0);
    expect(summed).toBe(q.totalCents);
    expect(q.depositCents + q.balanceCents).toBe(q.totalCents);
  });
});

describe("sales tax", () => {
  it("is pending until a ZIP is known, rather than silently zero", () => {
    const q = quote(cart(), R);
    expect(q.taxIsEstimate).toBe(true);
    expect(q.taxCents).toBe(0);
  });

  it("applies the Hamilton County rate to a Cincinnati ZIP", () => {
    const q = quote(cart({ zip: "45220" }), R);
    expect(q.taxRateBp).toBe(780);
    expect(q.taxCounty).toBe("hamilton");
    expect(q.taxCents).toBe(Math.round(21500 * 0.078));
    expect(q.totalCents).toBe(21500 + q.taxCents);
  });

  it("taxes travel too, since it is part of the price of a taxable service", () => {
    const noTravel = quote(cart({ zip: "45220" }), R);
    const withTravel = quote(cart({ zip: "45220", oneWayMinutes: 60 }), R); // $65
    expect(withTravel.taxCents).toBeGreaterThan(noTravel.taxCents);
    expect(withTravel.taxCents).toBe(Math.round((21500 + 6500) * 0.078));
  });

  it("falls back to the busiest county for an unknown ZIP, and says so", () => {
    const q = quote(cart({ zip: "99999" }), R);
    expect(q.taxRateBp).toBe(780);
    expect(q.taxCounty).toBe(null);
  });

  it("uses the Kentucky flat rate across the river", () => {
    const q = quote(cart({ zip: "41011" }), R);
    expect(q.taxRateBp).toBe(600);
  });
});
