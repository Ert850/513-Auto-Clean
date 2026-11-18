/**
 * Service pages from config/services/*.json (SEO pass B4; Imperion section B).
 * Like the city pages (render-locations.mjs): one file per page, written to
 * <slug>.html at the site root, registered everywhere by locations.mjs.
 *
 * Everything a customer could hold us to comes from the catalog, never the
 * config: package names, prices (small vehicle, "from"), what each includes and
 * leaves out, how long it takes, the size surcharges, add-on prices. The config
 * holds only the words: the intro, the steps, the honest note, the questions.
 * Before/after photos are the gallery pairs tagged with the page's services
 * (data/gallery.json "services"), shown in the hero carousel (split-hero.mjs),
 * hero.pair first.
 *
 * What fails the build: a missing field, a title over 60 or description over
 * 155 characters (as rendered), an unknown package or add-on, fewer than 3
 * steps or 3 questions, and a published page with fewer than 2 photo pairs.
 */
import { carouselHero } from "./split-hero.mjs";
import fs from "node:fs";
import path from "node:path";
import { root, loadServices, loadLocations, pageFile, overlap, contained, typedNumbers, configWords, mainText, normalWords } from "./locations.mjs";
import { findPackage, findAddon, componentsOf, SEED_CATALOG, vehicleSize, tierPriceFor } from "../../netlify/functions/_pricing.mjs";
import { explainsProblems, tabGuides } from "./page-links.mjs";

const SITE = "https://513autoclean.com";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const money = (c) => `$${(c / 100).toFixed(c % 100 ? 2 : 0)}`;
const hrs = (m) => { const h = Math.round(m / 30) / 2; return `about ${h} hr${h === 1 ? "" : "s"}`; };
const gallery = JSON.parse(read("data/gallery.json")).pairs ?? [];
const reviews = JSON.parse(read("data/reviews.json"));
const pages = loadServices();
const live = (p) => p.status !== "draft";
const problems = [];
const need = (cond, p, msg) => { if (!cond) problems.push(`${p.file}: ${msg}`); };

// {price:<package>} and {addon:<id>} in the words, filled from the catalog.
function priced(text, where) {
  return String(text).replace(/\{(price|addon):([a-z0-9-]+)\}/g, (m, kind, id) => {
    const cents = kind === "price" ? findPackage(id)?.priceCents : findAddon(id)?.tiers?.[0]?.priceCents;
    if (typeof cents !== "number") throw new Error(`render-services: ${where}: no ${kind} "${id}"`);
    return money(cents);
  });
}
// R6 (docs/SEO-COMPLIANCE.md): a business number in the words comes from a setting, never typed.
const typed = pages.flatMap((p) => configWords(p).flatMap((t) => typedNumbers(t).map((n) => `${p.file}: "${n}" is typed; say it from a setting ({price:...}, {addon:...}) or leave it out`)));
problems.push(...typed);
for (const p of pages) {
  for (const k of ["title", "meta", "sub", "honest"]) if (p[k]) p[k] = priced(p[k], `${p.file} ${k}`);
  p.steps = (p.steps ?? []).map((s) => priced(s, p.file));
  p.faq = (p.faq ?? []).map((q) => ({ q: priced(q.q, p.file), a: priced(q.a, p.file) }));
}
const proofOf = (p) => (p.proofPairs ?? gallery.filter((g) => (g.services ?? []).some((s) => (p.proofServices ?? []).includes(s))).map((g) => g.slug))
  .map((slug) => gallery.find((g) => g.slug === slug)).filter(Boolean).slice(0, p.proofMax ?? 4);

for (const p of pages) {
  need(/^[a-z0-9-]+$/.test(p.slug ?? ""), p, "slug must be lowercase letters, digits and dashes");
  for (const k of ["name", "title", "meta", "h1", "sub"]) need(typeof p[k] === "string" && p[k].trim(), p, `${k} is missing`);
  need(p.title.length <= 60, p, `title is ${p.title.length} characters (max 60)`);
  need(p.meta.length <= 155, p, `meta is ${p.meta.length} characters (max 155)`);
  for (const id of p.packages ?? []) need(findPackage(id), p, `no package "${id}"`);
  for (const id of p.addons ?? []) need(findAddon(id), p, `no add-on "${id}"`);
  need((p.steps ?? []).length >= 3, p, "at least 3 steps");
  need((p.faq ?? []).length >= 3, p, "at least 3 questions");
  for (const slug of p.proofPairs ?? []) need(gallery.some((g) => g.slug === slug), p, `no gallery pair "${slug}"`);
  // Every before/after on the page is work of this page's service (Emmett,
  // November 15: "Stains before and after" showed an interior reset).
  need(Array.isArray(p.proofServices) && p.proofServices.length, p, "proofServices must list the gallery service tags this page shows");
  const ofService = (slug) => (gallery.find((g) => g.slug === slug)?.services ?? []).some((s) => (p.proofServices ?? []).includes(s));
  for (const slug of [...(p.proofPairs ?? []), ...(p.hero?.pair ? [p.hero.pair] : [])]) need(ofService(slug), p, `"${slug}" isn't tagged with ${(p.proofServices ?? []).join(" or ")} in data/gallery.json`);
  if (live(p)) need(proofOf(p).length >= 2, p, "a published page needs at least 2 before/after pairs of this service");
}
if (problems.length) throw new Error("render-services:\n  " + problems.join("\n  "));

