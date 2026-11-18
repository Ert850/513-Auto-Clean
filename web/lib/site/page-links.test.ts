/** Links to the city and service pages (owner's pick C, November 18; docs/CITY-SERVICE-LINKS.md). */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
// @ts-expect-error plain ESM build scripts
import { footerDetailing, footerCities, stateGuides, stateOf, tabGuides, addonGuide, explainsProblems, STATES } from "../../scripts/page-links.mjs";
// @ts-expect-error plain ESM build scripts
import { loadLocations, loadServices } from "../../scripts/locations.mjs";
import { findAddon } from "../server-entry.js";

const root = path.resolve(__dirname, "../../..");
const read = (f: string) => fs.readFileSync(path.join(root, f), "utf8");

const interior = { slug: "interior-car-detailing-cincinnati", name: "Interior Car Detailing", status: "live", explains: { tab: "interior", link: "About interior detailing" } };
const stain = { slug: "car-stain-odor-treatment-cincinnati", name: "Stain, Spill & Odor Treatment", status: "live", explains: { addon: "stain", link: "More on stains and odors" } };
const delhi = { slug: "delhi", name: "Delhi & Price Hill", status: "live", areaServed: ["Delhi Township, OH", "Price Hill, Cincinnati, OH"] };
const covington = { slug: "covington", name: "Covington", status: "live", areaServed: ["Covington, KY"] };
const draft = (p: object) => ({ ...p, status: "draft" });

describe("links to the city and service pages", () => {
  it("links only to published pages: with none, every spot renders nothing", () => {
    const s = [draft(interior), draft(stain)], l = [draft(delhi)];
    expect([footerDetailing(s), footerCities(l), tabGuides(s), addonGuide(s, "stain"), stateGuides(l, "OH")]).toEqual(["", "", "", "", ""]);
  });

  it("footer: a Detailing column, package pages before add-on pages, and the city guides first in Service Areas", () => {
    const col = footerDetailing([stain, interior]);
    expect(col).toContain('<div class="f-detailing">');
    expect(col.indexOf("Interior Car Detailing")).toBeLessThan(col.indexOf("Stain, Spill &amp; Odor Treatment"));
    expect(col).toContain('href="interior-car-detailing-cincinnati.html"');
    expect(footerCities([delhi, draft(covington)])).toBe('<a href="delhi.html">Delhi &amp; Price Hill</a>\n          ');
  });

  it("Range & Travel: each state's card lists only its own cities", () => {
    expect(stateGuides([delhi, covington], "OH")).toContain('City guides: <a href="delhi.html">Delhi &amp; Price Hill</a></p>');
    expect(stateGuides([delhi, covington], "KY")).toContain("Covington");
    expect(stateGuides([delhi, covington], "IN")).toBe("");
    expect(() => stateOf({ slug: "x", areaServed: ["Florence, KY", "Delhi, OH"] })).toThrow(/one of OH, KY, IN/);
    expect(() => stateOf({ slug: "x", areaServed: ["Somewhere"] })).toThrow();
  });

  it("Services: the tab link names its tab, and the add-on link goes on its add-on", () => {
    expect(tabGuides([interior, stain])).toContain('<a class="svc-guide reveal" data-guide-for="interior" href="interior-car-detailing-cincinnati.html">About interior detailing <span aria-hidden="true">&rarr;</span></a>');
    expect(tabGuides([stain])).toBe("");
    expect(addonGuide([interior, stain], "stain")).toBe('<a class="addon-guide" href="car-stain-odor-treatment-cincinnati.html">More on stains and odors <span aria-hidden="true">&rarr;</span></a>');
    expect(addonGuide([interior, stain], "ozone")).toBe("");
  });

  it("checks each page's explains setting", () => {
    expect(explainsProblems(loadServices(), findAddon)).toEqual([]);
    const bad = explainsProblems([
      { slug: "a", explains: { tab: "wheels", link: "About wheels" } },
      { slug: "b", explains: { addon: "nope", link: "x" } },
      { slug: "c", explains: { tab: "interior", addon: "stain", link: "Both" } },
      { slug: "d", explains: { tab: "interior", link: "From $145" } },
      { slug: "e", explains: { tab: "interior", link: "Another interior" } },
    ], findAddon).join("\n");
    expect(bad).toContain("a: explains.tab must be one of interior, exterior");
    expect(bad).toContain('b: explains.addon "nope" is not an add-on');
    expect(bad).toContain("b: explains.link must be 3 to 40 characters");
    expect(bad).toContain('c: explains needs exactly one of "tab" or "addon"');
    expect(bad).toContain("d: explains.link carries a number");
    expect(bad).toContain("e: tab interior is already explained by d");
  });

  it("every city config names one state, and the pages carry the markers the generators fill", () => {
    for (const l of loadLocations()) expect(STATES).toContain(stateOf(l));
    const area = read("service-area.html");
    for (const st of STATES) expect(area).toContain(`<!-- CITYGUIDES:${st}:START -->`);
    expect(area).not.toContain("LOCATIONS:START");
    expect(read("services.html")).toContain("<!-- SERVICEGUIDES:START -->");
    expect(read("web/partials/footer.html")).toMatch(/\{\{detailing\}\}[\s\S]*\{\{cityguides\}\}/);
  });

  it("the tab link shows only with its own tab", () => {
    const css = read("styles.css");
    for (const tab of ["interior", "exterior"]) {
      expect(css).toContain(`.svc-tabs-row:has(.svc-tab.active[data-panel="${tab}"]) .svc-guide:not([data-guide-for="${tab}"])`);
    }
  });
});
