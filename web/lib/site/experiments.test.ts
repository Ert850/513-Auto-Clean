/**
 * A/B tests (config/experiments.json, docs/AB-TESTING.md).
 *
 * The file is checked at build time, and js/analytics.js runs the split in the
 * browser. These tests run the real analytics.js in a sandbox with a fake page
 * and storage, so the split, its stickiness, the source rule, the element
 * switching and the consent gate are all exercised as shipped.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
// @ts-expect-error: plain ESM build script, no types
import { root } from "../../scripts/chrome.mjs";
// @ts-expect-error: plain ESM build script, no types
import { checkExperiments, experimentsForPage } from "../../scripts/experiments.mjs";

const SRC = fs.readFileSync(path.join(root, "js/analytics.js"), "utf8");

type Test = { id: string; status: string; versions: [string, number][]; sources?: string[]; winner?: string };

function store(seed: Record<string, string> = {}) {
  const m = new Map(Object.entries(seed));
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    map: m,
  };
}

/** One page view. Shares localStorage when passed one, like a returning visitor. */
function page(opts: {
  tests: Test[];
  search?: string;
  local?: ReturnType<typeof store>;
  session?: ReturnType<typeof store>;
  random?: number;
  ga?: string;
  elements?: string[];
}) {
  const els = (opts.elements ?? []).map((v) => {
    const classes = new Set<string>();
    return { attr: v, classList: { add: (c: string) => classes.add(c) }, getAttribute: () => v, shown: () => classes.has("exp-on") };
  });
  const gtagCalls: unknown[][] = [];
  const doc = {
    readyState: "interactive",
    addEventListener() {},
    querySelectorAll: (sel: string) => (sel === "[data-exp]" ? els : []),
    createElement: () => ({ setAttribute() {}, addEventListener() {}, set innerHTML(_v: string) {} }),
    head: { appendChild() {} },
    body: { appendChild() {} },
  };
  const local = opts.local ?? store();
  const win: Record<string, unknown> = {
    AC_CONFIG: { ga4MeasurementId: opts.ga ?? "", clarityProjectId: "" },
    AC_EXPERIMENTS: opts.tests,
  };
  const ctx = {
    window: win,
    document: doc,
    location: { search: opts.search ?? "", reload() {} },
    localStorage: local,
    sessionStorage: opts.session ?? store(),
    URLSearchParams,
    Math: Object.assign(Object.create(Math), { random: () => opts.random ?? 0.1 }),
    JSON,
    Date,
  };
  vm.runInNewContext(SRC, ctx);
  // gtag is created when analytics loads; record what reaches it.
  const dl = (win["dataLayer"] as unknown[][] | undefined) ?? [];
  for (const a of dl) gtagCalls.push(Array.from(a as ArrayLike<unknown>));
  return { win: win as Record<string, (...a: unknown[]) => string>, local, els, gtagCalls, dl: () => (win["dataLayer"] as unknown[] | undefined) ?? [] };
}

const SPLIT: Test = { id: "golf-code", status: "running", versions: [["no-code", 50], ["code", 50]], sources: ["golf"] };

describe("config/experiments.json", () => {
  it("is valid as shipped", () => {
    expect(() => experimentsForPage()).not.toThrow();
  });
  const bad: [string, unknown][] = [
    ["no list", {}],
    ["a misspelt top-level key", { experiments: [], experiment: [] }],
    ["bad id", { experiments: [{ id: "Golf Code", status: "off", versions: { a: 1, b: 1 } }] }],
    ["one version", { experiments: [{ id: "x", status: "off", versions: { a: 1 } }] }],
    ["zero share", { experiments: [{ id: "x", status: "off", versions: { a: 0, b: 1 } }] }],
    ["unknown status", { experiments: [{ id: "x", status: "on", versions: { a: 1, b: 1 } }] }],
    ["ended without a winner", { experiments: [{ id: "x", status: "ended", versions: { a: 1, b: 1 } }] }],
    ["a winner that isn't a version", { experiments: [{ id: "x", status: "ended", versions: { a: 1, b: 1 }, winner: "c" }] }],
    ["a typo'd field", { experiments: [{ id: "x", status: "off", versions: { a: 1, b: 1 }, source: ["golf"] }] }],
    ["the same id twice", { experiments: [{ id: "x", status: "off", versions: { a: 1, b: 1 } }, { id: "x", status: "off", versions: { a: 1, b: 1 } }] }],
  ];
  for (const [what, input] of bad) {
    it(`refuses ${what}`, () => expect(() => checkExperiments(input)).toThrow(/config\/experiments\.json/));
  }
});

