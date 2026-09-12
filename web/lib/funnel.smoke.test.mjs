/**
 * The booking funnel actually opens.
 *
 * js/funnel.js is 3,000 lines of plain browser JavaScript with no build step
 * and, until this file, no test. It shipped a completely blank booking form:
 * a second `function fail()` was added in the same scope as an existing one,
 * the later declaration silently replaced the earlier, and every validator
 * ended up handing a string to a function that expected a DOM node. The first
 * render threw, so the modal opened with a title, a Continue button and
 * nothing in between. `node --check` passes on that file all day.
 *
 * So: a DOM small enough to write by hand, big enough to run a real render.
 * It is not a browser and does not try to be. It answers one question, which
 * is the question nobody was asking: does the thing open.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/* ---------------- the smallest DOM that renders ---------------- */

function makeDom() {
  const byId = new Map();

  function makeEl(tag = "div", id = "") {
    const kids = [];
    const el = {
      tagName: String(tag).toUpperCase(),
      id,
      dataset: {},
      style: {},
      hidden: false,
      disabled: false,
      value: "",
      offsetParent: {},
      children: kids,
      parentNode: null,
      _html: "",
      _text: "",
      classList: {
        _s: new Set(),
        add(...c) { c.forEach((x) => this._s.add(x)); },
        remove(...c) { c.forEach((x) => this._s.delete(x)); },
        toggle(c, on) { if (on === undefined) { this._s.has(c) ? this._s.delete(c) : this._s.add(c); } else if (on) this._s.add(c); else this._s.delete(c); },
        contains(c) { return this._s.has(c); },
      },
      get innerHTML() { return el._html; },
      set innerHTML(v) { el._html = String(v); },
      get textContent() { return el._text; },
      set textContent(v) { el._text = String(v); },
      get firstChild() { return kids[0] ?? null; },
      setAttribute() {}, getAttribute() { return null; },
      removeAttribute() {}, hasAttribute() { return false; },
      appendChild(c) { kids.push(c); c.parentNode = el; return c; },
      insertBefore(c) { kids.unshift(c); c.parentNode = el; return c; },
      removeChild(c) { const i = kids.indexOf(c); if (i > -1) kids.splice(i, 1); return c; },
      remove() {},
      addEventListener() {}, removeEventListener() {},
      // Ids resolve through the shared map, so el('bkBody') returns the SAME
      // node every call and what the funnel writes can be read back. That is
      // the whole point: a querySelector that invents a fresh element makes
      // every assertion pass and proves nothing.
      querySelector(sel) {
        const m = /^#([\w-]+)$/.exec(String(sel));
        if (m) return lookup(m[1]);
        // A real DOM would find the child. Returning null here made the shim
        // fail on code that is perfectly fine in a browser, which is worse
        // than useless: a test that cries wolf gets switched off.
        return makeEl("span");
      },
      querySelectorAll() { return []; },
      closest() { return null; },
      focus() {}, select() {}, scrollIntoView() {}, click() {},
      contains() { return false; },
      setSelectionRange() {},
      getBoundingClientRect() { return { top: 0, bottom: 100, left: 0, right: 100, width: 100, height: 100 }; },
    };
    return el;
  }

  function lookup(id) {
    if (!byId.has(id)) byId.set(id, makeEl("div", id));
    return byId.get(id);
  }

  const document = {
    readyState: "complete",
    body: makeEl("body"),
    documentElement: makeEl("html"),
    getElementById: lookup,
    createElement: (t) => makeEl(t),
    querySelector: (sel) => {
      const m = /^#([\w-]+)$/.exec(String(sel));
      return m ? lookup(m[1]) : null;
    },
    querySelectorAll: () => [],
    addEventListener() {}, removeEventListener() {},
    execCommand: () => true,
  };

  const window = {
    document,
    location: { hash: "", origin: "https://513autoclean.com", pathname: "/", href: "" },
    navigator: { clipboard: null, maxTouchPoints: 0, userAgent: "node" },
    console: { log() {}, warn() {}, error() {} },
    // Run timers inline: the funnel defers loadSlots and mountPayment through
    // setTimeout, and a throw in either is a bug this file should see.
    setTimeout: (fn) => { fn(); return 0; },
    clearTimeout() {},
    addEventListener() {},
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    innerHeight: 800,
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    fetch: () => Promise.resolve({ ok: false, json: () => Promise.resolve({}) }),
  };
  window.window = window;

  return { window, document, lookup };
}

