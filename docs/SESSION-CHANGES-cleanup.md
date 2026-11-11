# Session changes: dead code cleanup (November 11)

Branch: `cleanup-nov11`, from `ec6922a` (same commit as `eNov6`). Not pushed.

**Goal:** remove code nothing uses, with no change in behaviour or look. Nothing here changes a price, a legal text, calendar logic or what the booking form does. After every commit: `npm run build`, then the full suite (`TZ=America/New_York npx vitest run`): 524 passing before and after each one. No test was deleted or changed.

**Total:** 20 files, 666 lines removed, 75 added (net 591). The published code and data in `dist/` went from 719 KB to 698 KB; the browser pricing bundle from 86.3 KB to 80.9 KB.

## How "unused" was proven

- **Functions and variables:** `tsc --allowJs --checkJs --noUnusedLocals` on every script, plus a search for each name across pages, partials, build scripts, Netlify functions and tests.
- **Click handlers:** every `data-*` attribute and `#bk…` id a handler reacts to, checked against everything that writes markup (the booking form's own HTML strings, the pages, the partials, `render-site.mjs`).
- **Stylesheet rules**, four ways:
  1. each class and id in a selector, searched for in every page, partial, script and build source, comments excluded; no script builds a class from a prefix (`'bk-' + x`) that could produce them;
  2. compound selectors (`.a.b`): no source line puts both classes together;
  3. Chrome's own record of which rules matched (CSS rule-usage tracking), across all nine pages at 1440, 820, 375 and 320 px and every scripted booking flow at 1440 and 375. Each never-matched rule was then checked by hand; most are states a script does not reach (menus open, errors, the consent banner, inactive tabs, the leave panel) and stay;
  4. same selector, same context, a later rule sets the same property, so the earlier declaration can never apply.
- **Exports:** every import of `_pricing.mjs` / `server-entry.ts` (static, namespace and `await import`), and every `P.x` read of `window.ACPricing` in the site's scripts.

## What was removed

| File | Lines (−/+) | What | Proof |
|---|---|---|---|
| `book.css` | −139 / +6 | Old choice cards (`.bk-card*`, `.bk-cards`, `.bk-card-ask`, `.bk-intentnote`), the copy-quote bar (`.bk-quotebar`, `.bk-copyquote`), slot tags (`.bk-tag`), time-window chips (`.bk-windows`, `.bk-win`), time buckets and buttons (`.bk-bucket*`, `.bk-times`, `.bk-time*`), `.bk-more-band`, `.bk-promolink`, the second-vehicle upsell (`.bk-upsell*`), `.bk-pay.static`, `.bk-check.bk-juston`, `.bk-how-more`, `.bk-otherslots`, `.bk-day.more`, `.bk-day h4`. The `.bk-travel` block, which was pasted twice word for word. Overridden declarations: `.bk-days` gap, `.bk-extra-veh` colour, `.bk-addon` padding and margin, `.bk-wk-day em` size and padding, `.bk-nav` gap, `#bookFunnel .bk-ck` border, and `.bk-ck:last-child` (loses to `#bookFunnel .bk-ck` on specificity everywhere) | 1 to 4 |
| `styles.css` | −105 / +4 | The process steps (`.process`, `.steps`, `.step*`), the old photo grid (`.gal-grid`, `.gal-item`, `.gal-cap`, `.gal-badge`), `.rev-grid`, `.area-grid`, `.eyebrow.on-dark`, the old text logo (`.brand .mark`, its shine, the `shine` and `floaty` keyframes), `.svc-card .price s`, `.addons h3`, `.svc-corr .corr-tiers li svg`, `.reveal[data-d="4"]` (pages use 1 to 3), the schedule section (`.schedule`, `.cal-*`, `#schedule-cal`, FullCalendar theming). Overridden declarations: `.mobile-menu` transition, `.svc-tab.active` colours, `.addon .ad-price` margin, eight of `.rv-more`'s | 1 to 4 |
| `js/funnel.js` | −56 / +19 | The time-window chip handler (`[data-win]`) and `state.preferredWindows`. The `#bkCopyQuote` and `#bkOther` handlers (neither button is drawn). `state.fromQuote` (written, never read). `ok()`, `scrollToSection()`. `[data-book]` and `data-auto-open` (no element has them). The summaries of the four checkout steps (`sLoc`, `sTime`, `sContact`, the pay step's `sum`, the Time step's `sub`): since the two-page checkout those steps are only ever drawn as the checkout page, so nothing showed them. The bottom bar's branches for a standalone Time step (`onTime`, `go(timeStepIndex())`). The PayPal fallback paragraph, written once instead of four times. `.bk-cards` in one `closest()` list | tsc, handler/renderer cross-check, reading the render path |
| `js/travel.js` | −2 | `.zoom-on` toggled on the map: no CSS rule, no reader | Search |
| `script.js` | −48 | The commented-out FullCalendar / Google embed loader; `lastY` (written, never read) | tsc, search |
| `index.html` | −24 (+ stamps) | The commented-out "View our schedule" section | Commented out; FullCalendar is not loaded anywhere |
| `web/partials/header.html` | −2 | Two commented-out "Schedule" nav links | As above |
| `web/lib/browser-entry.ts` | −66 / +6 | 32 members of `window.ACPricing` that no script reads. The functions stay (server and tests use them); only the browser bundle drops them. `earliestBookableDate` stays because `funnel.smoke.test.mjs` asserts it | `P.x` search |
| `web/lib/server-entry.ts` | −21 / +4 | 21 re-exports no function, build script or test imports | Import scan |
| `web/lib/google/publicCalendar.ts` | −8 | `fetchEvents`, a wrapper left behind when `loadWindow` moved to `readCalendars` | Search |
| `netlify/functions/_pricing.mjs` | −149 | Generated from `server-entry.ts` | |
| `js/pricing.bundle.js` | (one line, −5.4 KB) | Generated from `browser-entry.ts` | |
| The other pages | stamps | `?v=` stamps and the header partial re-rendered | Generated |

## Found, not removed

**A bug (also on `main`, so on the live site):** `paintSlotsInner` in `js/funnel.js` calls `renderQuoteBanner()`, a function that has never existed anywhere in the repository's history. It runs when someone opens a shared quote link whose time has since been booked, with a live calendar. The call throws, so the time picker never paints its times for that visitor. Not fixed here, because fixing it changes behaviour: the smallest fix is to delete the call (the visitor then sees the live times, with their quoted time dropped), or to write the banner. `state.slotTaken`, the always-hidden `#bkQuoteNote` and the `.bk-quotenote` styles belong to the same unfinished feature and were left with it.

**Unused, but an owner decision** (all already on `main`):
- `web/lib/db/` (`schema.ts`, `constraints.sql`, 410 lines) and the `drizzle-orm` / `drizzle-kit` dependencies: nothing imports them.
- `web/lib/stripe/client.ts` (212 lines): nothing imports it (`create-payment.mjs` uses Stripe directly).
- `web/lib/booking/bookingChange.ts` (247) and `provisional.ts` (116): only their tests import them.
- Library exports used only by tests now that the browser bundle no longer exposes them: `groupIntoBands`, `hoursRemaining`, `computeCancellation`, `computeReschedule`, `travelCommitmentMinutes`, `requiresPriorityBooking`, `dormantProcessors`; and exported with no user at all: `removableComponents`, `addableComponents`, `unpricedComponents` (`catalog/types.ts`), `MAINTENANCE_PLAN`, `SERVICE_LEVELS` (`catalog/addons.ts`, catalog data).
- 24 images in `images/` (12 MB) that no page references; `build-dist` already leaves them out of the published site.

**Probably dead, not sure enough:** in `js/funnel.js`, `fitPicks`' branch for times shown outside the checkout, the `later` test in `updatePick` (always true once reached), and three unused parameters (`st` in the render loop, `i` in `applyQuote`'s map, `dur` in `paintMultiDay`). The non-checkout tail of `checkThenAdvance` looks dead but is reachable if the visitor leaves the checkout while the time is being checked, so it stays.

