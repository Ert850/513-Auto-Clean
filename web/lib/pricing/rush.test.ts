/**
 * The rush fee settings (config/rush-fee.json, owner November 11, 2026): two
 * days, today and tomorrow, for every booking, and the same for golf booklet
 * readers (the owner chose not to waive it). Matching by source stays built
 * and tested on its own settings, for later. The server must reach the same
 * answer as the browser from the same cart.
 */
import { describe, expect, it } from "vitest";
import {
  RUSH_SETTINGS,
  bookingSide,
  checkRushSettings,
  rushRuleFor,
  rushWindow,
  sourceKey,
} from "./rush.js";
import { DEFAULT_RULES } from "./rules.js";
import { slotNeedsPriority } from "./surcharge.js";
import { priceFromWire, type WireCart } from "../server-entry.js";
import { validateWire } from "./wire.js";

// Noon, Wednesday November 11, 2026, in Cincinnati.
const NOW = Date.UTC(2026, 10, 11, 17, 0);
const DAY = 86_400_000;
const at = (daysAhead: number) => NOW + daysAhead * DAY; // noon on that day

const INT = ["full-interior"];
const EXT = ["full-exterior"];
const BOTH = ["full-interior", "full-exterior"];

describe("the settings as shipped", () => {
  for (const [what, ids] of [["interior", INT], ["exterior only", EXT], ["both", BOTH]] as const) {
    it(`${what}: today and tomorrow, not the day after`, () => {
      const w = rushWindow({ packageIds: [...ids] }, NOW);
      expect([0, 1, 2].map((d) => slotNeedsPriority(at(d), NOW, w))).toEqual([true, true, false]);
    });
  }

  it("golf and Prestige Living visits pay the same rush fee as anyone", () => {
    for (const source of ["golf / print / qr", "prestige / print / qr"]) {
      expect(rushWindow({ source, packageIds: INT }, NOW).minLeadDays).toBe(2);
    }
  });

  it("DEFAULT_RULES.window agrees with the file", () => {
    expect(DEFAULT_RULES.window.minLeadDays).toBe(RUSH_SETTINGS.defaultRushDays);
  });

  it("names every rule, so a log can say which one applied", () => {
    expect(RUSH_SETTINGS.rules.every((r) => r.name.length > 3)).toBe(true);
  });
});

describe("a source rule, kept for later", () => {
  const s = checkRushSettings({
    defaultRushDays: 2,
    rules: [{ name: "Golf: no rush fee", when: { sources: ["golf"] }, rushDays: 0 }],
  });
  it("waives the fee for golf visits only", () => {
    expect(rushWindow({ source: "golf / print / qr", packageIds: EXT }, NOW, s).minLeadDays).toBe(0);
    expect(rushWindow({ source: "prestige / print / qr", packageIds: EXT }, NOW, s).minLeadDays).toBe(2);
    expect(rushWindow({ packageIds: EXT }, NOW, s).minLeadDays).toBe(2);
  });
});

