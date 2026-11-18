/**
 * /llms.txt (llmstxt.org): a short Markdown guide to the site for AI
 * assistants and AI search (Imperion audit, November 18: "Llms.txt not
 * found"). Google says its own search ignores the file and that having one is
 * fine; the point is the AI tools that do read it.
 *
 * Written at build from what the site already says, so it can never drift:
 * - the summary is the home page's meta description;
 * - the pages are exactly the sitemap's, each with its own title and meta
 *   description, at its one address (site-urls.mjs);
 * - packages and "from" prices come from the catalog, the same source as the
 *   price cards (no business number is typed here);
 * - what the prices mean is read from the Services page's own sentence;
 * - phone and hours come from config/business.json and BUSINESS_PHONE
 *   (businessPhone() reads it); the build's phone stamp runs after this file
 *   is written and checks no old number is left.
 */
import fs from "node:fs";
import path from "node:path";
import { tagWith } from "./site-urls.mjs";
import { BOOK_PAGE } from "./book-links.mjs";

const meta = (html, re) => (re.exec(html)?.[1] ?? "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
const title = (html) => meta(html, /<title>([^<]*)<\/title>/).replace(/\s*\|\s*513 Auto Clean$/, "").replace(/^513 Auto Clean\s*\|\s*/, "");
const description = (html) => meta(tagWith(html, "meta", /\bname="description"/) ?? "", /\bcontent="([^"]*)"/);
const money = (cents) => "$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: cents % 100 ? 2 : 0 });

/** The policies go under "Optional": the spec's place for what can be skipped. */
const OPTIONAL = new Set(["/privacy", "/terms"]);

/**
 * @param {object} o
 * @param {string} o.dist the built site
 * @param {{ packages: object[] }} o.catalog SEED_CATALOG
 * @param {string} o.phone the published number, as shown
 * @param {string} o.hours hoursText()
 */
export function llmsTxt({ dist, catalog, phone, hours }) {
  const sitemap = fs.readFileSync(path.join(dist, "sitemap.xml"), "utf8");
  const pages = [...sitemap.matchAll(/<loc>([^<]*)<\/loc>/g)].map(([, url]) => {
    const rel = new URL(url).pathname;
    const file = rel === "/" ? "index.html" : rel.slice(1) + ".html";
    const html = fs.readFileSync(path.join(dist, file), "utf8");
    return { url, rel, title: rel === "/" ? "Home" : title(html), description: description(html) };
  });
  const home = pages.find((p) => p.rel === "/");
  const line = (p) => `- [${p.title}](${p.url})${p.description ? `: ${p.description}` : ""}`;
  // Bookable by anyone: not coming soon, and not limited to returning customers.
  const packages = catalog.packages
    .filter((p) => !p.comingSoon && !p.requiresPriorDetail)
    .sort((a, b) => a.category.localeCompare(b.category) || a.sortOrder - b.sortOrder);
  const origin = new URL(home.url).origin;
  // What the prices mean, in the Services page's own words (read, not copied).
  const services = fs.readFileSync(path.join(dist, "services.html"), "utf8");
  // Up to the sentence's full stop, line breaks collapsed; a tag inside it fails loudly below.
  const meaning = /Prices are starting points[^<.]*\./.exec(services)?.[0].replace(/\s+/g, " ");
  if (!meaning) throw new Error('llms-txt: services.html no longer says "Prices are starting points..."; update llms-txt.mjs');

  return [
    "# 513 Auto Clean",
    "",
    `> ${home.description}`,
    "",
    `- Phone: ${phone}`,
    `- Hours: ${hours}`,
    `- Book online: ${origin}${BOOK_PAGE}`,
    "",
    // Free text belongs before the first H2 (llmstxt.org): the H2 sections are
    // lists of links. The Services page's own words for what the prices mean.
    `Packages and starting prices. ${meaning} The booking form shows the price for your vehicle as you choose.`,
    "",
    ...packages.map((p) => `- ${p.name} (${p.category}), from ${money(p.priceCents)}: ${p.tagline}`),
    "",
    "## Pages",
    "",
    ...pages.filter((p) => !OPTIONAL.has(p.rel)).map(line),
    "",
    "## Optional",
    "",
    ...pages.filter((p) => OPTIONAL.has(p.rel)).map(line),
    "",
  ].join("\n");
}