describe("the split in the browser (js/analytics.js)", () => {
  it("a visitor from the right source gets a version and keeps it", () => {
    const local = store();
    const first = page({ tests: [SPLIT], search: "?utm_source=golf", local, random: 0.9 });
    expect(first.win.AC_EXP!("golf-code")).toBe("code");
    // Next visit, a new tab without the tag, and a different random number.
    const again = page({ tests: [SPLIT], local, random: 0.1 });
    expect(again.win.AC_EXP!("golf-code")).toBe("code");
    expect(again.win.AC_EXPS!()).toBe("golf-code: code");
  });

  it("shares follow the weights", () => {
    expect(page({ tests: [SPLIT], search: "?utm_source=golf", random: 0.49 }).win.AC_EXP!("golf-code")).toBe("no-code");
    expect(page({ tests: [SPLIT], search: "?utm_source=golf", random: 0.5 }).win.AC_EXP!("golf-code")).toBe("code");
  });

  it("anyone else sees the control and nothing is stored or reported", () => {
    const p = page({ tests: [SPLIT], search: "?utm_source=prestige" });
    expect(p.win.AC_EXP!("golf-code")).toBe("no-code");
    expect(p.local.map.has("ac-exp")).toBe(false);
    expect(p.win.AC_EXPS!()).toBe("");
  });

  it("an off test shows its control, an ended one its winner, an unknown one nothing", () => {
    const off = page({ tests: [{ ...SPLIT, status: "off" }], search: "?utm_source=golf" });
    expect(off.win.AC_EXP!("golf-code")).toBe("no-code");
    expect(off.local.map.has("ac-exp")).toBe(false);
    const ended = page({ tests: [{ ...SPLIT, status: "ended", winner: "code" }] });
    expect(ended.win.AC_EXP!("golf-code")).toBe("code");
    expect(ended.win.AC_EXPS!()).toBe("");
    expect(page({ tests: [] }).win.AC_EXP!("golf-code")).toBe("");
  });

  it("shows only the elements for the chosen version", () => {
    const p = page({ tests: [SPLIT], search: "?utm_source=golf", random: 0.9, elements: ["golf-code:code", "golf-code:no-code"] });
    expect(p.els.map((e) => e.shown())).toEqual([true, false]);
  });

  it("tells Google Analytics only after Accept", () => {
    const declined = page({ tests: [SPLIT], search: "?utm_source=golf", ga: "G-TEST", elements: ["golf-code:code"] });
    expect(declined.dl()).toEqual([]);
    const accepted = page({
      tests: [SPLIT],
      search: "?utm_source=golf",
      ga: "G-TEST",
      random: 0.9,
      local: store({ "ac-analytics": "granted" }),
      elements: ["golf-code:code"],
    });
    const events = accepted.dl().map((a) => Array.from(a as ArrayLike<unknown>));
    expect(events).toContainEqual(["event", "experience_impression", { exp_variant_string: "ac-golf-code-code" }]);
  });

  it("works with storage blocked: a version for this page, nothing kept", () => {
    const blocked = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); }, removeItem() {}, map: new Map() };
    const p = page({ tests: [SPLIT], local: blocked as unknown as ReturnType<typeof store>, session: blocked as unknown as ReturnType<typeof store> });
    expect(p.win.AC_EXP!("golf-code")).toBe("no-code");
  });
});