## Verified

- Build passes; 524 tests pass after every commit.
- Headless Chrome on the built `dist/`, all sends blocked (`web3forms`, `send-confirmation`, `create-payment`, `paypal-order`, `cart-capture`, `booking-followup`), at 1440×900 and 375×812 (device emulation):
  - all nine pages load with no console errors (the only log is the expected `/api/reviews` 404, as there are no functions locally) and no sideways scroll;
  - Book Now (a real mouse click, header at 1440, phone bar at 375) opens the form in place;
  - an interior booking, a Both booking with a second vehicle, and a "Tell us when does" request each reach Done, and "Book another vehicle" opens a fresh form each time. The baseline build (`ec6922a`) behaves the same in the same script.
- **Look:** the baseline build and this branch, served side by side, compared element by element on computed styles (40 properties, both pseudo-elements and the box size, animations frozen): every page at 1440 and 375, plus the booking form (first page, Both with packages, checkout, extras, recommended times, the week calendar, review, Done). **0 differences** in about 3,500 elements per size. (In the booking form runs the only logs are the expected `/api/travel` 404s, as there are no functions locally.)

## What to test

1. Every page at 1440 and 375 px: loads with no console errors and looks as before. Especially: the header logo and the footer logo tile, the Services tabs (the red active tab), the add-ons grid, the reviews "Read in full" link, the mobile menu sliding in and out, the correction card's tier list.
2. Book Now opens the booking form in place.
3. An interior booking, a Both booking with a second vehicle, and a "Tell us when does" request each reach Done; "Book another vehicle" starts a fresh form.
4. At the checkout, in the chosen-time bar: "Change" opens the Time section; "Change to suggested?" moves the time and stays on the checkout.
5. With PayPal configured but not loading, the fallback still reads "PayPal is not available here yet. Choose card instead, or carry on and we will send you a PayPal link."
6. Range & Travel: click the map, scroll to zoom; the hint text still changes.
