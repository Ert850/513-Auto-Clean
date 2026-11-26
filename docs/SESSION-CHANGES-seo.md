# Session change log: the SEO master page (November 26, 2026)

Branch `claude/seo-master-page-7e23ad`, not pushed. It merges into eNov14 later, after Emmett approves it. Nothing here reaches production: the master page is still a draft (noindex, out of the sitemap and out of production builds).

## 1. The standard: `docs/SEO-PAGE-STANDARD.md` (new)

- **What it is:** what one good service, add-on or area page is, as a pass/fail checklist (29 items, the ★ items gate publishing), plus how a photo gets its town.
- **What it holds:**
  - the master page's grade: 25 of 28 (89%), 1 fail and 2 pending;
  - the decisions Emmett makes before the other pages are generated.
- **Test:** read it against the Deploy Preview of the interior page, at 1440×790 and 375×812.

## 2. The master page: `interior-car-detailing-cincinnati` (still a draft)

### Generator (`web/scripts/render-services.mjs`, `web/templates/service.html`)

- **`{time:<package>}`** in a page's words is filled from the catalog's duration ("about 4 hrs"), like `{price:}`.
- **`offer`** (`{ package, label }`): one line under the subtitle with the package's name, "from" price and time from the catalog.
- **`reviews`** (`[{ author, date }]`): a "What customers say" section after the levels.
  - The words are always `data/reviews.json`'s.
  - The build fails on a review that isn't there or isn't shown (`feature: false`).
  - Signed with the first name and "on Google", with no review markup.
- **Hub links** under the FAQ: add-ons, Range & Travel, FAQ, plus every other published service page.
- **og:image** is the hero pair's after photo, not `hero-exterior.jpg`.
- **New publish gates:** at least 2 reviews and at least 5 questions. A draft still builds without them.
- **Photos:** at most 3 shown (was 4). The standard says 2 or 3, not a gallery.

### Config (`config/services/interior-car-detailing-cincinnati.json`)

- **H1:** "Book interior detailing in Cincinnati. We come to your driveway." (decision 1 in the standard).
- **New:** subtitle, meta, offer (Full Interior + Steam, the catalog's featured package) and 3 interior reviews.
- **FAQ:** 3 questions became 8, with numbers through `{price:}`, `{time:}` and `{addon:}`.

### Style (`styles.css`)

- `.svp-offer` and `.svp-links`, in the existing `svp-` block, using existing colors.

**Other pages:** the other `*.html` files changed only in their `?v=` stamps (`styles.css` changed). The stain page (also a draft) gains the hub links. It has no pair, so its og:image is still `hero-exterior.jpg`.

**Test (preview build, `PREVIEW_BUILD=1 npm run build`):**
- Open `/interior-car-detailing-cincinnati` at 1440×790: the H1, offer, Book Now, rating and before/after card are in the first screen.
- At 375: Book Now is in the first screen.
- Each level card's Book button opens the form on its package; the hero's opens it on Interior, as before.
- `CONTEXT=production npm run build` leaves the page out of `dist/` and the sitemap.

## 3. Photo privacy check (found, not changed)

- **Published images are clean:** no image in `dist/` (the only folder Netlify publishes) carries EXIF.
- **Seven source photos in the public repo carry GPS coordinates** (`images/detail-closeup.jpg`, `escape-dashboard-after.jpg`, `minivan-cargo-after.jpg`, `rear-seats-after.jpg`, `sedan-rear-seats-after.jpg`, `suv-cargo-before.jpg`, `truck-interior-after.jpg`). An eighth, `hero-cargo.jpg`, carries a capture date only.
  - No page references them, the build leaves them out, and the live site returns 404 for them.
  - They are on `main` and in the history since June, so anyone can download them from GitHub.
  - **Root cause:** they were committed straight from the phone before the gallery's "saved fresh, no EXIF" rule (`data/gallery.json` `_howToAdd`), and nothing checks `images/` for metadata.
  - **Fix proposed for Emmett:** strip or delete them, add a test that fails on GPS in `images/`, and purge them from history together with step 4 of `AFTER-TOLL-FREE-APPROVAL.md`.
- **The 6 reviewed gallery pairs have no `source`, and their masters have no EXIF,** so none of them can be dated or placed from the repo. No calendar was read: there was no date to match.

## 4. Question list: `docs/QUESTIONS-FOR-ELIJAH-SEO.md` and `.pdf` (new)

- **What it is:** 337 customer questions, numbered for replies by number and grouped by the page they belong to.
  - The groups: general and booking, pricing, each interior and exterior package, 18 add-ons, gift cards, and 11 area groups.
  - 150 are marked ✅ with where the site already answers them.
  - It ends with 15 facts for Elijah to confirm (A to O), such as water and power, and insurance.
- **It replaces** the November 15 `FAQ-QUESTIONS-FOR-ELIJAH.md`. His answers feed each page's FAQ (standard item C5).
- **The PDF** is the same file, printed with headless Chrome.

## 5. Found on live or draft pages while checking (not changed)

- **`faq.html` types a business number:** the pet hair answer says the add-ons are "billed at $50/hr". That breaks the no-typed-numbers rule, and the catalog's add-ons are fixed prices, not hourly.
- **`faq.html`'s heading** "Can you remove pet hair, stains, and odors?" reads as a removal promise; the answer under it is careful.
- **Water and power are said three ways:**
  - FAQ: "rarely an issue";
  - Terms: give them if you have them, or we bring our own;
  - the interior draft and `BUSINESS-CONTEXT.md`: we bring everything.
  This is fact check A in the question list.
- **The stain draft's step 2** says every stain is extracted. Only the deep tier includes extraction.
- **`service-area.html`** says "we will travel up to 12 hours each way". That looks doubtful (fact check G).
- **`config/areas.json` has no Northern Kentucky or Southeast Indiana group,** so a city page there can't pass the ZIP check yet (fact check F).
- **The gift cards page** says Apple Pay or Google Pay; the setting lists card, Link and Amazon Pay. Wallets likely come through card; confirm (fact check O).
