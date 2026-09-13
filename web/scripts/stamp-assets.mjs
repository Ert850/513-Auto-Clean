/**
 * Content-hashes every local script and stylesheet URL in the HTML.
 *
 * `js/funnel.js` becomes `js/funnel.js?v=3f9a1c2e`, so the CDN can cache the
 * file for a year and a price change still reaches every browser on the
 * next page load. Before this, the bundle was cached for an hour and a
 * returning customer could watch one price on the page and another at
 * checkout, because the server reprices and the stale bundle did not.
 *
 * Idempotent: an existing ?v= is replaced.
 *
 * Run after every other render step and before build-dist.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PAGES = ["index.html", "terms.html", "privacy.html", "404.html"];

const hashOf = (rel) =>
  // Line endings normalised before hashing. Git hands a Windows checkout CRLF
  // and the Linux build box LF, so without this the same file stamps
  // differently in the two places and every deploy looks like it changed
  // three assets nobody touched.
  crypto
    .createHash("sha256")
    .update(fs.readFileSync(path.join(root, rel)).toString("binary").replace(/\r\n/g, "\n"), "binary")
    .digest("hex")
    .slice(0, 10);

const cache = new Map();
function stamp(rel) {
  if (!cache.has(rel)) cache.set(rel, fs.existsSync(path.join(root, rel)) ? hashOf(rel) : null);
  return cache.get(rel);
}

let total = 0;
for (const page of PAGES) {
  const p = path.join(root, page);
  let html = fs.readFileSync(p, "utf8");
  let n = 0;
  html = html.replace(
    /(<(?:script|link)\b[^>]*?\b(?:src|href)=")(\/?)((?:js\/)?[A-Za-z0-9._-]+\.(?:js|css))(?:\?v=[0-9a-f]+)?(")/g,
    (m, pre, slash, rel, post) => {
      const h = stamp(rel);
      if (!h) return m;
      n++;
      return `${pre}${slash}${rel}?v=${h}${post}`;
    },
  );
  fs.writeFileSync(p, html);
  total += n;
}
console.log(`stamped ${total} asset URLs across ${PAGES.length} pages`);
