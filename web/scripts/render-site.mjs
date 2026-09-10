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
  CORRECTION_RULES,
  COATING_COVERAGE,
  COATING_EXPLAINER,
  CORRECTION_TIERS,
  DEFAULT_RULES,
  SEED_CATALOG,
  VEHICLE_SIZES,
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

  return `        <article class="svc-card${p.featured ? " featured" : ""} reveal">
${p.featured ? '          <span class="svc-tag">Most Popular</span>\n' : ""}          <h3>${esc(p.name)}</h3>
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
          <div class="svc-foot"><a class="btn ${p.featured ? "btn-primary" : "btn-ghost"} btn-block" href="book.html">Book ${esc(p.name)}</a></div>
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

  const sizes = VEHICLE_SIZES.map(
    (v) => `${esc(v.label)} ${v.upchargeCents ? "+" + money(v.upchargeCents) : "no extra charge"}`,
  ).join(", ");

  const corr = CORRECTION_TIERS.map(
    (t) => `<li>${TICK} ${esc(t.label)} <strong>+${money(t.addCents)}</strong>, ${esc(t.result)}</li>`,
  ).join("\n        ");

  return `${panel("interior")}

${panel("exterior")}

    <div class="svc-note reveal">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
      <span>Booking interior <em>and</em> exterior together? Take <strong>${money(DEFAULT_RULES.comboDiscountCents)} off automatically.</strong>
      Vehicle size: ${sizes}. Travel is worked out from your address, and the first 10 minutes of drive time are free.</span>
    </div>

    <div class="svc-correction reveal">
      <details class="svc-explain">
        <summary>${esc(COATING_EXPLAINER.heading)}</summary>
        <p>${esc(COATING_EXPLAINER.body)}</p>
        <p class="ex-h">What it does</p>
        <ul class="ex-yes">${COATING_EXPLAINER.does.map((d) => `<li>${esc(d)}</li>`).join("")}</ul>
        <p class="ex-h">What it does not do</p>
        <ul class="ex-no">${COATING_EXPLAINER.doesNot.map((d) => `<li>${esc(d)}</li>`).join("")}</ul>
        <p class="ex-why">${esc(COATING_EXPLAINER.why)}</p>
      </details>
      <h3>Paint correction and ceramic coating</h3>
      <p>Showroom Ready Exterior is everything in Full Exterior, then one of these. Booked at least ${CORRECTION_RULES.minLeadDays} days out, weekend mornings.</p>
      <ul class="feat">
        ${corr}
      </ul>
      <p class="svc-coverage">${esc(COATING_COVERAGE)}</p>
    </div>`;
}

/* ---------------- add-ons ---------------- */

function addonsHtml() {
  const card = (a) => {
    const why = unavailableReason(a);
    const priced = a.tiers.filter((t) => t.priceCents !== null);
    const price = why
      ? `<i class="ad-price ad-soon">${esc(why)}</i>`
      : `<i class="ad-price">${
          priced.length > 1
            ? `${money(priced[0].priceCents)} to ${money(priced[priced.length - 1].priceCents)}`
            : money(priced[0].priceCents)
        }</i>`;
    // NOTE: the (i) marker and an autoplaying clip belong here, from
    // addon.videoUrl. Neither renders yet.
    const how = a.note
      ? `<details class="ad-how"><summary>How it works</summary><p>${esc(a.note)}</p></details>`
      : "";
    return `        <div class="addon${why ? " ad-off" : ""} reveal">
          <span class="ad-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 2"/></svg></span>
          <div><b>${esc(a.name)}${why ? "<sup>*</sup>" : ""}</b><span>${esc(a.description)}</span>${price}${how}</div>
        </div>`;
  };

  const groups = ["interior", "exterior"].map((scope) => {
    const list = ADDONS.filter((a) => a.scope === scope);
    if (!list.length) return "";
    return `      <h4 class="addon-grp">${scope === "interior" ? "Interior" : "Exterior"}</h4>
      <div class="addon-grid">
${list.map(card).join("\n")}
      </div>`;
  });

  return `      <h3 class="reveal">Add-ons</h3>
${groups.join("\n")}`;
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

function splice(html, name, body) {
  const start = `<!-- CATALOG:${name}:START -->`;
  const end = `<!-- CATALOG:${name}:END -->`;
  const i = html.indexOf(start);
  const j = html.indexOf(end);
  if (i < 0 || j < 0) {
    throw new Error(`Markers for ${name} not found in index.html`);
  }
  return html.slice(0, i + start.length) + "\n" + body + "\n    " + html.slice(j);
}

let html = fs.readFileSync(INDEX, "utf8");
html = splice(html, "SERVICES", servicesHtml());
html = splice(html, "ADDONS", addonsHtml());
html = splice(html, "OFFERS", offersHtml());
fs.writeFileSync(INDEX, html);

const count =
  packagesFor("interior").concat(packagesFor("exterior")).filter((p) => !p.requiresPriorDetail).length;
const bookable = ADDONS.filter((a) => !unavailableReason(a)).length;
console.log(
  `rendered ${count} packages, ${ADDONS.length} add-ons (${bookable} bookable, ${ADDONS.length - bookable} listed only) into index.html`,
);
