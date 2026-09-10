# 513 Auto Clean

Mobile car detailing in Cincinnati, UC student-owned. This repo is the website
and the booking system behind it.

The site is a static page served by Netlify. The pricing, catalog and
scheduling logic is TypeScript in `web/`, bundled two ways: once for the
browser and once for the Netlify Functions, from the same source. That is the
whole point of the layout, and it is why a price change cannot land on the
front page without also landing on the funnel and the payment function.

---

## Layout

```
index.html            the page. Sections between CATALOG:* markers are generated
styles.css            design system and page styles
book.css              the booking funnel modal
script.js             nav, tabs, scroll reveals
js/
  funnel.js           the booking funnel, ~1500 lines, no framework
  travel.js           service area map and travel fee estimator
  reviews.js          Google reviews, ticker and grid
  gallery.js          before and after sliders
  pricing.bundle.js   GENERATED. do not edit
data/reviews.json     hand-taken review snapshot, absolute dates
netlify/functions/    payments, reviews proxy
  _pricing.mjs        GENERATED. do not edit
web/
  lib/catalog/        packages, add-ons, icons, popularity. the source of truth
  lib/pricing/        money and time maths. pure functions, no I/O
  lib/availability/   slot computation
  lib/travel/         ZIP drive-time bands and map coordinates
  lib/booking/        calendar reading
  scripts/render-site.mjs   writes the catalog into index.html at build time
docs/
  LAUNCH-CHECKLIST.md what is blocking a fully working site
  ROADMAP.md          everything still to build
  crm-analysis.md     what is worth borrowing from open-source CRMs
SETUP.md              click-by-click for every account and key
```

---

## Working on it

```bash
cd web
npm install
npm run build      # bundles both entries, then regenerates index.html
npx vitest run     # 106 tests, all pure logic, runs in under a second
npx tsc --noEmit   # strict, with noUncheckedIndexedAccess
```

Serve the root with any static server to look at it:

```bash
python -m http.server 8765
```

**`npm run build` rewrites `index.html` in place.** The services grid, the
add-ons panel, the FAQ price sentence and the JSON-LD offer catalog all live
between `<!-- CATALOG:NAME:START -->` markers and are generated from
`web/lib/catalog/`. Edit the catalog, not the HTML, or the next build will
throw your change away.

Generated files, never edited by hand: `js/pricing.bundle.js`,
`netlify/functions/_pricing.mjs`, and everything inside a CATALOG marker.

---

## The rules that matter

**Prices come from one place.** `web/lib/catalog/` feeds the front page at
build time, the funnel at runtime, and the payment functions on the server.
They cannot disagree.

**The server never trusts a price from the browser.** `priceFromWire()` takes
IDs only and recomputes from scratch. A tampered request that claims a $400
detail costs $1 gets repriced at $400.

**Money is integer cents. Percentages are basis points.** No floats anywhere
near a total.

**Pure functions have no I/O.** Everything in `lib/pricing/` is testable in
milliseconds, which is why there are 106 tests and why they are fast enough to
run on every change.

**No em-dashes in anything a customer reads.** Code and comments are exempt.

---

## Configuration

`window.AC_CONFIG` at the top of `index.html` holds the public keys: Stripe
publishable, PayPal client ID, Google browser key, calendar ID. Publishable
keys are designed to be public.

Everything secret lives in `web/.env.local` (gitignored) and in Netlify's
environment variables. See `SETUP.md`.

An unconfigured site degrades rather than breaks: no calendar key means
standard time slots with a visible warning, no Places key means the review
snapshot, no Stripe key means the payment SDK is never even requested.
