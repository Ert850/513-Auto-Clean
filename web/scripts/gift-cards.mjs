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
import { cincinnatiDay, coverage, coverTable, coversLine, giftCardProblems, saleOn, salePriceCents, SIZE_WORDS, DEFAULT_RULES, VEHICLE_SIZES } from "../../netlify/functions/_pricing.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export const GIFT_PAGE = "gift-cards.html";
/**
 * The card's own page (where Stripe sends the buyer back, and every card email
 * links) and Elijah's lookup page. Both noindex and unlinked, and both stay
 * even with gift cards "off": cards already sold must still open and redeem.
 */
export const CERT_PAGE = "gift-certificate.html";
export const ADMIN_PAGE = "gift-admin.html";
export const GIFT_TOOL_PAGES = [CERT_PAGE, ADMIN_PAGE];

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
const hide = (on) => (on ? "" : " hidden");

/**
 * The setting as the page should show it on `nowMs` (the build's moment):
 * saleNow by saleOn(), the same test the checkout charges by, and upcoming
 * before the sale starts. The static page is right on the day it's built;
 * js/giftcards.js and script.js correct it in the browser if the date has
 * moved on since (validation pass 1: a page built before the sale must not
 * show sale prices, nor one built during it after it ends).
 */
export function viewAt(cfg, nowMs = Date.now()) {
  const saleNow = saleOn(cfg, nowMs);
  return {
    ...cfg,
    saleSet: cfg.mode === "sale",
    saleNow,
    upcoming: cfg.mode === "sale" && !saleNow && cincinnatiDay(nowMs) < cfg.sale.starts,
  };
}
const pays = (valueCents, v) => salePriceCents(valueCents, { mode: v.saleNow ? "sale" : "regular", sale: v.sale });

/** "You pay $40 $50 Save $10" (the value struck through) during the sale; just "$50" without one. */
export function priceRow(valueCents, v, cls = "gc-price") {
  const pay = pays(valueCents, v);
  if (pay === valueCents) return `<p class="${cls}"><strong>${dollars(pay)}</strong></p>`;
  return `<p class="${cls}"><span class="gc-pay">You pay</span> <strong>${dollars(pay)}</strong> <s><span class="sr-only">instead of </span>${dollars(valueCents)}</s> <span class="gc-save">Save ${dollars(valueCents - pay)}</span></p>`;
}

/**
 * The card itself, as the recipient will see it: what they get, big. The
 * sale's percentage rides on its corner (there, hidden, whenever a sale is
 * set, so the page's script can show it on the day). Decorative: the h2 and
 * the price row carry the words for screen readers.
 */
export function cardFace(valueCents, v) {
  const off = v.saleSet ? `<span class="gc-off"${hide(v.saleNow)}>${v.sale.percentOff}% off</span>` : "";
  return `<div class="gc-face" aria-hidden="true">${off}
            <span class="gc-face-brand"><img class="gc-face-mark" src="images/logo-mark.png" alt="" width="20" height="26" />513 Auto Clean</span>
            <span class="gc-face-value">${dollars(valueCents)}</span>
            <span class="gc-face-label">Gift card</span>
          </div>`;
}

export function buyLabel(valueCents, payCents, custom) {
  if (custom) return payCents < valueCents ? `Buy a ${dollars(valueCents)} card for ${dollars(payCents)}` : `Buy a ${dollars(valueCents)} card`;
  return `Buy for ${dollars(payCents)}`;
}

function buyButton(valueCents, v, { primary = false, custom = false } = {}) {
  const off = v.checkout.enabled ? "" : " disabled";
  return `<button type="button" class="btn ${primary ? "btn-primary" : "btn-ghost"} btn-block" data-gc-buy="${custom ? "custom" : valueCents / 100}"${off}>${buyLabel(valueCents, pays(valueCents, v), custom)}</button>`;
}

/** The sale in one sentence, marked so the page's script can show or hide it on the day. */
function saleLines(v, during, before) {
  if (!v.saleSet) return "";
  return `<span class="gc-sale-only"${hide(v.saleNow)}>${during}</span><span class="gc-sale-soon"${hide(v.upcoming)}>${before}</span>`;
}

