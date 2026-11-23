/**
 * The gift card page's settings and generated HTML (config/gift-cards.json,
 * docs/GIFT-CARDS-PLAN-2026-11-23.md). render-giftcards.mjs writes the HTML
 * into gift-cards.html; chrome.mjs, stamp-assets.mjs and build-dist.mjs list
 * the page through giftPages(), so mode "off" removes it everywhere at once.
 *
 * Every amount and date comes from the setting or the catalog. The price
 * display follows Baymard's discount findings (November 23): the price you pay
 * big and bold, the card's value beside it, smaller and struck through, the
 * saving once, and nothing that every card shares repeated on each card.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { coverage, coverTable, coversLine, giftCardProblems, salePriceCents, SIZE_WORDS, DEFAULT_RULES, VEHICLE_SIZES } from "../../netlify/functions/_pricing.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export const GIFT_PAGE = "gift-cards.html";

export function loadGiftCards(file = path.join(root, "config/gift-cards.json")) {
  const cfg = JSON.parse(fs.readFileSync(file, "utf8"));
  const problems = giftCardProblems(cfg);
  if (problems.length) throw new Error("config/gift-cards.json:\n  " + problems.join("\n  "));
  return cfg;
}

/** The page, unless gift cards are off. */
export function giftPages(cfg = loadGiftCards()) {
  return cfg.mode === "off" ? [] : [GIFT_PAGE];
}

const dollars = (cents) => "$" + (cents % 100 ? (cents / 100).toFixed(2) : String(cents / 100));
const longDay = (iso) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });
const onSale = (cfg) => cfg.mode === "sale";

/** "You pay $40 $50 Save $10" (the value struck through), or "You pay $50" when there is no sale. */
export function priceRow(valueCents, cfg, cls = "gc-price") {
  const pay = salePriceCents(valueCents, cfg);
  const lead = `<span class="gc-pay">You pay</span> <strong>${dollars(pay)}</strong>`;
  if (pay === valueCents) return `<p class="${cls}">${lead}</p>`;
  return `<p class="${cls}">${lead} <s><span class="sr-only">instead of </span>${dollars(valueCents)}</s> <span class="gc-save">Save ${dollars(valueCents - pay)}</span></p>`;
}

/**
 * The card itself, as the recipient will see it: what they get, big. The
 * sale's percentage rides on its corner. Decorative: the h2 and the price
 * row carry the words for screen readers.
 */
export function cardFace(valueCents, cfg) {
  const off = onSale(cfg) ? `<span class="gc-off">${cfg.sale.percentOff}% off</span>` : "";
  return `<div class="gc-face" aria-hidden="true">${off}
            <span class="gc-face-brand"><img class="gc-face-mark" src="images/logo-mark.png" alt="" width="20" height="26" />513 Auto Clean</span>
            <span class="gc-face-value">${dollars(valueCents)}</span>
            <span class="gc-face-label">Gift card</span>
          </div>`;
}

function buyButton(valueCents, cfg, { primary = false, custom = false } = {}) {
  const pay = salePriceCents(valueCents, cfg);
  const label = custom ? `Buy a ${dollars(valueCents)} card for ${dollars(pay)}` : `Buy for ${dollars(pay)}`;
  const off = cfg.checkout.enabled ? "" : " disabled";
  return `<button type="button" class="btn ${primary ? "btn-primary" : "btn-ghost"} btn-block" data-gc-buy="${custom ? "custom" : valueCents / 100}"${off}>${label}</button>`;
}

/** The page title block. */
export function giftHead(cfg) {
  const lead = onSale(cfg)
    ? `Every card is ${cfg.sale.percentOff}% off through ${longDay(cfg.sale.ends)}. It&rsquo;s emailed right away or on the day you choose, with a certificate to print or forward.`
    : `It&rsquo;s emailed right away or on the day you choose, with a certificate to print or forward.`;
  return `<div class="section-head">
      <span class="eyebrow">${onSale(cfg) ? "Holiday gift cards" : "Gift cards"}</span>
      <h1>Give a car that feels new again.</h1>
      <p>${lead}</p>
    </div>`;
}

