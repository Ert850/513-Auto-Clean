/** The gift card page and its links (config/gift-cards.json, web/scripts/gift-cards.mjs). */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
// @ts-expect-error plain ESM build scripts
import { buyLabel, buyLine, cardFace, tierName, viewAt, giftCalc, giftHead, giftPages, giftTerms, giftTiers, giftTopLink, loadGiftCards } from "../../scripts/gift-cards.mjs";
// @ts-expect-error plain ESM build scripts
import { CHROME_PAGES, valuesFor } from "../../scripts/chrome.mjs";

const root = path.resolve(__dirname, "../../..");
const read = (f: string) => fs.readFileSync(path.join(root, f), "utf8");
const cfg = loadGiftCards();
const SALE = { ...cfg, mode: "sale", sale: { percentOff: 20, starts: "2026-11-27", ends: "2026-12-25" } };
const at = (iso: string, c: object = SALE) => viewAt(c, Date.parse(iso));
const during = at("2026-12-01T17:00:00Z");
const before = at("2026-11-23T17:00:00Z");
const after = at("2026-12-27T17:00:00Z");
const regular = at("2026-12-01T17:00:00Z", { ...SALE, mode: "regular" });
const as = (mode: string) => ({ ...cfg, mode });

describe("gift card page", () => {
  it("during the sale: the value on the card, the price in the button with the value struck through, all from the setting (approved mock, November 26)", () => {
    const tiers = giftTiers(during);
    expect(tiers).toContain('<h2 class="sr-only">$250 gift card, you pay $200</h2>');
    expect(tiers).toContain('<button type="button" class="btn btn-ghost btn-block" data-gc-buy="250" aria-label="Buy a $250 gift card for $200"><span class="gc-buy-line" aria-hidden="true"><span class="gc-buy-for">Buy for</span> <s class="gc-buy-was">$250</s> <span class="gc-buy-now">$200</span></span></button>');
    expect(buyLine(3700, 2960)).toContain('<span class="gc-buy-now">$29.60</span>');
    expect(buyLabel(25000, 20000, false)).toBe("Buy a $250 gift card for $200");
    expect(buyLabel(25000, 20000, true)).toBe("Buy a $250 card for $200");
    expect(tierName(25000, 20000)).toBe("$250 gift card, you pay $200");
    // No sale pill, no price row and no "Covers" line on a tile any more: "Gift card" sits where the pill was.
    expect(cardFace(5000)).not.toMatch(/gc-off|% off/);
    expect(cardFace(5000)).toContain('<span class="gc-face-label">Gift card</span>');
    expect(tiers).not.toMatch(/gc-price|gc-covers|gc-off|You pay|Save \$/);
    expect(giftHead(during)).toContain('<span class="gc-sale-only">Every card is 20% off through December 25. </span>');
  });

  it("before the sale: full prices, and the sale's dates said (validation pass 1: no sale prices before it starts)", () => {
    expect(giftHead(before)).toContain('<span class="gc-sale-soon">Every card will be 20% off from November 27 to December 25. </span>');
    expect(giftTiers(before)).toContain(' aria-label="Buy a $50 gift card"><span class="gc-buy-line" aria-hidden="true"><span class="gc-buy-for">Buy for</span> <span class="gc-buy-now">$50</span></span></button>');
    expect(giftTiers(before)).toContain('<h2 class="sr-only">$50 gift card</h2>');
    expect(giftTiers(before)).not.toContain("gc-buy-was");
    expect(giftCalc(before)).toContain(">Buy a $250 card</button>");
    expect(giftCalc(before)).toContain('data-gc-built-sale="0"');
    expect(giftTopLink(before)).toContain('<span class="tb-gift-sale" hidden>');
  });

  it("after the sale, and in regular mode: nothing reads as a sale", () => {
    for (const v of [after, regular]) {
      const shown = [giftHead(v), giftTiers(v), giftCalc(v), giftTopLink(v)].join("").replace(/<(span)[^>]* hidden>[\s\S]*?<\/\1>/g, "");
      expect(shown).not.toMatch(/<s[ >]|Save \$|% off|through December|you pay/);
    }
    expect(giftHead(regular)).not.toContain("Holiday");
  });

  it("no amount, percentage or date is typed into the page: the generated regions match the setting", () => {
    const page = read("gift-cards.html");
    for (const name of ["HEAD", "TIERS", "CALC", "TERMS"]) {
      expect(page).toContain(`<!-- GIFTCARDS:${name}:START -->`);
    }
    if (cfg.mode === "off") return;
    // Built for the day it was built: before, during or after the sale. Any one
    // of the three, exactly (validation pass 2: not red on the sale's first day).
    const days = [Date.parse(cfg.sale.starts + "T12:00:00Z") - 86_400_000, Date.parse(cfg.sale.starts + "T17:00:00Z"), Date.parse(cfg.sale.ends + "T12:00:00Z") + 2 * 86_400_000];
    const built = days.map((d) => viewAt(cfg, d)).find((v) => page.includes(giftTiers(v)));
    expect(built, "the page matches none of the sale's states: npm run build").toBeTruthy();
    expect(page).toContain(giftCalc(built));
    // Outside the generated regions, the hand-written page carries no money or percentage.
    const outside = page.replace(/<!-- GIFTCARDS:(\w+):START -->[\s\S]*?<!-- GIFTCARDS:\1:END -->/g, "");
    expect(outside.slice(outside.indexOf("<main>"), outside.indexOf("</main>"))).not.toMatch(/\$\d|\d+%/);
  });

  it("after the sale: says it has ended, that cards are full price, and when next year's runs, until that day (Elijah, November 23)", () => {
    const withNext = { ...SALE, sale: { ...SALE.sale, next: { starts: "2027-11-27", ends: "2027-12-25" } } };
    const ended = at("2026-12-27T17:00:00Z", withNext);
    expect(ended.endedNext).toBe(true);
    expect(giftHead(ended)).toContain('<span class="gc-sale-ended">Our holiday sale has ended, and you can still buy gift cards at full price. Our next sale runs from November 27 to December 25, 2027. </span>');
    expect(giftTiers(ended)).toContain('<span class="gc-buy-now">$50</span></span></button>');
    expect(giftTiers(ended)).not.toContain("gc-buy-was");
    // During the sale, and once next year's dates have come, the line is hidden.
    expect(giftHead(at("2026-12-01T17:00:00Z", withNext))).toContain('<span class="gc-sale-ended" hidden>');
    expect(at("2027-11-27T17:00:00Z", withNext).endedNext).toBe(false);
    // Without next year's dates there's no such line at all.
    expect(giftHead(after)).not.toContain("gc-sale-ended");
  });

  it("any amount to the cent in the calculator, no highlighted card, and the card's life said from the setting", () => {
    expect(giftCalc(during)).toContain('step="0.01"');
    expect(giftCalc(during)).toContain('inputmode="decimal"');
    expect(cfg.tiers.some((t: { featured?: boolean }) => t.featured)).toBe(false);
    expect(giftTiers(during)).not.toContain("Our pick");
    expect(giftTerms(during)).toContain(`<li>Good for ${cfg.expiryYears} years, no fees</li>`);
    expect(read("gift-certificate.html")).not.toContain("Anything else");
    expect(read("terms.html")).toContain(`it can be used for ${cfg.expiryYears} years from the day it was bought`);
  });

  it("the setting refuses a card shorter-lived than federal law allows, a payment method that bans gift cards, and next year's dates before this year's end", async () => {
    // @ts-expect-error plain ESM build output
    const { giftCardProblems } = await import("../../../netlify/functions/_pricing.mjs");
    expect(giftCardProblems(cfg)).toEqual([]);
    expect(giftCardProblems({ ...cfg, expiryYears: 1 }).join()).toMatch(/expiryYears/);
    expect(giftCardProblems({ ...cfg, checkout: { ...cfg.checkout, methods: ["card", "klarna"] } }).join()).toMatch(/checkout.methods/);
    expect(giftCardProblems({ ...cfg, checkout: { ...cfg.checkout, methods: ["card", "affirm"] } }).join()).toMatch(/checkout.methods/);
    expect(giftCardProblems({ ...cfg, checkout: { ...cfg.checkout, methods: ["link"] } }).join()).toMatch(/checkout.methods/);
    expect(giftCardProblems({ ...cfg, sale: { ...cfg.sale, next: { starts: "2026-12-01", ends: "2026-12-20" } } }).join()).toMatch(/sale.next/);
  });

  it("the buy buttons stay disabled until the checkout exists", () => {
    const off = { ...during, checkout: { enabled: false } };
    const buttons = (giftTiers(off) + giftCalc(off)).match(/<button[^>]*data-gc-buy[^>]*>/g)!;
    expect(buttons.length).toBe(cfg.tiers.length + 1);
    for (const b of buttons) expect(b).toContain(" disabled");
    expect(giftTerms(off)).toContain("Buying online opens soon.");
    expect(giftTiers({ ...during, checkout: { enabled: true } })).not.toContain(" disabled");
  });

  it('mode "off" removes the page and every link: the site is as it was before gift cards', () => {
    expect(giftPages(as("off"))).toEqual([]);
    expect(giftTopLink(viewAt(as("off")))).toBe("");
    expect(read("web/partials/header.html")).toContain("{{gift}}");
    if (cfg.mode !== "off") {
      expect(CHROME_PAGES).toContain("gift-cards.html");
      expect(valuesFor("index.html", "").gift).toContain('href="gift-cards.html"');
      expect(read("sitemap.xml")).toContain("https://513autoclean.com/gift-cards</loc>");
    }
  });

  it("the booking page's top bar leaves the link out (it wrapped beside the location pill)", () => {
    expect(valuesFor("booking.html", "").gift).toBe("");
  });

  it("class names stay clear of ad-blocker words (CLAUDE.md)", () => {
    const names = [...read("gift-cards.html").matchAll(/class="([^"]+)"/g), ...giftTopLink(cfg).matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1]!.split(/\s+/));
    for (const n of names) expect(n).not.toMatch(/^(ad-|ad_|ads|advert)|banner|promo|sponsor|popup/);
  });

  /**
   * js/giftcards.js re-prices the tiles in the browser when the sale has
   * started or ended since the build. Run it on a page built the other way and
   * check the tiles come out exactly as the build would write them for today.
   */
  it("the browser re-prices a tile into the build's own markup (js/giftcards.js = gift-cards.mjs)", async () => {
    // @ts-expect-error plain ESM build output
    const real = await import("../../../netlify/functions/_pricing.mjs");
    const src = read("js/giftcards.js");
    for (const saleNow of [true, false]) {
      const view = saleNow ? during : regular;
      const el = (attrs: Record<string, string> = {}) => {
        const a = { ...attrs };
        const e: Record<string, unknown> = {
          hidden: false, innerHTML: "", textContent: "", value: "250", children: [],
          getAttribute: (k: string) => (k in a ? a[k] : null),
          setAttribute: (k: string, v: string) => { a[k] = String(v); },
          removeAttribute: (k: string) => { delete a[k]; },
          addEventListener: () => {}, focus: () => {},
          classList: { toggle: () => {}, add: () => {}, remove: () => {} },
          querySelector: () => null, querySelectorAll: () => [],
          attrs: a,
        };
        return e;
      };
      const tiles = cfg.tiers.map((t: { value: number }) => {
        const h2 = el(), btn = el({ "data-gc-buy": String(t.value) });
        const tile = el({ "data-gc-value": String(t.value) });
        tile.querySelector = (q: string) => (q === "h2" ? h2 : q === "[data-gc-buy]" ? btn : null);
        return { value: t.value * 100, h2, btn, tile };
      });
      const calc = el({ "data-gc-min": String(cfg.custom.min), "data-gc-max": String(cfg.custom.max), "data-gc-built-sale": saleNow ? "0" : "1" });
      const parts: Record<string, unknown> = { "#gcAmt": el(), ".gc-err": el(), ".gc-out": el(), ".gc-calc-price": el(), '[data-gc-buy="custom"]': el(), 'input[name="gcSize"]:checked': null };
      calc.querySelector = (q: string) => parts[q] ?? null;
      const document = {
        querySelector: (q: string) => (q === ".gc-calc" ? calc : null),
        querySelectorAll: (q: string) => (q === ".gc-tier[data-gc-value]" ? tiles.map((t: { tile: unknown }) => t.tile) : []),
        getElementById: () => null,
        createElement: () => el(),
        addEventListener: () => {},
      };
      const P = { ...real, GIFT_CARDS: { mode: view.mode, sale: view.sale, scheduleDays: cfg.scheduleDays }, saleOn: () => saleNow, saleEndedNext: () => false, cincinnatiDay: () => "2026-12-01" };
      vm.runInNewContext(src, { window: { ACPricing: P, addEventListener: () => {} }, document, setTimeout, clearTimeout, Intl });
      const built = giftTiers(view);
      for (const t of tiles) {
        const pay = saleNow ? Math.round((t.value * (100 - view.sale.percentOff)) / 100) : t.value;
        expect(t.btn.innerHTML).toBe(buyLine(t.value, pay));
        expect((t.btn.attrs as Record<string, string>)["aria-label"]).toBe(buyLabel(t.value, pay, false));
        expect(t.h2.textContent).toBe(tierName(t.value, pay));
        expect(built).toContain(`aria-label="${buyLabel(t.value, pay, false)}">${t.btn.innerHTML}</button>`);
        expect(built).toContain(`<h2 class="sr-only">${t.h2.textContent}</h2>`);
      }
    }
  });
});
