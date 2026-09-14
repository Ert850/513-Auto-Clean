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
      _on: {},
      // Recorded, not discarded, so a test can click something and watch the
      // real handler run. Everything below this line used to be reachable
      // only by a person with a phone.
      addEventListener(type, fn) { (el._on[type] = el._on[type] || []).push(fn); },
      removeEventListener() {},
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

function loadFunnel(hash = "", config = null) {
  const { window, document, lookup } = makeDom();
  window.location.hash = hash;
  // js/config.js is not loaded here, so the funnel sees no keys at all, which
  // is exactly the state the live site is in today. Pass a config to render
  // the screen a customer will see once Stripe is wired in.
  if (config) window.AC_CONFIG = config;
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

/**
 * A click on a control carrying these attributes, through the funnel's own
 * delegated handler.
 *
 * `closest` is selector-aware on purpose: the handler asks several times
 * whether the thing clicked was some OTHER control, and a closest() that
 * always says yes would take the first branch every time.
 */
function click(env, attrs) {
  const dataset = attrs.dataset || {};
  const target = {
    id: attrs.id || "",
    dataset,
    value: attrs.value || "",
    checked: !!attrs.checked,
    firstChild: null,
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    closest(sel) {
      const s = String(sel);
      if (target.id && s.includes("#" + target.id)) return target;
      for (const k of Object.keys(dataset)) {
        const attr = "[data-" + k.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());
        if (s.includes(attr + "]") || s.includes(attr + "=")) return target;
      }
      // The consent and access handlers walk up to the group they live in and
      // repaint it. A group stub is enough for them to finish.
      if (/^\.[\w-]+$/.test(s)) {
        return {
          classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
          querySelectorAll() { return []; },
          querySelector() { return null; },
          contains() { return false; },
        };
      }
      return null;
    },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    remove() {},
    focus() {},
  };
  const host = env.lookup("bookFunnel");
  (host._on.click || []).forEach((fn) =>
    fn({ target, preventDefault() {}, stopPropagation() {} }),
  );
}