const tpl = read("web/templates/service.html");
const cities = loadLocations().filter(live);

for (const p of pages) {
  const url = `${SITE}/${p.slug}`;
  const ctaAttrs = p.book?.package ? ` data-book-package="${esc(p.book.package)}"` : p.book?.intent ? ` data-book-intent="${esc(p.book.intent)}"` : "";
  // The hero carousel holds every before/after of the page: the chosen first
  // pair, then the service's other pairs (they had their own row until the
  // carousel, November 15).
  const first = p.hero?.pair ? gallery.find((g) => g.slug === p.hero.pair) : null;
  const shown = [...(first ? [first] : []), ...proofOf(p).filter((g) => g !== first)];
  const hero = shown.length ? carouselHero(shown) : "";

  const levels = (p.packages ?? []).length ? `
<section class="svp-levels">
  <div class="wrap">
    <h2>${esc(p.levelsH2 ?? "Pick your level")}</h2>
    <div class="svp-levels-grid">
${p.packages.map((id) => {
  const k = findPackage(id);
  const parts = componentsOf(k, SEED_CATALOG).map((c) => c.name);
  return `      <article class="svp-level${k.featured ? " featured" : ""}">
        ${k.featured ? '<span class="svc-tag">Most Popular</span>' : ""}<h3>${esc(k.name)}</h3>
        <p class="svp-price"><b>from ${money(k.priceCents)}</b> <span>${hrs(k.durationMin)}</span></p>
        <p class="svp-tag">${esc(k.tagline)}</p>
        <ul>${parts.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
        ${(k.notIncluded ?? []).length ? `<p class="svp-not"><b>Not included:</b> ${esc(k.notIncluded.slice(0, 2).join("; "))}.</p>` : ""}
        <a class="btn btn-ghost btn-block" href="book.html" data-book-package="${esc(k.id)}">Book ${esc(k.name)}</a>
      </article>`;
}).join("\n")}
    </div>
  </div>
</section>
` : "";


  const addonLine = (id) => {
    const a = findAddon(id);
    const t = a.tiers.filter((x) => x.priceCents !== null);
    const price = t.length > 1 ? `${money(t[0].priceCents)} to ${money(t[t.length - 1].priceCents)}`
      : t[0]?.totalWith ? `${money(findPackage(t[0].totalWith).priceCents + t[0].priceCents)}+ total with ${findPackage(t[0].totalWith).name}`
      : t[0]?.withPackage ? `${money(t[0].priceCents)} (${Object.entries(t[0].withPackage).map(([pk, c]) => `${money(c)} with ${findPackage(pk).name}`).join(", ")})`
      : t[0] ? money(t[0].priceCents) : "price on request";
    return `        <li><b>${esc(a.name)}</b>, ${esc(price)}: ${esc(a.description)}</li>`;
  };
  const sizes = ["medium", "large"].map((id) => vehicleSize(id)).filter(Boolean)
    .map((s) => `${s.label} (${s.examples}) +${money(s.upchargeCents)}`).join(", ");

  const jsonld = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: "Services", item: `${SITE}/services.html` },
        { "@type": "ListItem", position: 3, name: p.name, item: url },
      ] },
      { "@type": "Service", name: p.name, serviceType: p.serviceType ?? p.name, url,
        provider: { "@type": "AutoWash", "@id": `${SITE}/#business`, name: "513 Auto Clean", url: `${SITE}/` },
        areaServed: { "@type": "Place", name: "Greater Cincinnati" },
        ...((p.packages ?? []).length ? { offers: p.packages.map((id) => { const k = findPackage(id); return { "@type": "Offer", name: k.name, priceSpecification: { "@type": "PriceSpecification", minPrice: (k.priceCents / 100).toFixed(2), priceCurrency: "USD" } }; }) } : {}) },
    ],
  };

  const fill = {
    FILE: p.file, TITLE: esc(p.title), META: esc(p.meta), CANONICAL: url,
    ROBOTS: live(p) ? "" : '<meta name="robots" content="noindex" />\n',
    JSONLD: JSON.stringify(jsonld, null, 2),
    NAME: esc(p.name), EYEBROW: esc(p.eyebrow ?? p.name), H1: esc(p.h1), SUB: esc(p.sub),
    CTA_ATTRS: ctaAttrs,
    RATING: `${Number(reviews.rating).toFixed(1)} on Google (${reviews.count} reviews)`,
    TRUST: (p.trust ?? ["UC student-owned", "We come to you", "Pay when it's done"]).map((t) => `          <li>${esc(t)}</li>`).join("\n"),
    HERO: hero, LEVELS: levels,
    HOW_H2: esc(p.howH2 ?? "How it works"),
    STEPS: p.steps.map((s) => `        <li>${esc(s)}</li>`).join("\n"),
    HONEST: p.honest ? `      <p class="svp-honest"><b>Straight answer:</b> ${esc(p.honest)}</p>` : "",
    ADDONS_H2: esc(p.addonsH2 ?? "Add to it"),
    ADDONS: (p.addons ?? []).map(addonLine).join("\n"),
    SIZES: `Prices are for a small car. ${esc(sizes)}. You see your exact total, with travel and tax, before you book.`,
    FAQ_H2: esc(p.faqH2 ?? "Common questions"),
    FAQ: p.faq.map((q) => `    <details class="loc-q"><summary>${esc(q.q)}</summary><p>${esc(q.a)}</p></details>`).join("\n"),
    WHERE: `    <p class="svp-where">We come to you anywhere in our <a href="service-area.html">service area</a>${cities.length ? `, including ${cities.map((c) => `<a href="${pageFile(c)}">${esc(c.name)}</a>`).join(", ")}` : ""}.</p>`,
  };
  let html = tpl.replace(/\{\{(\w+)\}\}/g, (m, k) => { if (!(k in fill)) throw new Error(`render-services: no value for {{${k}}}`); return fill[k]; });
  const out = path.join(root, pageFile(p));
  if (fs.existsSync(out)) {
    const old = fs.readFileSync(out, "utf8");
    for (const part of ["HEAD", "HEADER", "FOOTER", "SCRIPTS"]) {
      const s = `<!-- CHROME:${part}:START -->\n`, e = `\n<!-- CHROME:${part}:END -->`;
      const have = old.slice(old.indexOf(s) + s.length, old.indexOf(e));
      const i = html.indexOf(s) + s.length, j = html.indexOf(e);
      html = html.slice(0, i) + have + html.slice(j);
    }
  }
  fs.writeFileSync(out, html);
}

