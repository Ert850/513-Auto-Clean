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
  HOURS,
  hoursText,
  SEED_CATALOG,
  componentsOf,
  findPackage,
  MAX_ONE_WAY_MINUTES,
  packagesFor,
  unavailableReason,
} from "../../netlify/functions/_pricing.mjs";
import { contactCard, contactHead, loadContactForm } from "./contact-form.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
// The catalog is split across pages now: packages on the home page, add-ons
// on services.html, the FAQ (and its price sentence) on faq.html, and the
// reviews block that carries the rating on about.html.
const PAGES = ["index.html", "services.html", "faq.html", "about.html", "lp-golf.html", "lp-prestige.html", "booking.html"];
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");

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
  // One convention per tier: name and price on the first row, what it gets
  // you on the next line, the hours always on a line of their own. They were
  // joined with a middle dot, which wrapped wherever the width happened to
  // break and left the hours mid-line on some tiers and alone on others.
  const tiers = CORRECTION_TIERS.map(
    (t) =>
      `<li><strong>${esc(t.label)}</strong><b class="corr-price">+${money(t.addCents)}</b>` +
      `<span class="corr-meta">${esc(t.result)}</span>` +
      `<span class="corr-meta">About ${dur(baseMin + t.addMin)} of work</span></li>`,
  ).join("\n              ");

  // "Coming soon" is said once, by the amber tag on the card's corner. This
  // heading repeated it inline, an inch away, about the same card.
  // The list is deliberately not ul.feat: that class belongs to the package
  // checklists, and its `.svc-card ul.feat li { display: flex }` outranked
  // this list's own layout and split every tier into three squeezed columns.
  return `<div class="svc-corr">
            <h4>Paint correction and ceramic coating</h4>
            <details class="svc-explain">
              <summary>How it works: ${esc(COATING_EXPLAINER.heading)}</summary>
              <div class="how-body">
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
              </div>
            </details>
            <ul class="corr-tiers">
              ${tiers}
            </ul>
            <p class="svc-coverage">Booked at least ${CORRECTION_RULES.minLeadDays} days out, on weekend mornings, because the work runs across days.</p>
          </div>`;
}

// On services.html each package card lists its first FOLD_AT inclusions and
// folds the rest behind a toggle, so all three cards (name, price, hours,
// the key inclusions and the Book button) and the offers banner under them,
// with its link down to the add-ons, fit on a 1440x790 laptop screen. 3, the
// owner's pick of three rendered options (4 left the banner below the
// screen). The home page keeps the full lists: the owner reverted a compact
// teaser there.
const FOLD_AT = 3;

