/**
 * Every path that prices a cart has to reach the same number.
 *
 * THE BUG THIS EXISTS FOR. create-payment measured the drive and passed it
 * into priceFromWire. send-confirmation called priceFromWire without it and
 * silently fell back to the ZIP band. For a Mason address that is a 34 minute
 * estimate against a 28 minute measurement, which is $30 against $20: the
 * screen said $20, the card charged $20, and the confirmation email said $30.
 * The customer saw two of those three.
 *
 * Nothing here talks to Google. The point is not whether the measurement is
 * right, it is that every caller ASKS for one, and that they agree given the
 * same answer.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_RULES,
  estimateOneWayMinutes,
  mileageFeeCents,
  priceFromWire,
  type WireCart,
} from "./server-entry.js";

const FUNCTIONS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../netlify/functions");

const cart = (): WireCart => ({
  vehicles: [{ sizeId: "small", packageIds: ["basic-interior"], addons: [] }],
  zip: "45040",
  address: { line1: "5555 Tylersville Rd", city: "Mason", region: "OH", zip: "45040" },
  slot: Date.now() + 6 * 86_400_000,
  kind: "booking",
  payInFull: false,
});

describe("a measured drive and an estimated one are genuinely different prices", () => {
  it("differ by enough to matter, which is why the gap was visible", () => {
    const estimated = estimateOneWayMinutes("45040");
    expect(estimated, "45040 should have a ZIP band").toBeGreaterThan(0);

    const measured = 28; // what Google actually returned for this address
    const feeEstimated = mileageFeeCents(estimated!, DEFAULT_RULES.mileage);
    const feeMeasured = mileageFeeCents(measured, DEFAULT_RULES.mileage);

    expect(feeEstimated).not.toBe(feeMeasured);
    expect(Math.abs(feeEstimated - feeMeasured)).toBeGreaterThanOrEqual(500);
  });

  it("changes the total, so passing the measurement is not cosmetic", () => {
    const withMeasure = priceFromWire(cart(), { measuredOneWayMinutes: 28, nowMs: Date.now() });
    const without = priceFromWire(cart(), { nowMs: Date.now() });
    expect(withMeasure.totalCents).not.toBe(without.totalCents);
    expect(withMeasure.travelSource).toBe("routes");
    expect(without.travelSource).toBe("estimate");
  });

  it("agrees exactly when both paths are handed the same measurement", () => {
    // This is what the two functions now do. Same cart, same minutes, same
    // engine: the totals cannot drift unless someone stops measuring.
    const a = priceFromWire(cart(), { measuredOneWayMinutes: 28, nowMs: 1_700_000_000_000 });
    const b = priceFromWire(cart(), { measuredOneWayMinutes: 28, nowMs: 1_700_000_000_000 });
    expect(a.totalCents).toBe(b.totalCents);
    expect(a.lines).toEqual(b.lines);
  });
});

describe("every server-side pricing path asks for the drive", () => {
  /*
   * A source check, not a behavioural one, because calling the real handlers
   * would mean calling Google. What it catches is the exact mistake that
   * happened: a new endpoint prices a cart and forgets the measurement. The
   * shared helper lives in _routes.mjs so there is one thing to import and
   * one thing to grep for.
   */
  const pricingFunctions = fs
    .readdirSync(FUNCTIONS)
    .filter((f) => f.endsWith(".mjs") && !f.startsWith("_"))
    .filter((f) => fs.readFileSync(path.join(FUNCTIONS, f), "utf8").includes("priceFromWire("));

  it("finds the functions that price a cart", () => {
    expect(pricingFunctions).toContain("create-payment.mjs");
    expect(pricingFunctions).toContain("send-confirmation.mjs");
  });

  for (const name of pricingFunctions) {
    it(`${name} measures the drive before pricing`, () => {
      const src = fs.readFileSync(path.join(FUNCTIONS, name), "utf8");
      expect(src, `${name} should import the shared helper from _routes.mjs`)
        .toMatch(/import\s*\{[^}]*measuredOneWayMinutes[^}]*\}\s*from\s*"\.\/_routes\.mjs"/);
      expect(src, `${name} should pass the measurement into priceFromWire`)
        .toMatch(/measuredOneWayMinutes\s*:/);
    });
  }
});
