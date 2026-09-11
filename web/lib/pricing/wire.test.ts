import { describe, expect, it } from "vitest";
import { normalisePhone, validateWire, WIRE_LIMITS } from "./wire.js";
import { priceFromWire } from "../server-entry.js";
import { slotNeedsPriority } from "./surcharge.js";
import { DEFAULT_RULES, MAX_BOOKING_CENTS } from "./rules.js";
import { zonedToUtc } from "../time/zone.js";

const NOW = Date.parse("2026-09-14T15:00:00Z"); // Monday 11am Cincinnati
const DAY = 86_400_000;
const TZ = "America/New_York";

const good = (): any => ({
  cart: {
    vehicles: [{ sizeId: "large", packageIds: ["full-interior", "full-exterior"], addons: [] }],
    address: { line1: "1 Main St", city: "Cincinnati", region: "OH", zip: "45220" },
    slot: NOW + 5 * DAY,
  },
  contact: { name: "Ada", phone: "(513) 555-1212", email: "Ada@Example.com" },
  consent: { termsVersion: "2026-09-11", sms: true, media: false, mandateAccepted: true },
});

const rejects = (mutate: (b: any) => void, error: string, opts: Partial<Parameters<typeof validateWire>[1]> = {}) => {
  const b = good();
  mutate(b);
  const r = validateWire(b, { nowMs: NOW, mode: "card_only", ...opts });
  expect(r.ok, `expected ${error}, got ok`).toBe(false);
  if (!r.ok) expect(r.error).toBe(error);
};