function packageCard(p, { fold = false } = {}) {
  const comps = componentsOf(p, SEED_CATALOG);
  const base = p.supersetOf ? findPackage(p.supersetOf) : null;
  const shown = base ? comps.slice(componentsOf(base, SEED_CATALOG).length) : comps;

  const price = money(p.priceCents) + (p.pricePlus ? "+" : "");
  const time = p.durationMaxMin ? `${dur(p.durationMin)} to ${dur(p.durationMaxMin)}` : dur(p.durationMin);

  // NOTE: the (i) video markers go here, driven by component.videoUrl.
  // Nothing is rendered until those clips exist.
  const items = (base ? [`<strong>Everything in ${esc(base.name)}</strong>`] : [])
    .concat(shown.map((c) => esc(c.name)))
    .map((label) => `            <li>${TICK} ${label}</li>`);
  const cut = fold && !p.requiresCorrectionTier && items.length > FOLD_AT ? FOLD_AT : items.length;
  const feats = items.slice(0, cut).join("\n");
  const more = items.slice(cut);

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
          ${p.comingSoon ? `<p class="svc-soon">${esc(p.comingSoonNote ?? "Not bookable yet.")}</p>` : ""}
          <ul class="feat">
${feats}
          </ul>
          ${(() => {
            const how = p.note
              ? `<details class="svc-how"><summary>How it works</summary><p>${esc(p.note)}</p></details>`
              : "";
            if (!more.length) return how;
            // Both toggles share one row; an opened one takes the full width.
            const fold = `<details class="svc-more"><summary>${more.length} more included</summary><ul class="feat">\n${more.join("\n")}\n          </ul></details>`;
            return `<div class="svc-toggles">${fold}${how}</div>`;
          })()}
          <div class="svc-foot">${
            p.comingSoon
              ? `<a class="btn btn-ghost btn-block" href="book.html" data-book-interest="${esc(p.id)}">Register interest</a>`
              : `<a class="btn ${p.featured ? "btn-primary" : "btn-ghost"} btn-block" href="book.html" data-book-package="${esc(p.id)}">Book ${esc(bookLabel)}</a>`
          }</div>`;

  // The wide card splits in two: the package on the left, the correction
  // tiers on the right. Wrapping the left half keeps that a two-child grid
  // rather than a pile of items each needing its own placement rule.
  const inner = wide
    ? `          <div class="swide-main">\n${body}\n          </div>\n          ${correctionBlock()}`
    : body;

  return `        <article class="svc-card${p.featured ? " featured" : ""}${wide} reveal">
${p.featured ? '          <span class="svc-tag">Most Popular</span>\n' : ""}${
    p.comingSoon ? '          <span class="svc-tag soon">Coming soon</span>\n' : ""
  }${inner}
        </article>`;
}

function servicesHtml({ fold = false } = {}) {
  const panel = (cat) => {
    const cards = packagesFor(cat)
      // Maintenance is returning-customer pricing and is not offered publicly.
      .filter((p) => !p.requiresPriorDetail)
      .map((p) => packageCard(p, { fold }))
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
      <div class="svc-offers">
        <p>Booking interior <em>and</em> exterior together? Take <strong>${money(DEFAULT_RULES.comboDiscountCents)} off automatically${fold ? "." : " when you book together."}</strong></p>
        <p>Have multiple vehicles? <strong>Get ${DEFAULT_RULES.additionalVehicleDiscountBp / 100}% off everything</strong> when you book them together!</p>
      </div>${
        // services.html: the banner ends the first screen, so it says where
        // the page goes next. The add-ons section follows straight after it.
        fold
          ? `
      <a class="svc-next" href="#addons">Add-ons for any package <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6"/></svg></a>`
          : ""
      }
    </div>`;
}

/* ---------------- add-ons ---------------- */

function addonsHtml() {
  const card = (a) => {
    const why = unavailableReason(a);
    const priced = a.tiers.filter((t) => t.priceCents !== null);
    // A price that depends on the package (steam: $80 with Full Interior).
    const deal = priced.length === 1 && priced[0].withPackage ? Object.entries(priced[0].withPackage)[0] : null;
    const range = deal
      ? `${money(deal[1])} with ${findPackage(deal[0])?.name ?? deal[0]}, ${money(priced[0].priceCents)} otherwise`
      : priced.length > 1
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
      (range ? `<i class="addon-price">${range}${caveat ? "*" : ""}</i>` : "") +
      (why ? `<i class="addon-soon">${esc(why)}</i>` : "") +
      (caveat ? `<i class="addon-ast">*${esc(caveat)}</i>` : "");
    // NOTE: the (i) marker and an autoplaying clip belong here, from
    // addon.videoUrl. Neither renders yet.
    const how = a.note
      ? `<details class="addon-how"><summary>How it works</summary><p>${esc(a.note)}</p></details>`
      : "";
    // The icon says what the service IS at a glance. Fifteen identical
    // clocks said only that all fifteen take time.
    return `        <div class="addon${why ? " addon-off" : ""} reveal">
          <span class="addon-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${addonIcon(a.icon)}</svg></span>
          <div class="addon-body"><b>${esc(a.name)}${why ? "<sup>*</sup>" : ""}</b><span>${esc(a.description)}</span>${price}${how}</div>
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

  // No "Add-ons" heading here: the section above already says "Add-ons for any
  // package", and a second, smaller one read as a duplicate.
  return groups.join("\n");
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
      // Do not let a search result advertise something nobody can book.
      availability: p.comingSoon
        ? "https://schema.org/PreOrder"
        : "https://schema.org/InStock",
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

