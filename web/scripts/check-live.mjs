/**
 * Is the live site actually running what this repo says it is?
 *
 * Every test in this project runs against local files. That is the right
 * default and it missed the thing that actually went wrong: a Stripe key, a
 * calendar key, a Places key and three Netlify variables were all set
 * correctly, everything was committed and pushed, the whole suite was green,
 * and the live site was serving a build from two days earlier. Nothing was
 * broken. Nothing had deployed.
 *
 * So this checks the deployment, not the code:
 *
 *   1. STALE BUILD. Each page is stamped with a hash of the asset it loads,
 *      so comparing the stamps in the local index.html with the deployed one
 *      answers "is what I am looking at what I wrote" in one request.
 *   2. WHAT THE SERVER CAN SEE. Netlify injects environment variables into
 *      functions AT DEPLOY TIME. Adding one to the dashboard changes nothing
 *      until the next deploy, which is the second half of the same trap: the
 *      variable is set, the dashboard says so, and the function still returns
 *      "unconfigured".
 *   3. THAT EVERY ENDPOINT IS REACHABLE and answers the way its unit tests
 *      say it should.
 *
 * SAFE BY DEFAULT. No charge, no saved card, no email, no billed API call.
 * The payment and email endpoints are probed with payloads that are refused
 * before they reach Stripe or Resend, which still proves the function is
 * deployed and running. Pass --paid to also measure one real drive, which
 * costs one Routes call and is the only way to prove that key works.
 *
 *   node web/scripts/check-live.mjs
 *   node web/scripts/check-live.mjs --paid
 *   node web/scripts/check-live.mjs https://deploy-preview-12--site.netlify.app
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const argv = process.argv.slice(2);
const PAID = argv.includes("--paid");
const BASE = (argv.find((a) => a.startsWith("http")) ?? "https://513autoclean.com").replace(/\/$/, "");
const TIMEOUT = 25_000;

let failures = 0;
let warnings = 0;

const pass = (m, d) => console.log(`  \x1b[32mok\x1b[0m    ${m}${d ? `  \x1b[90m${d}\x1b[0m` : ""}`);
const warn = (m, d) => { warnings++; console.log(`  \x1b[33mnote\x1b[0m  ${m}${d ? `  \x1b[90m${d}\x1b[0m` : ""}`); };
const fail = (m, d) => { failures++; console.log(`  \x1b[31mFAIL\x1b[0m  ${m}${d ? `  \x1b[90m${d}\x1b[0m` : ""}`); };
const head = (m) => console.log(`\n\x1b[1m${m}\x1b[0m`);

async function get(p, init) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT);
  try {
    const r = await fetch(BASE + p, { ...init, signal: ctl.signal, redirect: "follow" });
    const text = await r.text();
    let body = null;
    try { body = JSON.parse(text); } catch { /* html, or an error page */ }
    return { status: r.status, text, body, headers: r.headers };
  } catch (e) {
    return { status: 0, text: String(e?.message ?? e), body: null, headers: new Headers() };
  } finally {
    clearTimeout(t);
  }
}

const post = (p, payload) =>
  get(p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });

/** Every `name?v=hash` in a page, as a map. The build writes these. */
function stamps(html) {
  const out = {};
  for (const m of html.matchAll(/([\w./-]+\.(?:js|css))\?v=([a-f0-9]+)/g)) out[m[1]] = m[2];
  return out;
}

console.log(`\n\x1b[1m513 Auto Clean, live check\x1b[0m  \x1b[90m${BASE}\x1b[0m`);
if (!PAID) console.log("\x1b[90mNo billed calls. Pass --paid to also measure one real drive.\x1b[0m");

/* ---------------------------------------------------------------- */
head("Is the deployed build the one in this repo?");

