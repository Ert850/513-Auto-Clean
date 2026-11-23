/** The gift card page and its links (config/gift-cards.json, web/scripts/gift-cards.mjs). */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
// @ts-expect-error plain ESM build scripts
import { cardFace, giftCalc, giftHead, giftPages, giftTerms, giftTiers, giftTopLink, loadGiftCards, priceRow } from "../../scripts/gift-cards.mjs";
// @ts-expect-error plain ESM build scripts
import { CHROME_PAGES, valuesFor } from "../../scripts/chrome.mjs";

const root = path.resolve(__dirname, "../../..");
const read = (f: string) => fs.readFileSync(path.join(root, f), "utf8");
const cfg = loadGiftCards();
const as = (mode: string) => ({ ...cfg, mode });

describe("gift card page", () => {
  it("the sale shows the price you pay, the value struck through and the saving, all from the setting", () => {
    const sale = { ...cfg, mode: "sale", sale: { ...cfg.sale, percentOff: 20 } };
    expect(priceRow(5000, sale)).toBe('<p class="gc-price"><span class="gc-pay">You pay</span> <strong>$40</strong> <s><span class="sr-only">instead of </span>$50</s> <span class="gc-save">Save $10</span></p>');
    expect(priceRow(3700, sale)).toContain("<strong>$29.60</strong>");
    expect(priceRow(5000, as("regular"))).toBe('<p class="gc-price"><span class="gc-pay">You pay</span> <strong>$50</strong></p>');
    // The card face carries the sale's percentage only during the sale.
    expect(cardFace(5000, sale)).toContain('<span class="gc-off">20% off</span>');
    expect(cardFace(5000, as("regular"))).not.toContain("gc-off");
  });

  it("regular mode says nothing about a sale", () => {
    const html = [giftHead(as("regular")), giftTiers(as("regular")), giftCalc(as("regular")), giftTopLink(as("regular"))].join("");
    expect(html + cardFace(5000, as("regular"))).not.toMatch(/<s>|Save \$|% off|through December|Holiday/);
  });

  it("no amount, percentage or date is typed into the page: the generated regions match the setting", () => {
    const page = read("gift-cards.html");
    for (const name of ["HEAD", "TIERS", "CALC", "TERMS"]) {
      expect(page).toContain(`<!-- GIFTCARDS:${name}:START -->`);
    }
    if (cfg.mode === "off") return;
    expect(page).toContain(giftTiers(cfg));
    expect(page).toContain(giftCalc(cfg));
    // Outside the generated regions, the hand-written page carries no money or percentage.
    const outside = page.replace(/<!-- GIFTCARDS:(\w+):START -->[\s\S]*?<!-- GIFTCARDS:\1:END -->/g, "");
    expect(outside.slice(outside.indexOf("<main>"), outside.indexOf("</main>"))).not.toMatch(/\$\d|\d+%/);
  });

  it("the buy buttons stay disabled until the checkout exists", () => {
    const off = { ...cfg, checkout: { enabled: false } };
    const buttons = (giftTiers(off) + giftCalc(off)).match(/<button[^>]*data-gc-buy[^>]*>/g)!;
    expect(buttons.length).toBe(cfg.tiers.length + 1);
    for (const b of buttons) expect(b).toContain(" disabled");
    expect(giftTerms(off)).toContain("Buying online opens soon.");
    expect(giftTiers({ ...cfg, checkout: { enabled: true } })).not.toContain(" disabled");
  });

  it('mode "off" removes the page and every link: the site is as it was before gift cards', () => {
    expect(giftPages(as("off"))).toEqual([]);
    expect(giftTopLink(as("off"))).toBe("");
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