function splice(file, html, name, body, { inline = false } = {}) {
  const start = `<!-- CATALOG:${name}:START -->`;
  const end = `<!-- CATALOG:${name}:END -->`;
  const i = html.indexOf(start);
  const j = html.indexOf(end);
  if (i < 0 || j < 0) {
    throw new Error(`Markers for ${name} not found in ${file}`);
  }
  const wrapped = inline ? body : `\n${body}\n    `;
  return html.slice(0, i + start.length) + wrapped + html.slice(j);
}

const pages = Object.fromEntries(PAGES.map((f) => [f, read(f)]));
// The full cards on both: the home page shows them as it always has, and
// services.html carries them above the add-ons.
pages["index.html"] = splice("index.html", pages["index.html"], "SERVICES", servicesHtml());
pages["services.html"] = splice("services.html", pages["services.html"], "SERVICES", servicesHtml({ fold: true }));
pages["index.html"] = splice("index.html", pages["index.html"], "OFFERS", offersHtml());
pages["services.html"] = splice("services.html", pages["services.html"], "ADDONS", addonsHtml());
pages["faq.html"] = splice("faq.html", pages["faq.html"], "FAQPRICE", faqPriceText(), { inline: true });
// The JSON-LD copy has to survive JSON.stringify, so quotes are escaped.
pages["faq.html"] = splice("faq.html", pages["faq.html"], "FAQPRICE_JSON", JSON.stringify(faqPriceText()).slice(1, -1), { inline: true });
/* ---------------- the Google rating, from one source ---------------- */

// "5.0 across 32 reviews" used to be typed into the meta description, the
// JSON-LD and the reviews header separately. The snapshot in data/reviews.json
// is the source; js/reviews.js prefers the live API at runtime and these are
// what search engines and no-JS visitors see.
{
  const snap = JSON.parse(fs.readFileSync(path.join(root, "data/reviews.json"), "utf8"));
  const rating = Number(snap.rating);
  const count = Number(snap.count ?? (snap.reviews ?? []).length);
  if (Number.isFinite(rating) && rating > 0 && count > 0) {
    const r1 = rating.toFixed(1);
    for (const f of PAGES) pages[f] = pages[f]
      .replace(/Rated [0-9.]+ across \d+ Google reviews/g, `Rated ${r1} across ${count} Google reviews`)
      .replace(/"ratingValue": "[0-9.]+"/g, `"ratingValue": "${r1}"`)
      .replace(/"reviewCount": "\d+"/g, `"reviewCount": "${count}"`)
      .replace(/<span class="num">[0-9.]+<\/span>/g, `<span class="num">${r1}</span>`)
      .replace(/<b>\d+ reviews<\/b> on Google/g, `<b>${count} reviews</b> on Google`)
      // The hero badge. It said "Rated 5.0 on Google & Yelp" with no count at
      // all, which is the weaker claim: the rating says the work is good, the
      // count says enough people have checked.
      .replace(
        /Rated [0-9.]+ from \d+ reviews on Google/g,
        `Rated ${r1} from ${count} reviews on Google`,
      );
  }
}

/* ---------------- printed promo codes, from config/promo-codes.json ---------------- */

// "GOLF10 takes 10% off" was typed into lp-golf.html while the discount itself
// lives in the settings file, so changing one would have left the page wrong.
// A page that names a code the file doesn't know fails the build.
{
  const { codes } = JSON.parse(read("config/promo-codes.json"));
  const off = (c) => (c.percentOff !== undefined ? `${c.percentOff}% off` : `$${c.dollarsOff} off`);
  for (const f of PAGES) {
    pages[f] = pages[f].replace(/<b>([A-Z0-9]+)<\/b> takes [^<]*? off\b/g, (_, code) => {
      const c = codes.find((x) => String(x.code).toUpperCase() === code);
      if (!c) throw new Error(`${f} names the promo code ${code}, which is not in config/promo-codes.json`);
      return `<b>${code}</b> takes ${off(c)}`;
    });
  }
}

for (const f of PAGES) fs.writeFileSync(path.join(root, f), pages[f]);

/* ---------------- business numbers in hand-written pages, from their settings ---------------- */

