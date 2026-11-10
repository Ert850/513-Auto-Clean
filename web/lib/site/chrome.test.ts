/**
 * The header and footer on every page must be exactly what the partials
 * render. Fails when someone edits a page's header or footer by hand (edit
 * web/partials/ instead), or adds a page without the CHROME markers.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
// @ts-expect-error: plain ESM build script, no types
import { root, CHROME_PAGES, expectedChrome, currentChrome } from "../../scripts/chrome.mjs";

describe("shared header and footer", () => {
  for (const page of CHROME_PAGES as string[]) {
    it(`${page} carries the partials exactly`, () => {
      const html = fs.readFileSync(path.join(root, page), "utf8");
      const want = expectedChrome(page, html);
      for (const part of ["HEADER", "FOOTER"]) {
        const got = currentChrome(html, part);
        expect(got, `${page} is missing CHROME:${part} markers`).not.toBeNull();
        expect(got, `${page} ${part} differs from web/partials/: edit the partial, then npm run build`).toBe(want[part]);
      }
    });
  }

  it("covers every page that has the site header", () => {
    const withHeader = fs.readdirSync(root).filter((f) => f.endsWith(".html") && /id="header"/.test(fs.readFileSync(path.join(root, f), "utf8")));
    expect(withHeader.sort()).toEqual([...(CHROME_PAGES as string[])].sort());
  });
});