// R2 on what a visitor reads (docs/SEO-COMPLIANCE.md): each service page's
// visible text against the others and against the pages it could copy from.
// The city pages are written first (build:locations), so they're compared too
// (validation cycle 3), as fixed pages: city against city is render-locations' job.
const versus = [...pages.map((p) => ({ name: p.slug, text: mainText(read(pageFile(p))) })),
  ...["services.html", "index.html", "faq.html", "about.html", ...loadLocations().map(pageFile)].map((f) => ({ name: f, text: mainText(read(f)), fixed: true }))];
for (let i = 0; i < versus.length; i++) for (let k = i + 1; k < versus.length; k++) {
  const A = versus[i], B = versus[k];
  if (A.fixed && B.fixed) continue;
  const a = normalWords(A.text, []), b = normalWords(B.text, []);
  const o = overlap(a, b), c = Math.max(contained(a, b), contained(b, a));
  if (o > 0.3) problems.push(`${A.name} and ${B.name} share ${o.toFixed(2)} of their text (max 0.30)`);
  if (c > 0.5) problems.push(`${A.name} and ${B.name}: over half of one page's text is in the other`);
}
problems.push(...explainsProblems(pages, findAddon));
if (problems.length) throw new Error("render-services:\n  " + problems.join("\n  "));

// Services page tab row: links to the published pages that explain a tab (page-links.mjs).
{
  let s = read("services.html");
  const a = "<!-- SERVICEGUIDES:START -->", b = "<!-- SERVICEGUIDES:END -->";
  if (s.indexOf(a) < 0 || s.indexOf(b) < 0) throw new Error("render-services: SERVICEGUIDES markers not found in services.html");
  s = s.slice(0, s.indexOf(a) + a.length) + tabGuides(pages) + s.slice(s.indexOf(b));
  fs.writeFileSync(path.join(root, "services.html"), s);
}

const published = pages.filter(live);
let sm = read("sitemap.xml");
const a = "<!-- SERVICEPAGES:START -->", b = "<!-- SERVICEPAGES:END -->";
if (sm.indexOf(a) < 0 || sm.indexOf(b) < 0) throw new Error("render-services: SERVICEPAGES markers not found in sitemap.xml");
sm = sm.slice(0, sm.indexOf(a) + a.length) + published.map((p) => `\n  <url>\n    <loc>${SITE}/${p.slug}</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>`).join("") + "\n  " + sm.slice(sm.indexOf(b));
fs.writeFileSync(path.join(root, "sitemap.xml"), sm);
console.log(`services: ${pages.length} service pages (${published.length} published, ${pages.length - published.length} draft)`);
