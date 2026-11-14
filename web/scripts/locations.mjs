/**
 * City (location) pages: one file per city in config/locations/<slug>.json,
 * rendered from web/templates/location.html by render-locations.mjs (SEO
 * pass, Imperion section B; November 14). This module is the one list every
 * other step reads, so a new city page is ONE config file: the shared chrome
 * (chrome.mjs CHROME_PAGES), publishing (build-dist FILES), asset stamps
 * (stamp-assets PAGES), the sitemap and the hub all follow it.
 *
 * A page with "status": "draft" is built (for review on localhost) but carries
 * noindex and stays out of the sitemap and the hub.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DIR = path.join(root, "config/locations");

export function loadLocations() {
  if (!fs.existsSync(DIR)) return [];
  return fs.readdirSync(DIR)
    .filter((f) => f.endsWith(".json") && !f.startsWith("_"))
    .sort()
    .map((f) => ({ file: `config/locations/${f}`, ...JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8")) }));
}

/** The page file each city is written to, at the site root (flat address, see render-locations.mjs). */
export const pageFile = (loc) => `${loc.slug}.html`;

export function locationPages() {
  return loadLocations().map(pageFile);
}

/** Words of a page's own (local) text, for the duplicate check. */
export function localWords(loc) {
  const parts = [
    loc.h1, loc.sub, loc.localParagraph,
    ...(loc.highlights ?? []),
    ...(loc.faq ?? []).flatMap((q) => [q.q, q.a]),
    ...(loc.localJobs ?? []).map((j) => j.note ?? ""),
  ];
  // Place names and ZIPs become one token, so two pages are compared on what
  // they say, not on the town they name (docs/SEO-COMPLIANCE.md, section 2).
  let text = parts.join(" ").toLowerCase().replace(/<[^>]+>/g, " ");
  const places = [loc.name, ...(loc.neighborhoods ?? []), ...(loc.areaServed ?? [])]
    .flatMap((n) => String(n).toLowerCase().split(/\s*(?:&|,|\band\b|\/)\s*/))
    .map((n) => n.trim()).filter((n) => n.length > 2).sort((a, b) => b.length - a.length);
  for (const n of places) text = text.split(n).join(" placename ");
  text = text.replace(/\b\d{5}\b/g, " zipcode ");
  return text.match(/[a-z0-9']+/g) ?? [];
}

const grams = (w, n = 5) => new Set(w.slice(0, Math.max(0, w.length - n + 1)).map((_, i) => w.slice(i, i + n).join(" ")));

/** Share of word 5-grams two pages have in common (Jaccard), 0 to 1. */
export function overlap(a, b) {
  const A = grams(a), B = grams(b);
  if (!A.size || !B.size) return 0;
  let both = 0;
  for (const g of A) if (B.has(g)) both++;
  return both / (A.size + B.size - both);
}

/** How much of page a's 5-grams also appear in page b (containment), 0 to 1. */
export function contained(a, b) {
  const A = grams(a), B = grams(b);
  if (!A.size) return 0;
  let both = 0;
  for (const g of A) if (B.has(g)) both++;
  return both / A.size;
}
