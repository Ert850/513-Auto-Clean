/**
 * City pages from config/locations/*.json (SEO pass; see locations.mjs and
 * docs/SEO-COMPLIANCE.md). Runs FIRST in the build, before the shared chrome
 * is written, so each page gets its header, footer and scripts like any other.
 *
 * Addresses are flat (/<slug>, served from <slug>.html at the site root): the
 * shared files use relative paths, so a page in a sub-folder would need every
 * one of them rewritten. Imperion's own example (/mobile-detailing-west-chester/)
 * is flat too.
 *
 * What fails the build, so a weak or copied page can never ship:
 *   a missing or over-long field (title 60, meta 155 characters, the local
 *   paragraph's word range); a gallery pair or review that does not exist; too
 *   few things that belong to this city alone; two pages whose own text
 *   overlaps more than MAX_OVERLAP (word 5-grams, Jaccard).
 */
import { pairPics, carouselHero } from "./split-hero.mjs";
import fs from "node:fs";
import path from "node:path";
import { root, loadLocations, loadServices, pageFile, localWords, overlap, contained } from "./locations.mjs";
import { findPackage, findAddon, zipGeo } from "../../netlify/functions/_pricing.mjs";

const SITE = "https://513autoclean.com";
// docs/SEO-COMPLIANCE.md section 2: Jaccard on word 5-grams of each page's own
// text, place names and ZIPs blanked. Google has no official number; 0.30 is
// about 46% of the text shared. Warn from 0.20; also fail when over half of
// one page appears in another.
const MAX_OVERLAP = 0.30;
const WARN_OVERLAP = 0.20;
const MAX_CONTAINED = 0.50;
const LIMITS = { title: 60, meta: 155, paraMin: 100, paraMax: 190 };

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const gallery = JSON.parse(read("data/gallery.json")).pairs ?? [];
const reviews = JSON.parse(read("data/reviews.json"));

const locs = loadLocations();

// Prices in the words come from the catalog, never typed (CLAUDE.md): write
// {price:full-interior} for a package or {addon:steam} for an add-on's
// standard price, and the build fills in today's figure.
const money = (c) => `$${(c / 100).toFixed(c % 100 ? 2 : 0)}`;
function priced(text, where) {
  return String(text).replace(/\{(price|addon):([a-z0-9-]+)\}/g, (m, kind, id) => {
    const cents = kind === "price" ? findPackage(id)?.priceCents : findAddon(id)?.tiers?.[0]?.priceCents;
    if (typeof cents !== "number") throw new Error(`render-locations: ${where}: no ${kind} "${id}" in the catalog`);
    return money(cents);
  });
}
for (const l of locs) for (const k of ["sub", "localParagraph", "meta"]) if (l[k]) l[k] = priced(l[k], `${l.file} ${k}`);
for (const l of locs) {
  l.highlights = (l.highlights ?? []).map((h) => priced(h, l.file));
  l.faq = (l.faq ?? []).map((q) => ({ q: priced(q.q, l.file), a: priced(q.a, l.file) }));
}
const problems = [];
const need = (cond, loc, msg) => { if (!cond) problems.push(`${loc.file}: ${msg}`); };

