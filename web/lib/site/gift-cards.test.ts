/** The gift card page and its links (config/gift-cards.json, web/scripts/gift-cards.mjs). */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
// @ts-expect-error plain ESM build scripts
import { cardFace, viewAt, giftCalc, giftHead, giftPages, giftTerms, giftTiers, giftTopLink, loadGiftCards, priceRow } from "../../scripts/gift-cards.mjs";
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
  it("during the sale: the price you pay, the value struck through and the saving, all from the setting", () => {
    expect(priceRow(5000, during)).toBe('<p class="gc-price"><span class="gc-pay">You pay</span> <strong>$40</strong> <s><span class="sr-only">instead of </span>$50</s> <span class="gc-save">Save $10</span></p>');
    expect(priceRow(3700, during)).toContain("<strong>$29.60</strong>");
    expect(cardFace(5000, during)).toContain('<span class="gc-off">20% off</span>');
    expect(giftHead(during)).toContain('<span class="gc-sale-only">Every card is 20% off through December 25. </span>');
  });

  it("before the sale: full prices, and the sale's dates said (validation pass 1: no sale prices before it starts)", () => {
    expect(priceRow(5000, before)).toBe('<p class="gc-price"><strong>$50</strong></p>');
    expect(cardFace(5000, before)).toContain('<span class="gc-off" hidden>');
    expect(giftHead(before)).toContain('<span class="gc-sale-soon">Every card will be 20% off from November 27 to December 25. </span>');
    expect(giftTiers(before)).toContain(">Buy for $50</button>");
    expect(giftCalc(before)).toContain(">Buy a $150 card</button>");
    expect(giftCalc(before)).toContain('data-gc-built-sale="0"');
    expect(giftTopLink(before)).toContain('<span class="tb-gift-sale" hidden>');
  });

  it("after the sale, and in regular mode: nothing reads as a sale", () => {
    for (const v of [after, regular]) {
      const shown = [giftHead(v), giftTiers(v), giftCalc(v), giftTopLink(v)].join("").replace(/<(span)[^>]* hidden>[\s\S]*?<\/\1>/g, "");
      expect(shown).not.toMatch(/<s>|Save \$|% off|through December/);
    }
    expect(giftHead(regular)).not.toContain("Holiday");
  });

  it("no amount, percentage or date is typed into the page: the generated regions match the setting", () => {
    const page = read("gift-cards.html");
    for (const name of ["HEAD", "TIERS", "CALC", "TERMS"]) {
      expect(page).toContain(`<!-- GIFTCARDS:${name}:START -->`);
    }
    if (cfg.mode === "off") return;
    // As of today: the page is built for the day it's built.
    expect(page).toContain(giftTiers(viewAt(cfg)));
    expect(page).toContain(giftCalc(viewAt(cfg)));
    // Outside the generated regions, the hand-written page carries no money or percentage.
    const outside = page.replace(/<!-- GIFTCARDS:(\w+):START -->[\s\S]*?<!-- GIFTCARDS:\1:END -->/g, "");
    expect(outside.slice(outside.indexOf("<main>"), outside.indexOf("</main>"))).not.toMatch(/\$\d|\d+%/);
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
});
