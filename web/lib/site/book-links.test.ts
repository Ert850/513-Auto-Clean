/** Imperion, November 14: Book links to /book, and the consent boxes there. */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
// @ts-expect-error plain ESM build scripts
import { routeBookLinks, routeDist, bookLinksSetting } from "../../scripts/book-links.mjs";
// @ts-expect-error plain ESM build scripts
import { bookPageConsent, contactCard, loadContactForm } from "../../scripts/contact-form.mjs";
import { validateWire } from "../server-entry.js";

const root = path.resolve(__dirname, "../../..");
const read = (f: string) => fs.readFileSync(path.join(root, f), "utf8");

describe("Book links to /book (config/booking-page.json bookLinks)", () => {
  it("rewrites every Book link and keeps what it carried", () => {
    const html = `<a class="btn" href="book.html">Book Now</a>
<a href="book.html" data-book-package="full-interior">Book Full Interior</a>
<a href="book.html" data-book-interest="showroom-exterior">Interest</a>
<a href="./book.html" data-book-browse>View</a>
<a class="btn" href="#quote">Book Now</a>
<a class="btn" href="/#book">Book a detail</a>
<a href="services.html">Services</a>`;
    const { html: out, count } = routeBookLinks(html);
    expect(count).toBe(6);
    expect(out).toContain('href="/book">Book Now');
    expect(out).toContain('href="/book?package=full-interior" data-book-package="full-interior"');
    expect(out).toContain('href="/book?interest=showroom-exterior"');
    expect(out).toContain('href="/book?browse=1" data-book-browse');
    expect(out).toContain('href="services.html"');
    expect(out).not.toMatch(/href="(\.\/)?book\.html"/);
  });
  it("marks the page so old #book addresses go to /book too", () => {
    expect(routeBookLinks('<html lang="en"><a href="book.html">Book</a>').html).toContain('<html data-book-links="page" lang="en">');
    expect(routeBookLinks('<html lang="en"><p>no links</p>').html).toBe('<html lang="en"><p>no links</p>');
  });

  it("every built page: no link that SAYS book goes anywhere but /book (the booking page itself excepted)", () => {
    const dist = path.join(root, "dist");
    if (!fs.existsSync(dist)) return;
    const cfg = JSON.parse(read("config/booking-page.json"));
    if (cfg.bookLinks !== "page") return;
    const bad: string[] = [];
    for (const f of fs.readdirSync(dist).filter((x) => x.endsWith(".html") && x !== "booking.html")) {
      const html = fs.readFileSync(path.join(dist, f), "utf8");
      for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)) {
        const text = m[2]!.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
        const href = /href="([^"]*)"/.exec(m[1]!)?.[1] ?? "";
        if (/\bbook(ing)?\b/i.test(text) && !/^\/book\b/.test(href) && !/^#booking$/.test(href)) bad.push(`${f}: ${href} "${text.trim().slice(0, 40)}"`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("the switch, both ways, on a whole folder: inline leaves every byte alone, page moves every Book link", () => {
    const tmp = fs.mkdtempSync(path.join(require("node:os").tmpdir(), "booklinks-"));
    const pages = ["index.html", "services.html", "lp-golf.html", "404.html", "booking.html"];
    for (const f of pages) fs.copyFileSync(path.join(root, f), path.join(tmp, f));
    const before = Object.fromEntries(pages.map((f) => [f, fs.readFileSync(path.join(tmp, f), "utf8")]));
    expect(routeDist(tmp, { bookLinks: "inline" })).toBe(0);
    for (const f of pages) expect(fs.readFileSync(path.join(tmp, f), "utf8")).toBe(before[f]);
    expect(routeDist(tmp, { bookLinks: "page" })).toBeGreaterThan(20);
    // The booking page keeps its own links: there they open the form in place.
    expect(fs.readFileSync(path.join(tmp, "booking.html"), "utf8")).toBe(before["booking.html"]);
    for (const f of pages.filter((x) => x !== "booking.html")) {
      expect(fs.readFileSync(path.join(tmp, f), "utf8")).not.toMatch(/href="(\.\/)?book\.html"|href="#quote"|href="\/#book"/);
    }
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("only accepts page or inline, and inline is the old behaviour", () => {
    expect(bookLinksSetting({ bookLinks: "page" })).toBe("page");
    expect(bookLinksSetting({})).toBe("inline");
    expect(() => bookLinksSetting({ bookLinks: "yes" })).toThrow();
  });
  it("the source pages keep book.html, so switching back needs only the setting", () => {
    for (const f of ["index.html", "services.html", "lp-golf.html"]) expect(read(f)).toContain('href="book.html"');
  });
});

describe("the /book consent boxes", () => {
  const cfg = loadContactForm();
  // Checked in quote mode whichever mode is live, so switching back is safe (November 26: live is "question").
  const quote = { ...cfg, mode: "quote" };
  it("say exactly what the Contact form's boxes say", () => {
    const span = (html: string) => [...html.matchAll(/<label class="inq-tick">.*?<span>(.*?)<\/span><\/label>/g)].map((m) => m[1]);
    expect(span(bookPageConsent(quote))).toEqual(span(contactCard(quote)));
    expect(bookPageConsent(quote)).toContain(quote.modes.quote.termsLine.replace(/\{phone\}/g, "").slice(0, 20));
  });
  it("are unticked and optional", () => {
    const boxes = bookPageConsent(quote).match(/<input[^>]*>/g) ?? [];
    expect(boxes.length).toBe(2);
    for (const b of boxes) expect(b).not.toMatch(/checked|required/);
  });
  it("are gone in question mode, the page as it was", () => {
    expect(bookPageConsent({ ...cfg, mode: "question" })).toBe("");
  });
  it("are in booking.html as built, only in quote mode", () => {
    if (cfg.mode === "quote") expect(read("booking.html")).toContain(bookPageConsent(cfg).trim().slice(0, 60));
    else expect(read("booking.html")).not.toContain('id="bpSms"');
  });
  it("a marketing yes reaches the server, and an odd value is dropped", () => {
    const NOW = Date.now();
    const base = {
      cart: { vehicles: [{ sizeId: "small", packageIds: ["basic-interior"], addons: [] }],
        address: { line1: "1 Main St", city: "Mason", region: "OH", zip: "45040" }, slot: NOW + 5 * 86_400_000 },
      contact: { name: "T", phone: "(513) 555-0100", email: "t@example.com" },
    };
    const ok = validateWire({ ...base, consent: { sms: true, marketing: true } }, { nowMs: NOW, mode: "card_only" });
    expect(ok.ok && ok.booking.consent).toMatchObject({ sms: true, marketing: true });
    const odd = validateWire({ ...base, consent: { marketing: "yes" } }, { nowMs: NOW, mode: "card_only" });
    expect(odd.ok && odd.booking.consent.marketing).toBeUndefined();
  });
});

describe("navigation links are never Book links", () => {
  it("the hero's View Services goes to the Services page, not the booking form", () => {
    const hero = read("index.html").split('class="hero-cta')[1].split("</div>")[0];
    const view = /<a\b[^>]*>(?:(?!<\/a>)[\s\S])*View Services/.exec(hero)?.[0] ?? "";
    expect(view).toContain('href="services.html"');
    expect(view).not.toMatch(/book\.html|data-book-/);
  });
});
