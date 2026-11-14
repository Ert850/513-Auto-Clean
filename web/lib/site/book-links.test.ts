/** Imperion, November 14: Book links to /book, and the consent boxes there. */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
// @ts-expect-error plain ESM build scripts
import { routeBookLinks, bookLinksSetting } from "../../scripts/book-links.mjs";
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
<a href="services.html">Services</a>`;
    const { html: out, count } = routeBookLinks(html);
    expect(count).toBe(4);
    expect(out).toContain('href="/book">Book Now');
    expect(out).toContain('href="/book?package=full-interior" data-book-package="full-interior"');
    expect(out).toContain('href="/book?interest=showroom-exterior"');
    expect(out).toContain('href="/book?browse=1" data-book-browse');
    expect(out).toContain('href="services.html"');
    expect(out).not.toMatch(/href="(\.\/)?book\.html"/);
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
  it("say exactly what the Contact form's boxes say", () => {
    const span = (html: string) => [...html.matchAll(/<label class="inq-tick">.*?<span>(.*?)<\/span><\/label>/g)].map((m) => m[1]);
    expect(span(bookPageConsent(cfg))).toEqual(span(contactCard(cfg)));
    expect(bookPageConsent(cfg)).toContain(cfg.modes[cfg.mode].termsLine.replace(/\{phone\}/g, "").slice(0, 20));
  });
  it("are unticked and optional", () => {
    const boxes = bookPageConsent(cfg).match(/<input[^>]*>/g) ?? [];
    expect(boxes.length).toBe(2);
    for (const b of boxes) expect(b).not.toMatch(/checked|required/);
  });
  it("are in booking.html as built", () => {
    expect(read("booking.html")).toContain(bookPageConsent(cfg).trim().slice(0, 60));
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
