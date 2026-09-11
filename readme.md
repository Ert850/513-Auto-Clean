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
terms.html            terms. Sections between TERMS:* markers are generated
privacy.html          privacy policy. Sections between PRIVACY:* markers are generated
404.html              the not-found page
styles.css            design system and page styles
book.css              the booking funnel modal
script.js             nav, tabs, scroll reveals
js/
  config.js           PUBLIC keys only: browser API key, Stripe publishable, PayPal client id, Turnstile site key
  vendors.js          loads Stripe, PayPal and Turnstile only once their key exists
  funnel.js           the booking funnel, ~2600 lines, no framework
  travel.js           service area map and travel fee estimator
  reviews.js          Google reviews, ticker and grid
  gallery.js          before and after sliders
  year.js             the footer year on the legal pages
  pricing.bundle.js   GENERATED. do not edit
data/reviews.json     hand-taken review snapshot, absolute dates. The rating on the page comes from here
data/gallery.json     the before and after pairs
dist/                 GENERATED. What Netlify publishes, and nothing else. Gitignored
netlify/functions/    payments, travel, reviews proxy, personal calendar
  _pricing.mjs        GENERATED. do not edit
  _routes.mjs         Google Routes, one implementation shared by travel and payment
  _ratelimit.mjs      token bucket per client, per function
  _turnstile.mjs      Cloudflare Turnstile verification, off until its key exists
web/
  lib/catalog/        packages, add-ons, icons, popularity. the source of truth
  lib/pricing/        money and time maths. pure functions, no I/O
    wire.ts           what the browser may send, and the gate that checks it
  lib/availability/   slot computation, multi-day planning
  lib/travel/         ZIP drive-time bands and map coordinates
  lib/booking/        calendar reading, quote links, change rules
  lib/site/           capabilities (what is live), legal versions, the copy that depends on them
  scripts/
    render-site.mjs   writes the catalog and the rating into index.html
    render-legal.mjs  writes rules and capabilities into terms.html and privacy.html
    stamp-assets.mjs  content-hashes every script and stylesheet URL
    build-dist.mjs    assembles dist/
    lock-legal.mjs    records the legal pages' fingerprints after a deliberate change
  legal.lock.json     those fingerprints
docs/
  LAUNCH-CHECKLIST.md what is blocking a fully working site
  ROADMAP.md          everything still to build
  STRESS-TEST-2026-09-11.md  the audit, its findings, and what was done about each
SETUP.md              click-by-click for every account and key
```

---

## Working on it

```bash
npm install            # once, at the root. The functions resolve stripe from here
cd web && npm install  # once
npm run build          # at the root: bundles, renders, stamps, assembles dist/
cd web
npx vitest run         # 300 tests, pure logic plus a smoke test of every function
npx tsc --noEmit       # strict, with noUncheckedIndexedAccess
```

To look at it, serve `dist/` after a build. Serving the repo root also works for
a quick look, but `dist/` is what customers get:

```bash
python -m http.server 8765 --directory dist
```

**`npm run build` rewrites files in place.** The services grid, the add-ons
panel, the FAQ price sentence, the offer catalog and the Google rating in
`index.html`; every number and every feature-dependent sentence in
`terms.html` and `privacy.html`; and the `?v=` hash on every asset URL. Edit
the source of each (the catalog, the rules, the capabilities, the snapshot),
not the HTML, or the next build will throw your change away.

Generated, never edited by hand: `js/pricing.bundle.js`,
`netlify/functions/_pricing.mjs`, `dist/`, and everything inside a
`CATALOG`, `TERMS` or `PRIVACY` marker.

---

## The rules that matter

**Prices come from one place.** `web/lib/catalog/` feeds the front page at
build time, the funnel at runtime, and the payment functions on the server.
They cannot disagree.

**The server trusts nothing from the browser except ids.** `validateWire()`
checks every id against the catalog, refuses anything coming soon, unpriced
or duplicated, and derives the two things the browser is not allowed to
decide: whether a slot is inside the priority window (from the slot) and
whether the customer is paying in full (from the payment mode).
`priceFromWire()` then recomputes the total from scratch. A tampered request
that claims a $400 detail costs $1, or that a slot tomorrow is not priority,
gets repriced at what it actually costs.

**Money is integer cents. Percentages are basis points.** No floats anywhere
near a total.

**Pure functions have no I/O.** Everything in `lib/pricing/` and
`lib/availability/` is testable in milliseconds, which is why there are 300
tests and why they run on every change.

**The legal pages are generated and versioned.** Every number in the terms
comes from `lib/pricing/rules.ts`; every sentence whose truth depends on a
feature, and every processor named in the privacy policy, comes from
`lib/site/capabilities.ts`. Flip a capability to `live: true`, rebuild, and
both pages rewrite themselves. `terms.test.ts` and `privacy.test.ts` fail if a
page ever claims something a switch says is not working. The version date in
`lib/site/legal.ts` is what the funnel records against each booking; change
the wording without bumping it and `legal.test.ts` fails. After a deliberate
change: bump the date, `npm run lock:legal`.

**Only `dist/` is published.** Source, docs, planning documents and the
secrets file on a laptop can never become a public URL, because they are
never copied there.

**No em-dashes in anything a customer reads.** Code and comments are exempt.

---

## Configuration

`js/config.js` holds the public keys: Stripe publishable, PayPal client ID,
Google browser key, calendar ID, Turnstile site key. Publishable keys are
designed to be public. Nothing in it is inline in the HTML, so the
Content-Security-Policy can forbid inline scripts.

Everything secret lives in `web/.env.local` (gitignored) and in Netlify's
environment variables. See `SETUP.md`.

An unconfigured site degrades rather than breaks: no calendar key means
standard time slots with a visible warning, no Places key means the review
snapshot, no Stripe key means the payment SDK is never even requested, no
Turnstile key means no bot check.
