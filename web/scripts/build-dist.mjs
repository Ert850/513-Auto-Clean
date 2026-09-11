/**
 * Assembles the publish directory.
 *
 * Netlify used to publish the repository root, which would have made
 * context_outline.txt, docs/, the TypeScript source, the database schema and
 * (after a build) web/node_modules into public URLs the day the branch
 * deployed. A CLI deploy from a laptop would have shipped web/.env.local
 * too, because the CLI does not read .gitignore.
 *
 * So the site is now copied, file by file, into dist/, and only dist/ is
 * published. Images are copied only if something references them: the repo
 * carries about 11MB of photos that nothing on the page uses.
 *
 * Run last in `npm run build`.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dist = path.join(root, "dist");

const FILES = [
  "index.html",
  "terms.html",
  "privacy.html",
  "404.html",
  "styles.css",
  "book.css",
  "script.js",
  "robots.txt",
  "sitemap.xml",
];
const DIRS = ["js", "data"];

function copy(rel) {
  const from = path.join(root, rel);
  const to = path.join(dist, rel);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  return fs.statSync(to).size;
}

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

let bytes = 0;
let count = 0;

for (const f of FILES) {
  if (!fs.existsSync(path.join(root, f))) throw new Error(`build-dist: missing ${f}`);
  bytes += copy(f);
  count++;
}

for (const d of DIRS) {
  for (const f of fs.readdirSync(path.join(root, d))) {
    if (f.endsWith(".map")) continue;
    bytes += copy(path.join(d, f));
    count++;
  }
}

/* ---- images: only what the page can reach ---- */

const textFiles = [
  ...FILES.filter((f) => /\.(html|css|js|xml)$/.test(f)),
  ...fs.readdirSync(path.join(root, "js")).map((f) => path.join("js", f)),
  ...fs.readdirSync(path.join(root, "data")).map((f) => path.join("data", f)),
];
const referenced = new Set();
for (const f of textFiles) {
  const text = fs.readFileSync(path.join(root, f), "utf8");
  for (const m of text.matchAll(/images\/([A-Za-z0-9._-]+\.(?:jpg|jpeg|png|webp|avif|svg))/g)) {
    referenced.add(m[1]);
  }
}
// The gallery names its pairs by slug and builds the path in JS.
try {
  const gallery = JSON.parse(fs.readFileSync(path.join(root, "data/gallery.json"), "utf8"));
  for (const p of gallery.pairs ?? []) {
    referenced.add(`ba-${p.slug}-before.jpg`);
    referenced.add(`ba-${p.slug}-after.jpg`);
  }
} catch {
  /* no gallery, nothing to add */
}

let imgBytes = 0;
let skipped = 0;
for (const f of fs.readdirSync(path.join(root, "images"))) {
  if (!referenced.has(f)) {
    skipped++;
    continue;
  }
  imgBytes += copy(path.join("images", f));
  count++;
}

console.log(
  `dist/: ${count} files, ${(bytes / 1024).toFixed(0)}KB of code and data, ` +
    `${(imgBytes / 1024 / 1024).toFixed(1)}MB of images (${skipped} unreferenced images left out)`,
);
