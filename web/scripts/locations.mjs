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

/* Service pages (config/services/<slug>.json, render-services.mjs): the same
   one-file-per-page idea, read from the catalog. */
const SDIR = path.join(root, "config/services");
export function loadServices() {
  if (!fs.existsSync(SDIR)) return [];
  return fs.readdirSync(SDIR)
    .filter((f) => f.endsWith(".json") && !f.startsWith("_"))
    .sort()
    .map((f) => ({ file: `config/services/${f}`, ...JSON.parse(fs.readFileSync(path.join(SDIR, f), "utf8")) }));
}

/** Every generated page (cities and services): what the chrome, previews and stamps register. */
export function generatedPages() {
  return [...loadLocations(), ...loadServices()].map(pageFile);
}

/**
 * Only the published ones: what the live site gets (build-dist.mjs, when
 * Netlify's CONTEXT is "production"). A draft stays reviewable on a Deploy
 * Preview but is never reachable on 513autoclean.com (SEO-COMPLIANCE.md R1).
 */
export function publishedPages() {
  return [...loadLocations(), ...loadServices()].filter((p) => p.status !== "draft").map(pageFile);
}

/**
 * Numbers typed into page wording that should come from a setting
 * (CLAUDE.md, SEO-COMPLIANCE.md R6): a $ or % figure, or a count of minutes,
 * hours, days, weeks, months, miles or degrees, or a clock time. {price:...}
 * and {addon:...} tokens are the way to say a price. ZIPs, road numbers
 * (U.S. 50, I-71) and plain counts ("3 rows") are fine.
 */
const COUNT = "(?:\\d+(?:\\.\\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|forty-five|ninety)";
const UNIT = "(?:minutes?|mins?|hours?|hrs?|days?|weeks?|months?|miles?|mi|degrees?|percent)";
const TYPED = new RegExp([
  "\\$\\s?\\d",                                                      // $50
  "\\d\\s?%",                                                         // 10%
  `\\b${COUNT}(?:\\s*(?:-|to)\\s*${COUNT})?\\s+(?:[a-z]+\\s+)?${UNIT}\\b`, // 3 hours, two to four days, 2 business days, an hour
  "\\ban?\\s+(?:hour|day)\\b",                                            // within an hour, a day ahead
  "\\d+\\s*°",                                                       // 40°
  "\\b\\d{1,2}(?::\\d\\d)?\\s?(?:am|pm|a\\.m\\.|p\\.m\\.)(?![a-z])",       // 6pm, 7:30 am
  "\\b(?:noon|midnight|next day|same day|overnight)\\b",
].join("|"), "gi");
export function typedNumbers(text) {
  const t = String(text).replace(/\{(price|addon):[a-z0-9-]+\}/g, "");
  return t.match(TYPED) ?? [];
}

/** Every customer-readable string in a page config: all string fields, nested, except the ones that are ids, data or notes for us. */
const NOT_WORDS = new Set(["_read_me", "status", "slug", "file", "zips", "area", "nearby", "pairs", "pair", "map", "book", "packages", "addons", "proofPairs", "proofServices", "writtenBy", "author", "date", "zip", "intent", "package", "serviceType"]);
export function configWords(o, key = "") {
  if (NOT_WORDS.has(key)) return [];
  if (typeof o === "string") return [o];
  if (Array.isArray(o)) return o.flatMap((x) => configWords(x));
  if (o && typeof o === "object") return Object.entries(o).flatMap(([k, v]) => configWords(v, k));
  return [];
}

/** A page's visible words: its <main>, or, on the home page (no <main>), what sits between the shared header and footer. */
export function mainText(html) {
  let m = html.match(/<main[^>]*>([\s\S]*?)<\/main>/);
  const a = html.indexOf("<!-- CHROME:HEADER:END -->"), b = html.indexOf("<!-- CHROME:FOOTER:START -->");
  // Comparing nothing would pass every duplicate check.
  if (!m && (a < 0 || b < a)) throw new Error("mainText: the page has no <main> and no CHROME:HEADER/FOOTER markers");
  let body = m ? m[1] : html.slice(a, b);
  return body
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(+d))
    .replace(/&[a-z]+;/g, " ");
}

/** Place names of a city page, longest first: its name, neighborhoods and areaServed. */
export function placeNames(loc) {
  return [loc.name, ...(loc.neighborhoods ?? []), ...(loc.areaServed ?? []), ...(loc.roads ?? [])]
    .flatMap((n) => String(n ?? "").toLowerCase().split(/\s*(?:&|,|\band\b|\/)\s*/))
    .map((n) => n.trim()).filter((n) => n.length > 2);
}

/** Words of some text with the given place names and every ZIP blanked to one token each (SEO-COMPLIANCE.md R2). */
export function normalWords(text, places) {
  let t = String(text).toLowerCase().replace(/<[^>]+>/g, " ");
  for (const n of [...new Set(places)].sort((a, b) => b.length - a.length)) t = t.split(n).join(" placename ");
  t = t.replace(/\b\d{5}\b/g, " zipcode ");
  return t.match(/[a-z0-9']+/g) ?? [];
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
  return normalWords(parts.join(" "), placeNames(loc));
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
