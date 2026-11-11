/**
 * js/config.js, built from js/config.template.js and the environment.
 *
 * The keys in that file are all public by design, but they were still
 * committed, which meant two bad days: Netlify's secret scanner failed every
 * build on sight of an `AIza...`, and there was no way to give a Deploy
 * Preview a test Stripe key while production had a live one, because there
 * was only ever one file.
 *
 * So: one place for every key, the Netlify environment, and nothing in the
 * repo to leak or to scan. An unset variable becomes an empty string, which
 * every consumer already treats as "that feature is off" rather than as an
 * error.
 *
 * RUNS BEFORE build:stamp, deliberately. The stamp is a hash of the file's
 * contents and js/* is served immutable for a year, so writing the keys in
 * after stamping would pin browsers to a stale config until the cache
 * expired. Order matters more here than it looks.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { experimentsForPage } from "./experiments.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const TEMPLATE = path.join(root, "js/config.template.js");
const OUT = path.join(root, "js/config.js");

/**
 * The calendar id is not a key and the site is useless without it, so it
 * keeps a default. Everything else defaults to empty and degrades.
 */
const DEFAULTS = {
  GOOGLE_CALENDAR_ID:
    "75726fed82aa92a27201386beda7b3a15f550a3a5691e5e6cfc51382f0f0b9cf@group.calendar.google.com",
};

/** What a missing value costs, so the build log says something useful. */
const COSTS = {
  GOOGLE_CALENDAR_API_KEY: "standard time slots instead of real openings",
  GOOGLE_PLACES_API_KEY: "no address autocomplete",
  STRIPE_PUBLISHABLE_KEY: "no card field at all",
  PAYPAL_CLIENT_ID: "no PayPal or Venmo",
  TURNSTILE_SITE_KEY: "no bot check",
  GA4_MEASUREMENT_ID: "no Google Analytics",
  CLARITY_PROJECT_ID: "no Clarity heatmaps or recordings",
  GOOGLE_API_KEY: null, // legacy fallback, absence is normal
};

const template = fs.readFileSync(TEMPLATE, "utf8");

const found = [];
const missing = [];

const out = template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_m, name) => {
  const raw = process.env[name] ?? DEFAULTS[name] ?? "";
  const value = String(raw).trim();

  if (value) found.push(name);
  else if (COSTS[name]) missing.push(name);

  // Into a single-quoted JS string. A stray quote or backslash in a pasted
  // key would otherwise break the file silently, and a newline would end the
  // statement somewhere unhelpful.
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/[\r\n]+/g, "");
});

if (/\{\{[A-Z0-9_]+\}\}/.test(out)) {
  throw new Error("render-config: a placeholder survived substitution");
}

// The A/B tests (config/experiments.json), checked here so a mistake fails the
// build. JSON is valid JavaScript, and the ids and version names are limited
// to letters, digits and dashes, so nothing in it can end the statement.
const experiments = experimentsForPage();

// The rush fee and discount code files are checked when the pricing code
// loads. esbuild bundles them without running anything, so load the server
// bundle here: a mistake in config/rush-fee.json or config/promo-codes.json
// stops the build instead of shipping a booking function that throws.
await import("../../netlify/functions/_pricing.mjs");
const outWithTests = out + "\nwindow.AC_EXPERIMENTS = " + JSON.stringify(experiments) + ";\n";

fs.writeFileSync(OUT, outWithTests);

const shape = (n) => {
  const v = String(process.env[n] ?? DEFAULTS[n] ?? "");
  return v.length > 14 ? `${v.slice(0, 10)}...` : v ? "set" : "";
};

console.log(
  `js/config.js: ${found.length} set${found.length ? " (" + found.map((n) => `${n} ${shape(n)}`).join(", ") + ")" : ""}`,
);
console.log(`  A/B tests: ${experiments.map((x) => `${x.id} ${x.status}`).join(", ") || "none"}`);
if (missing.length) {
  for (const n of missing) console.log(`  not set: ${n}, so ${COSTS[n]}`);
}