function loadFunnel(hash = "") {
  const { window, document, lookup } = makeDom();
  window.location.hash = hash;
  const run = (rel) => {
    const code = fs.readFileSync(path.join(ROOT, rel), "utf8");
    new Function(
      "window", "document", "location", "navigator", "localStorage", "fetch", "setTimeout", "clearTimeout", "btoa", "atob", "console",
      code,
    )(
      window, document, window.location, window.navigator, window.localStorage, window.fetch,
      window.setTimeout, window.clearTimeout,
      (s) => Buffer.from(s, "binary").toString("base64"),
      (s) => Buffer.from(s, "base64").toString("binary"),
      window.console,
    );
  };
  run("js/pricing.bundle.js");
  run("js/funnel.js");
  return { window, document, lookup };
}

/* ---------------- the tests ---------------- */

describe("the booking funnel opens", () => {
  let env;
  beforeAll(() => { env = loadFunnel(); });

  it("loads the pricing bundle with everything the funnel reads off it", () => {
    const P = env.window.ACPricing;
    expect(P, "js/pricing.bundle.js did not define window.ACPricing").toBeTruthy();
    // Every name funnel.js reaches for on P at module scope or first render.
    for (const key of [
      "RULES", "formatCents", "quote", "VEHICLE_SIZES", "findPackage", "findAddon",
      "packagesFor", "vehicleSize", "IN_PERSON", "isLive", "LEGAL", "TIME_BANDS",
      "slotNeedsPriority", "localMinutesOfDay", "earliestBookableDate", "findPromo",
      "normalisePromo", "promoMessage", "quoteUrl", "decodeQuote",
    ]) {
      expect(P[key], `window.ACPricing.${key} is missing`).toBeDefined();
    }
  });

  it("mounts and exposes an open()", () => {
    expect(typeof env.window.ACFunnel?.open).toBe("function");
  });

  it("renders the first step instead of a blank box", () => {
    env.window.ACFunnel.open();

    const body = env.lookup("bkBody").innerHTML;
    const nav = env.lookup("bkNav").innerHTML;

    // This is the assertion that was missing. The modal chrome rendered fine
    // while the body was empty, so "it opened" was never the question.
    expect(body.length, "the first step rendered nothing").toBeGreaterThan(100);
    expect(body).toContain("data-size");
    expect(nav.length, "the step nav rendered nothing").toBeGreaterThan(50);
    expect(nav).toContain("Vehicle");
    expect(nav).toContain("Accept");
  });

  it("renders the last step, which is the one with the most on it", () => {
    // A quote link opens the funnel straight on Confirm. That is the only way
    // to reach the busiest screen without simulating clicks, and it is the
    // screen carrying the access questions, the promo box, the card
    // authorization and the payment options: four things added recently, none
    // of which had ever been rendered by anything but a person.
    const P = env.window.ACPricing;
    const url = P.quoteUrl(
      {
        v: 1,
        ts: Math.floor(Date.now() / 1000),
        vs: [{ z: "small", i: "interior", p: ["basic-interior"] }],
        ad: ["1 Main St", "Cincinnati", "OH", "45220"],
        ct: ["Ada", "5135551212", "ada@example.com"],
      },
      "https://513autoclean.com/",
    );
    const hash = url.slice(url.indexOf("#"));

    const fresh = loadFunnel(hash);
    const body = fresh.lookup("bkBody").innerHTML;

    expect(body.length, "the confirm step rendered nothing").toBeGreaterThan(200);
    expect(body, "the promo field should be on the confirm step").toContain("bkPromo");
    expect(body, "the access questions should be on the confirm step").toContain("data-access");
    expect(body, "the card authorization should be on the confirm step").toContain("bkMandate");

    // Add-ons are editable from here, so nobody has to walk five screens
    // back to change one while looking at the total.
    expect(body, "the extras picker should be on the confirm step").toContain("data-extraadd");
    // This quote has no add-ons on it, so the picker gets the dark treatment.
    expect(body, "with nothing added it should be the dark panel").toContain("bk-extras empty");
  });

  it("offers real add-ons in the confirm-step picker, and no unbookable ones", () => {
    const P = env.window.ACPricing;
    const url = P.quoteUrl(
      {
        v: 1,
        ts: Math.floor(Date.now() / 1000),
        vs: [{ z: "small", i: "exterior", p: ["basic-exterior"] }],
        ad: ["1 Main St", "Cincinnati", "OH", "45220"],
        ct: ["Ada", "5135551212", ""],
      },
      "https://513autoclean.com/",
    );
    const body = loadFunnel(url.slice(url.indexOf("#"))).lookup("bkBody").innerHTML;

    const options = [...body.matchAll(/<option value="([^"|]+)\|([^"]+)"/g)].map((m) => m[1]);
    expect(options.length, "the picker should offer something").toBeGreaterThan(2);

    // Everything offered has to be bookable. Scratch work and coatings are
    // switched off in the catalog and must not appear here just because this
    // is a different screen from the extras step.
    for (const id of options) {
      const a = P.findAddon(id);
      expect(a, `${id} is not a real add-on`).toBeTruthy();
      expect(P.isSelectable(a), `${id} is not bookable but was offered`).toBe(true);
    }
    expect(options).not.toContain("scratch-reduction");
    expect(options).not.toContain("ceramic-coating");
  });

  it("a shared quote link keeps the time it was built with", () => {
    // The recipient opens a link for a specific hour. Losing it on the way in
    // is the worst outcome there is: they came for that time.
    const P = env.window.ACPricing;
    const slot = Date.now() + 6 * 86_400_000;
    const url = P.quoteUrl(
      {
        v: 1,
        ts: Math.floor(Date.now() / 1000),
        vs: [{ z: "small", i: "interior", p: ["basic-interior"] }],
        ad: ["1 Main St", "Cincinnati", "OH", "45220"],
        ct: ["Ada", "5135551212", ""],
        sl: slot,
      },
      "https://513autoclean.com/",
    );
    const body = loadFunnel(url.slice(url.indexOf("#"))).lookup("bkBody").innerHTML;

    expect(body, "the confirm step should show the quoted time").toContain("Your time");
    const day = new Date(slot).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    expect(body, `expected ${day} somewhere in the summary`).toContain(day);
  });

  it("does not offer to take money online while it cannot take money online", () => {
    const P = env.window.ACPricing;
    expect(P.isLive("cardOnFile"), "this test assumes payments are still off").toBe(false);

    const url = P.quoteUrl(
      {
        v: 1,
        ts: Math.floor(Date.now() / 1000),
        vs: [{ z: "small", i: "interior", p: ["basic-interior"] }],
        ad: ["1 Main St", "Cincinnati", "OH", "45220"],
        ct: ["Ada", "5135551212", ""],
        sl: Date.now() + 6 * 86_400_000,
      },
      "https://513autoclean.com/",
    );
    const body = loadFunnel(url.slice(url.indexOf("#"))).lookup("bkBody").innerHTML;

    // A discount for doing something the site cannot do yet, which also
    // rewrote the total of the option next to it.
    expect(body, "the pay-now option should be hidden until Stripe is live").not.toContain('data-pay="now"');
    expect(body).not.toMatch(/Pay now and save/);
  });

  it("puts the chrome in the right state for step one", () => {
    env.window.ACFunnel.open();
    // Both of these are set AFTER the body renders, so if the render throws
    // they keep their default and stay visible. That is exactly how the blank
    // screen looked: a Back arrow and a Continue button that should not have
    // been on screen at all.
    expect(env.lookup("bkBack").hidden, "Back should be hidden on step one").toBe(true);
    expect(env.lookup("bkNext").hidden, "step one advances on click, so Continue should be hidden").toBe(true);
  });
});

