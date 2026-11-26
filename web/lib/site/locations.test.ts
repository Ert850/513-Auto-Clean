/** City pages (config/locations/): registration, drafts kept out of search, and the duplicate-text measure. */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
// @ts-expect-error plain ESM build script
import { loadLocations, loadServices, pageFile, localWords, overlap, contained, typedNumbers, configWords, mainText, publishedPages, generatedPages, distPages, isPreviewBuild, unreviewedPairs, reviewFromArea } from "../../scripts/locations.mjs";
// @ts-expect-error plain ESM build script
import { CHROME_PAGES } from "../../scripts/chrome.mjs";

const root = path.resolve(__dirname, "../../..");
const read = (f: string) => fs.readFileSync(path.join(root, f), "utf8");
const locs = loadLocations();

describe("city pages", () => {
  it("every city page gets the shared chrome", () => {
    for (const l of locs) expect(CHROME_PAGES).toContain(pageFile(l));
  });
  it("drafts carry noindex and stay out of the sitemap and Range & Travel's state cards; published pages don't", () => {
    for (const l of locs) {
      const html = read(pageFile(l));
      const draft = l.status === "draft";
      expect(html.includes('name="robots" content="noindex"'), l.slug).toBe(draft);
      expect(read("sitemap.xml").includes(`/${l.slug}<`), l.slug).toBe(!draft);
      // Written to the .html file like every source link (page-links.mjs).
      expect(read("service-area.html").includes(`href="${pageFile(l)}"`), l.slug).toBe(!draft);
    }
  });
  it("titles and descriptions fit Google's lengths (as rendered, prices filled in)", () => {
    const un = (s: string) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"');
    for (const l of locs) {
      const html = read(pageFile(l));
      const title = un(/<title>([^<]*)<\/title>/.exec(html)![1]!);
      const meta = un(/<meta name="description" content="([^"]*)"/.exec(html)![1]!);
      expect(title.length, l.slug).toBeLessThanOrEqual(60);
      expect(meta.length, l.slug).toBeLessThanOrEqual(155);
      expect(meta, l.slug).not.toMatch(/\{(price|addon):/);
    }
  });
  it("the duplicate measure: identical text is 1, unrelated text near 0, place names don't count", () => {
    const a = "we come to your driveway and detail the car while you get on with your day".split(" ");
    expect(overlap(a, a)).toBe(1);
    expect(overlap(a, "an entirely different sentence about something else that shares nothing at all here".split(" "))).toBe(0);
    expect(contained(a, a)).toBe(1);
    const one = { name: "Delhi", neighborhoods: ["Delshire"], zips: ["45233"], h1: "Detailing in Delhi", sub: "", localParagraph: "We come to Delhi and Delshire 45233 every week to clean cars at home", faq: [] };
    const two = { name: "Madeira", neighborhoods: ["Camargo"], zips: ["45243"], h1: "Detailing in Madeira", sub: "", localParagraph: "We come to Madeira and Camargo 45243 every week to clean cars at home", faq: [] };
    expect(overlap(localWords(one), localWords(two))).toBe(1);
  });
});