for (const loc of locs) {
  need(/^[a-z0-9-]+$/.test(loc.slug ?? ""), loc, "slug must be lowercase letters, digits and dashes");
  for (const k of ["name", "title", "meta", "eyebrow", "h1", "sub", "localParagraph"]) need(typeof loc[k] === "string" && loc[k].trim(), loc, `${k} is missing`);
  need((loc.title ?? "").length <= LIMITS.title, loc, `title is ${loc.title?.length} characters (max ${LIMITS.title})`);
  need((loc.meta ?? "").length <= LIMITS.meta, loc, `meta is ${loc.meta?.length} characters (max ${LIMITS.meta})`);
  const words = (loc.localParagraph ?? "").split(/\s+/).filter(Boolean).length;
  need(words >= LIMITS.paraMin && words <= LIMITS.paraMax, loc, `localParagraph is ${words} words (want ${LIMITS.paraMin} to ${LIMITS.paraMax})`);
  need(Array.isArray(loc.zips) && loc.zips.length && loc.zips.every((z) => /^\d{5}$/.test(z)), loc, "zips must be 5-digit ZIP codes");
  need(Array.isArray(loc.neighborhoods) && loc.neighborhoods.length >= 3, loc, "list at least 3 neighborhoods");
  need(Array.isArray(loc.faq) && loc.faq.length >= 3, loc, "at least 3 FAQ answers written for this area");
  // The hero carousel: gallery before/after pairs, never a lone "after" (Emmett, November 15).
  need(Array.isArray(loc.hero?.pairs) && loc.hero.pairs.length, loc, "hero.pairs must list the gallery pairs the hero carousel shows");
  for (const slug of loc.hero?.pairs ?? []) need(gallery.some((p) => p.slug === slug) && ["before", "after"].every((s) => ["webp", "jpg"].every((x) => fs.existsSync(path.join(root, `images/ba-${slug}-${s}-760.${x}`)))), loc, `hero.pairs: "${slug}" isn't a gallery before/after pair with both photos`);
  need(loc.map && Array.isArray(loc.map.center) && loc.map.center.length === 2 && loc.map.radiusMiles > 0, loc, "map needs center [lat, lon] and radiusMiles");
  for (const j of loc.localJobs ?? []) need(gallery.some((p) => p.slug === j.pair), loc, `localJobs: no gallery pair "${j.pair}"`);
  for (const r of loc.reviews ?? []) need(reviews.reviews.some((x) => x.author === r.author && x.date === r.date), loc, `reviews: no review by ${r.author} on ${r.date}`);
  // Things only this page has: its own paragraph and FAQ always; local jobs and reviews once Elijah's data is in.
  if (loc.status !== "draft") {
    need((loc.localJobs ?? []).length >= 2, loc, "a published page needs at least 2 local jobs with photos");
    need((loc.reviews ?? []).length >= 1, loc, "a published page needs at least 1 review from this area");
  }
}
for (let i = 0; i < locs.length; i++) for (let k = i + 1; k < locs.length; k++) {
  const a = localWords(locs[i]), b = localWords(locs[k]);
  const o = overlap(a, b), ca = contained(a, b), cb = contained(b, a);
  if (o > MAX_OVERLAP) problems.push(`${locs[i].slug} and ${locs[k].slug} overlap ${o.toFixed(2)} (max ${MAX_OVERLAP})`);
  else if (o > WARN_OVERLAP) console.warn(`render-locations: warning, ${locs[i].slug} and ${locs[k].slug} overlap ${o.toFixed(2)}`);
  if (Math.max(ca, cb) > MAX_CONTAINED) problems.push(`${locs[i].slug} and ${locs[k].slug}: over half of one page's text is in the other`);
}
if (problems.length) throw new Error("render-locations:\n  " + problems.join("\n  "));

const tpl = read("web/templates/location.html");
const pair = (slug) => gallery.find((p) => p.slug === slug);
const live = (loc) => loc.status !== "draft";