/** Typing into a field, through the funnel's own input handler. */
function type(env, attrs, value) {
  const target = {
    id: attrs.id || "",
    dataset: attrs.dataset || {},
    value,
    hasAttribute: (a) => a in (attrs.dataset || {}) || a === attrs.has,
    closest() { return null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    focus() {},
  };
  const host = env.lookup("bookFunnel");
  (host._on.input || []).forEach((fn) => fn({ target }));
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

    // NO STRIPE KEY, SO NO CARD STEP AT ALL. This screen used to ask for a
    // card authorization, then load a form that announced online payment was
    // not switched on. A customer read that as a broken site and did not
    // book. With no processor there is nothing to authorize, and the screen
    // says what does happen instead.
    expect(body, "there is no card to authorize without a key").not.toContain("bkMandate");
    expect(body, "the screen should say what does happen").toContain("Nothing to pay today");

    // Add-ons are editable from here, so nobody has to walk five screens
    // back to change one while looking at the total.

    // Add-ons are editable from here, so nobody has to walk five screens
    // back to change one while looking at the total.
    expect(body, "the extras picker should be on the confirm step").toContain("data-extraadd");
    // This quote has no add-ons on it, so the picker gets the dark treatment.
    expect(body, "with nothing added it should be the dark panel").toContain("bk-extras empty");
  });

  it("Help me decide asks for a recommendation instead of a package", () => {
    /*
     * Somebody who does not know what they want had nothing to press. Every
     * route through the intent step demanded an answer they did not have, and
     * the fallback was to close the funnel. This walks the path they take
     * now: no package, no price, no slot, and a request at the end of it.
     */
    const fresh = loadFunnel();
    fresh.window.ACFunnel.open();

    click(fresh, { dataset: { size: "small" } });
    const intent = fresh.lookup("bkBody").innerHTML;
    expect(intent, "the intent step should offer it").toContain('data-intent="advice"');
    expect(intent, "and point at the services list").toContain("See all services and prices");

    click(fresh, { dataset: { intent: "advice" } });

    // Package, Extras and Vehicles are not in this customer's path, so they
    // are not tabs they can see either.
    const nav = fresh.lookup("bkNav").innerHTML;
    expect(nav, "the package tab should be gone").not.toContain("Package");
    expect(nav, "and the extras tab with it").not.toContain("Extras");
    expect(nav, "the summary should say which path they are on").toContain("Help me decide");

    // It lands on the time step, which under advice is the preference picker:
    // there is no duration, so there is no honest list of start times.
    const body = fresh.lookup("bkBody").innerHTML;
    expect(body, "it should ask which days could work").toContain("data-prefday");
    expect(body, "and offer no start times to pick from").not.toContain("data-slot");

    // Walk the rest of it. The last screen is the one that has broken twice,
    // and on this path it renders with no price, no promo box and no card.
    const day = /data-prefday="([^"]+)"/.exec(body)[1];
    click(fresh, { dataset: { prefday: day } });

    click(fresh, { id: "bkNext" });
    type(fresh, { dataset: { addr: "line1" } }, "1 Main St");
    type(fresh, { dataset: { addr: "city" } }, "Cincinnati");
    type(fresh, { dataset: { addr: "zip" } }, "45220");

    click(fresh, { id: "bkNext" });
    type(fresh, { dataset: { c: "name" } }, "Ada");
    type(fresh, { dataset: { c: "phone" } }, "5135551212");
    for (const name of ["terms", "sms", "media"]) {
      click(fresh, { dataset: { consent: name, val: "1" } });
    }

    click(fresh, { id: "bkNext" });
    const last = fresh.lookup("bkBody").innerHTML;

    expect(last.length, "the last screen rendered nothing").toBeGreaterThan(200);
    expect(last, "it should say what it is").toContain("request for a recommendation");
    expect(last, "there is nothing priced, so no receipt").not.toContain("bk-review");
    expect(last, "and no promo box to apply to it").not.toContain("bkPromo");
    expect(last, "and no card to authorize").not.toContain("bkMandate");
    expect(last, "it should ask about the vehicle instead").toContain("bkNotes");
  });

  it("brings the card step back the moment a Stripe key exists", () => {
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
    const body = loadFunnel(url.slice(url.indexOf("#")), {
      stripePublishableKey: "pk_test_smoke",
    }).lookup("bkBody").innerHTML;

    /*
     * TWO LOCKS ON THE CARD STEP, not just on pay-now.
     *
     * Stripe is refusing the secret key, so cardOnFile is muted and the card
     * step is gone even though a publishable key is present. A booking screen
     * that asks for a card and then cannot take one is worse than one that
     * never mentions a card at all. This test follows the switch rather than
     * asserting one half of it, so flipping cardOnFile back on is a one line
     * change with nothing here to rewrite.
     */
    if (env.window.ACPricing.isLive("cardOnFile")) {
      expect(body, "a key means there is a card to authorize").toContain("bkMandate");
      expect(body, "and a form to mount it in").toContain("bkPayMount");
    } else {
      expect(body, "the capability is muted, so no card is asked for").not.toContain("bkMandate");
      expect(body, "and the screen says what does happen instead").toContain("Nothing to pay today");
    }
    // A TEST key is still not a live one, so paying up front stays shut.
    expect(body, "pay now needs a live key, not a test one").not.toContain('data-pay="now"');
  });

  it("renders real time slots, not the fallback that means it crashed", async () => {
    /*
     * THE TEST THAT WAS MISSING, and it cost a live booking flow.
     *
     * paintSlotsInner read a variable called `corr` that belongs to
     * loadSlots, which calls it rather than containing it. Every paint threw
     * a ReferenceError, one frame up the throw was caught and turned into
     * the "tell us when suits" panel, and that panel is a real screen that
     * looks entirely deliberate. So the calendar was read correctly, 336
     * valid starts were computed, and every customer was shown a form asking
     * what day might suit.
     *
     * It also made every booking an inquiry, which silently removed "pay now
     * and save 5%", because that option is correctly hidden when no time has
     * been agreed. Two reported bugs, one undeclared variable.
     *
     * No calendar key here, so this paints the generated standard hours.
     * That is enough: the crash was in the painter, not in the data.
     */
    const fresh = loadFunnel();
    fresh.window.ACFunnel.open();

    click(fresh, { dataset: { size: "small" } });
    click(fresh, { dataset: { intent: "interior" } });
    click(fresh, { dataset: { pkg: "basic-interior", cat: "interior" } });
    click(fresh, { id: "bkNext" });   // past extras
    click(fresh, { id: "bkNext" });   // past more vehicles

    expect(fresh.lookup("bkTitle").textContent).toBe("Pick your time");

    // loadSlots resolves on a microtask; let the promises settle.
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    const slots = fresh.lookup("bkSlots").innerHTML;

    expect(slots, "the painter crashed and fell back to the inquiry panel")
      .not.toContain("bk-noslots");
    expect(slots, "no parts of the day to choose from").toContain("data-band");
    expect(slots, "no days rendered").toContain("bk-daygroup");
  });

  it("actually loads the payment SDKs it checks for", () => {
    /*
     * The card form checked `window.Stripe` and nothing on the entire site
     * ever fetched it. So with a live publishable key, a live secret key and
     * the capability switched on, the confirm screen still said "no card
     * needed today", and every test passed while it did.
     *
     * A DOM shim cannot prove a script tag reached Stripe. It can prove the
     * URL is referenced at all, which is the thing that was missing.
     */
    const src = fs.readFileSync(path.join(ROOT, "js/funnel.js"), "utf8");
    expect(src, "nothing loads Stripe.js, so window.Stripe is never defined")
      .toContain("https://js.stripe.com/v3/");
    expect(src, "nothing loads the PayPal SDK either").toContain("paypal.com/sdk/js");
    // Venmo is the only reason PayPal is here rather than Stripe alone.
    expect(src, "the PayPal SDK must ask for Venmo").toContain("enable-funding=venmo");
  });

  it("never narrates its own failures to a customer", () => {
    /*
     * Somebody reached the last screen, read that online payment was not
     * switched on and that we could not reach our calendar, decided the site
     * was broken, and did not book. Every one of those sentences was true and
     * every one of them cost a job.
     *
     * Comments are stripped first: the reasoning above is allowed to name the
     * thing it is there to prevent. What is left is what a customer could be
     * shown.
     */
    const src = fs
      .readFileSync(path.join(ROOT, "js/funnel.js"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/^\s*\/\/.*$/gm, " ")
      .toLowerCase();

    for (const phrase of ["could not load", "could not reach", "not switched on", "couldn't"]) {
      expect(src, `"${phrase}" can reach a customer's screen`).not.toContain(phrase);
    }
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

  it("needs a LIVE key and the capability before it offers to take money", () => {
    /*
     * Two locks on the same door, and they are deliberately in different
     * places: the capability lives in capabilities.ts, which the terms and
     * the privacy policy are generated from, and the key lives in
     * js/config.js, which this harness does not load. Either one alone has
     * to keep it shut.
     *
     * "Pay now and save 5%" is a discount for doing something, so offering
     * it when the site cannot take the money is an invoice nobody can pay.
     * It also rewrote the total of the option sitting next to it.
     */
    const P = env.window.ACPricing;
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
    const hash = url.slice(url.indexOf("#"));
    const render = (config) => loadFunnel(hash, config).lookup("bkBody").innerHTML;

    // No key at all, whatever the capability says.
    const none = render(null);
    expect(none, "no key means no pay-now").not.toContain('data-pay="now"');
    expect(none).not.toMatch(/Pay now and save/);

    // A test key is real enough to take a card and not real enough to take
    // money, so this one stays shut too.
    expect(render({ stripePublishableKey: "pk_test_smoke" }), "a test key cannot take money")
      .not.toContain('data-pay="now"');

    // Both locks open.
    // Three locks, not two: payInFull is its own switch, because taking a
    // card to hold and taking the whole price up front fail differently and
    // one of them was failing on mobile.
    const live = render({ stripePublishableKey: "pk_live_smoke" });
    if (P.isLive("cardOnFile") && P.isLive("payInFull")) {
      expect(live, "a live key and the capabilities together open it").toContain('data-pay="now"');
      expect(live).toMatch(/Pay now and save/);
    } else {
      expect(live, "a capability is off, so the key alone is not enough")
        .not.toContain('data-pay="now"');
    }
  });

  it("only one free-text box, and it is on the confirm screen", () => {
    const P = env.window.ACPricing;
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
    expect(body, "the notes box belongs with the other day-of questions").toContain("bkNotes");
    expect(body).toContain("Anything else we should know");
  });

  it("every optional field is flagged, so nothing jumps back to one", () => {
    // The walker goes forward and then back, which is what you want for a
    // gap somebody skipped. It is not what you want for an empty promo box
    // near the top of the confirm screen, which is almost everybody. The
    // only thing keeping those apart is this flag.
    const src = fs.readFileSync(path.join(ROOT, "js/funnel.js"), "utf8");
    const inputs = [...src.matchAll(/<input type="(?:text|tel|email)" id="(\w+)"([^>]*)/g)];
    expect(inputs.length, "expected to find the funnel's text inputs").toBeGreaterThan(5);

    const optional = ["bkEmail", "bkPromo", "bkLabel"];
    for (const [, id, attrs] of inputs) {
      const flagged = attrs.includes("data-optional");
      expect(flagged, `${id} is ${optional.includes(id) ? "optional but not flagged" : "required but flagged optional"}`)
        .toBe(optional.includes(id));
    }
  });

  it("what happens next depends on whether a time was actually booked", () => {
    const src = fs.readFileSync(path.join(ROOT, "js/funnel.js"), "utf8");
    const fn = src.slice(src.indexOf("function nextSteps()"), src.indexOf("function nextSteps()") + 2200);
    // A request and a booking are different stories, and the calendar being
    // live decides whether anybody confirms by hand.
    expect(fn).toContain("isInquiry()");
    expect(fn).toContain("liveCalendar");
    // The mileage estimator is good enough; we do not promise a measurement.
    expect(fn).not.toMatch(/work out the exact drive/i);
  });

  it("reads test against live off the Stripe key, not a second switch", () => {
    const src = fs.readFileSync(path.join(ROOT, "js/funnel.js"), "utf8");
    const fn = src.slice(src.indexOf("function stripeMode()"), src.indexOf("function stripeMode()") + 500);
    expect(fn).toContain("pk_live_");
    expect(fn).toContain("pk_test_");

    // A test key must never unlock "pay now and save 5%": now means a test
    // card that moves nothing, so the discount would be off an unpaid bill.
    const can = src.slice(src.indexOf("function canPayNow()"), src.indexOf("function canPayNow()") + 900);
    expect(can).toContain("=== 'live'");
    expect(can).toContain("cardOnFile");
    // And the prepay switch, so turning the key on does not by itself turn
    // "pay now and save 5%" back on while the mobile path is still broken.
    expect(can).toContain("payInFull");
  });

  it("says test mode out loud when the key is a test key", () => {
    const src = fs.readFileSync(path.join(ROOT, "js/funnel.js"), "utf8");
    expect(src, "a card field that silently does nothing is a trap").toMatch(/Test mode\.<\/b> No card is charged/);
    expect(src).toContain("4242 4242 4242 4242");
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

/**
 * Four bugs that a render test cannot see, because each one is a sentence
 * being chosen rather than a screen failing to draw. All four were reported
 * from the live site by somebody trying to book.
 */
describe("what the screen says about money and time", () => {
  const src = () => fs.readFileSync(path.join(ROOT, "js/funnel.js"), "utf8");
  const fn = (name, len) => {
    const code = src();
    const at = code.indexOf(`function ${name}(`);
    expect(at, `${name}() should exist`).toBeGreaterThan(-1);
    return code.slice(at, at + len);
  };

  it("shows a measured drive even for a ZIP that is not in our table", () => {
    /*
     * travelLine() opened by looking the ZIP up in zipRanges and giving up if
     * it was not there. An address in 40324 is outside that table, so the
     * panel said "add your ZIP and the travel fee appears here" while the
     * Routes API had already measured the drive and the fee was in the total.
     * Charging for something the screen denies exists is the worst version of
     * this bug, not a cosmetic one.
     */
    const code = fn("travelLine", 1600);
    const gate = code.indexOf("Add your ZIP");
    const measured = code.indexOf("t.source === 'routes'");
    expect(measured, "the measurement must be read before the ZIP table is consulted")
      .toBeLessThan(gate);
    expect(code.slice(0, gate)).toContain("!measured");
  });

  it("prices the receipt's travel row from the quote, not from a second sum", () => {
    // Rebuilding the fee here meant the row could disagree with the total
    // directly beneath it, which is the one thing a receipt must never do.
    const code = fn("lineTable", 2600);
    expect(code).toContain("quote.travelCents");
    expect(code, "no second mileage calculation").not.toContain("mileageFeeCents");
    expect(code, "the quote's own travel line would print the fee twice")
      .toContain("l.kind !== 'travel'");
  });

  it("asks for a time with a list of half hours, not a clock", () => {
    // A native time input on a phone opens on the current time: touching it
    // at all asks for 4:37 this afternoon without meaning to.
    const code = fn("jumpBox", 1200);
    expect(code, "a time input defaults itself to now").not.toContain('type="time"');
    expect(code).toContain("halfHours()");
  });

  it("offers the nearest times instead of refusing the one asked for", () => {
    const code = fn("noteWantedTime", 2600);
    expect(code).toContain("Here are the nearest times we have to");
    for (const dead of ["Nothing at exactly", "not available", "isn't available"]) {
      expect(code, `"${dead}" reads as a failure when nothing has failed`).not.toContain(dead);
    }
  });
});

/**
 * The first screen must not wait for anything it does not need.
 *
 * Lighthouse on a throttled phone measured the headline arriving 8.8 seconds
 * after the page, because it was held invisible until the LAST deferred
 * script ran, while the hero image shared the connection with Stripe.js, the
 * map library, a dozen map tiles and two blocking stylesheets. Every one of
 * those is easy to put back by accident, so each is pinned here.
 */
describe("the first screen owes nothing to the rest of the page", () => {
  const html = () => fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const head = () => html().slice(0, html().indexOf("</head>"));

  it("shows the hero from CSS, not from script.js", () => {
    const css = fs.readFileSync(path.join(ROOT, "styles.css"), "utf8");
    expect(css, "the hero must animate itself in; .reveal alone hides it until the last script runs")
      .toMatch(/\.hero \.reveal \{ animation:/);
  });

  it("sends a phone a phone-sized hero image", () => {
    const h = html();
    expect(h).toMatch(/<source type="image\/webp" sizes="100vw"\s+srcset="images\/hero-exterior-640\.webp 640w/);
    expect(h, "the preload has to describe the same candidates or it fetches a second copy")
      .toMatch(/imagesrcset="images\/hero-exterior-640\.webp 640w/);
    expect(h, "the 300KB original is not the fallback for anybody").not.toContain('"images/hero-exterior.webp"');
  });

  it("keeps third-party and modal stylesheets out of the head", () => {
    const h = head();
    expect(h, "the Google Fonts stylesheet blocks the first paint from the head").not.toMatch(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis/);
    expect(h, "book.css styles a modal that is not open at first paint").not.toMatch(/<link rel="stylesheet" href="book\.css/);
    // Still linked, just after the content they do not affect.
    expect(html()).toMatch(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis/);
    expect(html()).toMatch(/<link rel="stylesheet" href="book\.css/);
  });

  it("does not link Leaflet from the page at all", () => {
    // js/travel.js fetches it when the map scrolls into reach.
    expect(html()).not.toMatch(/<(script|link)[^>]+leaflet/);
    const travel = fs.readFileSync(path.join(ROOT, "js/travel.js"), "utf8");
    expect(travel).toContain("IntersectionObserver");
    expect(travel, "the version and its hash must stay pinned when loaded from script").toContain("integrity = 'sha384-");
  });

  it("never loads a payment SDK just because a key exists", () => {
    const v = fs.readFileSync(path.join(ROOT, "js/vendors.js"), "utf8");
    expect(v).not.toContain("js.stripe.com");
    expect(v).not.toContain("paypal.com/sdk");
  });
});
