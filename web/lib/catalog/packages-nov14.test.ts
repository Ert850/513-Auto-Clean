/** Package changes, November 14: Full Interior + Steam, Showroom Ready Restoration, old links. */
import { describe, expect, it } from "vitest";
import { findPackage, upgradeLegacy } from "./seed.js";
import { addonBlockedReason, findAddon } from "./addons.js";
import { priceFromWire, wireNeeds, type WireCart } from "../server-entry.js";

const NOW = Date.UTC(2026, 10, 11, 17, 0);
const subtotal = (packageIds: string[], addons: { addonId: string; tierId: string }[] = []) => {
  const cart: WireCart = { vehicles: [{ sizeId: "small", packageIds, addons }], zip: "45040", slot: NOW + 7 * 86_400_000, kind: "booking", payInFull: false };
  const p = priceFromWire(cart, { nowMs: NOW });
  expect(p.rejected).toEqual([]);
  return p.serviceSubtotalCents;
};
const R = { addonId: "showroom-restoration", tierId: "std" };
const STEAM = { addonId: "steam", tierId: "std" };

describe("Full Interior + Steam and Showroom Ready Restoration", () => {
  it("Full + steam extra and the Full + Steam package cost the same", () => {
    expect(subtotal(["full-interior"], [STEAM])).toBe(subtotal(["full-steam-interior"]));
    expect(findPackage("full-steam-interior")!.priceCents).toBe(31500);
  });
  it("Restoration totals the same on Full and on Full + Steam ($445 at today's prices)", () => {
    expect(subtotal(["full-interior"], [R])).toBe(44500);
    expect(subtotal(["full-steam-interior"], [R])).toBe(44500);
  });
  it("steam can't be bought twice: blocked with Full + Steam or with Restoration", () => {
    const steam = findAddon("steam")!;
    expect(addonBlockedReason(steam, { packageIds: ["full-steam-interior"], addonTiers: [] })).toBeTruthy();
    expect(addonBlockedReason(steam, { packageIds: ["full-interior"], addonTiers: [R] })).toBeTruthy();
    expect(addonBlockedReason(steam, { packageIds: ["full-interior"], addonTiers: [] })).toBeNull();
  });
  it("Restoration needs a Full Interior", () => {
    const r = findAddon("showroom-restoration")!;
    expect(addonBlockedReason(r, { packageIds: ["basic-interior"], addonTiers: [] })).toBeTruthy();
    expect(addonBlockedReason(r, { packageIds: ["full-steam-interior"], addonTiers: [] })).toBeNull();
  });
  it("Restoration is the owner's work: a detailer without 'restoration' can't take it", () => {
    expect(wireNeeds({ vehicles: [{ sizeId: "small", packageIds: ["full-interior"], addons: [R] }] } as WireCart)).toContain("restoration");
    expect(wireNeeds({ vehicles: [{ sizeId: "small", packageIds: ["full-interior"], addons: [] }] } as WireCart)).not.toContain("restoration");
  });
});

describe("the retired Showroom Ready package (old links, drafts, cached pages)", () => {
  it("becomes Full Interior + Restoration", () => {
    expect(upgradeLegacy(["showroom-interior"], [])).toEqual({ packageIds: ["full-interior"], addons: [R] });
    expect(upgradeLegacy(["showroom-interior", "full-exterior"], [STEAM]).packageIds).toEqual(["full-interior", "full-exterior"]);
  });
  it("is priced by the server, never rejected", () => {
    expect(subtotal(["showroom-interior"])).toBe(subtotal(["full-interior"], [R]));
  });
  it("leaves current packages alone", () => {
    expect(upgradeLegacy(["basic-interior"], [STEAM])).toEqual({ packageIds: ["basic-interior"], addons: [STEAM] });
  });
});
