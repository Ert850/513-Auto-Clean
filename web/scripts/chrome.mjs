/**
 * The shared header and footer ("chrome"), from ONE source.
 *
 * They used to be copied by hand into all six pages, so every nav rename,
 * link fix or logo change had to be made six times and was not always made
 * six times. Now web/partials/header.html and footer.html are the only
 * copies anyone edits, and the build writes them into each page between
 * CHROME:HEADER and CHROME:FOOTER markers, like the catalog and the legal
 * text. Plain HTML in every page, nothing fetched at runtime, so search
 * engines and visitors without JavaScript see the same header.
 *
 * WHAT DIFFERS PER PAGE, and why. Each value is derived from the page
 * itself, so there is no per-page settings table to forget:
 *   home     the logo: back to the top on the home page, home otherwise
 *   gallery  "Results": in-page on the home page, index.html#gallery elsewhere
 *   book     "Book Now": book.html where the booking form is on the page (the
 *            form intercepts it and opens in place), index.html#book elsewhere
 *   contact  "Contact Us": the form itself on contact.html, the page elsewhere
 *   areas    footer place links: in-page on service-area.html, that page elsewhere
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const CHROME_PAGES = ["index.html", "services.html", "about.html", "service-area.html", "faq.html", "contact.html", "lp-golf.html", "lp-prestige.html"];
const PARTS = ["HEAD", "HEADER", "FOOTER", "SCRIPTS"];
/** The build stamps asset URLs (?v=hash) after this step; compare without them. */
export const unstamp = (s) => s.replace(/\?v=[0-9a-f]{10}/g, "");

const partial = (name) =>
  fs.readFileSync(path.join(root, "web/partials", `${name}.html`), "utf8")
    // The "edit this file" note is for whoever opens the partial; pages do not carry it.
    .replace(/^<!-- Edit THIS file[\s\S]*?-->\n/, "")
    .replace(/\n$/, "");

export function valuesFor(page, html) {
  return {
    home: page === "index.html" ? "#top" : "index.html",
    gallery: page === "index.html" ? "#gallery" : "index.html#gallery",
    // Every page with the shared SCRIPTS block carries the booking form, so
    // Book Now opens it in place; index.html#book is for a page without it.
    book: /CHROME:SCRIPTS:START|\bid="bookFunnel"/.test(html) ? "book.html" : "index.html#book",
    contact: page === "contact.html" ? "#inquiry" : "contact.html",
    areas: page === "service-area.html" ? "" : "service-area.html",
  };
}

export function renderPart(part, values) {
  const out = partial(part.toLowerCase()).replace(/\{\{(\w+)\}\}/g, (m, k) => {
    if (!(k in values)) throw new Error(`chrome: no value for {{${k}}}`);
    return values[k];
  });
  if (/\{\{\w+\}\}/.test(out)) throw new Error("chrome: a placeholder survived");
  return out;
}

/** The chrome a page SHOULD carry, keyed by part. */
export function expectedChrome(page, html) {
  const v = valuesFor(page, html);
  return Object.fromEntries(PARTS.map((p) => [p, renderPart(p, v)]));
}

/** What is between a page's markers now. */
export function currentChrome(html, part) {
  const start = `<!-- CHROME:${part}:START -->\n`, end = `\n<!-- CHROME:${part}:END -->`;
  const i = html.indexOf(start), j = html.indexOf(end);
  if (i < 0 || j < 0) return null;
  return html.slice(i + start.length, j);
}

export function applyChrome(page, html) {
  const want = expectedChrome(page, html);
  for (const part of PARTS) {
    const start = `<!-- CHROME:${part}:START -->\n`, end = `\n<!-- CHROME:${part}:END -->`;
    const i = html.indexOf(start), j = html.indexOf(end);
    if (i < 0 || j < 0) throw new Error(`chrome: CHROME:${part} markers missing in ${page}`);
    const have = html.slice(i + start.length, j);
    // Same apart from the ?v= stamps: leave it, so a rebuild changes nothing.
    if (unstamp(have) === want[part]) continue;
    html = html.slice(0, i + start.length) + want[part] + html.slice(j);
  }
  return html;
}
