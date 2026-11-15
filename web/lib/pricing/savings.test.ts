/**
 * The bar's struck price and "You saved" agree, and say what they include
 * (Emmett, November 15). Real quotes, re-priced with every discount off the
 * way js/funnel.js undiscounted() does it.
 */
import { describe, expect, it } from "vitest";
import { DEFAULT_RULES as R } from "./rules.js";
import { minutesOfDay } from "./surcharge.js";
import { quote, type CartInput, type PackageRef } from "./quote.js";
import { barLabel, discountKinds, savingSummary } from "./savings.js";

const FULL_INT: PackageRef = { id: "fi", name: "Full Interior", category: "interior", priceCents: 23500, durationMin: 240 };
const BASIC_INT: PackageRef = { id: "bi", name: "Basic Interior", category: "interior", priceCents: 14500, durationMin: 120 };
const FULL_EXT: PackageRef = { id: "fe", name: "Full Exterior", category: "exterior", priceCents: 21000, durationMin: 240 };
const cart = (over: Partial<CartInput> = {}): CartInput => ({
  vehicles: [{ label: "Car", packages: [FULL_INT], addons: [] }], oneWayMinutes: 20, surchargeContext: null, zip: "45220", ...over,
});
/** What the form shows: the bar's struck price, its label, and "You saved" with its note. */
function shown(c: CartInput) {
  const q = quote(c, R);
  const none = quote({ ...c, promoCode: null, payInFull: false }, { ...R, additionalVehicleDiscountBp: 0, comboDiscountCents: 0, payInFullDiscountBp: 0 });
  const s = savingSummary(q, none.totalCents);
  return { q, struck: none.totalCents, label: barLabel(q), saved: s.cents, note: s.note };
}

describe("savings: bar and You saved", () => {
  it("no discount: no struck price, no saving", () => {
    const r = shown(cart());
    expect(r.label).toBeNull();
    expect(discountKinds(r.q)).toEqual([]);
    expect(r.saved).toBe(0);
  });
  it("interior + exterior: named, and You saved includes the tax that came off", () => {
    const r = shown(cart({ vehicles: [{ label: "Car", packages: [FULL_INT, FULL_EXT], addons: [] }] }));
    expect(r.label).toBe("interior + exterior saving applied");
    expect(r.struck - r.q.totalCents).toBe(r.saved);
    expect(r.saved).toBeGreaterThan(R.comboDiscountCents);
    expect(r.note).toBe(`${Math.round((R.comboDiscountCents / (FULL_INT.priceCents + FULL_EXT.priceCents)) * 100)}% off, tax included`);
  });
  it("two vehicles and a code: 'savings applied', and the two figures still agree", () => {
    const v = (p: PackageRef) => ({ label: "Car", packages: [p], addons: [] });
    const r = shown(cart({ vehicles: [v(FULL_INT), v(BASIC_INT)], promoCode: "LIKENEW" }));
    expect(discountKinds(r.q).sort()).toEqual(["additional_vehicle_discount", "promo_discount"]);
    expect(r.label).toBe("savings applied");
    expect(r.struck - r.q.totalCents).toBe(r.saved);
    expect(r.note).toMatch(/^\d+% off, tax included$/);
  });
  it("one code alone is named", () => {
    expect(shown(cart({ promoCode: "LIKENEW" })).label).toBe("LIKENEW applied");
  });
  it("a fee in the total is named in the note, singular, never 'fees' (travel isn't part of the saving)", () => {
    const v = { label: "Car", packages: [FULL_INT], addons: [] };
    const r = shown(cart({ vehicles: [v, v], surchargeContext: { startMinutesLocal: minutesOfDay(11), priorityBooking: true } }));
    expect(r.struck - r.q.totalCents).toBe(r.saved);
    expect(r.note).toMatch(/^10% off, tax and rush fee included$/);
  });
  it("no ZIP yet: no tax to mention", () => {
    const v = { label: "Car", packages: [FULL_INT], addons: [] };
    expect(shown(cart({ vehicles: [v, v], zip: null })).note).toBe("10% off");
  });
});