const home = await get("/");
if (home.status !== 200) {
  fail("the site did not answer", `HTTP ${home.status}`);
} else {
  pass("the site answers", `HTTP 200`);

  const local = stamps(fs.readFileSync(path.join(root, "index.html"), "utf8"));
  const live = stamps(home.text);
  const behind = Object.keys(local).filter((f) => live[f] && live[f] !== local[f]);
  const missing = Object.keys(local).filter((f) => !live[f]);

  if (behind.length) {
    fail(
      `the deploy is STALE, ${behind.length} asset${behind.length > 1 ? "s" : ""} behind`,
      behind.map((f) => `${f}: live ${live[f]}, repo ${local[f]}`).join(" | "),
    );
    console.log(
      "\n        Nothing below this line is testing today's code, and any environment\n" +
      "        variable added since the last deploy is invisible to the functions.\n" +
      "        Trigger a deploy in Netlify, then run this again.",
    );
  } else if (missing.length) {
    warn(`${missing.length} local asset not found in the live page`, missing.join(", "));
  } else {
    pass("every asset stamp matches the repo", `${Object.keys(local).length} files`);
  }
}

/* ---------------------------------------------------------------- */
head("Public keys the page carries");

const cfg = await get("/js/config.js");
if (cfg.status !== 200) {
  fail("js/config.js did not load", `HTTP ${cfg.status}`);
} else {
  for (const [label, re, why] of [
    ["Stripe publishable", /stripePublishableKey:\s*'(pk_(live|test)_[^']+)'/, "card capture"],
    ["Google Calendar", /googleCalendarApiKey:\s*'(AIza[^']+)'/, "real openings"],
    ["Google Places", /googlePlacesApiKey:\s*'(AIza[^']+)'/, "address autocomplete"],
    ["PayPal client", /paypalClientId:\s*'([^']+)'/, "PayPal and Venmo"],
    ["Turnstile site", /turnstileSiteKey:\s*'([^']+)'/, "bot check"],
  ]) {
    const m = re.exec(cfg.text);
    if (m) pass(`${label} key present`, `${m[1].slice(0, 12)}...`);
    else warn(`${label} key not set`, `so: no ${why}`);
  }
}

/* ---------------------------------------------------------------- */
head("What the server can see (these come from Netlify, at deploy time)");

const reviews = await get("/api/reviews?minRating=5");
if (reviews.status === 200 && Array.isArray(reviews.body?.reviews)) {
  pass("reviews: live from Google", `${reviews.body.reviews.length} returned, rating ${reviews.body.rating}, ${reviews.body.total} total`);
  if (reviews.body.reviews.length <= 5) {
    console.log("        \x1b[90mGoogle caps Place Details at 5. The page merges these with the 32 in data/reviews.json.\x1b[0m");
  }
} else if (reviews.status === 503) {
  warn("reviews: GOOGLE_MAPS_SERVER_KEY or GOOGLE_PLACE_ID not set", "showing the stored reviews");
} else if (reviews.status === 502) {
  // Not a failure of the site. Google refusing the Place ID is a known open
  // item, the page shows all 32 stored reviews either way, and a checker that
  // shouts about a thing you have decided to live with is a checker you stop
  // reading.
  const why = reviews.body?.status === 404 ? "Google does not recognise the Place ID" : `Google said ${reviews.body?.status}`;
  warn(`reviews: ${why}`, "showing the stored reviews, which is the designed fallback");
} else {
  fail("reviews: unexpected", `HTTP ${reviews.status} ${reviews.text.slice(0, 120)}`);
}

const busy = await get("/api/personal-busy");
// The off switch returns an empty busy list, so it has to be checked BEFORE
// the success case, which an empty list also satisfies.
if (busy.status === 200 && busy.body?.off) {
  warn("personal calendar: switched OFF by PERSONAL_CALENDAR_OFF", "bookings can land on your own commitments");
} else if (busy.status === 200 && Array.isArray(busy.body?.busy)) {
  pass("personal calendar: read", `${busy.body.busy.length} busy blocks ahead`);
} else if (busy.status === 503) {
  warn("personal calendar: PERSONAL_CALENDAR_ICS not reaching the function", "bookings can land on your own commitments");
} else {
  fail("personal calendar: unexpected", `HTTP ${busy.status} ${busy.text.slice(0, 120)}`);
}