// These sentences were typed with the number in them while the number itself
// lives in the pricing rules or the catalog: "the first 10 minutes are free"
// sat in three places from September to November 12, 2026. Each entry stamps
// the number from its source, matched by the words around it, so the page
// text stays exactly as written (the terms' wording check sees no change).
// Every entry must still match its count: a rewording that drops the pattern
// fails the build instead of quietly going stale. (The booking form reads the
// same settings through P.RULES and the catalog.)
{
  const R = DEFAULT_RULES;
  const pkg = (id) => {
    const p = findPackage(id);
    if (!p) throw new Error(`render-site: no package ${id}`);
    return p;
  };
  const num = (n) => String(Math.round(n * 100) / 100);
  // [file, pattern (a group around each number), the numbers in order, matches expected]
  const STAMPS = [
    ["service-area.html", /(first )\d+( minutes are free)/g, [R.mileage.freeMinutes], 1],
    ["service-area.html", /(travel up to <b>)\d+( hours each way)/g, [MAX_ONE_WAY_MINUTES / 60], 1],
    ["terms.html", /(first )\d+( minutes of drive time are free)/g, [R.mileage.freeMinutes], 1],
    ["terms.html", /([Mm]ore than )\d+( hours notice)/g, [R.refundFullWindowHours], 2],
    ["terms.html", /(Inside )\d+( hours the day is half committed and hard to refill; inside )\d+( hours it is gone)/g,
      [R.refundFullWindowHours, R.refundMidWindowHours], 1],
    ["terms.html", /(Moving a booking inside )\d+( hours)/g, [R.refundMidWindowHours], 1],
    ["terms.html", /(counts as a cancellation inside )\d+( hours)/g, [R.refundMidWindowHours], 1],
    ["terms.html", /(A Basic Interior at \$)\d+( is a Basic Interior at \$)\d+()/g,
      [pkg("basic-interior").priceCents / 100, pkg("basic-interior").priceCents / 100], 1],
    ["index.html", /(save )\d+(% on each extra)/g, [R.additionalVehicleDiscountBp / 100], 1],
    ["faq.html", /(billed at \$)\d+(\/hr)/g, [R.addonRateCents / 100], 2],
    ["faq.html", /(basic details around )[\d.]+( hours, and full details about )[\d.]+( hours)/g,
      [pkg("basic-interior").durationMin / 60, pkg("full-interior").durationMin / 60], 2],
  ];
  const files = {};
  for (const [f, re, values, expected] of STAMPS) {
    let hits = 0;
    const html = (files[f] ?? read(f)).replace(re, (...m) => {
      hits++;
      const groups = m.slice(1, values.length + 2);
      return groups.map((g, i) => g + (i < values.length ? num(values[i]) : "")).join("");
    });
    if (hits !== expected) {
      throw new Error(`render-site: ${f} matched ${re} ${hits} times, expected ${expected}. Reworded? Update STAMPS.`);
    }
    files[f] = html;
  }
  for (const [f, html] of Object.entries(files)) fs.writeFileSync(path.join(root, f), html);
}

/* ---------------- the Contact form, from config/contact-form.json ---------------- */

// "Request a quote" until texting approval, then back to "Got a question
// first?" by changing one word (A2P plan T2). See contact-form.mjs.
{
  const cfg = loadContactForm();
  let html = read("contact.html");
  for (const [name, body] of [["HEAD", contactHead(cfg)], ["CARD", contactCard(cfg)]]) {
    const start = `<!-- CONTACT:${name}:START -->\n`;
    const end = `<!-- CONTACT:${name}:END -->`;
    const i = html.indexOf(start);
    const j = html.indexOf(end);
    if (i < 0 || j < 0) throw new Error(`render-site: CONTACT:${name} markers not found in contact.html`);
    html = html.slice(0, i + start.length) + body + html.slice(j);
  }
  fs.writeFileSync(path.join(root, "contact.html"), html);
  console.log(`contact form: ${cfg.mode} mode`);
}

/* ---------------- the booking page (/book), from config/booking-page.json ---------------- */

