/**
 * Renders catalog-driven sections of index.html at build time.
 *
 * The services grid, the add-ons panel and the Offer schema all came from
 * hand-written HTML that drifted out of sync with the booking funnel the
 * moment a price changed. They are now generated from the SAME catalog the
 * funnel and the payment functions use, between marker comments, so the two
 * can never disagree again.
 *
 * Build time rather than client side on purpose: the prices stay in the HTML
 * for search engines and for anyone with JavaScript off.
 *
 * Run by `npm run build`.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ADDONS,
  addonIcon,
  addonsFor,
  CORRECTION_RULES,
  COATING_COVERAGE,
  COATING_EXPLAINER,
  CORRECTION_TIERS,
  DEFAULT_RULES,
  SEED_CATALOG,
  componentsOf,
  findPackage,
  packagesFor,
  unavailableReason,
} from "../../netlify/functions/_pricing.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const INDEX = path.join(root, "index.html");

const money = (c) => {
  const whole = Math.abs(c) % 100 === 0;
  return "$" + (Math.abs(c) / 100).toLocaleString("en-US", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  });
};

const dur = (min) => {
  if (!min) return "";
  const h = Math.floor(min / 60), m = min % 60;
  return (h ? `${h} hr${h > 1 ? "s" : ""}` : "") + (m ? `${h ? " " : ""}${m} min` : "");
};

const esc = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const TICK =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6L9 17l-5-5"/></svg>';

/* ---------------- services ---------------- */

/**
 * The correction and coating block.
 *
 * It used to sit on its own below both service panels, which meant someone
 * reading the exterior tiers had to scroll past the whole interior grid to
 * find out what the "+" on Showroom Ready meant. It now lives inside that
 * card, beside the package it belongs to.
 */
function correctionBlock() {
  const baseMin = findPackage("showroom-exterior")?.durationMin ?? 0;

  // Hours are shown because the price only makes sense beside them: this is
  // days of labour, not a product with a markup.
  const tiers = CORRECTION_TIERS.map(
    (t) =>
      `<li><strong>${esc(t.label)}</strong> <b class="corr-price">+${money(t.addCents)}</b>` +
      `<span class="corr-meta">${esc(t.result)} &middot; about ${dur(baseMin + t.addMin)} of work</span></li>`,
  ).join("\n              ");

  return `<div class="svc-corr">
            <h4>Paint correction and ceramic coating</h4>
            <details class="svc-explain">
              <summary>How it Works: ${esc(COATING_EXPLAINER.heading)}</summary>
              <p>${esc(COATING_EXPLAINER.body)}</p>
              <p class="ex-h">What it does</p>
              <ul class="ex-yes">${COATING_EXPLAINER.does.map((d) => `<li>${esc(d)}</li>`).join("")}</ul>
              <p class="ex-h">What it does not do</p>
              <ul class="ex-no">${COATING_EXPLAINER.doesNot.map((d) => `<li>${esc(d)}</li>`).join("")}</ul>
              <p class="ex-h">How long it takes</p>
              <ul class="ex-time">${COATING_EXPLAINER.timing.map((d) => `<li>${esc(d)}</li>`).join("")}</ul>
              <p>${esc(COATING_EXPLAINER.timingNote)}</p>
              <p class="ex-why">${esc(COATING_EXPLAINER.why)}</p>
              <p class="ex-h">What is covered</p>
              <p>${esc(COATING_COVERAGE)}</p>
            </details>
            <ul class="feat corr-tiers">
              ${tiers}
            </ul>
            <p class="svc-coverage">Booked at least ${CORRECTION_RULES.minLeadDays} days out, on weekend mornings, because the work runs across days.</p>
          </div>`;
}