describe("hidden means hidden", () => {
  /**
   * The shim above cannot see CSS, so it cheerfully reported that the Back
   * arrow was hidden while the real page showed it. The browser's own
   * `[hidden] { display: none }` is specificity 0,1,0, every `.bk-thing
   * { display: … }` is also 0,1,0, and at a tie the author stylesheet wins.
   *
   * That made `.bk-leave`, a fixed full-screen 55% black sheet at z-index
   * 410, permanently visible over the modal: the booking form looked greyed
   * out and swallowed every click.
   */
  const css = fs.readFileSync(path.join(ROOT, "book.css"), "utf8");
  const funnel = fs.readFileSync(path.join(ROOT, "js/funnel.js"), "utf8");

  it("styles.css makes the hidden attribute win globally", () => {
    const site = fs.readFileSync(path.join(ROOT, "styles.css"), "utf8").replace(/\s+/g, " ");
    expect(site, "a class with a display beats [hidden] without this").toContain("[hidden] { display: none !important; }");
  });

  it("book.css neutralises the hidden attribute inside the funnel", () => {
    expect(
      css.replace(/\s+/g, " "),
      "without this, any class with a display beats the hidden attribute",
    ).toContain("#bookFunnel [hidden] { display: none !important; }");
  });

  it("every element the funnel hides by attribute is inside #bookFunnel", () => {
    // The rule above is scoped, so anything hidden outside that subtree is
    // not covered by it and needs its own guard.
    const ids = [...funnel.matchAll(/id="(bk\w+)"[^>]*\shidden\b/g)].map((m) => m[1]);
    expect(ids.length, "expected the shell to hide some elements by attribute").toBeGreaterThan(3);
    // Everything in SHELL is inside #bookFunnel by construction; this asserts
    // the shell is still where they live rather than having moved to body.
    for (const id of ids) {
      expect(funnel, `${id} should be declared inside the funnel shell`).toContain(`id="${id}"`);
    }
  });
});

