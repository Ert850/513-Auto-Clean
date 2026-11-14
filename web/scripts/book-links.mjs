/**
 * Where the site's Book links go (config/booking-page.json "bookLinks").
 *
 * "page" (Imperion, November 14, for the toll-free verification): every Book
 * link on every page except the booking page itself goes to /book, where the
 * SMS and marketing consent boxes are, and the form opens from there. The
 * package or interest a link carried rides along in the query
 * (/book?package=full-interior), and funnel.js applies it when the form opens.
 *
 * "inline": the links stay book.html and open the form in place, as before.
 *
 * Applied to dist/ only, like the phone number: the source pages keep
 * href="book.html", so switching back is one word and the next build.
 */
import fs from "node:fs";
import path from "node:path";

export const BOOK_PAGE = "/book";

export function bookLinksSetting(cfg) {
  const v = cfg?.bookLinks ?? "inline";
  if (v !== "page" && v !== "inline") {
    throw new Error(`config/booking-page.json: bookLinks must be "page" or "inline", not ${JSON.stringify(v)}`);
  }
  return v;
}

/** Rewrites one page's Book links to /book, keeping what each link carried. */
export function routeBookLinks(html) {
  let n = 0;
  const out = html.replace(/<a\b[^>]*\bhref="(?:\.\/)?book\.html"[^>]*>/g, (tag) => {
    n++;
    const pkg = /\bdata-book-package="([a-z0-9-]+)"/.exec(tag);
    const interest = /\bdata-book-interest="([a-z0-9-]+)"/.exec(tag);
    const browse = /\bdata-book-browse\b/.test(tag);
    const q = pkg ? `?package=${pkg[1]}` : interest ? `?interest=${interest[1]}` : browse ? "?browse=1" : "";
    return tag.replace(/\bhref="(?:\.\/)?book\.html"/, `href="${BOOK_PAGE}${q}"`);
  });
  return { html: out, count: n };
}

/** Every published page but the booking page. Returns how many links moved. */
export function routeDist(dist, cfg) {
  if (bookLinksSetting(cfg) !== "page") return 0;
  let total = 0;
  for (const f of fs.readdirSync(dist)) {
    if (!f.endsWith(".html") || f === "booking.html") continue;
    const file = path.join(dist, f);
    const { html, count } = routeBookLinks(fs.readFileSync(file, "utf8"));
    if (count) fs.writeFileSync(file, html);
    total += count;
  }
  return total;
}