describe("SEO build checks (docs/SEO-COMPLIANCE.md, November 15)", () => {
  it("R6: typed business numbers are caught, tokens and ZIPs and road numbers are not", () => {
    for (const t of ["about 3 hours", "$50 off", "10% off", "we arrive at 6pm", "2 to 4 hours", "7:30 am", "a 20 minute drive", "within 15 miles",
      "within an hour", "two to four days", "2 business days", "below 40°.", "10 percent", "by noon", "the next day"])
      expect(typedNumbers(t), t).not.toEqual([]);
    for (const t of ["from {price:full-interior}", "{addon:stain}", "on U.S. 50 and I-71", "ZIP 45238", "3 rows of seats", "Pay when it's done",
      "the 2 amazing results", "a few hours", "months of commuting"])
      expect(typedNumbers(t), t).toEqual([]);
  });
  it("R6: no city or service page config types a business number", () => {
    for (const o of [...locs, ...loadServices()]) for (const t of configWords(o)) expect(typedNumbers(t), `${o.file}: ${t}`).toEqual([]);
  });
  it("R4: the area ZIP list is the Accounting sheet's, and every city's ZIPs are in its area", () => {
    const areas = JSON.parse(read("config/areas.json")).areas;
    const gs = read("tools/jobs-sync/JobsSync.gs");
    const block = /const AREAS = \{([\s\S]*?)\n\};/.exec(gs)![1]!;
    const fromGs = Object.fromEntries([...block.matchAll(/'([^']+)': \[([^\]]*)\]/g)].map((m) => [m[1], [...m[2]!.matchAll(/'(\d{5})'/g)].map((z) => z[1])]));
    expect(fromGs).toEqual(areas);
    for (const l of locs) {
      expect(Object.keys(areas), l.slug).toContain(l.area);
      for (const z of l.zips) expect(areas[l.area], `${l.slug} ${z}`).toContain(z);
      expect(l.neighborhoods.length, l.slug).toBeLessThanOrEqual(12);
    }
  });
  it("R2 reads what a visitor reads: <main>, or the home page between the shared header and footer", () => {
    const home = mainText(read("index.html"));
    expect(home).toMatch(/Real cars\. Real results\./);
    expect(home).not.toMatch(/Meet the Team|Analytics choices/);
    const city = mainText(read(pageFile(locs[0])));
    expect(city).toContain(locs[0].h1);
    expect(city).not.toMatch(/<|CHROME/);
  });
  it("R1: drafts never reach the live site (production builds publish only published pages)", () => {
    const drafts = [...locs, ...loadServices()].filter((p: any) => p.status === "draft").map(pageFile);
    for (const d of drafts) {
      expect(publishedPages(), d).not.toContain(d);
      expect(generatedPages(), d).toContain(d);
    }
    // Drafts only where a preview is the point; every other build, including a
    // laptop build with no CONTEXT, gets published pages alone (validation cycle 3).
    for (const env of [{ CONTEXT: "production" }, {}, { CONTEXT: "something-new" }]) for (const d of drafts) expect(distPages(env), d).not.toContain(d);
    for (const env of [{ CONTEXT: "deploy-preview" }, { CONTEXT: "branch-deploy" }, { PREVIEW_BUILD: "1" }]) for (const d of drafts) expect(distPages(env), d).toContain(d);
    expect(read("web/scripts/build-dist.mjs")).toContain("...distPages(),");
  });

  it("R1: a review counts for a page only from a town it names, never just Cincinnati (validation cycle 3)", () => {
    const delhi = locs.find((l: { slug: string }) => l.slug === "mobile-detailing-delhi-price-hill-oh");
    for (const a of ["Delhi Township, OH", "Sayler Park", "Price Hill (Cincinnati)", "West Price Hill, Cincinnati, OH"]) expect(reviewFromArea(delhi, a), a).toBe(true);
    for (const a of ["Cincinnati", "Cincinnati, OH", "Mount Washington, Cincinnati", "West Chester (Cincinnati area)", "OH", ""]) expect(reviewFromArea(delhi, a), a).toBe(false);
  });

  it("R6 catches a hyphenated count and a travel promise (validation cycle 3)", () => {
    for (const t of ["a 15-minute drive", "a two-hour job", "within a 30-mile radius", "free travel to Delhi", "no travel fee in Delhi"]) expect(typedNumbers(t), t).not.toEqual([]);
    for (const t of ["3 rows of seats", "U.S. 50 and I-71", "ZIP 45238"]) expect(typedNumbers(t), t).toEqual([]);
  });

  it("unchecked photos stop every build but a preview (validation cycle 3)", () => {
    expect(unreviewedPairs({ pairs: [{ slug: "a" }, { slug: "b", reviewed: false }, { slug: "c", reviewed: true }] })).toEqual(["b"]);
    expect(isPreviewBuild({ CONTEXT: "production" })).toBe(false);
    expect(isPreviewBuild({})).toBe(false);
    expect(isPreviewBuild({ CONTEXT: "deploy-preview" })).toBe(true);
  });
});

describe("city and service pages read like the rest of the site (Emmett, November 15)", () => {
  const pages = [
    ...locs.map((l: { slug: string }) => `${l.slug}.html`),
    ...fs.readdirSync(path.join(root, "config/services")).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, ".html")),
  ];
  it("every Book button says Book Now, never a made-up 'Delhi quote'", () => {
    for (const p of pages) {
      const html = read(p);
      const labels = [...html.matchAll(/<a class="btn btn-primary[^"]*" href="book\.html"[^>]*>([^<]*)/g)].map((m) => m[1]!.trim());
      expect(labels.length, p).toBeGreaterThan(0);
      for (const t of labels) expect(t, p).toBe("Book Now");
      expect(html, p).not.toMatch(/instant [A-Za-z ]+ quote/i);
    }
  });
  it("the hero is a before/after carousel written into the page, captioned without a place nobody checked", () => {
    // Emmett, November 15 (option A): the home page's wipe, one card in view.
    // The cards are in the HTML for search and the largest paint; the first never waits.
    for (const p of pages) {
      // A draft with no checked pair of its own service has no carousel yet (the stain
      // page, November 26: the candidate stain pairs were held back for Elijah's
      // better photos). Never a published page, and never an unrelated pair instead.
      if (!read(p).includes('class="loc-hero-pic loc-hero-ba"')) {
        expect(read(p), p).toContain('name="robots" content="noindex"');
        continue;
      }
      const hero = read(p).split('class="loc-hero-pic loc-hero-ba"')[1]!.split("</section>")[0]!;
      const cards = hero.split('<figure class="ba-slider"').slice(1);
      expect(cards.length, p).toBeGreaterThan(0);
      for (const c of cards) {
        expect(c, p).toMatch(/-before-760\.jpg/);
        expect(c, p).toMatch(/-after-760\.jpg/);
        expect(c, p).toMatch(/>Before<.*>After</s);
        expect(c, p).not.toMatch(/west side|east side|northeast|recent/i);
      }
      expect(cards[0], p).not.toContain('loading="lazy"');
      expect(cards[0], p).toContain('fetchpriority="high"');
      expect(read(p), p).toMatch(/<script src="js\/gallery\.js[^"]*" defer>/);
    }
  });
  it("the hero cards are js/gallery.js's own card markup", () => {
    // split-hero.mjs writes the cards js/gallery.js would build; a class
    // renamed in one and not the other would leave the wipe without a handle.
    const classes = (s: string) => [...s.matchAll(/class="([^"]+)"/g)].map((m) => m[1]).filter((c) => !/^ba-carousel|^ba-viewport|^ba-track|^loc-/.test(c!));
    const js = read("js/gallery.js");
    const fn = js.slice(js.indexOf("function card("), js.indexOf("function card(") + 2000);
    const fromJs = classes(fn.slice(0, fn.indexOf("</figure>")) + "</figure>");
    const page = read(pages[0]!);
    const first = page.slice(page.indexOf('<figure class="ba-slider"'));
    // The photos come from gallery.js photo(), a function of its own.
    const fromPage = classes(first.slice(0, first.indexOf("</figure>"))).filter((c) => c !== "ba-img");
    expect(fromPage).toEqual(fromJs);
    expect(js.slice(js.indexOf("function photo("), js.indexOf("function card("))).toContain('class="ba-img"');
  });
  it("no keyword-stuffed headings", () => {
    for (const p of pages) {
      expect(read(p), p).not.toMatch(/drivers trust 513 Auto Clean|Proudly serving/);
      for (const m of read(p).matchAll(/<h2>([^<]*) questions<\/h2>/g)) expect(m[1], p).toBe("Common");
    }
    // City pages: the place is named in the title, the eyebrow, the H1 and the words, never stuffed into the section headings.
    for (const l of locs) for (const m of read(pageFile(l)).matchAll(/<h2[^>]*>([^<]*)<\/h2>/g)) expect(m[1], l.slug).not.toContain(l.name.split(" & ")[0]);
  });
});
