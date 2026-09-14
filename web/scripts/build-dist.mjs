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
import esbuild from "esbuild";
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
  "manifest.webmanifest",
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
    // Source for the build, not part of the site. Publishing it would put a
    // second copy of the config on the web, with {{PLACEHOLDERS}} in it,
    // which is only ever confusing.
    if (f.endsWith(".template.js")) continue;
    bytes += copy(path.join(d, f));
    count++;
  }
}

/*
 * MINIFY THE HAND WRITTEN JAVASCRIPT ON THE WAY OUT.
 *
 * js/funnel.js is 220KB of plain browser JavaScript, most of it the comments
 * that make it maintainable, and every one of those bytes was being sent to
 * every visitor. The pricing bundle has been minified by esbuild since the
 * day it existed; these files simply never went through it.
 *
 * Minified in dist/ only, so what is read, edited, diffed and reviewed is
 * always the readable file. The ?v= stamps are hashes of the SOURCE, which
 * is correct: minification is deterministic, so the same source always
 * produces the same output, and the stamp still changes whenever the file
 * that anyone actually edits does.
 *
 * Not bundled, only minified. The load order in index.html is deliberate and
 * these files talk to each other through globals.
 */
const MINIFY = ["script.js", ...fs.readdirSync(path.join(root, "js")).filter((f) => f.endsWith(".js")).map((f) => path.join("js", f))];

let saved = 0;
for (const rel of MINIFY) {
  const to = path.join(dist, rel);
  if (!fs.existsSync(to)) continue;
  const source = fs.readFileSync(to, "utf8");
  try {
    // The JS API rather than the CLI: on Windows node_modules/.bin/esbuild is
    // a shell script, and spawning it fails with ENOENT.
    const out = await esbuild.transform(source, { minify: true, target: "es2018", loader: "js" });
    fs.writeFileSync(to, out.code);
    saved += Buffer.byteLength(source) - Buffer.byteLength(out.code);
  } catch (err) {
    // A file esbuild will not parse is a file the browser would also have
    // refused. Better to stop the build than to publish it unminified and
    // wonder later why the numbers moved.
    throw new Error("build-dist: could not minify " + rel + ": " + err.message);
  }
}
bytes -= saved;

/* ---- images: only what the page can reach ---- */

const textFiles = [
  ...FILES.filter((f) => /\.(html|css|js|xml)$/.test(f)),
  ...fs.readdirSync(path.join(root, "js")).map((f) => path.join("js", f)),
  ...fs.readdirSync(path.join(root, "data")).map((f) => path.join("data", f)),
];
const referenced = new Set([
  // Linked from the manifest and the head, so no stylesheet or script names
  // them and the scan below would leave them behind.
  "apple-touch-icon.png",
  "icon-192.png",
  "icon-512.png",
  "icon-maskable-512.png",
]);
for (const f of textFiles) {
  const text = fs.readFileSync(path.join(root, f), "utf8");
  for (const m of text.matchAll(/images\/([A-Za-z0-9._-]+\.(?:jpg|jpeg|png|webp|avif|svg))/g)) {
    referenced.add(m[1]);
  }
}
/*
 * The gallery names its pairs by slug and builds the paths in JS, so nothing
 * above can see them.
 *
 * Only the RESIZED files ship. The full size exports stay in the repo as the
 * masters to re-cut from, and are about 250KB each: twelve of them was three
 * megabytes on a page where the widest a card is ever painted is around 560
 * points.
 */
try {
  const gallery = JSON.parse(fs.readFileSync(path.join(root, "data/gallery.json"), "utf8"));
  for (const p of gallery.pairs ?? []) {
    for (const side of ["before", "after"]) {
      for (const w of p.widths ?? [420, 760]) {
        referenced.add(`ba-${p.slug}-${side}-${w}.webp`);
      }
      // One JPEG, for the few browsers with no WebP.
      referenced.add(`ba-${p.slug}-${side}-760.jpg`);
    }
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
  `dist/: ${count} files, ${(bytes / 1024).toFixed(0)}KB of code and data ` +
    `(${(saved / 1024).toFixed(0)}KB minified away), ` +
    `${(imgBytes / 1024 / 1024).toFixed(1)}MB of images (${skipped} unreferenced images left out)`,
);
