/** City pages (config/locations/): registration, drafts kept out of search, and the duplicate-text measure. */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
// @ts-expect-error plain ESM build script
import { loadLocations, pageFile, localWords, overlap, contained } from "../../scripts/locations.mjs";
// @ts-expect-error plain ESM build script
import { CHROME_PAGES } from "../../scripts/chrome.mjs";

const root = path.resolve(__dirname, "../../..");
const read = (f: string) => fs.readFileSync(path.join(root, f), "utf8");
const locs = loadLocations();

describe("city pages", () => {
  it("every city page gets the shared chrome", () => {
    for (const l of locs) expect(CHROME_PAGES).toContain(pageFile(l));
  });
  it("drafts carry noindex and stay out of the sitemap and the hub; published pages don't", () => {
    for (const l of locs) {
      const html = read(pageFile(l));
      const draft = l.status === "draft";
      expect(html.includes('name="robots" content="noindex"'), l.slug).toBe(draft);
      expect(read("sitemap.xml").includes(`/${l.slug}<`), l.slug).toBe(!draft);
      expect(read("service-area.html").includes(`href="${l.slug}"`), l.slug).toBe(!draft);
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
