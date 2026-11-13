# Session changes: ad blocker compatibility (November 12)

Branch: `worktree-agent-a0a0c1affaadac2d9`. Started from `6fe1445`, paused for a computer restart (the WIP is kept as branch `adblock-wip-62044b6`), then re-applied on `1e99847` (`eNov6`) and re-verified on November 12; see "Re-verified" at the end. Not pushed.

**Report:** Imperion (the Google Ads agency) said package and add-on text is not visible on the site. They browse with an ad blocker.

**Goal:** the site looks and works the same with or without a blocker. Only internal names change: no restyling, no new wording, no new behaviour.

## Root cause

EasyList, the base list of nearly every blocker, has this generic element-hiding rule (EasyList version 202611121521, line 6146):

```
##.ad-body
```

AdGuard Base has the same rule. `##` with no domain in front means "on every site, hide every element with this class". Each add-on card on `services.html` (`CATALOG:ADDONS`, written by `web/scripts/render-site.mjs`) put everything it says inside `<div class="ad-body">`: the name, the description, the price, the "*" note and "How it works". So every one of the 16 add-on cards (Pet Hair Removal through Paint Correction) showed only its icon. This affected uBlock Origin, Adblock Plus, AdBlock, AdGuard, Ghostery and Brave in Aggressive mode.

Brave's Standard mode probably spared them. It does not hide a first-party element that holds more than five words of text ([Brave wiki: Cosmetic Filtering](https://github.com/brave/brave-browser/wiki/Cosmetic-Filtering)).

The `ad-` prefix came from "add-on" shortened. The cards' other classes (`ad-how`, `ad-price`, `ad-ic`, `ad-soon`, `ad-off`, `ad-ast`) are not on any list today. EasyList has hundreds of `##.ad-…` rules, though, so any of them could be added next week.

**Packages:** no package card, on any page or at any booking step, matched a rule in any list tested. The add-on section on `services.html` is titled "Add-ons for any package", so the report probably describes that one section. If Imperion still sees missing package text after this deploy, ask which page, which blocker and which extra lists they use.

## What changed

The `ad-` classes on the add-on cards were renamed to `addon-`, matching the section's existing `addon`, `addon-grp` and `addon-grid`:

| Before | After |
|---|---|
| `.ad-body` | `.addon-body` |
| `.ad-how` | `.addon-how` |
| `.ad-price` | `.addon-price` |
| `.ad-ic` | `.addon-ic` |
| `.ad-soon` | `.addon-soon` |
| `.ad-off` | `.addon-off` |
| `.ad-ast` | `.addon-ast` |

- **Sources edited:** `web/scripts/render-site.mjs` (the add-on card markup) and `styles.css` (17 rule lines; same specificity, same declarations, same order).
- **Rebuilt:** `services.html` (`CATALOG:ADDONS`) and the `?v=` stamps on every page, by `npm run build`.
- **Also edited:** `CLAUDE.md`, which named `.ad-how` in the "How it works" rule. It now says `.addon-how`, and a lesson line was added under Pages.
- **Unchanged:** no file, path, endpoint, setting, A/B test id, analytics event or booking email or calendar field was renamed. Nothing outside the repo (Netlify settings, printed QR codes) is affected.

## How it was tested

The work ran in the session scratchpad. The lists were downloaded into their own folder as untrusted data, and the scripts lived in another folder. The site was served from a copy of `dist/` on port 8793, with `Cache-Control: no-store`.

One snag: `127.0.0.1:8793` was still held by an old `python -m http.server` from another session's November 10 preview. That server was left running, and this session served on `[::1]:8793` instead.

### Lists tested

All downloaded on November 12, 2026:

- **EasyList and EasyPrivacy.**
- **uBlock filters:** filters, badware, privacy, unbreak, quick fixes and resource abuse, plus Annoyances (others and cookies).
- **Peter Lowe's list** and **URLhaus** (the online malware list).
- **ABP Acceptable Ads** (`exceptionrules.txt`).
- **AdGuard:** Base, Tracking Protection, Social, URL Tracking, Mobile, and the five Annoyances lists (cookies, popups, mobile app, other, widgets).
- **Fanboy:** Annoyance, Social, and Cookie (`fanboy-cookiemonster.txt` is the EasyList Cookie List).
- **Brave:** specific, unbreak and first-party.
- **Ghostery's own prebuilt full engine** (ads, tracking and annoyances).