describe("validateWire: shape", () => {
  it("accepts a good booking and normalises it", () => {
    const r = validateWire(good(), { nowMs: NOW, mode: "card_only" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.booking.contact.phone).toBe("+15135551212");
    expect(r.booking.contact.email).toBe("ada@example.com");
    expect(r.booking.cart.zip).toBe("45220");
    expect(r.booking.payInFull).toBe(false);
    expect(r.booking.kind).toBe("booking");
    expect(r.booking.consent.mandateAccepted).toBe(true);
    expect("priority" in r.booking.cart).toBe(false);
  });

  it("refuses non-objects and empties", () => {
    expect(validateWire(null, { nowMs: NOW }).ok).toBe(false);
    expect(validateWire([], { nowMs: NOW }).ok).toBe(false);
    expect(validateWire("x", { nowMs: NOW }).ok).toBe(false);
    rejects((b) => (b.cart = null), "empty_cart");
    rejects((b) => (b.cart.vehicles = []), "empty_cart");
    rejects((b) => (b.cart.vehicles = [null]), "bad_vehicle");
    rejects((b) => (b.cart.vehicles = [1]), "bad_vehicle");
    rejects((b) => (b.cart.vehicles = [{ packageIds: [] }]), "empty_cart");
    rejects((b) => (b.cart.vehicles = Array(WIRE_LIMITS.maxVehicles + 1).fill(b.cart.vehicles[0])), "too_many_vehicles");
  });

  it("refuses packages that do not exist, are coming soon, repeat, or double up a category", () => {
    rejects((b) => (b.cart.vehicles[0].packageIds = ["nope"]), "unknown_package");
    rejects((b) => (b.cart.vehicles[0].packageIds = ["showroom-exterior"]), "not_bookable_yet");
    rejects((b) => (b.cart.vehicles[0].packageIds = ["basic-interior", "basic-interior"]), "duplicate_package");
    rejects((b) => (b.cart.vehicles[0].packageIds = ["basic-interior", "full-interior"]), "one_per_category");
    rejects((b) => (b.cart.vehicles[0].packageIds = "basic-interior"), "bad_packages");
  });

  it("refuses add-ons that do not exist, are not selectable, or repeat", () => {
    rejects((b) => (b.cart.vehicles[0].addons = {}), "bad_addons");
    rejects((b) => (b.cart.vehicles[0].addons = [{ addonId: "nope", tierId: "x" }]), "unknown_addon");
    rejects((b) => (b.cart.vehicles[0].addons = [{ addonId: "pet-hair", tierId: "nope" }]), "unknown_addon");
    rejects(
      (b) => (b.cart.vehicles[0].addons = [
        { addonId: "pet-hair", tierId: "std" },
        { addonId: "pet-hair", tierId: "std" },
      ]),
      "duplicate_addon",
    );
  });

  it("refuses correction while the package that carries it is coming soon", () => {
    rejects((b) => (b.cart.vehicles[0].correction = { tierId: "one-step", coatingId: "3yr" }), "not_bookable_yet");
  });
});

describe("validateWire: slot, kind, mode", () => {
  it("refuses bad, past and far-future slots", () => {
    rejects((b) => (b.cart.slot = 1e20), "slot_too_far");
    rejects((b) => (b.cart.slot = "abc"), "bad_slot");
    rejects((b) => (b.cart.slot = NaN), "bad_slot");
    rejects((b) => (b.cart.slot = NOW - 1000), "slot_in_past");
    rejects((b) => (b.cart.slot = NOW + (WIRE_LIMITS.maxDaysAhead + 1) * DAY), "slot_too_far");
  });

  it("an inquiry has no slot and cannot prepay", () => {
    rejects((b) => (b.cart.kind = "inquiry"), "inquiry_has_slot");
    rejects(
      (b) => {
        b.cart.kind = "inquiry";
        b.cart.slot = null;
      },
      "inquiry_cannot_prepay",
      { mode: "pay_now" },
    );
    const b = good();
    b.cart.kind = "inquiry";
    b.cart.slot = null;
    const r = validateWire(b, { nowMs: NOW, mode: "card_only" });
    expect(r.ok && r.booking.kind).toBe("inquiry");
  });

  it("payInFull comes from the mode, never from the cart", () => {
    const b = good();
    (b.cart as any).payInFull = true;
    const r1 = validateWire(b, { nowMs: NOW, mode: "card_only" });
    expect(r1.ok && r1.booking.payInFull).toBe(false);
    const r2 = validateWire(b, { nowMs: NOW, mode: "pay_now" });
    expect(r2.ok && r2.booking.payInFull).toBe(true);
  });

  it("the priority flag from the browser is dropped", () => {
    const b = good();
    (b.cart as any).priority = false;
    const r = validateWire(b, { nowMs: NOW, mode: "card_only" });
    expect(r.ok && (r.booking.cart as any).priority).toBeUndefined();
  });
});

describe("validateWire: address, zip, contact", () => {
  it("requires an address with a five digit ZIP inside the three states", () => {
    rejects((b) => (b.cart.address = null), "missing_address");
    rejects((b) => (b.cart.address.zip = ""), "bad_zip");
    rejects((b) => (b.cart.address.zip = "abc12"), "bad_zip");
    rejects((b) => (b.cart.address.zip = "90210"), "zip_out_of_area");
    rejects((b) => (b.cart.address.zip = "99999"), "zip_out_of_area");
    rejects((b) => (b.cart.address.line1 = "x".repeat(WIRE_LIMITS.maxLine1 + 1)), "bad_address");
    for (const z of ["45220", "45322", "41011", "47025", "43215"]) {
      const b = good();
      b.cart.address.zip = z;
      expect(validateWire(b, { nowMs: NOW }).ok, z).toBe(true);
    }
  });

  it("the cart zip cannot disagree with the address", () => {
    const b = good();
    (b.cart as any).zip = "";
    const r = validateWire(b, { nowMs: NOW });
    expect(r.ok && r.booking.cart.zip).toBe("45220");
  });

  it("validates contact details", () => {
    rejects((b) => (b.contact = null), "missing_contact");
    rejects((b) => (b.contact.name = ""), "bad_name");
    rejects((b) => (b.contact.name = "x".repeat(WIRE_LIMITS.maxName + 1)), "bad_name");
    rejects((b) => (b.contact.phone = "abc"), "bad_phone");
    rejects((b) => (b.contact.phone = "' OR email:'"), "bad_phone");
    rejects((b) => (b.contact.phone = "0135551212"), "bad_phone");
    rejects((b) => (b.contact.email = "not-an-email"), "bad_email");
    rejects((b) => (b.contact.name = {}), "bad_name");
  });

  it("normalises phones", () => {
    expect(normalisePhone("513-555-1212")).toBe("+15135551212");
    expect(normalisePhone("+1 (513) 555 1212")).toBe("+15135551212");
    expect(normalisePhone("15135551212")).toBe("+15135551212");
    expect(normalisePhone("5551212")).toBeNull();
    expect(normalisePhone(5135551212 as any)).toBeNull();
  });
});

describe("priceFromWire after validation", () => {
  const monday = zonedToUtc(2026, 9, 14, 11, 0, 0, TZ);

  it("derives priority from the slot and ignores the browser", () => {
    const wire = { vehicles: [{ sizeId: "large", packageIds: ["full-interior"] }], zip: "45220" };
    const soon = priceFromWire({ ...wire, slot: monday + 1 * DAY, priority: false }, { nowMs: monday });
    const later = priceFromWire({ ...wire, slot: monday + 5 * DAY, priority: true }, { nowMs: monday });
    expect(soon.priority).toBe(true);
    expect(soon.surchargeBp).toBe(DEFAULT_RULES.surcharge.priorityBp);
    expect(later.priority).toBe(false);
    expect(later.surchargeBp).toBe(0);
  });

  it("Monday to Thursday is not priority, Wednesday is", () => {
    const r = DEFAULT_RULES.window;
    expect(slotNeedsPriority(zonedToUtc(2026, 9, 17, 10, 0, 0, TZ), monday, r)).toBe(false);
    expect(slotNeedsPriority(zonedToUtc(2026, 9, 16, 10, 0, 0, TZ), monday, r)).toBe(true);
    // Tick over to Tuesday 12:01am and Thursday becomes priority.
    const tue = zonedToUtc(2026, 9, 15, 0, 1, 0, TZ);
    expect(slotNeedsPriority(zonedToUtc(2026, 9, 17, 10, 0, 0, TZ), tue, r)).toBe(true);
  });

  it("pay in full comes only from the option", () => {
    const wire = { vehicles: [{ sizeId: "large", packageIds: ["full-interior"] }], zip: "45220", payInFull: true };
    const a = priceFromWire(wire, { nowMs: monday });
    const b = priceFromWire(wire, { nowMs: monday, payInFull: true });
    expect(a.totalCents).toBeGreaterThan(b.totalCents);
  });

  it("the booking ceiling clears a big legitimate cart", () => {
    const wire = {
      vehicles: [1, 2].map(() => ({
        sizeId: "large",
        packageIds: ["full-interior", "full-exterior"],
        addons: [
          { addonId: "pet-hair", tierId: "std" },
          { addonId: "engine-bay", tierId: "std" },
        ],
      })),
      zip: "45220",
      slot: monday + 1 * DAY,
    };
    const q = priceFromWire(wire, { nowMs: monday });
    expect(q.rejected.filter((r) => !/pet-hair|engine-bay/.test(r)).length).toBe(0);
    expect(q.totalCents).toBeLessThan(MAX_BOOKING_CENTS);
    expect(q.totalCents).toBeGreaterThan(200_000 * 0.4);
  });
});