function packageCard(p) {
  const comps = componentsOf(p, SEED_CATALOG);
  const base = p.supersetOf ? findPackage(p.supersetOf) : null;
  const shown = base ? comps.slice(componentsOf(base, SEED_CATALOG).length) : comps;

  const price = money(p.priceCents) + (p.pricePlus ? "+" : "");
  const time = p.durationMaxMin ? `${dur(p.durationMin)} to ${dur(p.durationMaxMin)}` : dur(p.durationMin);

  // NOTE: the (i) video markers go here, driven by component.videoUrl.
  // Nothing is rendered until those clips exist.
  const feats = (base ? [`<strong>Everything in ${esc(base.name)}</strong>`] : [])
    .concat(shown.map((c) => esc(c.name)))
    .map((label) => `            <li>${TICK} ${label}</li>`)
    .join("\n");

  // The correction package is a different kind of product and a different
  // order of price, so it gets a full width card underneath the tier row
  // rather than orphaning itself as a fourth column.
  const wide = p.requiresCorrectionTier ? " wide" : "";

  // "Showroom Ready (Paint Correction and Protection)" runs past the edge of
  // its button. The parenthetical clarifies the heading, where there is room
  // for it; on the CTA the name alone is unambiguous because the card it sits
  // in has just spelled the rest out.
  const bookLabel = p.name.replace(/\s*\([^)]*\)\s*$/, "");

  const body = `          <h3>${esc(p.name)}</h3>
          <div class="svc-meta">
            <span class="price">${price}</span>
            <span class="dur"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 2"/></svg> ${time}</span>
          </div>
          <p class="svc-desc">${esc(p.tagline)}</p>
          <ul class="feat">
${feats}
          </ul>
          ${
            p.note
              ? `<details class="svc-how"><summary>How it works</summary><p>${esc(p.note)}</p></details>`
              : ""
          }
          <div class="svc-foot"><a class="btn ${p.featured ? "btn-primary" : "btn-ghost"} btn-block" href="book.html" data-book-package="${esc(p.id)}">Book ${esc(bookLabel)}</a></div>`;

  // The wide card splits in two: the package on the left, the correction
  // tiers on the right. Wrapping the left half keeps that a two-child grid
  // rather than a pile of items each needing its own placement rule.
  const inner = wide
    ? `          <div class="swide-main">\n${body}\n          </div>\n          ${correctionBlock()}`
    : body;

  return `        <article class="svc-card${p.featured ? " featured" : ""}${wide} reveal">
${p.featured ? '          <span class="svc-tag">Most Popular</span>\n' : ""}${inner}
        </article>`;
}

function servicesHtml() {
  const panel = (cat) => {
    const cards = packagesFor(cat)
      // Maintenance is returning-customer pricing and is not offered publicly.
      .filter((p) => !p.requiresPriorDetail)
      .map(packageCard)
      .join("\n\n");
    return `    <div class="svc-panel${cat === "interior" ? " active" : ""}" id="panel-${cat}">
      <div class="svc-grid">
${cards}
      </div>
    </div>`;
  };

  return `${panel("interior")}

${panel("exterior")}

    <div class="svc-note reveal">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
      <span>Booking interior <em>and</em> exterior together? Take <strong>${money(DEFAULT_RULES.comboDiscountCents)} off automatically when you book together.</strong>
      Have multiple vehicles? <strong>Get ${DEFAULT_RULES.additionalVehicleDiscountBp / 100}% off everything</strong> when you book them together!</span>
    </div>`;
}

/* ---------------- add-ons ---------------- */

function addonsHtml() {
  const card = (a) => {
    const why = unavailableReason(a);
    const priced = a.tiers.filter((t) => t.priceCents !== null);
    const range =
      priced.length > 1
        ? `${money(priced[0].priceCents)} to ${money(priced[priced.length - 1].priceCents)}`
        : priced.length === 1
          ? money(priced[0].priceCents)
          : null;
    // Price AND reason, not one or the other. Something Elijah is not taking
    // bookings for yet is still something a customer is deciding about, and
    // hiding the number only means they have to ask to find out whether it is
    // anywhere near their budget.
    // A tier asterisk is the "this could change on inspection" caveat. The
    // funnel showed it and the front page did not, which meant the first
    // place a customer saw a price was the one place it looked unconditional.
    const caveat = a.tiers.find((t) => t.asterisk)?.asterisk ?? null;

    const price =
      (range ? `<i class="ad-price">${range}${caveat ? "*" : ""}</i>` : "") +
      (why ? `<i class="ad-soon">${esc(why)}</i>` : "") +
      (caveat ? `<i class="ad-ast">*${esc(caveat)}</i>` : "");
    // NOTE: the (i) marker and an autoplaying clip belong here, from
    // addon.videoUrl. Neither renders yet.
    const how = a.note
      ? `<details class="ad-how"><summary>How it works</summary><p>${esc(a.note)}</p></details>`
      : "";
    // The icon says what the service IS at a glance. Fifteen identical
    // clocks said only that all fifteen take time.
    return `        <div class="addon${why ? " ad-off" : ""} reveal">
          <span class="ad-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${addonIcon(a.icon)}</svg></span>
          <div class="ad-body"><b>${esc(a.name)}${why ? "<sup>*</sup>" : ""}</b><span>${esc(a.description)}</span>${price}${how}</div>
        </div>`;
  };

  const groups = ["interior", "exterior"].map((scope) => {
    // addonsFor sorts cheapest first. Going through it rather than filtering
    // ADDONS directly is what keeps this page in the same order as the funnel.
    const list = addonsFor(scope);
    if (!list.length) return "";
    return `      <h4 class="addon-grp">${scope === "interior" ? "Interior" : "Exterior"}</h4>
      <div class="addon-grid">
${list.map(card).join("\n")}
      </div>`;
  });

  return `      <h3 class="reveal">Add-ons</h3>
${groups.join("\n")}`;
}