### Engine

[`@ghostery/adblocker` 2.20.3](https://github.com/ghostery/adblocker) is the engine inside Ghostery, built here once per blocker from that blocker's default lists:

| Profile | Lists |
|---|---|
| uBlock Origin defaults | EasyList, EasyPrivacy, the uBO lists, Peter Lowe, URLhaus |
| Adblock Plus / AdBlock | EasyList and Acceptable Ads |
| AdGuard | Base, Tracking, Social, URL Tracking, Mobile and the Annoyances lists |
| Brave Shields | EasyList, EasyPrivacy, the uBO lists, Peter Lowe and the Brave lists, modelled as Aggressive |
| Annoyances | Fanboy Annoyance, Fanboy Social, EasyList Cookie and uBO Annoyances |
| Ghostery | its own prebuilt engine |

Pages were driven in headless Chrome over puppeteer-core.

**Not engine-tested:** Safari's 1Blocker publishes no lists. AdGuard for Safari converts the AdGuard lists into Safari's `css-display-none` / `block` rules, so its result follows the AdGuard row.

### Where it looked

At 1440 and 375 px, 116 states in all:

- **Pages:** all 11 pages (the 10 named plus `404.html`). On each: as loaded and scrolled through, with every `<details>` open, and with the booking form opened from a Book link wherever one exists.
- **Booking form:** opened from `index.html#book` and walked through:
  - vehicle and service;
  - package, with every "How it works" open, for inside and out, interior only and exterior only;
  - "Browse through all options" and "Help me decide";
  - extras: the list, every "How it works", and add-ons, a coming-soon interest and a tiered add-on picked;
  - checkout: contact, address, recommended times, "More times", the calendar view, "Choose a day", "None of these work";
  - the agreements, the review with its folds open, and the "are you sure" panel.
- **Never pressed:** "Confirm booking". Every request off the machine (functions, Web3Forms, analytics, Stripe, PayPal, Turnstile, weather, map tiles) was recorded and answered locally with an empty response, so nothing reached production or a third party.
- **Second run with the public keys set** (dummy GA4, Clarity, Turnstile, Stripe and PayPal values), so the analytics consent banner and the bot-check and payment code paths render too.

### Three checks at every state

1. **Each blocker's cosmetic stylesheet**, from the engine for that DOM, injected into the page. Every element that went from shown to hidden was recorded.
2. **Every native generic element-hiding selector** from every list (42,801 unique), plus the domain rules that apply to `.com`, `.app` or every site, run with `querySelectorAll`. This names the exact list and rule behind a hit.
3. **Every request the page made**, plus an inventory of the requests that happen only with keys set or on a real booking, matched against each engine as a first-party page on `513autoclean.com`. The inventory covered `/api/*` and `/.netlify/functions/*` for all eight functions, every `js/` file, gtag, GA collect, Clarity, Turnstile, Stripe, PayPal, Web3Forms, Places, Calendar, Nominatim, OSM tiles, Leaflet, weather.gov and Google Fonts.

### Two more checks

- **Synthetic sweep.** Every class, id and `data-` name used anywhere in the CSS, scripts and pages (678 classes, 188 ids, 85 data attributes) was put on its own element, and every list selector was run against them. This catches names that appear only in states the walk never reached.
- **Walk with each blocker on.** The booking form was walked from vehicle to Review with each blocker's network rules refusing requests (as `blockedbyclient`) and its cosmetic stylesheet applied, after accepting analytics, with every key set.

## Results, before (6fe1445) and after

### Cosmetic: elements hidden

| Blocker | Before | After |
|---|---|---|
| uBlock Origin | `services.html`: 16 add-on card bodies (`div.ad-body`) hidden, at 1440 and 375, as loaded, with folds open and with the booking form open | none |
| Adblock Plus / AdBlock | same 16 | none |
| AdGuard | same 16 | none |
| Brave (Aggressive) | same 16 | none |
| Ghostery | same 16 | none |
| Annoyances lists | none | none |

- **Rule:** `##.ad-body` in EasyList and in AdGuard Base.
- **Other pages and the booking form:** no hit in any state, before or after. That includes the consent banner, the offers banner, the package cards, every booking step and the map.
- **Synthetic sweep:** before, only `.ad-body` matched. After, nothing matched.

### Network: requests blocked

Identical before and after:

| Request | Blocked by |
|---|---|
| `googletagmanager.com/gtag/js` | uBO, AdGuard, Brave, Ghostery |
| `google-analytics.com/g/collect` | uBO, AdGuard, Brave, Ghostery |
| `clarity.ms/tag/…` | uBO, AdGuard, Brave, Ghostery |
| everything else | nothing |

- **Expected:** the analytics requests are blocked by design. The script tags are added only after Accept, and every call goes through `window.AC_TRACK`, which checks first. With them refused, the booking form still reached Review ("Confirm booking") under every blocker, at both widths, with no page errors and no hidden control pressed.
- **Not blocked by any list:** all of the site's own files (`js/analytics.js`, `js/funnel.js`, `js/pricing.bundle.js`, `js/config.js`, `script.js`, the stylesheets, `data/*.json`), every `/api/*` and `/.netlify/functions/*` path, Google Fonts, Leaflet from cdnjs, OpenStreetMap tiles, Cloudflare Turnstile, Stripe, PayPal, Web3Forms, Places, Calendar, Nominatim and weather.gov.

### Nothing visible changed

Computed styles were compared with no blocker, original against the fixed build, at the same 116 states, 1440 and 375 px:

- **What was captured:** every element's full computed style; its `::before`, `::after`, `::marker`, `::placeholder`, `::selection`, `::first-line`, `::file-selector-button`, scrollbar and details-marker styles; its box; its own text; and its visible attributes and values.
- **How it was frozen:** CSS animations finished or paused, reduced motion on, and the same clock, random seed and time zone.
- **Normalised:** only the `?v=` stamps and the `/orig/` vs `/fixed/` folder.
- **Result:** the first run was cut off by the restart before it wrote one. The re-check at the end of this file covers it.

## Found, not changed

- **`js/analytics.js`.** No current list blocks it as a first-party file. EasyPrivacy's `/analytics.js` rule is limited to named domains. It is worth knowing, though, that this file also sets the booking email's SOURCE (`AC_SOURCE`) and the A/B tests (`AC_EXP`), not only analytics. If a list ever blocks it generically, the funnel reads both through guards and still books, but the email's source and the A/B versions would be lost. Rename it only if a list starts blocking it.
- **`bk-promo*`, `#bkPromo`, `data-promo`** (the promo code field in the booking form). No list matches them today. Fanboy has many `promo` rules, all domain-specific or on other class shapes. They were left alone so the booking form is not touched without a match. If one ever matches, rename them, with `js/funnel.js` and `book.css` together.
- **Brave Standard vs Aggressive.** Brave Standard does not block first-party requests and spares first-party elements with real text. The Brave row above models Aggressive, the stricter case.

## How to check a new name

**The quick way.** Download EasyList, AdGuard Base and Fanboy Annoyance into an empty folder (they are data, not code) and search them for the name:

```
grep -nE '^##[.#]your-name\b|^##\[(class|id)[*^]?="[^"]*your' easylist.txt adguard-base.txt fanboy-annoyance.txt
```

**The thorough way, as done here.** Serve a copy of `dist/` and open the page in Chrome. Run every `##` selector from the lists with `document.querySelectorAll`, and inject the `@ghostery/adblocker` engine's `getCosmeticsFilters()` stylesheet to see what disappears. For requests, match each URL with `engine.match(Request.fromRawDetails({ url, sourceUrl: 'https://513autoclean.com/', type }))`.

**Visual check.** For an add-on or package change, open `services.html` with uBlock Origin on and confirm every card's text shows.

## What to test after deploy

1. **`services.html` with uBlock Origin (default lists):** all 16 add-on cards show name, description, price, "*" note and "How it works +"; the toggle opens the grey panel. Repeat with Adblock Plus or AdGuard if handy.
2. **With no blocker, the same page:**
   - the add-on cards look exactly as before: icon tile, bold name, red price, amber `*` on the four coming-soon ones, faded coming-soon cards;
   - "How it works +" and "-" work.
3. **Booking form, with a blocker on, any page:** Book Now opens it, and vehicle, service, package, extras, contact, address, time and review all work. Don't press Confirm.

## Sources

- **EasyList** (list home, syntax and policy): <https://easylist.to/>
- **Adblock Plus, How to write filters** (element hiding `##`, generic vs domain rules, `#@#` exceptions, URL patterns, `^`, `$third-party`): <https://help.adblockplus.org/hc/en-us/articles/360062733293>
- **uBlock Origin**:
  - static filter syntax: <https://github.com/uBlockOrigin/uBlock-issues/wiki/Static-filter-syntax>
  - generic and procedural cosmetic filters: <https://github.com/uBlockOrigin/uBlock-issues/wiki/Procedural-cosmetic-filters>
  - why generic filters are injected per class and id: <https://github.com/uBlockOrigin/uBlock-issues/wiki/Cosmetic-filtering-in-uBlock:-version-0.4.0.0-update>
- **AdGuard** filter syntax and lists: <https://adguard.com/kb/general/ad-filtering/create-own-filters/>, <https://adguard.com/kb/general/ad-filtering/adguard-filters/>
- **Brave**:
  - cosmetic filtering, and its first-party and five-word rule: <https://github.com/brave/brave-browser/wiki/Cosmetic-Filtering>
  - blocking policy (Standard does not block first-party requests): <https://github.com/brave/brave-browser/wiki/Blocking-goals-and-policy>
  - third-party cosmetic filtering: <https://brave.com/privacy-updates/2-third-party-cosmetic-filtering/>
- **Ghostery adblocker engine** (used for the tests): <https://github.com/ghostery/adblocker>
- **Safari content blockers** (AdGuard's converter maps `##` rules to `css-display-none`): <https://github.com/AdguardTeam/SafariConverterLib>
- **Practitioner guidance on false positives:**
  - a class named `add-btn` caught by an `ad` prefix rule, and advice to rename or prefix classes: <https://til.hashrocket.com/posts/dpg9k0zf70-ad-block-is-hiding-your-selector>
  - common flagged names (`.ad-*`, `.banner`, `.sponsor`, cookie and consent names), and testing with uBlock Origin on: <https://frontendchecklist.io/rules/security/element-hiding>

## Re-verified after the restart (on `1e99847`, November 12)

The first run's scripts and lists were in the session's temp folder, which the restart wiped. The fix itself was safe in its commit. It was re-applied to the current `eNov6` (`1e99847`), which applied cleanly, and checked again from scratch:

- **Build and tests:** `npm run build` passes, and 610 of 610 tests pass.
- **Lists:** fresh downloads, November 12. EasyList, EasyPrivacy, AdGuard Base, AdGuard Tracking Protection, AdGuard Annoyances, Fanboy Annoyance, Fanboy Cookie (EasyList Cookie), uBlock filters, uBlock privacy and Peter Lowe's list. `##.ad-body` is at EasyList line 6146 and AdGuard Base line 77322.
- **Blockers on live pages:**
  - **Method:** each page was served and loaded in headless Chrome, and its scripts ran. The engine was asked for the hiding rules that apply to that page's real classes, ids and links on `513autoclean.com`. They were injected, and whatever disappeared was recorded. The checks covered 10 pages plus the booking form opened on the home and Services pages.
  - **Before (`1e99847`):** on `services.html`, all 16 `div.ad-body` were hidden, with or without the form open. Nothing else was hidden on any page.
  - **After:** nothing was hidden on any page.
  - **Requests:** no request any page made was blocked, before or after. Analytics doesn't load locally without its ids.
- **Consent banner:** the analytics banner's markup was checked against each list on its own. None of them hides it.
- **Analytics blocked by design:** the form never calls GA or Clarity directly. It goes through `window.AC_TRACK`, and `gtag` and `clarity` are queue stubs. A refused GA or Clarity script leaves the form working.
- **Nothing visible changed:**
  - **Method:** 40 computed properties were compared for every element and its `::before`/`::after`, before vs after. Animations were frozen, and every add-on "How it works" was open. The comparison covered 10 pages plus `services.html` with the booking form open, at 1440 and 375 px. The results carousel and the map tiles were left out, because they move on their own.
  - **Result:** 8,920 element states, **0 differences**.
