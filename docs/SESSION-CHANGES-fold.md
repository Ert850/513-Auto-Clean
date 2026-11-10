# Session changes: sub-page core content on the first screen

Branch `claude/subpages-fold-18a4ca`, not pushed. Owner's request: "On full subpages like the services page, all core information needs to be visible without scrolling, at least on full-sized laptop or desktop screens. … make the process flow simpler for the end user."

## What we follow (research summary)
- **Bootstrap's pricing example** (getbootstrap.com/docs/5.2/examples/pricing):
  - a short header (title and one lead line);
  - then three equal cards, each with the name, the price, about four bullets and a full-width button;
  - the full feature comparison below the cards.

  The first screen answers "what are the options, what do they cost, how do I buy". Detail is one step away.
- **Fold research.** Nielsen Norman Group's 2018 eye-tracking study, as reported secondhand: about 57% of viewing time is spent above the fold, and 74% within the first two screens. People scroll when the first screen promises something worth scrolling for. So the decision content belongs on the first screen, and the depth can sit below it or behind a toggle. (The figures come from secondary sources; we couldn't open the NN/g page itself.)
- **Industry conventions we applied:**
  - **A compact page header on inner pages.** The big display title belongs to the home hero. Inner pages use a smaller title, with the page controls (here, the tabs) on the same row.
  - **Pricing cards show key inclusions** and fold the rest behind "N more". Nothing is removed.
  - **The rating appears next to the call to action** on an About page: a trust badge by the buttons.
  - **Density is tuned by line height and spacing**, not by smaller type.
