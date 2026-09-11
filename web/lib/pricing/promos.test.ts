import { describe, expect, it } from "vitest";
import { findPromo, normalisePromo, promoDiscountCents, PROMOS } from "./promos.js";
import { quote, type CartInput, type PackageRef } from "./quote.js";
import { DEFAULT_RULES as R } from "./rules.js";

const FULL_INT: PackageRef = {
  id: "fi",
  name: "Full Interior",
  category: "interior",
  priceCents: 21500,
  durationMin: 240,
};

const cart = (over: Partial<CartInput> = {}): CartInput => ({
  vehicles: [{ label: "Test car", packages: [FULL_INT], addons: [] }],
  oneWayMinutes: null,
  surchargeContext: null,
  zip: null,
  ...over,
});

describe("promo codes", () => {
  it("matches however the customer types it", () => {
    for (const typed of ["LIKENEW", "likenew", " LikeNew ", "like new"]) {
      expect(findPromo(typed).promo?.code, typed).toBe("LIKENEW");
    }
    expect(normalisePromo("  li ke new ")).toBe("LIKENEW");
  });

  it("says why an unusable code did not apply", () => {
    expect(findPromo("").rejected).toBe("empty");
    expect(findPromo("NOTACODE").rejected).toBe("unknown");
  });

  it("refuses an inactive code", () => {
    const off = { code: "OFF", label: "off", percentBp: 5000, active: false };
    PROMOS.push(off);
    try {
      expect(findPromo("OFF").rejected).toBe("unknown");
    } finally {
      PROMOS.pop();
    }
  });

  it("stops working the day after it expires", () => {
    const dated = { code: "DATED", label: "dated", percentBp: 1000, active: true, expiresOn: "2026-06-30" };
    PROMOS.push(dated);
    try {
      expect(findPromo("DATED", { today: new Date(2026, 5, 30) }).promo).toBeTruthy();
      expect(findPromo("DATED", { today: new Date(2026, 6, 1) }).rejected).toBe("expired");
    } finally {
      PROMOS.pop();
    }
  });

  it("enforces a minimum when one is set", () => {
    const big = { code: "BIG", label: "big", amountCents: 5000, active: true, minServiceCents: 20000 };
    PROMOS.push(big);
    try {
      expect(findPromo("BIG", { serviceCents: 10000 }).rejected).toBe("too_small");
      expect(findPromo("BIG", { serviceCents: 25000 }).promo).toBeTruthy();
      // No cart yet means no judgement yet, so the code still validates.
      expect(findPromo("BIG").promo).toBeTruthy();
    } finally {
      PROMOS.pop();
    }
  });

  it("never discounts more than the subtotal", () => {
    const huge = { code: "HUGE", label: "huge", amountCents: 99999, active: true };
    expect(promoDiscountCents(huge, 5000)).toBe(5000);
    expect(promoDiscountCents(huge, 0)).toBe(0);
    expect(promoDiscountCents(null, 5000)).toBe(0);
  });
});

describe("promo codes inside a quote", () => {
  it("takes 10% off the service for LIKENEW", () => {
    const plain = quote(cart(), R);
    const promo = quote(cart({ promoCode: "LIKENEW" }), R);

    expect(promo.promoCode).toBe("LIKENEW");
    expect(promo.promoDiscountCents).toBe(Math.round(plain.serviceSubtotalCents * 0.1));
    expect(promo.serviceSubtotalCents).toBe(
      plain.serviceSubtotalCents - promo.promoDiscountCents,
    );
  });

  it("does NOT discount travel, which is a cost rather than margin", () => {
    const plain = quote(cart({ zip: "45242", oneWayMinutes: 60 }), R);
    const promo = quote(cart({ zip: "45242", oneWayMinutes: 60, promoCode: "LIKENEW" }), R);
    expect(promo.travelCents).toBe(plain.travelCents);
    expect(promo.travelCents).toBeGreaterThan(0);
  });

  it("charges tax on the discounted price, not the original", () => {
    const plain = quote(cart({ zip: "45242" }), R);
    const promo = quote(cart({ zip: "45242", promoCode: "LIKENEW" }), R);
    expect(promo.taxCents).toBeLessThan(plain.taxCents);
  });

  it("ignores a code that does not exist rather than failing the quote", () => {
    const q = quote(cart({ promoCode: "FREESTUFF" }), R);
    expect(q.promoCode).toBeNull();
    expect(q.promoDiscountCents).toBe(0);
    expect(q.promoRejected).toBe("unknown");
    expect(q.totalCents).toBe(quote(cart(), R).totalCents);
  });

  it("shows up as its own line so the customer can see it", () => {
    const q = quote(cart({ promoCode: "LIKENEW" }), R);
    const line = q.lines.find((l) => l.kind === "promo_discount");
    expect(line).toBeTruthy();
    expect(line!.amountCents).toBeLessThan(0);
    expect(line!.label).toContain("LIKENEW");
  });

  it("stacks under the multi-vehicle discount rather than replacing it", () => {
    const two = {
      vehicles: [
        { label: "A", packages: [FULL_INT], addons: [] },
        { label: "B", packages: [FULL_INT], addons: [] },
      ],
    };
    const plain = quote(cart(two), R);
    const promo = quote(cart({ ...two, promoCode: "LIKENEW" }), R);

    expect(plain.multiVehicleDiscountCents).toBeGreaterThan(0);
    expect(promo.multiVehicleDiscountCents).toBe(plain.multiVehicleDiscountCents);
    // 10% of what is left AFTER the vehicle discount, not of the list price.
    expect(promo.promoDiscountCents).toBe(Math.round(plain.serviceSubtotalCents * 0.1));
  });

  it("comes off before the pay in full discount, so they compound honestly", () => {
    const both = quote(cart({ promoCode: "LIKENEW", payInFull: true }), R);
    const promoOnly = quote(cart({ promoCode: "LIKENEW" }), R);
    expect(both.totalCents).toBeLessThan(promoOnly.totalCents);
    expect(both.payInFullSavingsCents).toBeLessThan(
      quote(cart({ payInFull: true }), R).payInFullSavingsCents,
    );
  });
});