for (const loc of locs) {
  const url = `${SITE}/${loc.slug}`;
  const ctaAttrs = loc.book?.package ? ` data-book-package="${esc(loc.book.package)}"` : loc.book?.intent ? ` data-book-intent="${esc(loc.book.intent)}"` : "";
  const li = (t) => `        <li>${esc(t)}</li>`;
  const nearby = (loc.nearby ?? []).map((s) => locs.find((l) => l.slug === s)).filter((l) => l && live(l));
  const jobs = (loc.localJobs ?? []).length ? `
<section class="loc-jobs">
  <div class="wrap">
    <h2>${esc(loc.jobsH2 ?? "Recent jobs nearby")}</h2>
    <div class="loc-jobs-grid">
${loc.localJobs.map((j) => { const p = pair(j.pair); return `      <figure class="loc-job"><span class="loc-job-pics svp-split">${pairPics(p)}</span><figcaption><b>${esc(j.vehicle ?? p.caption)}</b>${j.note ? ` ${esc(j.note)}` : ""}${j.comment ? `<q>${esc(j.comment)}</q>` : ""}</figcaption></figure>`; }).join("\n")}
    </div>
  </div>
</section>
` : "";
  const revs = (loc.reviews ?? []).length ? `
<section class="loc-reviews">
  <div class="wrap">
    <h2>${esc(loc.reviewsH2 ?? "What customers say")}</h2>
${loc.reviews.map((r) => { const x = reviews.reviews.find((y) => y.author === r.author && y.date === r.date); return `    <blockquote class="loc-review"><p>${esc(x.text)}</p><cite>${esc(x.author.split(" ")[0])}${r.area ? `, ${esc(r.area)}` : ""}</cite></blockquote>`; }).join("\n")}
  </div>
</section>
` : "";
  const jsonld = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: "Service area", item: `${SITE}/service-area.html` },
        { "@type": "ListItem", position: 3, name: loc.name, item: url },
      ] },
      { "@type": "Service", "@id": `${url}#service`, name: loc.h1, serviceType: "Mobile car detailing", url,
        // AutoWash (an AutomotiveBusiness) is the closest schema.org type (docs/SEO-COMPLIANCE.md section 4).
        provider: { "@type": "AutoWash", "@id": `${SITE}/#business`, name: "513 Auto Clean", url: `${SITE}/` },
        areaServed: [...(loc.areaServed ?? [loc.name]).map((n) => ({ "@type": "Place", name: n })), ...loc.zips.map((z) => ({ "@type": "Place", address: { "@type": "PostalAddress", postalCode: z, addressCountry: "US" } }))] },
    ],
  };
  const fill = {
    FILE: loc.file, TITLE: esc(loc.title), META: esc(loc.meta), CANONICAL: url,
    ROBOTS: live(loc) ? "" : '<meta name="robots" content="noindex" />\n',
    JSONLD: JSON.stringify(jsonld, null, 2),
    NAME: esc(loc.name), EYEBROW: esc(loc.eyebrow),
    H1: esc(loc.h1), SUB: esc(loc.sub), CTA_ATTRS: ctaAttrs,
    RATING: `${Number(reviews.rating).toFixed(1)} on Google (${reviews.count} reviews)`,
    TRUST: (loc.trust ?? ["UC student-owned", "Pay when it's done"]).map((t) => `          <li>${esc(t)}</li>`).join("\n"),
    HERO: carouselHero(loc.hero.pairs.map(pair)),
    WHAT_H2: esc(loc.whatH2 ?? "What we do there"),
    // Each published service page (SEO-COMPLIANCE.md R7); none while they're drafts.
    SERVICE_LINKS: loadServices().filter(live).map((s) => `      <a class="loc-what-more" href="${s.slug}">${esc(s.name)} &rarr;</a>\n`).join(""),
    MAP: esc(JSON.stringify({ center: loc.map.center, radiusMiles: loc.map.radiusMiles,
      zips: loc.zips.map((z) => { const g = zipGeo(z) ?? (loc.map.zips ?? {})[z]; return g ? { zip: z, lat: g.lat, lon: g.lon } : null; }).filter(Boolean) })),
    LOCAL_H2: esc(loc.localH2 ?? "Where we set up"),
    LOCAL_P: loc.localParagraph.split(/\n\n+/).map((p) => `      <p>${esc(p)}</p>`).join("\n"),
    HIGHLIGHTS: (loc.highlights ?? []).map(li).join("\n"),
    AREAS_H2: esc(loc.areasH2 ?? "Where we go"),
    NEIGHBORHOODS: loc.neighborhoods.map((t) => `          <li>${esc(t)}</li>`).join("\n"),
    ZIPS: loc.zips.map((t) => `          <li>${esc(t)}</li>`).join("\n"),
    NEARBY: nearby.length ? `      <p class="loc-areas-l">Also nearby</p>\n      <ul class="loc-chips">\n${nearby.map((l) => `        <li><a href="${l.slug}">${esc(l.name)}</a></li>`).join("\n")}\n      </ul>` : "",
    JOBS: jobs, REVIEWS: revs,
    FAQ_H2: esc(loc.faqH2 ?? "Common questions"),
    FAQ: loc.faq.map((q) => `    <details class="loc-q"><summary>${esc(q.q)}</summary><p>${esc(q.a)}</p></details>`).join("\n"),
  };
  let html = tpl.replace(/\{\{(\w+)\}\}/g, (m, k) => { if (!(k in fill)) throw new Error(`render-locations: no value for {{${k}}}`); return fill[k]; });
  // Keep the shared chrome the page already has, so a rebuild changes nothing.
  const out = path.join(root, pageFile(loc));
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

// The sitemap and the hub list only published (non-draft) pages.
const published = locs.filter(live);
const region = (file, name, body) => {
  let s = read(file);
  const a = `<!-- ${name}:START -->`, b = `<!-- ${name}:END -->`;
  const i = s.indexOf(a), j = s.indexOf(b);
  if (i < 0 || j < 0) throw new Error(`render-locations: ${name} markers not found in ${file}`);
  s = s.slice(0, i + a.length) + body + s.slice(j);
  fs.writeFileSync(path.join(root, file), s);
};
region("sitemap.xml", "LOCATIONS", published.map((l) => `\n  <url>\n    <loc>${SITE}/${l.slug}</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>`).join("") + "\n  ");
region("service-area.html", "LOCATIONS", published.length
  ? `\n        <div class="loc-hub"><h3>City guides</h3><ul class="loc-chips">${published.map((l) => `<li><a href="${l.slug}">${esc(l.name)}</a></li>`).join("")}</ul></div>\n        `
  : "\n        ");
console.log(`locations: ${locs.length} city pages (${published.length} published, ${locs.length - published.length} draft)`);
