/**
 * Hover styles only where there is a mouse (November 15). A phone applies
 * :hover on tap and keeps it until the next tap elsewhere, so a tapped size
 * card, contact pill or carousel dot stayed red as if still chosen. Every
 * :hover rule sits inside @media (hover: hover).
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "../../..");
const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");

describe("hover styles", () => {
  for (const f of ["styles.css", "book.css"]) {
    it(`${f}: every :hover rule is inside @media (hover: hover)`, () => {
      const css = strip(fs.readFileSync(path.join(root, f), "utf8"));
      const outside = css.replace(/@media \(hover: hover\) \{\s*[^{}]*\{[^{}]*\}\s*\}/g, "");
      const left = outside.match(/[^{}]*:hover[^{}]*\{/g) ?? [];
      expect(left.map((s) => s.trim())).toEqual([]);
    });
  }
});