describe("matching", () => {
  const s = checkRushSettings({
    defaultRushDays: 3,
    rules: [
      { name: "summer", when: { from: "2027-06-01", until: "2027-08-31" }, rushDays: 1 },
      { name: "showroom", when: { packages: ["showroom-interior"] }, rushDays: 0 },
    ],
  });
  it("from and until are Cincinnati dates, both included", () => {
    const june1 = Date.UTC(2027, 5, 1, 4, 30); // 12:30am June 1 in Cincinnati
    const may31 = Date.UTC(2027, 5, 1, 3, 30); // 11:30pm May 31
    expect(rushWindow({}, june1, s).minLeadDays).toBe(1);
    expect(rushWindow({}, may31, s).minLeadDays).toBe(3);
    expect(rushWindow({}, Date.UTC(2027, 8, 1, 3, 0), s).minLeadDays).toBe(1); // 11pm Aug 31
    expect(rushWindow({}, Date.UTC(2027, 8, 1, 5, 0), s).minLeadDays).toBe(3); // 1am Sep 1
  });
  it("a package rule matches when any of its packages is booked", () => {
    expect(rushWindow({ packageIds: ["showroom-interior", "full-exterior"] }, NOW, s).minLeadDays).toBe(0);
  });
  it("the first matching rule wins", () => {
    expect(rushRuleFor({ packageIds: ["showroom-interior"] }, Date.UTC(2027, 6, 1, 16), s)?.name).toBe("summer");
  });
  it("a rule asking for a source never matches a visit without one", () => {
    const g = checkRushSettings({ defaultRushDays: 2, rules: [{ name: "g", when: { sources: ["golf"] }, rushDays: 0 }] });
    expect(rushWindow({ source: "", packageIds: EXT }, NOW, g).minLeadDays).toBe(2);
    expect(sourceKey(null)).toBe("");
  });
  it("tells interior, exterior and both apart, and nothing from no packages", () => {
    expect([bookingSide(INT), bookingSide(EXT), bookingSide(BOTH), bookingSide([])]).toEqual([
      "interior",
      "exterior",
      "both",
      null,
    ]);
  });
});

describe("a mistake in the file fails loudly", () => {
  const bad: [string, unknown][] = [
    ["negative days", { defaultRushDays: -1, rules: [] }],
    ["days as text", { defaultRushDays: "3", rules: [] }],
    ["no rules list", { defaultRushDays: 3 }],
    ["unknown kind", { defaultRushDays: 3, rules: [{ name: "x", when: { kinds: ["outside"] }, rushDays: 1 }] }],
    ["unknown package", { defaultRushDays: 3, rules: [{ name: "x", when: { packages: ["full-exteriour"] }, rushDays: 1 }] }],
    ["unknown condition", { defaultRushDays: 3, rules: [{ name: "x", when: { source: ["golf"] }, rushDays: 1 }] }],
    ["bad date", { defaultRushDays: 3, rules: [{ name: "x", when: { until: "June 30" }, rushDays: 1 }] }],
    ["from after until", { defaultRushDays: 3, rules: [{ name: "x", when: { from: "2027-02-01", until: "2027-01-01" }, rushDays: 1 }] }],
  ];
  for (const [what, input] of bad) {
    it(what, () => expect(() => checkRushSettings(input)).toThrow(/config\/rush-fee\.json/));
  }
});

describe("the server prices the rush the same way", () => {
  const cart = (packageIds: string[], slot: number, source?: string): WireCart => ({
    vehicles: [{ sizeId: "small", packageIds, addons: [] }],
    zip: "45040",
    address: { line1: "5555 Tylersville Rd", city: "Mason", region: "OH", zip: "45040" },
    slot,
    kind: "booking",
    payInFull: false,
    ...(source ? { source } : {}),
  });

  it("tomorrow is a rush, the day after tomorrow is not, for every kind of booking", () => {
    for (const ids of [INT, EXT, BOTH]) {
      expect(priceFromWire(cart(ids, at(1)), { nowMs: NOW }).priority).toBe(true);
      expect(priceFromWire(cart(ids, at(2)), { nowMs: NOW }).priority).toBe(false);
    }
  });

  it("a golf visit tomorrow pays the rush like anyone", () => {
    expect(priceFromWire(cart(INT, at(1), "golf"), { nowMs: NOW }).priority).toBe(true);
  });

  it("the wire keeps a clean source and drops junk", () => {
    const body = (source: unknown) => ({
      cart: { ...cart(INT, at(5)), source },
      contact: { name: "Test", phone: "5135550100" },
    });
    const ok = validateWire(body("Golf"), { requireAddress: true, nowMs: NOW });
    expect(ok.ok && ok.booking.cart.source).toBe("golf");
    const junk = validateWire(body("<script>"), { requireAddress: true, nowMs: NOW });
    expect(junk.ok && junk.booking.cart.source).toBe("script");
    const none = validateWire(body(42), { requireAddress: true, nowMs: NOW });
    expect(none.ok && none.booking.cart.source).toBeUndefined();
  });
});