const travelProbe = await get("/api/travel?zip=45220");
if (travelProbe.status === 400 && travelProbe.body?.error === "no_destination") {
  pass("travel: deployed and validating input");
} else if (travelProbe.status === 200) {
  pass("travel: answered from the ZIP estimate", JSON.stringify(travelProbe.body).slice(0, 120));
} else {
  fail("travel: unexpected", `HTTP ${travelProbe.status} ${travelProbe.text.slice(0, 120)}`);
}

if (PAID) {
  const drive = await get("/api/travel?address=" + encodeURIComponent("1 W 4th St, Cincinnati, OH 45202"));
  if (drive.status === 200 && typeof drive.body?.minutes === "number") {
    pass("travel: MEASURED a real drive", `${drive.body.minutes} min one way, fee ${drive.body.feeCents ?? "?"} cents, source ${drive.body.source ?? "?"}`);
  } else if (drive.status === 503) {
    warn("travel: GOOGLE_MAPS_SERVER_KEY not reaching the function", "travel stays a ZIP band estimate");
  } else {
    fail("travel: the measured call failed", `HTTP ${drive.status} ${drive.text.slice(0, 160)}`);
  }
} else {
  console.log("        \x1b[90mSkipped the measured drive. --paid runs it, one Routes call.\x1b[0m");
}

/* ---------------------------------------------------------------- */
head("Endpoints with side effects, probed so they cannot fire");

// No mandate, so it is refused before a Stripe object is created. This proves
// the function is deployed and its validation runs, and charges nothing.
const pay = await post("/api/create-payment", {
  cart: {
    vehicles: [{ sizeId: "small", packageIds: ["basic-interior"] }],
    address: { line1: "1 Main St", city: "Cincinnati", region: "OH", zip: "45220" },
  },
  contact: { name: "Live Check", phone: "5135551212" },
  mode: "card_only",
});
if (pay.status === 400 && pay.body?.error === "mandate_required") {
  pass("create-payment: deployed, and refuses a card with no authorization");
} else if (pay.status === 503 && pay.body?.error === "unconfigured") {
  warn("create-payment: STRIPE_SECRET_KEY not reaching the function", "no card can be taken");
} else {
  fail("create-payment: unexpected", `HTTP ${pay.status} ${pay.text.slice(0, 160)}`);
}

// An empty cart is refused by validateWire, so no mail is sent.
const mail = await post("/api/send-confirmation", {});
if (mail.status === 400) {
  pass("send-confirmation: deployed, and refuses an empty booking", `no mail sent`);
} else if (mail.status === 200 && mail.body?.sent === false && mail.body?.reason === "unconfigured") {
  warn("send-confirmation: RESEND_API_KEY not reaching the function", "nobody gets a confirmation");
} else {
  fail("send-confirmation: unexpected", `HTTP ${mail.status} ${mail.text.slice(0, 160)}`);
}

/* ---------------------------------------------------------------- */
head("Pages that must exist");

for (const p of ["/terms.html", "/privacy.html", "/sitemap.xml", "/robots.txt", "/data/reviews.json"]) {
  const r = await get(p);
  if (r.status === 200) pass(p, `${r.text.length.toLocaleString()} bytes`);
  else fail(p, `HTTP ${r.status}`);
}

// The generated legal pages carry their version. If the deployed one does not
// match the repo, the policy someone agreed to is not the policy on the site.
const localPrivacy = fs.readFileSync(path.join(root, "privacy.html"), "utf8");
const vLocal = /Version (\d{4}-\d{2}-\d{2})/.exec(localPrivacy)?.[1];
const vLive = /Version (\d{4}-\d{2}-\d{2})/.exec((await get("/privacy.html")).text)?.[1];
if (vLocal && vLive && vLocal === vLive) pass("privacy policy version matches the repo", vLive);
else fail("privacy policy version differs", `live ${vLive}, repo ${vLocal}`);

/* ---------------------------------------------------------------- */
console.log(
  `\n\x1b[1m${failures ? "\x1b[31m" : "\x1b[32m"}${failures} failed\x1b[0m, ` +
  `\x1b[33m${warnings} not switched on yet\x1b[0m\n`,
);
process.exit(failures ? 1 : 0);