describe("no two functions share a name in one scope", () => {
  /**
   * The bug was two `function fail()` declarations in the same scope. That is
   * legal JavaScript: the later one silently replaces the earlier, and every
   * caller of the first gets the second. Nothing warns, and `node --check`
   * is perfectly happy.
   *
   * Nesting is the whole difficulty. reviews.js has a paint() inside
   * renderGrid and another inside renderTicker, which is two different local
   * helpers and entirely fine. So this tracks the chain of enclosing function
   * declarations by indentation and only compares siblings.
   */
  const duplicatesIn = (code) => {
    const stack = [];
    const seen = new Map();
    const dupes = [];
    const lines = code.split(/\r?\n/);

    lines.forEach((line, n) => {
      const m = /^(\s*)function\s+([A-Za-z_$][\w$]*)\s*\(/.exec(line);
      if (!m) return;
      const indent = m[1].length;
      const name = m[2];

      while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
      const scope = stack.map((f) => f.name).join(">") + "|" + indent;
      const key = scope + "|" + name;

      if (seen.has(key)) {
        dupes.push(`${name}() declared twice in the same scope, lines ${seen.get(key)} and ${n + 1}`);
      } else {
        seen.set(key, n + 1);
      }
      stack.push({ indent, name });
    });

    return dupes;
  };

  for (const f of ["js/funnel.js", "js/travel.js", "js/reviews.js", "js/gallery.js", "script.js"]) {
    it(`${f} declares each function once per scope`, () => {
      const code = fs.readFileSync(path.join(ROOT, f), "utf8");
      expect(duplicatesIn(code), "the later declaration silently replaces the earlier one").toEqual([]);
    });
  }

  it("catches a real collision, and forgives a nested one", () => {
    // Siblings: the second silently wins. This is the shape of the bug.
    expect(duplicatesIn(["function a() {}", "function a() {}"].join("\n"))).toHaveLength(1);

    // Two local helpers with the same name in different parents. Fine, and
    // reviews.js really does this with paint() in renderGrid and renderTicker.
    expect(
      duplicatesIn(
        ["function one() {", "  function p() {}", "}", "function two() {", "  function p() {}", "}"].join("\n"),
      ),
    ).toEqual([]);
  });
});