/** The page title block. */
export function giftHead(v) {
  const pct = v.sale.percentOff, start = longDay(v.sale.starts), end = longDay(v.sale.ends);
  const lead = saleLines(v, `Every card is ${pct}% off through ${end}. `, `Every card will be ${pct}% off from ${start} to ${end}. `) +
    `It&rsquo;s emailed right away or on the day you choose, with a certificate to print or forward.`;
  return `<div class="section-head">
      <span class="eyebrow">${v.saleSet ? "Holiday gift cards" : "Gift cards"}</span>
      <h1>Give a car that feels new again.</h1>
      <p>${lead}</p>
    </div>`;
}

/** The tier cards. */
export function giftTiers(v, rows = coverTable()) {
  return v.tiers.map((t) => {
    const value = t.value * 100;
    return `<article class="svc-card gc-tier${t.featured ? " featured" : ""}" data-gc-value="${t.value}">${t.featured ? '\n          <span class="svc-tag">Our pick</span>' : ""}
          ${cardFace(value, v)}
          <h2 class="sr-only">${dollars(value)} gift card</h2>
          ${priceRow(value, v)}
          <p class="gc-covers">${coversLine(value, rows)}</p>
          <div class="svc-foot">${buyButton(value, v, { primary: !!t.featured })}</div>
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
export function giftCalc(v, rows = coverTable()) {
  const start = (v.tiers.find((t) => t.featured) ?? v.tiers[v.tiers.length - 1]).value * 100;
  const sizes = VEHICLE_SIZES.map((s, i) => `<label class="gc-size"><input type="radio" name="gcSize" value="${s.id}"${i ? "" : " checked"} /><span>${SIZE_WORDS[s.id].replace(/^./, (c) => c.toUpperCase())}</span></label>`).join("");
  const range = `${dollars(v.custom.min * 100)} to ${dollars(v.custom.max * 100)}`;
  return `<aside class="gc-calc" aria-labelledby="gcCalcH" data-gc-min="${v.custom.min}" data-gc-max="${v.custom.max}" data-gc-built-sale="${v.saleNow ? 1 : 0}">
        <h2 id="gcCalcH">Pick any amount</h2>
        <div class="field">
          <label for="gcAmt">Card value, ${range}</label>
          <div class="gc-amt"><span aria-hidden="true">$</span><input id="gcAmt" type="number" inputmode="numeric" min="${v.custom.min}" max="${v.custom.max}" step="1" value="${start / 100}" aria-describedby="gcAmtErr" /></div>
          <p class="gc-err" id="gcAmtErr" role="alert" hidden>Choose ${range}, in whole dollars.</p>
        </div>
        ${priceRow(start, v, "gc-price gc-calc-price")}
        <fieldset class="gc-sizes"><legend>What would it cover?</legend>${sizes}</fieldset>
        <div class="gc-out">${coverList(start, VEHICLE_SIZES[0].id, rows)}</div>
        <p class="sr-only" id="gcSay" aria-live="polite"></p>
        ${buyButton(start, v, { primary: true, custom: true })}
        <p class="gc-small">Prices include sales tax at the highest local rate. A travel fee beyond the first ${DEFAULT_RULES.mileage.freeMinutes} minutes&rsquo; drive is added when you book, and the card can pay it too.${saleLines(v, ` Every card is ${v.sale.percentOff}% off through ${longDay(v.sale.ends)}.`, "")}</p>
      </aside>`;
}

/** Said once for every card, under the cards. */
export function giftTerms(v) {
  const checkout = v.checkout.enabled ? "" : `\n      <p class="gc-soon">Buying online opens soon.</p>`;
  const refund = v.refundDays > 0 ? `\n        <li>Unused cards can be refunded within ${v.refundDays} days (<a href="terms.html#gift-cards">terms</a>)</li>` : "";
  return `<ul class="gc-terms">
        <li>Never expires, no fees</li>
        <li>No tax when you buy it: sales tax is added to the detail when it&rsquo;s used</li>
        <li>Use it over more than one booking</li>
        <li>Not redeemable for cash</li>${refund}
      </ul>${checkout}`;
}

/** The link at the top of every page while gift cards are on. */
export function giftTopLink(v) {
  if (v.mode === "off") return "";
  // The sale part is dropped on small phones, where the bar has room for "Gift cards" only,
  // and shown or hidden by script.js on the day (saleOn).
  const sale = v.saleSet ? `<span class="tb-gift-sale"${hide(v.saleNow)}>, ${v.sale.percentOff}% off</span>` : "";
  return `\n      <a class="tb-gift" href="${GIFT_PAGE}">Gift cards${sale}</a>`;
}