- **What we did not do:**
  - no sticky "Book" bar on desktop (the header's Book Now is already sticky);
  - no smaller body type;
  - no removed content.

## Viewports
1440×790 (laptop with browser chrome), 1280×720 (small laptop), 1920×950 (desktop). Also checked at 820, 375 and 320 px: no horizontal scroll at any width. Phones are long by nature; the order is unchanged.

## Before and after: where each page's core content ends
Each value is the page y-coordinate, in CSS px, of the bottom of the last core element. ✓ means it is on the first screen; ✗ means it is below.

| Page | Core element | 1440×790 before → after | 1280×720 before → after | 1920×950 before → after |
|---|---|---|---|---|
| Services, Interior tab | Book buttons | 1018 ✗ → **723 ✓** | 1018 ✗ → **714 ✓** | 1018 ✗ → **723 ✓** |
| Services, Exterior tab | Book buttons | ≈1017 ✗ → **769 ✓** | ≈1017 ✗ → 760 ✗ (40 px under) | ≈1017 ✗ → **769 ✓** |
| About | Google rating (reviews' summary) | none on the first screen (the reviews section starts at 972) → **726 ✓** | 956 ✗ → **719 ✓** | 972 → **726 ✓** |
| Range & Travel | map / legend | 735 / 770 ✓ → 710 / 745 ✓ | 735 / 770 ✗ → **681 / 716 ✓** | ✓ → ✓ |
| FAQ | last question | 799 ✗ → **703 ✓** | 799 ✗ → **699 ✓** | 799 ✓ → 703 ✓ |
| Contact | Send button | 697 ✓ → 697 ✓ | 697 ✓ → 697 ✓ | ✓ → ✓ |
| Home | (unchanged) | hero 759 → 759 | 748 → 748 | 785 → 785 |

The Exterior "before" figure comes from the card height (525 px against Interior's 526, same top). The first run's selector also caught the correction card further down.

Screenshots at 2× (`before-*` and `after-*` at every viewport, plus `toggles-open.png`) are in the side-session notes folder, under `fold-shots/`. The measuring script, `fold.mjs`, is there too: serve `dist/` on 8793 and run `node fold.mjs <outdir> <label> [1=screenshots] [pages]`.

## Changes

| File | Change |
|---|---|
| `services.html` | The title block and the tabs row are wrapped in `.svc-intro`: the title on the left, the tabs with "See all add-ons" under them on the right (from 1000 px). |
| `web/scripts/render-site.mjs` | `packageCard(p, { fold })` and `servicesHtml({ fold })`. On `services.html`, a checklist longer than 4 items shows 4. The rest go in `<details class="svc-more"><summary>N more included</summary>`, which shares a `.svc-toggles` row with "How it works". `index.html` is rendered without `fold`, so the home cards are unchanged. The correction card never folds. |
| `styles.css` (sub-page block after `main > section:first-child`) | <ul><li>Compact sub-page title: 1.7 to 2.3rem, the Contact page's `.inq-head` size.</li><li>The `:where()` margin rule.</li><li>The `.svc-intro` row.</li><li>`.svc-toggles` and `.svc-more`.</li><li>Card density on sub-pages only (`main .svc-card`): padding 1.25rem, price line-height 1.2, tagline line-height 1.5, slightly smaller gaps.</li><li>About: tighter spacing around the promises, and the badge spacing.</li></ul> |
| `styles.css` (`.svc-how summary` rules) | `.svc-more summary` joins the "How it works" toggle's selectors: one toggle look. |
| `styles.css` `.faq-item summary` | Padding 1.25rem changed to 1.1rem. |
| `styles.css` `.at-canvas` (≥820px) | Height `clamp(320px, 100vh - 365px, 380px)`. 380 px as before on most screens, a little less on a short laptop so the legend stays on the first screen. |
| `about.html` | The home page's Google badge (`#google-badge`), under Book Now / Ask a Question. The build stamps its count, and `js/reviews.js` `syncBadges()` keeps it live. Nothing new was written for it. |
| `CLAUDE.md` | New "Sub-page fold" section. |
| other `*.html` | Re-stamped `?v=` only. |

## Root causes
1. **Inner pages used the home page's section header.** The 2.7rem title wrapped to three lines, and the 2.5rem gap under the tabs sat above the cards. Before the first card began, the page had spent 517 px of a 790 px screen.
2. **The Services title and tabs were stacked.** That is a full row (57 px plus a 40 px gap) for two small controls. Beside the title, the add-ons button also cost the title 160 px of width, which made it three lines; it now sits under the tabs.
3. **The package cards were as tall as their longest checklist.** Full Interior has 8 items, and the row of three stretches to the tallest card. The price row used the body's 1.6 line-height, so a 1.85rem price made a 47 px row.
4. **A specificity collision:** `main > section:first-child .section-head` (0,2,2) beat `.svc-intro .section-head` (0,2,0), and silently added 26 px. It is fixed with `:where()`, and the rule is in CLAUDE.md.
5. **The About page had no reviews summary on its first screen.** The rating lived only in the reviews section below the team section.

## Not changed / open decisions
- **Folding the checklists (Services only)** hides 2 to 4 items per card behind a toggle until clicked. The brief allowed it, but the owner should see it. The home page cards still show everything.
- **The Exterior tab at 1280×720** ends 40 px short: Full Exterior's tagline runs five lines. Fitting it would mean a shorter tagline (a wording decision) or a smaller header for everyone.
- **The About badge** adds the existing home-page component. An alternative that costs no height: put the rating in the dark "513 Auto Clean / Student-owned • Cincinnati" card on the photo. Its "student-owned" line repeats the first promise.
- Sub-pages use `<h2>` for their page title and have no `<h1>`. That is worth fixing for SEO, separately.
- Not touched: the main session's `text-wrap` and `.section-head` width work. The `.svc-intro .section-head { max-width: 46rem }` override applies only inside the Services title row.

## How to test
1. `export PATH=/opt/homebrew/opt/node@22/bin:$PATH && npm run build`
2. `cd web && TZ=America/New_York npx vitest run` (409 of 409 pass).
3. Serve `dist/` with the cache disabled, in a 1440×790 window:
   - **Services:** all three cards, down to the Book buttons, are visible on both tabs.
   - **"4 more included +":** opens the rest of the list in the same checklist style, and "How it works" drops to the next line.
   - **Each Book button:** opens the booking form with that package chosen. All six were checked over CDP; each showed its own package and price.
4. **About:** the rating badge is under the buttons and reads "Rated 5.0 from 32 reviews on Google & Yelp".
5. **FAQ:** all six questions are visible. **Range & Travel:** the map legend is visible at 1280×720.
6. **Home:** the package cards still show full checklists and look exactly as before (`index.html` has no `<main>` and was rendered without `fold`).
7. **Widths:** at 375 and 320 px there is no horizontal scroll.
