/**
 * The privacy policy describes the site that exists, not one that might.
 *
 * Generated parts come from lib/site/capabilities.ts; this checks the page
 * carries them and never names a processor whose switch is off.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PROCESSORS, dormantProcessors, isLive, liveProcessors } from "./capabilities.js";
import { LEGAL } from "./legal.js";

const html = fs.readFileSync(path.resolve(__dirname, "../../../privacy.html"), "utf8");
const text = html
  .replace(/<script[\s\S]*?<\/script>/g, " ")
  .replace(/<style[\s\S]*?<\/style>/g, " ")
  .replace(/<!--[\s\S]*?-->/g, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/\s+/g, " ");

const MARKERS = ["EFFECTIVE", "COLLECT", "AUTO", "USE", "SHARE", "COOKIES", "RETAIN", "CHANGES"];

describe("privacy.html is generated and current", () => {
  it("has been rendered (no placeholders, every marker present)", () => {
    expect(html).not.toContain("PLACEHOLDER");
    for (const m of MARKERS) {
      expect(html, m).toContain(`<!-- PRIVACY:${m}:START -->`);
      expect(html, m).toContain(`<!-- PRIVACY:${m}:END -->`);
    }
  });

  it("carries its version", () => {
    expect(html).toContain(`Version ${LEGAL.privacyEffective}`);
  });

  it("names every live processor and no dormant one", () => {
    for (const p of liveProcessors()) expect(text, p.name).toContain(p.name);
    for (const p of dormantProcessors()) {
      // "Google" appears for Fonts and Gmail, so match the specific product.
      const needle = p.name.replace(/\s*\(.*\)$/, "");
      if (["Google Places", "Google Maps", "Google Calendar", "Stripe", "PayPal", "Twilio", "Resend", "Neon", "Cloudflare Turnstile"].includes(needle)) {
        expect(text, `${p.name} is not live`).not.toContain(needle);
      }
    }
  });

  it("does not describe payments, cookies from payment forms, or a database before they exist", () => {
    if (!isLive("cardOnFile")) {
      expect(text).not.toMatch(/card on file/i);
      expect(text).not.toMatch(/card details/i);
    }
    if (!isLive("bookingLink")) expect(text).not.toMatch(/our database/i);
    if (!isLive("automatedMessages")) expect(text).not.toMatch(/Twilio|Resend/);
  });

  it("no longer promises a future update instead of describing the present", () => {
    expect(text).not.toMatch(/when we launch online booking/i);
    expect(text).not.toMatch(/simple static site/i);
    expect(text).not.toMatch(/quote request form/i);
  });

  it("always names the things that are always true", () => {
    for (const n of ["OpenStreetMap", "Netlify", "Web3Forms", "Google Fonts", "cdnjs"]) expect(text).toContain(n);
    expect(text).toMatch(/STOP/);
    expect(text).toMatch(/HELP/);
  });

  it("every processor has a sentence in the customer's terms", () => {
    for (const p of PROCESSORS) {
      expect(p.does.length, p.name).toBeGreaterThan(20);
      expect(p.does, p.name).toMatch(/^[a-z]/);
      expect(p.does, p.name).not.toMatch(/—/);
    }
  });

  it("no em-dashes", () => {
    expect(html).not.toMatch(/—|&mdash;/);
  });
});
