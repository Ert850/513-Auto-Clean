import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { findPackage } from "./seed.js";
import { DEFAULT_RULES } from "../pricing/rules.js";

/**
 * docs/REPLY-TEMPLATES.md is the one place prices are written by hand.
 *
 * The website generates itself from the catalog and cannot drift. That file
 * cannot, and a stale price in a text message to a customer is a worse
 * mistake than a stale price on a page, because it has already been sent.
 * So the catalog checks the document.
 */
const doc = readFileSync(
  fileURLToPath(new URL("../../../docs/REPLY-TEMPLATES.md", import.meta.url)),
  "utf8",
);

const money = (cents: number) => "$" + cents / 100;

/**
 * Markdown wraps sentences and blockquotes them, so a sentence can be split
 * across lines with a "> " in the middle. Strip the quote markers, then
 * collapse whitespace, so matching ignores where the lines happen to fall.
 */
const flat = doc.replace(/^>\s?/gm, "").replace(/\s+/g, " ");

describe("reply templates stay in step with the catalog", () => {
  const rows: [string, string][] = [
    ["Basic Interior", "basic-interior"],
    ["Full Interior", "full-interior"],
    ["Showroom Ready", "showroom-interior"],
    ["Express Exterior", "express-exterior"],
    ["Basic Exterior", "basic-exterior"],
    ["Full Exterior", "full-exterior"],
  ];

  for (const [label, id] of rows) {
    it(`quotes ${label} at the catalog price`, () => {
      const pkg = findPackage(id);
      expect(pkg, id).toBeTruthy();
      const price = money(pkg!.priceCents);
      // The price has to appear beside the name, in the table row.
      expect(doc, `${label} should be listed at ${price}`).toContain(`| ${label} | ${price} |`);
    });
  }

  it("quotes the combo discount correctly", () => {
    expect(flat).toContain(`**${money(DEFAULT_RULES.comboDiscountCents)} off**`);
  });

  it("quotes the multi-vehicle and pay in full discounts correctly", () => {
    expect(flat).toContain(`**${DEFAULT_RULES.additionalVehicleDiscountBp / 100}% off everything**`);
    expect(flat).toContain(`**${DEFAULT_RULES.payInFullDiscountBp / 100}% off**`);
  });

  it("does the combo arithmetic right in the worked examples", () => {
    const combo = DEFAULT_RULES.comboDiscountCents;
    const bb = findPackage("basic-interior")!.priceCents + findPackage("basic-exterior")!.priceCents;
    const ff = findPackage("full-interior")!.priceCents + findPackage("full-exterior")!.priceCents;
    expect(flat).toContain(`is ${money(bb)}, less the ${money(combo)} combo discount, so **${money(bb - combo)}**`);
    expect(flat).toContain(`together is ${money(ff)}, less ${money(combo)}, so **${money(ff - combo)}**`);
  });

  it("does not quote a package it no longer sells", () => {
    // Express Interior was retired. It must not reappear in a live template,
    // and the "old versions" section names it only as something to avoid.
    const live = doc.slice(0, doc.indexOf("## Notes on the old versions"));
    expect(live).not.toContain("Express Interior");
  });
});
