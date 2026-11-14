/** The home page's four service buttons (config/home-services.json), and their link switch. */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
// @ts-expect-error plain ESM build script
import { routeBookLinks } from "../../scripts/book-links.mjs";

const root = path.resolve(__dirname, "../../..");
const cfg = JSON.parse(fs.readFileSync(path.join(root, "config/home-services.json"), "utf8"));
const home = fs.readFileSync(path.join(root, "index.html"), "utf8");
const region = home.slice(home.indexOf("<!-- HOME:SERVICES:START -->"), home.indexOf("<!-- HOME:SERVICES:END -->"));

describe("the four service buttons", () => {
  it("are built from the config, one per button, in order", () => {
    const labels = [...region.matchAll(/<span class="pk-l">(.*?) <i/g)].map((m) => m[1]!.replace(/&amp;/g, "&"));
    expect(labels).toEqual(cfg.buttons.map((b: { label: string }) => b.label));
    expect(region).toContain(`>${cfg.title}</h2>`);
  });
  it("every photo exists", () => {
    for (const b of cfg.buttons) for (const src of b.split ?? [b.image]) expect(fs.existsSync(path.join(root, src)), src).toBe(true);
  });
  it('linkTo "book": each is a Book link carrying its service, so bookLinks routes it like every other', () => {
    if (cfg.linkTo !== "book") return;
    const tags = [...region.matchAll(/<a class="pk"[^>]*>/g)].map((m) => m[0]);
    expect(tags.length).toBe(cfg.buttons.length);
    for (const t of tags) expect(t).toContain('href="book.html"');
    const routed = routeBookLinks(region).html;
    expect(routed).toContain('href="/book?intent=interior"');
    expect(routed).toContain('href="/book?interest=showroom-exterior"');
  });
});