// A2P plan T7. The 9:16 video slot shows the hero photo until a video is set
// (one value in the config file), and the area pills are the footer's own
// area list, so the two never disagree.
{
  const cfg = JSON.parse(read("config/booking-page.json"));
  const v = cfg.video ?? {};
  for (const k of ["src", "poster"]) {
    if (typeof v[k] !== "string") throw new Error(`config/booking-page.json: video.${k} must be text ("" for none)`);
    if (v[k] && (!/^images\/[A-Za-z0-9._-]+$/.test(v[k]) || !fs.existsSync(path.join(root, v[k])))) {
      throw new Error(`config/booking-page.json: video.${k} "${v[k]}" is not a file in images/`);
    }
  }
  const HERO = (ext) => [640, 960, 1280].map((w) => `images/hero-exterior-${w}.${ext} ${w}w`).join(", ");
  const SIZES = "(min-width: 1000px) 320px, 100vw";
  const media = v.src
    ? `      <video class="bp-media" src="${v.src}" poster="${v.poster || "images/hero-exterior-960.jpg"}" muted playsinline loop autoplay preload="metadata"></video>`
    : `      <picture>
        <source type="image/webp" sizes="${SIZES}" srcset="${HERO("webp")}" />
        <img class="bp-media" src="images/hero-exterior-960.jpg" sizes="${SIZES}" srcset="${HERO("jpg")}"
             alt="Freshly detailed glossy white SUV in a Cincinnati driveway" fetchpriority="high" width="1600" height="1200" />
      </picture>`;
  const areas = [...read("web/partials/footer.html").matchAll(/<a href="\{\{areas\}\}(#area-[a-z]+)">([^<]+)<\/a>/g)]
    .map(([, hash, label]) => `          <li><a href="service-area.html${hash}">${label}</a></li>`);
  if (areas.length < 3) throw new Error("render-site: the footer's area list was not found for the booking page");
  let html = pages["booking.html"] ?? read("booking.html");
  for (const [name, body] of [["VIDEO", media], ["AREAS", areas.join("\n")]]) {
    const start = `<!-- BOOKPAGE:${name}:START -->\n`;
    const end = `<!-- BOOKPAGE:${name}:END -->`;
    const i = html.indexOf(start);
    const j = html.indexOf(end);
    if (i < 0 || j < 0) throw new Error(`render-site: BOOKPAGE:${name} markers not found in booking.html`);
    html = html.slice(0, i + start.length) + body + "\n" + html.slice(j);
  }
  fs.writeFileSync(path.join(root, "booking.html"), html);
}

/* ---------------- opening hours, from config/business.json ---------------- */

// "7 days a week, 7 AM to 10 PM" was typed into four places while the hidden
// business data said 06:00 to 22:00 (A2P plan T4, November 12). The words and
// the data now both come from the setting. The footer gets them through the
// header and footer partials ({{hours}}); these are the hand-written lines.
{
  const T = "(?:\\d{1,2}(?::\\d\\d)? (?:AM|PM)|noon|midnight)";
  const words = new RegExp(`(7 days a week, |7 days/week · )${T} to ${T}`, "g");
  const HOURS_STAMPS = [
    // [file, pattern, replacement, matches expected (the footer counts too)]
    ["index.html", words, `$1${hoursText()}`, 2],
    ["contact.html", words, `$1${hoursText()}`, 2],
    ["index.html", /("opens": ")[\d:]+(", "closes": ")[\d:]+(")/g, `$1${HOURS.opens}$2${HOURS.closes}$3`, 1],
  ];
  const files = {};
  for (const [f, re, to, expected] of HOURS_STAMPS) {
    const before = files[f] ?? read(f);
    const hits = (before.match(re) || []).length;
    if (hits !== expected) {
      throw new Error(`render-site: ${f} matched ${re} ${hits} times, expected ${expected}. Reworded? Update HOURS_STAMPS.`);
    }
    files[f] = before.replace(re, to);
  }
  for (const [f, html] of Object.entries(files)) fs.writeFileSync(path.join(root, f), html);
}

const count =
  packagesFor("interior").concat(packagesFor("exterior")).filter((p) => !p.requiresPriorDetail).length;
const bookable = ADDONS.filter((a) => !unavailableReason(a)).length;
console.log(
  `rendered ${count} packages, ${ADDONS.length} add-ons (${bookable} bookable, ${ADDONS.length - bookable} listed only) into ${PAGES.join(", ")}`,
);
