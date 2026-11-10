# Session change log: November 9, 2026 (branch `eNov6`)

For the validation agent at the end of the session. It lists every change,
every new feature, and every section modified, with what to test. Updated as
work lands.

**Design rule (from the owner):** the home page is being simplified and
reorganized for better conversion. **The look of the site does not change.**
Colors, type, components and style stay as they are. This is cleanup and
reorganization only. Reference sites: *links not yet provided*.

**Rules for anything that touches the owner's calendar or bookings (from the owner):**
- Validate what the live site actually does before changing anything near it. That is the bare minimum.
- **Do not break existing behavior.** GoHighLevel starts as a *parallel* feed alongside the current booking flow. Whether booking management moves to GoHighLevel is a later decision.

**Phase order (from the owner):**
1. Interface cleanup, plus moving sections to sub-pages and building the magazine landing pages. **Next.**
2. Set up analytics, and validate that the landing pages work. The analytics code (feature 1 below) is **already built but on hold**: it does nothing until the two ids are set in Netlify, so it changes nothing on the live site until phase 2.
3. Rigorous testing and review of every change: behavior, bugs, how intuitive it is to use, and final cleanup.

---

## Live site check (November 9, 2026)

**The live site runs exactly what is on `main`** (`5fbf83a`, the same commit as `eNov6`'s base). The asset stamps in the live `index.html` match `HEAD`.

**Calendar reads, checked in the live booking form** (opened in a browser and stepped through to the Time step; nothing was submitted):

| What | Result |
|---|---|
| Availability calendar (`9f26…`) | Read through the Calendar API |
| Work calendar (`75726f…`) | Read through the Calendar API |
| Personal calendar (`/api/personal-busy`) | Read, 49 busy blocks ahead |
| "Standard time slots" fallback warning | Not shown, so real openings are offered |

**Calendar writes on booking** (`netlify/functions/_gcal.mjs`, called from `send-confirmation`): **not verified.** Proving it needs a real booking, which has side effects. Verify with the owner's own test booking, or in the Netlify function logs (`calendar.auth` in the response).

**Other things found:**
- `check-live.mjs` reports the Calendar, Places and Stripe keys as "not set", but the live `js/config.js` does carry them. The checker can't parse the minified config, so this is a bug in the checker, not the site. Not fixed (outside scope).
- `/api/reviews` returns 502 on the live site, because Google doesn't recognize the Place ID. The stored-reviews fallback works. Existing issue, not caused by this session.
- The availability and booking tests depend on the timezone: all 409 pass with `TZ=America/New_York`, and 14 fail under `TZ=UTC` (and under this laptop's CET). Existing issue, and none of those tests touch code changed here. Run tests with `TZ=America/New_York`.

---

## New features

### 1. Analytics consent banner, with GA4 and Microsoft Clarity
- **New file:** `js/analytics.js`
- **What it does:**
  - On the first visit to the home page, a banner offers Accept or Decline.
  - Accept loads GA4 (`googletagmanager.com/gtag/js`) and Clarity (`clarity.ms/tag/<id>`).
  - Decline, or ignoring the banner, loads neither.
  - The choice is saved in `localStorage` under `ac-analytics`.
  - An "Analytics choices" link in the footer reopens the banner.
  - Changing Accept to Decline reloads the page, so the running scripts stop.
- **Not for advertising:**
  - Google consent mode denies ad storage, ad user data and ad personalization.
  - Google Signals and ad personalization signals are off.
  - Clarity is told ads storage is denied (`consentv2`).
- **No ids, no banner:** with `GA4_MEASUREMENT_ID` and `CLARITY_PROJECT_ID` unset, nothing shows and the tracking calls do nothing.
- **Events tracked:**

| Event | When it fires |
|---|---|
| `booking_open` | The booking form opens |
| `booking_step` | Each step of the booking form, with `step` as the step id |
| `booking_complete` / `booking_request` | A booking or request is sent, with value, `USD` and `source` |
| `question_sent` | The question form is sent |
| `contact_click` | A `tel:`, `sms:` or `mailto:` link is clicked, with `method` |

- **Test:**
  1. With no ids set, there is no banner and no console errors.
  2. With ids set: the banner appears on the first visit, on both phone and desktop. On a phone it sits above the sticky bottom bar.
  3. Decline: no requests to googletagmanager.com or clarity.ms.
  4. Accept: both scripts load and the CSP reports no violations.
  5. Reload: the banner stays hidden and the choice is kept.
  6. The footer "Analytics choices" link reopens the banner.
  7. Switching from Accept to Decline reloads the page.
  8. The banner's privacy link opens `privacy.html#cookies`.
  9. The booking form still works end to end.

### 2. Arrival source tracking (magazine ROI)
- **In:** `js/analytics.js` (`AC_SOURCE`)
- **What it does:**
  - On arrival, `utm_source`, `utm_medium` and `utm_campaign` are saved as `"golf / print / qr"` in `sessionStorage` under `ac-source`.
  - The first tagged link wins for that tab, and it is saved whether or not the visitor accepts analytics.
  - The source is sent with every booking and question.
- **Test:**
  1. Open `/?utm_source=golf&utm_medium=print&utm_campaign=qr`, then book.
  2. The Web3Forms email ends with `SOURCE golf / print / qr`.
  3. The owner's Resend email ends with the same SOURCE block.
  4. The question form's email includes a `source` field.
  5. Without UTMs, there is no SOURCE line at all.

---

### 3. Page split, phase 1: a shorter home page and four sub-pages
- **Home page (`index.html`):**
  - Now holds the hero, review ticker, gallery, packages (Services), booking, question form and footer. It went from 94.5 KB to 63 KB.
  - Moved out, verbatim: About plus the full reviews grid, the service area and travel estimator, the FAQ, and the add-on catalog.
  - The add-ons block is replaced by a "See all add-ons" button that links to `services.html`.
  - The FAQ structured data (JSON-LD) moved to `faq.html`.
  - `js/travel.js` is no longer loaded on the home page; it only drives the service area.
- **New pages:**

| Page | Content | Scripts |
|---|---|---|
| `services.html` | Add-on catalog, rendered from the catalog | `script.js` |
| `about.html` | Meet the Team, plus the reviews grid | `reviews.js`, `script.js` |
| `service-area.html` | Map and travel estimator | `pricing.bundle.js`, `travel.js`, `script.js` |
| `faq.html` | FAQ, its JSON-LD and the generated price sentence | `script.js` |

  - All four load `config.js` and `analytics.js`, so the banner and arrival-source capture work on them too.
  - The topbar, header, mobile menu, footer and mobile bar are **copied verbatim** from `index.html`, with only the links changed. Home-page anchors become `index.html#…`. Book Now becomes `index.html#book`, which opens the booking form on arrival. Contact becomes `index.html#inquiry`.
  - **Design rule kept:** no CSS changes and no new components. The only new markup is the add-ons page heading and the "See all add-ons" button, both using existing classes.
- **Navigation:** the home page's header, mobile menu and footer now link to `about.html`, `about.html#reviews`, `service-area.html` and `faq.html` instead of in-page anchors. Labels and order are unchanged.
- **Build:**
  - `render-site.mjs` now writes to four pages: packages and offers into `index.html`, add-ons into `services.html`, the FAQ price sentence and its JSON-LD into `faq.html`, and the rating into every page that carries it.
  - The new pages are added to `build-dist.mjs` `FILES`, `stamp-assets.mjs` `PAGES` and `sitemap.xml`.
  - The comment in `robots.txt` now points at `service-area.html`.
- **Generated with** a one-off script that copied each slice of `index.html` exactly. It is not committed: the pages are plain static files from here on. Header and footer changes now need making on all five pages.
- **Test:**
  1. Every nav, menu and footer link on every page lands where its label says.
  2. Book Now on a sub-page opens the booking form on the home page.
  3. Package "Book …" buttons on the home page preselect the package.
  4. "See all add-ons" opens `services.html`.
  5. The travel estimator answers a ZIP code on `service-area.html`, and the map loads when scrolled to.
  6. The reviews grid appears on `about.html`. Locally, `/api/reviews` returns 404 and the stored reviews show; on Netlify the API is used.
  7. FAQ answers expand, and Google's Rich Results test sees the FAQPage on `faq.html`.
  8. No horizontal scroll at 375 px.
  9. The mobile bar and menu work on every page.
- **Checked in a browser on the built site:**
  - All four pages render with no script errors. The only failing request is `/api/reviews`, which exists only on Netlify.
  - The travel estimator returned "Mason (45040), $20 to $35".
  - About shows 6 review cards.
  - FAQ has 6 questions and valid FAQPage JSON-LD.
  - Services shows the Interior and Exterior add-on groups.
  - Home has 6 sections, and package buttons open the booking form.
  - `index.html#book` opens the booking form.
  - At 375 px, `service-area.html` has no horizontal overflow.
- **Polish for the review pass (not done):**
  - Sub-pages have no `<h1>`; each section heading is an `<h2>`. Swapping it would change how it looks, so that needs a decision.
  - `services.html` shows its heading plus the catalog's own "Add-ons" `<h3>`, which reads as slightly repetitive.
  - On sub-pages the first section fades in after `script.js` runs. The home hero avoids this with a CSS animation.
  - `services.html` holds only add-ons, as decided. The URL suggests full services, so consider `/add-ons`, or adding the packages there later.

### 4. Fixes from the first human review (November 9)

| Reported | Root cause | Fix | Verified |
|---|---|---|---|
| Clicking the logo cut the top bar in half | The logo's `#top` target sat *under* the top bar and header (113 px down). `scroll-padding-top: 90px` then stopped the jump at about 23 to 28 px, leaving 12 of the top bar's 40 px visible | Moved `<span id="top">` to the very start of `<body>`, so the jump lands at 0 with the whole top bar showing | Scrolled down, clicked the logo: scroll 0, top bar fully visible |
| Services sometimes landed at the wrong height | Content above Services loads after the first paint. The gallery is built from `data/gallery.json` (383 → 1,562 px) and the review ticker appears (+116 px), pushing Services down about 1,295 px. A smooth scroll aims at where the section was when the click happened | `script.js`: after a jump to an id on the same page, a `ResizeObserver` holds the target in place for 2.5 s whenever the page changes height. The hold ends the moment the visitor scrolls, taps or presses a key | Services held at 90 px (the header clearance) through the load, and still at 90 px after an extra 600 px was injected above it. After a wheel scroll the hold let go |
| Reviews link shifted slightly | Same cause on `about.html#reviews`: the web fonts (`display=swap`) and images settle above the target after the jump | Same hold, also applied when arriving with `#id` in the URL, and held again on `window.load` unless the visitor has already moved | Logic is shared with the Services case. The arrival timing could not be measured, because the hidden pane does not run smooth scrolling. **Re-check by hand** |
| "Service Area" needed a clearer name | n/a | Header nav now says **Range & Travel**, and the mobile menu says **Range & Travel Costs**, on all 5 pages. The footer column ("Service Areas"), the page title and the section heading are unchanged | Visible in the desktop nav |
| Google badge and four-promise bar layout | The badge sat alone in the hero, and the four promises wrapped 3 + 1 under the carousel | The badge moved out of the hero into the trust strip, on the left, with the four promises in a **2x2 grid** on the right. The strip now sits **above** the review carousel. Below 560 px the badge sits above the 2x2 grid. Uses the existing badge, icon and colour styles; the only new CSS is the grid, the badge margin, and a divider line under the strip so it doesn't merge with the carousel band | Checked at 1440, 820 and 375 px wide: no sideways scroll, and the rating text is still synced by `reviews.js` (`#google-badge` kept) |

### 5. Second review round (November 10): nav alignment everywhere, footer logo, question form

**Method.** Headless Chrome driven over CDP with real mouse clicks: every header-nav link (1440 px) and every mobile-menu link (375 px) on all 5 pages, clicked both immediately and after load, measuring the target's top against the header's bottom. That's 160 checks per run. The in-app browser pane was not used for this: when hidden, it does not run smooth scrolling or the jump-to-section on page load.

| Run | Misaligned | Note |
|---|---|---|
| Baseline | 80 / 160 | Desktop 17 px short, phone 26 px short |
| After scroll-padding fix | not valid | The test browser served cached old HTML. Cache now disabled |
| After smooth-scroll change | 32 / 160 | Desktop 80/80 correct; phone 9 px low |
| After header-width fix | see the latest run in the log | |

| Problem | Root cause | Fix |
|---|---|---|
| Every nav jump stopped short, showing a strip of the section above | `scroll-padding-top: 90px` against a 73 px sticky header | `script.js` sets it from `#header.offsetHeight`, again on resize. The CSS fallback is 73 px |
| Arriving from another page (such as About → Contact Us) opened at the top, then slid about 4,700 px | `html { scroll-behavior: smooth }` animates the jump to a section on page load too | Removed from CSS. `script.js` smooth-scrolls in-page clicks itself (respecting reduced motion) and arrivals land instantly |
| Phone jumps 9 px low | The header row was 379 px on a 375 px phone (logo PNG's transparent sides, name, tag line, menu button), so the phone zoomed out to fit it | The header logo now crops its transparent sides (`28×46`, `object-fit: cover`; the bottle stays the same size), and the tag line is hidden below 360 px. Width is now 375/375 and 320/320 |
| Footer logo tiny, with a big gap before the name | The same transparent PNG at 40×40 showed a 13 px bottle | `.footer .brand .mark-img { 30×54, cover }` |
| Question form: the text boxes started at different heights | The condition label wrapped to two lines | Rows align on the boxes (`align-items: end`). The label is now "Your vehicle's condition" |
| Question form: contact pills tall, with the radio stacked over its word | `.field label { display: block }` outranks `.pref` | Restated as `.contact-pref .pref`, sized to match the inputs, and given an `auto` column on wide screens |
| Question section: the card was too tall, the left column airy, the email didn't look clickable | Every field on its own row in a narrow card | Card widened (`minmax(250px, .5fr) 1.5fr`). Fields laid out as: question and condition side by side; then Name, Phone, Email; then Vehicle, ZIP and the contact pills. The email is a chip like the phone number. Left-column gaps tightened. The card is 628 px tall at 1440 |

**Merged:** `claude/service-area-cleanup-b4bca3` (Range & Travel page; see `docs/SESSION-CHANGES-service-area.md`).

**Still running in parallel:** the `services-fixes` session (How-it-works spacing, correction card, offers banner, condensed copy drafts).

**Also merged:** `claude/services-fixes-d9e6fc`, the Services & Pricing details. See `docs/SESSION-CHANGES-services.md`. The condensed "How it works" copy in `docs/HOW-IT-WORKS-DRAFTS.md` is **not applied**: it waits for the owner's approval.

### 6. One full Services page (decided with the owner, November 10)
- **`services.html`:**
  - Now holds every package card (Interior and Exterior tabs, How it works, the correction tiers, the offers banner) above the add-ons.
  - Loads the booking form (`#bookFunnel`, `book.css`, `vendors.js`, `pricing.bundle.js`, `funnel.js`). Book on any card opens the form in place with that package chosen, and its Book Now links are `book.html`.
  - Title: "Services and Prices".
- **Home page `#services`:**
  - Keeps the heading, then a teaser rendered from the catalog (`CATALOG:TEASER` in `render-site.mjs`). It shows one compact card per package (name, Most popular, tagline, price and hours), styled like the add-on cards and linking to `services.html#panel-<category>`.
  - Below that: "See all services & prices" and "Book Now".
  - On phones it shows two cards across with no tagline (1,044 px instead of 1,544 px).
- **Links:** "Services" and "Services & Pricing" in every header, menu and footer now go to `services.html`. The booking form's "See all services and prices" link does too.
- **`script.js`:** arriving at `services.html#panel-exterior` selects that tab and then lands on it. A hidden panel can't be scrolled to.
- **Verified (1440 and 375 px):**
  - 7 teaser cards on the home page.
  - `services.html#panel-exterior` opens the Exterior tab, and the panel lands at 73 px.
  - "Book Express Exterior" opens the booking form on the Services page.
  - No horizontal overflow.
  - Tests 409/409.
### 7. Home page Book Now goes to the booking section (owner's decision, November 10)
- **The hero's Book Now and the services teaser's Book Now** now link to `#quote` ("Let's get your car booked"). They glide there; the section's "Start My Booking" opens the form.
- **Unchanged, still opening the booking form instantly:** the header Book Now, the mobile-menu Book Now, the sticky phone bar, the footer Book Now, and the hero's "View Services" (which opens the form's browse view).
- **Verified with real clicks:**
  - Hero and teaser Book Now land on `#quote` exactly under the header (73 px) at both 1440 and 375 px.
  - "Start My Booking" opens the form.
  - The header Book Now still opens the form.
- **Note:** this was the owner's call over my recommendation, which was to merge `#quote` into Contact so every Book Now stays instant. Worth checking in analytics once GA4 is live: compare `booking_open` from the hero against before.

### 8. Third review round (November 10)

| Item | Root cause | Fix | Verified |
|---|---|---|---|
| Contact pills: the words sat outside the pills, overlapping the next one | `.field input { width: 100%; padding; border; background }` (meant for text boxes) also matched the radios. Each radio filled its pill; my earlier `nowrap` then pushed the word out | `.contact-pref .pref input { width: auto; padding: 0; border: 0; background: none; flex: none }` | 2× capture at 1100 px: radio and word side by side inside each pill. Words inside the pill at 1440 and 1100 |
| Footer logo: black trigger invisible | The PNG's trigger is black, and the footer is near-black | A light rounded tile behind the logo (44×54, shadow) in the footer and the mobile menu, on all pages | 2× capture of the footer |
| Home services section "messed up" | I replaced the full cards with a compact teaser | **Reverted:** the full cards and tabs are back on the home page, rendered from the same source as `services.html`. "See all add-ons" goes to `services.html#addons`. The teaser renderer, its CSS and the tab-on-arrival code are removed | Home has 7 package cards and 2 tabs |
| Duplicate "Services & Pricing" heading on `services.html` | The add-ons section reused the packages section's heading | The second section's heading is now **"Additionals"** | Read back in the page |
| "How it works" looked different on add-on cards and in the coating explainer | Three separate styles: `.svc-how` (the agreed one), `.ad-how` (plain text), `.svc-explain` (a white box with a display-font heading) | One shared style for all three: the same red toggle (+ / -) and the same grey panel with a 2 px left rule. The explainer's content is wrapped in `.how-body` (white panel, because it sits in the grey tier box) | 2× captures: add-on cards with panels open, the coating explainer open, package cards |
| Ohio county headings; travel-price colors | Handed to a parallel session (`range-travel-colors`, port 8791) | Pending its report | |

### 9. Fourth review round (November 10)

| Item | Root cause, or what changed | Verified |
|---|---|---|
| "Work" renamed "Results" | Header nav and phone menu, on all 5 pages | Read back |
| Contact Us moved below the FAQ on `faq.html` | The whole `#inquiry` section moved. Every Contact or Ask link on every page now points to `faq.html#inquiry`: header, menu, phone bar, hero, `#quote`'s "Ask us instead", footer, and the booking form's "Send us a message". **Side effect fixed:** the booking form's "ask a question" and "change my booking" used to fill a question form on the same page, and fell back to an `sms:` link (useless on a desktop) where there was none, which included `services.html`. Now they carry what the person entered to `faq.html#inquiry` through `sessionStorage` (read once, deleted). Privacy policy: one new sentence, version 2026-11-10, re-locked | Tests 409/409 |
| "See all add-ons" beside the Interior/Exterior tabs | A new `.svc-tabs-row` (tabs plus button). The old button under the cards is removed | 2× capture at 1440 |
| Footer Explore names | Now exactly the nav: Results, Services, Meet the Team, Reviews, **Range & Travel** (added), FAQ, Contact Us. Same on all 5 pages | 2× capture |
| Contact layout cramped below 1000 px | From 820 px the grid split 0.8fr/1.2fr, and the phone-first `order: 1` put the **form** in the narrow track. Now two columns only from 1000 px. Below that, "Prefer to talk?", the phone and the email sit in one compact row above a full-width form | 2× captures at 1440, 820 and 375 |
| Footer Service Areas links | All five opened the top of `service-area.html`. The state cards now have ids `area-oh`, `area-ky` and `area-in`, and each footer place links to its own card | A real click on "Northern Kentucky" lands the Kentucky card at 73 px |
| Merged `claude/range-travel-colors-bb207f` | Ohio grouped by county (the card got shorter); the fee scale is green, then an amber-to-brown ramp; dots solid and matching their keys; prices in ink. See `docs/SESSION-CHANGES-service-area.md` | Build, tests 409/409 |

### Reference sites reviewed (design lessons only, nothing copied)
- **dksdetailing.com:**
  - **What works:** one short line of social proof ("Trusted by 250+"), a one-line headline, and two buttons (a main one plus Call). Packages are grouped by Full, Exterior and Interior.
  - **What to avoid:** no prices anywhere, so every button says "Get Free Quote", which adds friction. The page is about 9,800 px tall with duplicated carousel content.
- **truecolorsdetailing.com** (local competitor, Florence, KY):
  - **What works:** a short nav (Services, Book Now, About, Mobile, Contact), each service on its own page (good for SEO), and a headline with the location in it. The hero has a main "Book services" button and a secondary "View all services" one, which is the same split we just made.
  - **What to avoid:** ten different labels for the booking button, and the home page is still about 12,000 px.
  - **Possible follow-up:** they're the closest competitor in our area; consider doing a full side-by-side comparison.
- **extramileceramiccoating.com:**
  - **What to avoid:** several `<h1>`s, a 20,000 px wall of text, a stray "New Page" nav item, and vague lowercase "schedule" buttons.
  - **What works:** the owner's own voice.
- **What that means for us:**
  - Use one main button label everywhere (Book Now) and one secondary (services and prices).
  - Keep the home page to proof, packages and booking, with depth on sub-pages.
  - Keep prices visible; that is already an advantage over DKS.
  - Avoid repeated content, and have one `<h1>` per page.

## Files and sections changed

| File | Section | Change |
|---|---|---|
| `js/analytics.js` | new | Banner, loader, event tracking, arrival source |
| `index.html` | `<head>` script tags | Added `js/analytics.js` (deferred) after `vendors.js` |
| `index.html` | footer, `.footer-bottom` | Added an "Analytics choices" button (`data-analytics-choices`, hidden until there are ids) |
| `styles.css` | after `.mobile-bar` | `.consent` banner styles and the `.linklike` button style |
| `js/funnel.js` | `go()` | Fires `booking_step`. Added the `track()` and `source()` helpers |
| `js/funnel.js` | `open()` | Fires `booking_open` |
| `js/funnel.js` | `done()` | Fires `booking_complete` or `booking_request` |
| `js/funnel.js` | `sendConfirmation()` | Payload now includes `source` |
| `js/funnel.js` | `buildSummary()` | Adds a SOURCE block to the Web3Forms email |
| `script.js` | question and contact form submit | Appends `source` to the FormData. Fires `question_sent` on success |
| `netlify/functions/send-confirmation.mjs` | `extras` and the owner email lines | Reads `payload.source` (120 characters maximum) and prints a SOURCE block |
| `js/config.template.js` | end | Added `ga4MeasurementId` and `clarityProjectId` |
| `web/scripts/render-config.mjs` | `COSTS` | The build log names the two new variables when they are missing |
| `netlify.toml` | `SECRETS_SCAN_OMIT_KEYS` | Added the two analytics ids (they are public) |
| `netlify.toml` | CSP (report-only) | Allowed googletagmanager.com, *.google-analytics.com, *.analytics.google.com, *.clarity.ms and c.bing.com |
| `web/lib/site/capabilities.ts` | `CAPABILITIES`, `PROCESSORS` | New `siteAnalytics` switch (live), plus Google Analytics and Microsoft Clarity as processors |
| `web/scripts/render-legal.mjs` | `automaticPara`, `cookiesParas` | New wording when `siteAnalytics` is live: the banner, the cookies, the arrival source, and how to change the choice |
| `web/lib/site/legal.ts` | `privacyEffective` | 2026-09-14 changed to 2026-11-09. Terms unchanged |
| `privacy.html` | generated sections | Regenerated by the build (do not hand edit) |
| `web/legal.lock.json` | privacy fingerprint | Re-locked with `npm run lock:legal` after the privacy wording change |
| `terms.html`, `404.html` | stylesheet `?v=` stamp | Re-stamped by the build only, because `styles.css` changed. No wording change |
| `js/pricing.bundle.js`, `netlify/functions/_pricing.mjs` | generated bundles | Rebuilt, carrying the new capability and the legal date |

**Verified so far:**
- `npm run build` passes, and `tsc --noEmit` passes.
- With `TZ=America/New_York`, the tests pass: 409 of 409.
- In a browser, with placeholder ids on a local copy of the build:
  - The banner shows, and nothing loads before a choice is made.
  - Decline: nothing loads, and `denied` is saved.
  - The footer link reopens the banner.
  - Accept: both scripts load, with the consent default (ads denied) and Clarity `consentv2` called first.
  - `?utm_source=golf&utm_medium=print&utm_campaign=qr` is captured as `golf / print / qr`.
- **Not yet tested:** a real booking's emails showing the SOURCE block, the phone layout of the banner over the mobile bar, and CSP reports from production.

## Docs added
- `docs/DELIVERABLES-2026-11-13.md`: the deliverables list from the voice notes
- `docs/ANALYTICS-OPTIONS.md`: the analytics comparison (GA4 + Clarity chosen)
- `docs/BOOKING-PIPELINE.md`: booking pipeline process document: flow diagram, counts, asked-vs-minimum comparison, 11 ranked improvements, and the weekly calendar spec. Written by a parallel agent. Two claims spot-checked against `rules.ts` and `surcharge.ts`: correct. Its 8 questions for the owner are still open.
- `docs/SESSION-CHANGES.md`: this file

## Known gaps and follow-ups
- GA4 and Clarity ids are not set yet. The owner needs to create the accounts (see `docs/ANALYTICS-OPTIONS.md`) and add `GA4_MEASUREMENT_ID` and `CLARITY_PROJECT_ID` as Netlify environment variables.
- The four sub-pages load `config.js` and `analytics.js`, and their footers carry the "Analytics choices" link (copied from the home page). **The magazine landing pages are not built yet** and must do the same.
- **GitHub push is blocked:** this Mac is signed in as `AffineFrame`, which has no write access to `Ert850/513-Auto-Clean`. Commits are on local `eNov6` only until access is fixed.
- The source is not yet sent to GoHighLevel, because that integration doesn't exist yet.

## Environment
- Installed Node 22 with Homebrew (`node@22`), with the owner's approval, to run the build and tests.
