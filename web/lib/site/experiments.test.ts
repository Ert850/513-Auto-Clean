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
import { checkExperimentPages, checkExperiments, experimentsForPage } from "../../scripts/experiments.mjs";

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
  words?: { test: string; versions: Record<string, string>; html: string }[];
  /** "loading": the script runs from the head while the page is still arriving. */
  readyState?: string;
}) {
  const els = (opts.elements ?? []).map((v) => {
    const classes = new Set<string>();
    return { attr: v, classList: { add: (c: string) => classes.add(c) }, getAttribute: () => v, shown: () => classes.has("exp-on") };
  });
  const docEl = {};
  const words = (opts.words ?? []).map((w) => ({
    innerHTML: w.html,
    // Parsed already, unless a test says the parser is still inside it.
    nextSibling: {} as unknown,
    parentNode: docEl,
    getAttribute: (a: string) => (a === "data-exp-words" ? w.test : a.startsWith("data-exp-") ? w.versions[a.slice(9)] ?? null : null),
  }));
  const gtagCalls: unknown[][] = [];
  const listeners: Record<string, (() => void)[]> = {};
  const appended: number[] = [];
  const observers: { cb: () => void; on: boolean }[] = [];
  const doc = {
    readyState: opts.readyState ?? "interactive",
    documentElement: docEl,
    addEventListener(t: string, f: () => void) { (listeners[t] ??= []).push(f); },
    removeEventListener(t: string, f: () => void) { listeners[t] = (listeners[t] ?? []).filter((x) => x !== f); },
    querySelectorAll: (sel: string) => (sel === "[data-exp]" ? els : sel === "[data-exp-words]" ? words : []),
    createElement: () => ({ setAttribute() {}, addEventListener() {}, set innerHTML(_v: string) {} }),
    head: { appendChild() {} },
    body: { appendChild: () => void appended.push(1) },
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
    MutationObserver: class {
      o: { cb: () => void; on: boolean };
      constructor(cb: () => void) { this.o = { cb, on: false }; observers.push(this.o); }
      observe() { this.o.on = true; }
      disconnect() { this.o.on = false; }
    },
  };
  vm.runInNewContext(SRC, ctx);
  // gtag is created when analytics loads; record what reaches it.
  const dl = (win["dataLayer"] as unknown[][] | undefined) ?? [];
  for (const a of dl) gtagCalls.push(Array.from(a as ArrayLike<unknown>));
  return {
    win: win as Record<string, (...a: unknown[]) => string>, local, els, words, gtagCalls,
    dl: () => (win["dataLayer"] as unknown[] | undefined) ?? [],
    /** The parser added nodes: what a MutationObserver hears before the next paint. */
    mutate: () => observers.filter((o) => o.on).forEach((o) => o.cb()),
    /** The page is parsed. */
    parsed: () => { doc.readyState = "interactive"; (listeners["readystatechange"] ?? []).slice().forEach((f) => f()); },
    observing: () => observers.some((o) => o.on),
    bannerShown: () => appended.length > 0,
  };
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

  it("swaps a headline's words for a visitor in another version, and leaves the control's for everyone else (November 16)", () => {
    const HEAD: Test = { id: "hero-headline", status: "running", versions: [["greater-cincinnati", 34], ["cincinnati", 33], ["the-513", 33]] };
    const w = { test: "hero-headline", html: "in Greater Cincinnati.", versions: { cincinnati: "in Cincinnati.", "the-513": "across the 513." } };
    expect(page({ tests: [HEAD], random: 0.1, words: [w] }).words[0]!.innerHTML).toBe("in Greater Cincinnati.");
    expect(page({ tests: [HEAD], random: 0.5, words: [w] }).words[0]!.innerHTML).toBe("in Cincinnati.");
    expect(page({ tests: [HEAD], random: 0.9, words: [w] }).words[0]!.innerHTML).toBe("across the 513.");
    expect(page({ tests: [{ ...HEAD, status: "off" }], random: 0.9, words: [w] }).words[0]!.innerHTML).toBe("in Greater Cincinnati.");
    // Ended: everyone gets the winner's words.
    expect(page({ tests: [{ ...HEAD, status: "ended", winner: "the-513" }], random: 0.1, words: [w] }).words[0]!.innerHTML).toBe("across the 513.");
  });

  it("swaps the words as soon as the parser closes the headline, not when the page is done (validation, November 16)", () => {
    // The hero fades in from CSS without waiting for scripts, so a swap at the
    // end of parsing showed the control's words first on a slow phone.
    const HEAD: Test = { id: "hero-headline", status: "running", versions: [["greater-cincinnati", 34], ["the-513", 66]] };
    const p = page({ tests: [HEAD], random: 0.9, readyState: "loading", words: [{ test: "hero-headline", html: "in Greater", versions: { "the-513": "across the 513." } }] });
    const h1 = p.words[0]!;
    // The network chunk ended inside the headline: leave it alone, or the rest of its words would land after ours.
    h1.nextSibling = null;
    p.mutate();
    expect(h1.innerHTML).toBe("in Greater");
    // The next node arrived, so the headline is whole: swapped before the browser paints again.
    h1.nextSibling = {};
    p.mutate();
    expect(h1.innerHTML).toBe("across the 513.");
    expect(p.observing()).toBe(true);
    p.parsed();
    expect(p.observing()).toBe(false);
    expect(h1.innerHTML).toBe("across the 513.");
  });

  it("a booking on another page still names the version the visitor was given (November 16)", () => {
    const HEAD: Test = { id: "hero-headline", status: "running", versions: [["greater-cincinnati", 34], ["cincinnati", 33], ["the-513", 33]] };
    const local = store();
    const home = page({ tests: [HEAD], random: 0.9, local, words: [{ test: "hero-headline", html: "x", versions: { "the-513": "y" } }] });
    expect(home.win.AC_EXPS!()).toBe("hero-headline: the-513");
    // Services: no headline on this page, so nothing asks; the booking email still says which one they saw.
    const services = page({ tests: [HEAD], local });
    expect(services.win.AC_EXPS!()).toBe("hero-headline: the-513");
    // A test that has ended is not reported.
    expect(page({ tests: [{ ...HEAD, status: "ended", winner: "cincinnati" }], local }).win.AC_EXPS!()).toBe("");
  });

  it("Google Analytics events on another page carry the version too (validation, November 16)", () => {
    const HEAD: Test = { id: "hero-headline", status: "running", versions: [["greater-cincinnati", 34], ["the-513", 66]] };
    const local = store({ "ac-analytics": "granted" });
    page({ tests: [HEAD], random: 0.9, local, ga: "G-TEST", words: [{ test: "hero-headline", html: "x", versions: { "the-513": "y" } }] });
    const services = page({ tests: [HEAD], local, ga: "G-TEST" });
    (services.win.AC_TRACK as unknown as (n: string, p?: object) => void)("booking_submitted", {});
    const events = services.dl().map((a) => Array.from(a as ArrayLike<unknown>));
    expect(events).toContainEqual(["event", "booking_submitted", { exp_variant_string: "ac-hero-headline-the-513" }]);
  });

  it("loaded from the head, the consent banner still waits for the page and then shows", () => {
    const p = page({ tests: [], ga: "G-TEST", readyState: "loading" });
    expect(p.bannerShown()).toBe(false);
    p.parsed();
    expect(p.bannerShown()).toBe(true);
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

describe("the pages match config/experiments.json (validation, November 16)", () => {
  const pages = () =>
    Object.fromEntries(fs.readdirSync(root).filter((f: string) => f.endsWith(".html")).map((f: string) => [f, fs.readFileSync(path.join(root, f), "utf8")]));
  it("every page as shipped", () => {
    expect(() => checkExperimentPages(experimentsForPage(), pages())).not.toThrow();
  });
  const T = [{ id: "h", status: "running", versions: [["a", 1], ["b", 1], ["c", 1]] as [string, number][] }];
  const ok = '<h1 data-exp-words="h" data-exp-b="B" data-exp-c="C">A</h1>';
  it("accepts words for every version but the control", () => expect(() => checkExperimentPages(T, { "x.html": ok })).not.toThrow());
  const wrong: [string, string][] = [
    ["a version's words missing", '<h1 data-exp-words="h" data-exp-b="B">A</h1>'],
    ["words for a version the test doesn't have", '<h1 data-exp-words="h" data-exp-b="B" data-exp-c="C" data-exp-d="D">A</h1>'],
    ["words for the control (its words are the element's own)", '<h1 data-exp-words="h" data-exp-a="A" data-exp-b="B" data-exp-c="C">A</h1>'],
    ["an unknown test", '<h1 data-exp-words="nope">A</h1>'],
    ["an element for an unknown version", '<p data-exp="h:z">Z</p>'],
    ["an element for an unknown test", '<p data-exp="nope:a">A</p>'],
  ];
  for (const [what, html] of wrong) it(`refuses ${what}`, () => expect(() => checkExperimentPages(T, { "x.html": html })).toThrow(/x\.html/));
  it('refuses a version called "words"', () =>
    expect(() => checkExperiments({ experiments: [{ id: "x", status: "off", versions: { a: 1, words: 1 } }] })).toThrow(/words/));
});
