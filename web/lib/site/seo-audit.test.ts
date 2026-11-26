/**
 * Imperion's Semrush audit, November 18: one address per page, one h1 per
 * page, slimmer HTML, and llms.txt. Root causes are in site-urls.mjs,
 * slim-html.mjs and llms-txt.mjs.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
// @ts-expect-error plain ESM build scripts
import { slimHtml } from "../../scripts/slim-html.mjs";
// @ts-expect-error plain ESM build scripts
import { SITE, cleanPath, cleanLinks, cleanPages, redirectsFor, applyCleanUrls, checkDist, headingSkip } from "../../scripts/site-urls.mjs";
// @ts-expect-error plain ESM build scripts
import { llmsTxt } from "../../scripts/llms-txt.mjs";

const root = path.resolve(__dirname, "../../..");
const read = (f: string) => fs.readFileSync(path.join(root, f), "utf8");

describe("slimHtml: comments and indentation out, what shows unchanged", () => {
  it("drops comments and indentation, keeps one line break where there was one", () => {
    expect(slimHtml("<div>\n    <!-- why -->\n    <p>Hi <b>there</b></p>\n  </div>")).toBe("<div>\n<p>Hi <b>there</b></p>\n</div>");
  });
  it("leaves script, style, pre and textarea byte for byte", () => {
    const keep = [
      '<script type="application/ld+json">\n  { "a": "<!-- not a comment -->" }\n</script>',
      "<style>\n  .x { color: red; }\n</style>",
      "<pre>\n  two  spaces\n</pre>",
      "<textarea>\n  typed\n</textarea>",
    ];
    for (const k of keep) expect(slimHtml(`<div>\n  ${k}\n</div>`)).toBe(`<div>\n${k}\n</div>`);
  });
  it("a comment that mentions <script is still only a comment", () => {
    expect(slimHtml("<p>a</p>\n<!-- the <script> below loads late -->\n<p>b</p>\n<script>x()</script>")).toBe("<p>a</p>\n<p>b</p>\n<script>x()</script>");
  });
  it("never eats a non-breaking space next to a line break", () => {
    expect(slimHtml("<p>a\n\u00a0b\u00a0\n  c</p>")).toBe("<p>a\n\u00a0b\u00a0\nc</p>");
  });
  it("keeps spaces on one line, so inline words keep their gaps", () => {
    expect(slimHtml("<p>a <i>b</i> <!-- x --> c</p>")).toBe("<p>a <i>b</i>  c</p>");
  });
});

describe("one address per page", () => {
  const pages = ["index.html", "about.html", "services.html", "service-area.html"];
  it("writes every link and absolute URL of a page in its clean form", () => {
    const html = `<a href="about.html">a</a><a href='./services.html#addons'>s</a><a href="/service-area.html?x=1">r</a>
<a href="index.html#book">b</a><a href="index.html">h</a><link rel="canonical" href="${SITE}/about.html" />
{"url": "${SITE}/services.html"}<a href="book.html">book</a><a href="terms.html">t</a><img data-src="about.html">`;
    const out = cleanLinks(html, pages);
    expect(out).toContain('href="/about">a');
    expect(out).toContain("href='/services#addons'>s");
    expect(out).toContain('href="/service-area?x=1">r');
    expect(out).toContain('href="/#book">b');
    expect(out).toContain('href="/">h');
    expect(out).toContain(`href="${SITE}/about"`);
    expect(out).toContain(`"url": "${SITE}/services"`);
    // Pages without their own address, and anything that isn't a link, stay as they were.
    expect(out).toContain('href="book.html"');
    expect(out).toContain('href="terms.html"');
    expect(out).toContain('data-src="about.html"');
  });
  it("reads canonical and noindex tags whatever their attribute order", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "seo-order-"));
    fs.writeFileSync(path.join(dir, "a.html"), `<link href="${SITE}/a.html" rel="canonical">`);
    fs.writeFileSync(path.join(dir, "b.html"), '<meta content="noindex" name="robots">');
    expect(cleanPages(dir)).toEqual(["a.html"]);
  });
  it("headings never skip a level, wherever the page starts", () => {
    expect(headingSkip("<h1>T</h1><h2>a</h2><h3>b</h3><h2>c</h2><h3>d</h3><h4>e</h4><h2>f</h2>")).toBeNull();
    expect(headingSkip('<h1>T</h1><h3 class="x">Basic <b>Interior</b></h3>')).toBe('h1 then h3 "Basic Interior"');
    expect(headingSkip("<h2>No title</h2>")).toBe('h(none) then h2 "No title"');
    expect(headingSkip("<h1>T</h1><script>x='<h4>not here</h4>'</script><template><h5>nor</h5></template><h2>ok</h2>")).toBeNull();
  });
  it("redirects each old address to the clean one, forced (the .html file still exists)", () => {
    expect(redirectsFor(["about.html", "index.html"])).toContain("/about.html /about 301!\n/index.html / 301!\n");
    expect(cleanPath("mobile-detailing-delhi-price-hill-oh.html")).toBe("/mobile-detailing-delhi-price-hill-oh");
  });

  function site(over: Record<string, string> = {}) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "seo-dist-"));
    const page = (canon: string, h1 = "<h1>T</h1>", robots = "") =>
      `<html><head><title>T | 513 Auto Clean</title><meta name="description" content="D" />${robots}<link rel="canonical" href="${canon}" /></head><body>${h1}<a href="about.html">a</a><a href="contact.html">c</a></body></html>`;
    const files: Record<string, string> = {
      "index.html": page(`${SITE}/`),
      "about.html": page(`${SITE}/about.html`),
      "contact.html": page(`${SITE}/contact.html`),
      "draft.html": page(`${SITE}/draft.html`, "<h1>T</h1>", '<meta name="robots" content="noindex" />'),
      "booking.html": '<html><head><meta name="robots" content="noindex" /></head><body><h1>Book</h1></body></html>',
      "sitemap.xml": `<urlset><url><loc>${SITE}/</loc></url><url><loc>${SITE}/about.html</loc></url><url><loc>${SITE}/contact.html</loc></url></urlset>`,
      ...over,
    };
    for (const [f, t] of Object.entries(files)) fs.writeFileSync(path.join(dir, f), t);
    return dir;
  }

  it("a consistent site passes, after the build's rewrite", () => {
    const dir = site();
    expect(applyCleanUrls(dir)).toEqual(["about.html", "contact.html", "draft.html", "index.html"]);
    expect(checkDist(dir)).toEqual([]);
    expect(fs.readFileSync(path.join(dir, "sitemap.xml"), "utf8")).toContain(`<loc>${SITE}/about</loc>`);
  });
  it("names each kind of disagreement", () => {
    const dir = site({
      "faq.html": `<html><head><link rel="canonical" href="${SITE}/faq-old" /></head><body><h1>a</h1><h1>b</h1></body></html>`,
      "lost.html": "<html><body><h1>x</h1></body></html>",
    });
    applyCleanUrls(dir);
    fs.appendFileSync(path.join(dir, "about.html"), '<a href="faq.html">stale</a>');
    const p = checkDist(dir).join("\n");
    expect(p).toContain("faq.html: 2 <h1> headings");
    expect(p).toContain(`faq.html: canonical is ${SITE}/faq-old, not ${SITE}/faq`);
    expect(p).toContain("faq.html: indexable, but missing from sitemap.xml");
    expect(p).toContain("lost.html: no canonical tag and no noindex");
    expect(p).toContain("about.html: still names a page by its .html address");
  });
  it("scripts' links are rewritten and checked too, and absolute .html addresses must be real pages", () => {
    const dir = site();
    fs.mkdirSync(path.join(dir, "js"));
    fs.writeFileSync(path.join(dir, "js/f.js"), `a='<a href="contact.html">x</a>';location.href="about.html#r";m={faq:"about.html"}`);
    fs.appendFileSync(path.join(dir, "index.html"), `<script type="application/ld+json">{"url":"${SITE}/book.html","u2":"${SITE}/booking.html"}</script>`);
    fs.writeFileSync(path.join(dir, "booking.html"), '<html><head><meta name="robots" content="noindex" /></head><body><h1>B</h1></body></html>');
    applyCleanUrls(dir);
    const js = fs.readFileSync(path.join(dir, "js/f.js"), "utf8");
    expect(js).toBe(`a='<a href="/contact">x</a>';location.href="/about#r";m={faq:"about.html"}`);
    const p = checkDist(dir).join("\n");
    expect(p).toContain(`index.html: ${SITE}/book.html is not an address a visitor should be sent to`);
    expect(p).not.toContain("booking.html is not an address");
    fs.writeFileSync(path.join(dir, "js/g.js"), `x='<a href="faq.html">'`);
    fs.writeFileSync(path.join(dir, "faq.html"), `<html><head><link rel="canonical" href="${SITE}/faq.html" /></head><body><h1>F</h1></body></html>`);
    expect(checkDist(dir).join("\n")).toContain("js/g.js: still names a page by its .html address");
  });

  it("the sitemap lists no draft and no address that isn't a page", () => {
    const dir = site({ "sitemap.xml": `<urlset><url><loc>${SITE}/</loc></url><url><loc>${SITE}/about</loc></url><url><loc>${SITE}/contact</loc></url><url><loc>${SITE}/draft</loc></url><url><loc>${SITE}/gone</loc></url></urlset>` });
    applyCleanUrls(dir);
    const p = checkDist(dir).join("\n");
    expect(p).toContain("draft.html: noindex, but listed in sitemap.xml");
    expect(p).toContain(`sitemap.xml: ${SITE}/gone is not the address of any page`);
  });

  it("a published page linked from fewer than two other pages fails (Semrush: one incoming internal link)", () => {
    const dir = site({
      "city.html": `<html><head><title>C</title><link rel="canonical" href="${SITE}/city" /></head><body><h1>C</h1></body></html>`,
      "about.html": `<html><head><title>T</title><link rel="canonical" href="${SITE}/about.html" /></head><body><h1>T</h1><a href="city">city</a><a href="contact.html">c</a></body></html>`,
      "sitemap.xml": `<urlset><url><loc>${SITE}/</loc></url><url><loc>${SITE}/about</loc></url><url><loc>${SITE}/contact</loc></url><url><loc>${SITE}/city</loc></url></urlset>`,
    });
    applyCleanUrls(dir);
    expect(checkDist(dir)).toEqual(["city.html: linked from 1 other page; a published page needs links from at least 2"]);
    // A draft (noindex) neither needs links nor counts as one.
    fs.writeFileSync(path.join(dir, "draft.html"), `<html><head><meta name="robots" content="noindex" /><link rel="canonical" href="${SITE}/draft" /></head><body><h1>D</h1><a href="/city">c</a></body></html>`);
    expect(checkDist(dir)).toEqual(["city.html: linked from 1 other page; a published page needs links from at least 2"]);
    fs.appendFileSync(path.join(dir, "contact.html"), '<a href="https://513autoclean.com/city#top">c</a>');
    expect(checkDist(dir)).toEqual([]);
  });

  it("llms.txt lists the sitemap's pages at their addresses, and bookable packages from the catalog", () => {
    const dir = site({
      "terms.html": `<html><head><title>Terms | 513 Auto Clean</title><meta name="description" content="Rules." /><link rel="canonical" href="${SITE}/terms.html" /></head><body><h1>T</h1></body></html>`,
      "sitemap.xml": `<urlset><url><loc>${SITE}/</loc></url><url><loc>${SITE}/about.html</loc></url><url><loc>${SITE}/contact.html</loc></url><url><loc>${SITE}/terms.html</loc></url></urlset>`,
    });
    applyCleanUrls(dir);
    // What the prices mean is read from the Services page, never typed (dist/ is all llmsTxt reads).
    fs.writeFileSync(path.join(dir, "services.html"), "<p>Prices are starting points for most cars; bigger may vary.</p>");
    const catalog = { packages: [
      { name: "Basic", category: "interior", sortOrder: 1, priceCents: 14500, tagline: "Clean." },
      { name: "Soon", category: "exterior", sortOrder: 0, priceCents: 1, tagline: "x", comingSoon: true },
      { name: "Upkeep", category: "interior", sortOrder: 0, priceCents: 1, tagline: "x", requiresPriorDetail: { maxMonths: 3 } },
    ] };
    const txt = llmsTxt({ dist: dir, catalog, phone: "(513) 279-2915", hours: "6 AM to midnight" });
    expect(txt.startsWith("# 513 Auto Clean\n\n> D\n")).toBe(true);
    expect(txt).toContain(`- [T](${SITE}/about): D`);
    expect(txt).toContain("- Basic (interior), from $145: Clean.");
    expect(txt).toContain("Packages and starting prices. Prices are starting points for most cars; bigger may vary.");
    expect(txt).toContain(`- Book online: ${SITE}/book`);
    fs.writeFileSync(path.join(dir, "services.html"), "<p>Reworded.</p>");
    expect(() => llmsTxt({ dist: dir, catalog, phone: "x", hours: "y" })).toThrow(/Prices are starting points/);
    expect(txt).not.toMatch(/Soon|Upkeep/);
    expect(txt).toMatch(new RegExp(`## Optional\\n\\n- \\[Terms\\]\\(${SITE}/terms\\): Rules\\.`));
  });

  it("Netlify's Pretty URLs is pinned in the repo, not left to the dashboard", () => {
    expect(read("netlify.toml")).toMatch(/\[build\.processing\.html\]\s*\n\s*pretty_urls = true/);
  });

  it("the built site agrees with itself (when dist/ exists)", () => {
    const dist = path.join(root, "dist");
    if (!fs.existsSync(path.join(dist, "_redirects"))) return;
    expect(checkDist(dist)).toEqual([]);
    expect(fs.existsSync(path.join(dist, "llms.txt"))).toBe(true);
  });
});
