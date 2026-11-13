/** Steam is $80 with Full Interior and $115 on any other package (Elijah, November 13). */
import { describe, expect, it } from "vitest";
import { findAddon, tierPriceFor } from "./addons.js";
import { priceFromWire, type WireCart } from "../server-entry.js";

const NOW = Date.UTC(2026, 10, 11, 17, 0);
const tier = findAddon("steam")!.tiers[0]!;

function steamCost(pkg: string): number {
  const cart = (addons: WireCart["vehicles"][number]["addons"]): WireCart => ({
    vehicles: [{ sizeId: "small", packageIds: [pkg], addons }],
    zip: "45040",
    slot: NOW + 5 * 86_400_000,
    kind: "booking",
    payInFull: false,
  });
  const withSteam = priceFromWire(cart([{ addonId: "steam", tierId: "std" }]), { nowMs: NOW });
  const without = priceFromWire(cart([]), { nowMs: NOW });
  expect(withSteam.rejected).toEqual([]);
  return withSteam.serviceSubtotalCents - without.serviceSubtotalCents;
}

describe("steam price by package", () => {
  it("reads the package price from the tier", () => {
    expect(tierPriceFor(tier, ["full-interior"])).toBe(tier.withPackage!["full-interior"]);
    expect(tierPriceFor(tier, ["basic-interior"])).toBe(tier.priceCents);
    expect(tierPriceFor(tier)).toBe(tier.priceCents);
  });
  it("is charged that way by the server", () => {
    expect(steamCost("full-interior")).toBe(tier.withPackage!["full-interior"]);
    expect(steamCost("basic-interior")).toBe(tier.priceCents);
  });
});