/* ---------------- FAQ price sentence ---------------- */

/**
 * One sentence, two places: the visible FAQ answer and the FAQPage JSON-LD.
 * It quoted $65 and a $15 combo discount long after both had changed, which
 * is exactly the drift the catalog markers exist to stop.
 */
function faqPriceText() {
  const cheapest = packagesFor("interior")
    .concat(packagesFor("exterior"))
    .filter((p) => !p.requiresPriorDetail)
    .reduce((lo, p) => (p.priceCents < lo ? p.priceCents : lo), Infinity);

  return (
    `Packages start at ${money(cheapest)}. Pricing depends on the package, add-ons, ` +
    `and travel distance, all confirmed before we book, with no surprise upsells. ` +
    `Book interior and exterior together and you save ${money(DEFAULT_RULES.comboDiscountCents)} automatically, ` +
    `and booking two or more vehicles at once takes ${DEFAULT_RULES.additionalVehicleDiscountBp / 100}% off everything.`
  );
}

/* ---------------- structured data ---------------- */

function offersHtml() {
  const offers = packagesFor("interior")
    .concat(packagesFor("exterior"))
    .filter((p) => !p.requiresPriorDetail)
    .map((p) => ({
      "@type": "Offer",
      name: p.name,
      description: p.tagline,
      price: (p.priceCents / 100).toFixed(2),
      priceCurrency: "USD",
      category: p.category,
      url: "https://513autoclean.com/book.html",
    }));

  const blob = {
    "@context": "https://schema.org",
    "@type": "OfferCatalog",
    name: "513 Auto Clean detailing packages",
    itemListElement: offers,
  };
  return `<script type="application/ld+json">\n${JSON.stringify(blob, null, 2)}\n</script>`;
}

/* ---------------- splice ---------------- */

function splice(html, name, body, { inline = false } = {}) {
  const start = `<!-- CATALOG:${name}:START -->`;
  const end = `<!-- CATALOG:${name}:END -->`;
  const i = html.indexOf(start);
  const j = html.indexOf(end);
  if (i < 0 || j < 0) {
    throw new Error(`Markers for ${name} not found in index.html`);
  }
  const wrapped = inline ? body : `\n${body}\n    `;
  return html.slice(0, i + start.length) + wrapped + html.slice(j);
}

let html = fs.readFileSync(INDEX, "utf8");
html = splice(html, "SERVICES", servicesHtml());
html = splice(html, "ADDONS", addonsHtml());
html = splice(html, "FAQPRICE", faqPriceText(), { inline: true });
// The JSON-LD copy has to survive JSON.stringify, so quotes are escaped.
html = splice(html, "FAQPRICE_JSON", JSON.stringify(faqPriceText()).slice(1, -1), { inline: true });
html = splice(html, "OFFERS", offersHtml());
fs.writeFileSync(INDEX, html);

const count =
  packagesFor("interior").concat(packagesFor("exterior")).filter((p) => !p.requiresPriorDetail).length;
const bookable = ADDONS.filter((a) => !unavailableReason(a)).length;
console.log(
  `rendered ${count} packages, ${ADDONS.length} add-ons (${bookable} bookable, ${ADDONS.length - bookable} listed only) into index.html`,
);
