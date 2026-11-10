/**
 * Writes the shared header and footer (web/partials/) into every page.
 * Runs first in `npm run build`. See chrome.mjs for what varies per page.
 */
import fs from "node:fs";
import path from "node:path";
import { root, CHROME_PAGES, applyChrome } from "./chrome.mjs";

let changed = 0;
for (const page of CHROME_PAGES) {
  const file = path.join(root, page);
  const before = fs.readFileSync(file, "utf8");
  const after = applyChrome(page, before);
  if (after !== before) { fs.writeFileSync(file, after); changed++; }
}
console.log(`chrome: header and footer written into ${CHROME_PAGES.length} pages (${changed} changed)`);
