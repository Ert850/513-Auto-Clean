/** Gift cards: what a card costs and what it covers (giftCards.ts). */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { coverTable, coverage, coversLine, giftCardProblems, maxTaxRateBp, salePriceCents, type GiftCardConfig } from "./giftCards.js";
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

  it("a tier's 'Covers' line never promises more than the card buys", () => {
    const rows = coverTable();
    for (const t of cfg.tiers) {
      const value = t.value * 100;
      const line = coversLine(value, rows);
      const named = rows.find((r) => line.includes(` ${r.name} for `));
      if (!named) { expect(line).toBe("Toward any detail or add-on"); continue; }
      const sizes = line.includes("any vehicle") ? VEHICLE_SIZES.map((s) => s.id)
        : line.includes("SUV or truck") ? ["small", "medium"] : ["small"];
      for (const s of sizes) expect(named.cents[s], `${line} (${s})`).toBeLessThanOrEqual(value);
      // And the line names the dearest package a car gets.
      expect(Math.max(...rows.map((r) => r.cents.small!).filter((c) => c <= value))).toBe(named.cents.small);
    }
  });

  it("words the sizes and the article", () => {
    const rows = [{ id: "x", name: "Express Exterior", cents: { small: 8000, medium: 9000, large: 11000 } }];
    expect(coversLine(8500, rows)).toBe("Covers an Express Exterior for a car, tax included");
    expect(coversLine(9500, rows)).toBe("Covers an Express Exterior for a car, SUV or truck, tax included");
    expect(coversLine(11000, rows)).toBe("Covers an Express Exterior for any vehicle, tax included");
    expect(coversLine(5000, rows)).toBe("Toward any detail or add-on");
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
    }).join("\n");
    for (const msg of ["mode must be", "percentOff", "starts is after", "go up in value", "one featured", "custom.min", "checkout.enabled"]) {
      expect(bad).toContain(msg);
    }
  });
});