/** The tier cards. */
export function giftTiers(cfg, rows = coverTable()) {
  return cfg.tiers.map((t) => {
    const value = t.value * 100;
    return `<article class="svc-card gc-tier${t.featured ? " featured" : ""}">${t.featured ? '\n          <span class="svc-tag">Our pick</span>' : ""}
          ${cardFace(value, cfg)}
          <h2 class="sr-only">${dollars(value)} gift card</h2>
          ${priceRow(value, cfg)}
          <p class="gc-covers">${coversLine(value, rows)}</p>
          <div class="svc-foot">${buyButton(value, cfg, { primary: !!t.featured })}</div>
        </article>`;
  }).join("\n        ");
}

/** The covered list for one amount and size: the calculator's first state, which js/giftcards.js then keeps up to date. */
export function coverList(valueCents, sizeId, rows = coverTable()) {
  const { covered, next } = coverage(valueCents, sizeId, rows);
  const items = covered.map((c) => `<li><b>${c.name}</b><em>${dollars(c.cents)}</em></li>`).join("");
  const none = covered.length ? "" : '<li class="gc-none">Not a full detail yet: it goes toward one, or an add-on</li>';
  const more = next ? `<p class="gc-next">${dollars(next.shortCents)} more covers ${/^[AEIOU]/i.test(next.name) ? "an" : "a"} ${next.name}</p>` : "";
  return `<ul class="gc-list">${items}${none}</ul>${more}`;
}

/** The calculator, which is also where any other amount is bought. */
export function giftCalc(cfg, rows = coverTable()) {
  const start = (cfg.tiers.find((t) => t.featured) ?? cfg.tiers[cfg.tiers.length - 1]).value * 100;
  const sizes = VEHICLE_SIZES.map((s, i) => `<label class="gc-size"><input type="radio" name="gcSize" value="${s.id}"${i ? "" : " checked"} /><span>${SIZE_WORDS[s.id].replace(/^./, (c) => c.toUpperCase())}</span></label>`).join("");
  const saleNote = onSale(cfg) ? `, ${cfg.sale.percentOff}% off through ${longDay(cfg.sale.ends)}` : "";
  return `<aside class="gc-calc" aria-labelledby="gcCalcH" data-gc-mode="${cfg.mode}" data-gc-pct="${cfg.sale.percentOff}" data-gc-min="${cfg.custom.min}" data-gc-max="${cfg.custom.max}">
        <h2 id="gcCalcH">Pick any amount</h2>
        <div class="field">
          <label for="gcAmt">Card value, ${dollars(cfg.custom.min * 100)} to ${dollars(cfg.custom.max * 100)}</label>
          <div class="gc-amt"><span aria-hidden="true">$</span><input id="gcAmt" type="number" inputmode="numeric" min="${cfg.custom.min}" max="${cfg.custom.max}" step="1" value="${start / 100}" /></div>
          <p class="gc-err" hidden>Choose ${dollars(cfg.custom.min * 100)} to ${dollars(cfg.custom.max * 100)}, in whole dollars.</p>
        </div>
        ${priceRow(start, cfg, "gc-price gc-calc-price")}
        <fieldset class="gc-sizes"><legend>What would it cover?</legend>${sizes}</fieldset>
        <div class="gc-out" aria-live="polite">${coverList(start, VEHICLE_SIZES[0].id, rows)}</div>
        ${buyButton(start, cfg, { primary: true, custom: true })}
        <p class="gc-small">Prices include sales tax at the highest local rate. Travel beyond the first ${DEFAULT_RULES.mileage.freeMinutes} minutes&rsquo; drive is extra${saleNote}.</p>
      </aside>`;
}

/** Said once for every card, under the cards. */
export function giftTerms(cfg) {
  const checkout = cfg.checkout.enabled ? "" : `\n      <p class="gc-soon">Buying online opens soon.</p>`;
  return `<ul class="gc-terms">
        <li>Never expires, no fees</li>
        <li>No tax when you buy it: sales tax is added to the detail when it&rsquo;s used</li>
        <li>Use it over more than one booking</li>
        <li>Not redeemable for cash</li>
      </ul>${checkout}`;
}

/** The link at the top of every page while gift cards are on. */
export function giftTopLink(cfg) {
  if (cfg.mode === "off") return "";
  // The sale part is dropped on small phones, where the bar has room for "Gift cards" only.
  const sale = onSale(cfg) ? `<span class="tb-gift-sale">, ${cfg.sale.percentOff}% off</span>` : "";
  return `\n      <a class="tb-gift" href="${GIFT_PAGE}">Gift cards${sale}</a>`;
}
