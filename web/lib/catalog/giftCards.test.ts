/** Gift cards: what a card costs and what it covers (giftCards.ts). */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { coverTable, coverage, giftCardProblems, maxTaxRateBp, salePriceCents, type GiftCardConfig } from "./giftCards.js";
import { SEED_CATALOG, VEHICLE_SIZES } from "./seed.js";
import { SEED_TAX_TABLE, computeTax } from "../pricing/tax.js";

const cfg = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../../config/gift-cards.json"), "utf8")) as GiftCardConfig;

describe("gift cards", () => {
  it("config/gift-cards.json is valid", () => {
    expect(giftCardProblems(cfg)).toEqual([]);
  });

  it("the sale price comes from the setting, and regular mode sells at value", () => {
    const sale = { mode: "sale" as const, sale: { percentOff: 20, starts: "2026-11-27", ends: "2026-12-25" } };
    expect(salePriceCents(5000, sale)).toBe(4000);
    expect(salePriceCents(25000, sale)).toBe(20000);
    expect(salePriceCents(5000, { ...sale, mode: "regular" })).toBe(5000);
  });

  it("prices with tax exactly as the booking form does, at the highest rate charged", () => {
    expect(maxTaxRateBp()).toBe(Math.max(...SEED_TAX_TABLE.rates.map((r) => r.rateBp)));
    const top = SEED_TAX_TABLE.rates.find((r) => r.rateBp === maxTaxRateBp())!;
    const zip = Object.entries(SEED_TAX_TABLE.zipToCounty).find(([, v]) => v.county === top.county && v.state === top.state)![0].replace(/^\D+-/, "");
    for (const row of coverTable()) {
      const p = SEED_CATALOG.packages.find((x) => x.id === row.id)!;
      for (const s of VEHICLE_SIZES) {
        const base = p.priceCents + s.upchargeCents;
        expect(row.cents[s.id]).toBe(base + computeTax(base, zip.padEnd(5, "0"), SEED_TAX_TABLE, 2026).taxCents);
      }
    }
  });

  it("leaves out what the public can't book: Maintenance and anything coming soon", () => {
    const ids = coverTable().map((r) => r.id);
    for (const p of SEED_CATALOG.packages) {
      if (p.requiresPriorDetail || p.comingSoon) expect(ids).not.toContain(p.id);
    }
  });

  it("the calculator lists what's covered, dearest first, and how far the next one is", () => {
    const rows = [
      { id: "a", name: "A", cents: { small: 10000 } },
      { id: "b", name: "B", cents: { small: 15000 } },
      { id: "c", name: "C", cents: { small: 20000 } },
    ];
    expect(coverage(16000, "small", rows)).toEqual({
      covered: [{ name: "B", cents: 15000 }, { name: "A", cents: 10000 }],
      next: { name: "C", shortCents: 4000 },
    });
    expect(coverage(30000, "small", rows).next).toBeNull();
  });

  it("refuses a broken config", () => {
    const bad = giftCardProblems({
      mode: "half" as never,
      sale: { percentOff: 80, starts: "2026-12-25", ends: "2026-11-27" },
      tiers: [{ value: 100, featured: true }, { value: 50, featured: true }],
      custom: { min: 500, max: 25 },
      checkout: {} as never,
      refundDays: 30,
      scheduleDays: 60,
      sendWindowHours: 0,
      expiryYears: 1,
    }).join("\n");
    for (const msg of ["mode must be", "percentOff", "starts is after", "go up in value", "one featured", "custom.min", "checkout.enabled", "checkout.methods", "expiryYears", "sendWindowHours"]) {
      expect(bad).toContain(msg);
    }
  });
});
