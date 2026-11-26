/**
 * Writes the gift card page's generated regions (GIFTCARDS:* in
 * gift-cards.html) and its sitemap entry, from config/gift-cards.json and the
 * catalog (gift-cards.mjs). Mode "off" leaves the page alone and takes it out
 * of the sitemap; build-dist.mjs then leaves it out of the site.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GIFT_PAGE, giftCalc, giftHead, giftTerms, giftTiers, loadGiftCards, viewAt } from "./gift-cards.mjs";
import { SITE } from "./site-urls.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");

function region(html, file, name, body) {
  const a = `<!-- GIFTCARDS:${name}:START -->`, b = `<!-- GIFTCARDS:${name}:END -->`;
  const i = html.indexOf(a), j = html.indexOf(b);
  if (i < 0 || j < 0) throw new Error(`render-giftcards: GIFTCARDS:${name} markers not found in ${file}`);
  return html.slice(0, i + a.length) + body + html.slice(j);
}

const cfg = loadGiftCards();

if (cfg.mode !== "off") {
  // As of this build: before the sale, during it or after it (viewAt).
  const v = viewAt(cfg);
  let page = read(GIFT_PAGE);
  page = region(page, GIFT_PAGE, "HEAD", `\n    ${giftHead(v)}\n    `);
  page = region(page, GIFT_PAGE, "TIERS", `\n        ${giftTiers(v)}\n        `);
  page = region(page, GIFT_PAGE, "CALC", `\n      ${giftCalc(v)}\n      `);
  page = region(page, GIFT_PAGE, "TERMS", `\n      ${giftTerms(v)}\n      `);
  fs.writeFileSync(path.join(root, GIFT_PAGE), page);
}

const entry = cfg.mode === "off" ? "" : `\n  <url>\n    <loc>${SITE}/gift-cards</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>\n  `;
fs.writeFileSync(path.join(root, "sitemap.xml"), region(read("sitemap.xml"), "sitemap.xml", "SITEMAP", entry));
console.log(`gift cards: mode ${cfg.mode}${cfg.mode === "off" ? ", no page" : `, ${cfg.tiers.length} cards, checkout ${cfg.checkout.enabled ? "on" : "off"}`}`);
