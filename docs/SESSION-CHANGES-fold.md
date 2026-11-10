# Session changes: sub-page core content on the first screen

Branch `claude/subpages-fold-18a4ca`, not pushed. It includes a merge of `eNov6`, which brought the balanced headings and the "pretty" text wrapping, so every measurement below is taken with those rules in place.

## The owner's request and acceptance test
> On full subpages like the services page, all core information needs to be visible without scrolling, at least on full-sized laptop or desktop screens. … make the process flow simpler for the end user.

It was followed by two screenshots of `about.html` and these targets, at **1440×790 and 1280×720 (laptop) and 1920×950 (desktop)**, with nothing scrolled:
- **Services:** every visible package card's Book button.
- **About:** the 5.0 Google score and the tops of the first review cards (name and stars).
- **Every other sub-page:** its critical items:
  - Range & Travel: the estimator, the map and its legend.
  - FAQ: every question.
  - Contact: the Send button.

All of these pass, on both Services tabs. See the table below.

## Research: sources and the rules we applied

| # | Rule | Source | How it is applied here |
|---|---|---|---|
| 1 | **The first screen gets most of the attention.** About 57% of viewing time is above the fold and 17% on the second screen. Attention drops sharply after the fold, and within the first screen most of it goes to the top half. | NN/g, [Scrolling and Attention](https://www.nngroup.com/articles/scrolling-and-attention/) (2018 eye-tracking) | The deciding content goes on the first screen: price, what is included and the Book button on Services; the score and real reviews on About. Depth goes below it or behind a toggle. |
| 2 | **People scroll only if the first screen promises more. A clean horizontal break looks like the end of the page (the "illusion of completeness", a "false floor").** A partly visible next element is the cue to scroll. | NN/g, [Illusion of Completeness](https://www.nngroup.com/articles/illusion-of-completeness/) and [Principle of Closure](https://www.nngroup.com/articles/principle-closure/); [Webflow](https://webflow.com/blog/breaking-the-illusion-of-completeness) | About ends its first screen on the tops of three review cards: names and stars, with the text cut off. That is the owner's own target, and it tells the visitor more follows. The team section no longer ends in a 144 px empty band, which read as the end of the page. |
| 3 | **Pricing pages:** a short header, then equal cards, each with the name, the price, about four key bullets and one full-width button. The full comparison goes below. | Bootstrap, [Pricing example](https://getbootstrap.com/docs/5.2/examples/pricing/) | Services uses a compact header, three equal cards, the first 4 inclusions with "N more included +", and one Book button per card. Nothing is removed: the folded items open in place. |
| 4 | **Don't make people scroll to find the prices.** Keep all the pricing boxes above the fold. Hidden prices feel like a trick. | [Solodev, pricing boxes](https://solodev.com/blog/web-design/how-to-design-pricing-boxes-that-get-people-to-click.stml); [CXL, Above the fold](https://conversionxl.com/blog/above-the-fold/) | All three prices and Book buttons are on the first screen, on both tabs. |
| 5 | **Put the call to action where it makes logical sense, once the value is clear.** "Always above the fold" is a simplification. | CXL, [Above the fold](https://conversionxl.com/blog/above-the-fold/) | Each Book button sits at the foot of the card that explains it, not in a separate bar, and it is on the first screen because the card is. |
| 6 | **Social proof belongs near the point of decision** (rating, count, a line of a real review), and too many proof widgets distract. | [Digital Applied, trust signal placement](https://www.digitalapplied.com/blog/social-proof-trust-signals-2026-conversion-placement-framework); [Zipify, review placement](https://zipify.com/blog-boost-11-review-tests/) (both are secondary summaries of Baymard and NN/g findings) | About shows the live Google score beside the reviews title, directly under Book Now / Ask a Question, and the first review cards. I first tried a separate rating badge and removed it: it repeated the score the reviews block now shows. |
| 7 | **Design for real laptop windows, not screen sizes.** Common laptop screens are 1366×768, 1536×864 and 1440×900, so the browser window is about 120 px shorter. | [StatCounter, desktop resolutions](https://gs.statcounter.com/screen-resolution-stats/desktop-tablet-console/worldwide) | We test 1280×720 as well as 1440×790. 720 px is roughly what a 1366×768 or 1280×800 laptop shows. |
| 8 | **The grid gives each column enough room.** Bootstrap's `row-cols-md-3` puts three cards in a row only at the larger breakpoints; below that, columns stack. | Bootstrap, [Grid](https://getbootstrap.com/docs/5.3/layout/grid/) and the pricing example | Package cards go three across only from 1000 px, not 820. At 820 they were 230 px wide and three-word items wrapped onto two lines. |
| 9 | **Compact page headers on inner pages.** The big display title belongs to the home hero, and inner pages put the title and the page controls on one row. | Bootstrap pricing example (`display-4` header with a single lead line); the Services and Contact pages' existing patterns | Sub-page titles use the Contact page's size. On Services the tabs sit beside the title; on About the Google score sits beside the reviews title. |
| 10 | **Density comes from line height and spacing, not smaller text.** | Typography basics; this repo's rule "keep the look" | Font sizes are unchanged. The price line went from line-height 1.6 to 1.2, the tagline from 1.6 to 1.5, and the gaps are tighter. |

Not done, on purpose:
- no sticky Book bar on desktop: the header's Book Now is already sticky;
- no smaller body text;
- nothing deleted;
- no change to the top bar or the header.

## Before and after
Each value is the bottom, in page px, of the last core element. For "card tops" it is the card's top + 65 px (name and stars). The fold is 790, 720 and 950. **Bold** means it now fits; ✗ means it does not.

| Page | Critical item | 1440×790 | 1280×720 | 1920×950 |
|---|---|---|---|---|
| Services, Interior | Book buttons | 1018 ✗ → **699** | 1018 ✗ → **692** | 1018 ✗ → **699** |
| Services, Exterior | Book buttons | 1017 ✗ → **724** | 1017 ✗ → **716** | 1017 ✗ → **724** |
| About | Google 5.0 score | 1061 ✗ → **672** | 1045 ✗ → **626** | 1061 ✗ → **672** |
| About | First review cards (name and stars) | 1152 ✗ → **753** | 1136 ✗ → **707** | 1152 ✗ → **753** |
| Range & Travel | Map legend | 770 → **737** | 770 ✗ → **708** | 770 → **737** |
| FAQ | Last question | 799 ✗ → **695** | 799 ✗ → **691** | 799 → **695** |
| Contact | Send button | 697 → **689** | 697 → **689** | 697 → **689** |
| Home | (not a target; hero unchanged) | 759 | 748 | 785 |

At 820, 375 and 320 px there is no horizontal scroll on any page.

Screenshots (2×) are in the side-session notes folder, under `fold-shots/`:
- `before2-*`: the original pages;
- `final-*`: this branch;
- `toggles-open.png`: a card with its toggles open.

The measuring script is `fold.mjs` in the same folder: serve `dist/` on 8793, then run `node fold.mjs <outdir> <label> [1=screenshots] [services,about,area,faq,contact,home]`.

## Changes

| File | Change |
|---|---|
| `services.html` | `.svc-intro` wraps the title and the tabs: the title on the left, the tabs with "See all add-ons" under them on the right, from 1000 px. |
| `web/scripts/render-site.mjs` | `servicesHtml({ fold })` and `packageCard(p, { fold })`. On `services.html` only, a checklist longer than 4 items shows 4. The rest go in `<details class="svc-more">` ("N more included"), which shares a `.svc-toggles` row with "How it works". The home page renders without `fold`. The correction card never folds. |
| `about.html` | The reviews title is wrapped in `.rv-intro`, with an empty `#rvScore` beside it. |
| `js/reviews.js` `renderGrid()` | If the page has `#rvScore`, the Google score header goes there instead of above the grid. Otherwise nothing changes. |
| `styles.css`, sub-page block | <ul><li>The first section's top padding is capped at 24 px (was 32).</li><li>Compact sub-page title; the margin rule is wrapped in `:where()`.</li><li>The `.svc-intro` row.</li><li>`.svc-toggles` and `.svc-more`.</li><li>Card density on sub-pages (`main .svc-card`): padding 1.1rem / 1.2rem, price line-height 1.2, tagline 1.5, checklist gap .32rem.</li><li>The About layout from 1000 px: the portrait is a 15rem column at the copy's height, the reviews section is transparent with 20 px top padding, and the reviews title and score share a row.</li></ul> |
| `styles.css`, `.svc-grid` | Three columns from 1000 px (was 820). This also applies to the home page; below 1000 px the cards stack, as on phones. |
| `styles.css`, other | `.faq-item summary` padding 1.25rem changed to 1.1rem. `.at-canvas` (≥820) is `clamp(320px, 100vh - 365px, 380px)`. `.svc-more summary` joins the "How it works" toggle's selectors. |
| `CLAUDE.md` | The "Sub-page fold" section: the acceptance test, the thin margins, and the lessons. The first-section padding line now says 24 px. |
| other `*.html` | Re-stamped `?v=` only, plus the `eNov6` merge. |

## Root causes
1. **Inner pages reused the home page's section headers.** The titles were 2.7 to 3rem across two or three lines, with section padding of 56 to 81 px meant for stacked home sections. On Services, 517 of the 790 px were spent before the first card began.
2. **On Services, the title and the tabs were stacked,** and the tabs row carried a 40 px margin. Beside the title, the add-ons button also took 160 px of width, which made the title three lines.
3. **The package cards were as tall as their longest checklist** (Full Interior has 8 items). The price row used the body's 1.6 line-height. The Full Exterior tagline ran to five lines because the card was 3 px too narrow.
4. **About stacked a 555 px tall 4:5 portrait,** then two 72 px section paddings (a 144 px empty band that read as the end of the page), then a centred reviews title, then the score on its own row. The score was at 1061 and the cards at 1152.
5. **A specificity collision:** `main > section:first-child .section-head` beat `.svc-intro .section-head` and added 26 px. It is fixed with `:where()`.
6. **At 820 to 999 px the cards were 230 px wide.** This came from the main session's orphan scan. It is fixed with the 1000 px breakpoint.

## Open decisions for the owner
- **Folded checklists on Services:** 2 to 4 items per card sit behind "N more included +". The brief allowed this. The home page still shows full lists.
- **The About portrait is cropped to a tall narrow strip** from 1000 px (`object-fit: cover`). The face stays centred. If the owner prefers the full 4:5 frame, the page can't meet the reviews target without moving the photo elsewhere.
- **Package cards stack below 1000 px** on home and Services. That is tidier than squeezed columns, but there is a lot of empty space at 820 to 999 px.
- **The margins are thin.** Services Exterior ends 4 px inside 720. A longer Full Exterior tagline, or a fifth visible item, breaks it.
- Sub-pages still have no `<h1>`. That is worth fixing for SEO, separately.

## How to test
1. `export PATH=/opt/homebrew/opt/node@22/bin:$PATH && npm run build`
2. `cd web && TZ=America/New_York npx vitest run` (409 of 409 pass).
3. Serve `dist/` with the cache disabled, and set the window to 1280×720, then to 1440×790:
   - **Services:** on both tabs, all three Book buttons are visible.
   - **Each Book button** opens the form with that package and its price. All six were checked over CDP: Basic Interior $125, Full Interior $215, Showroom Ready $395, Express Exterior $75, Basic Exterior $125, Full Exterior $245.
   - **"N more included +"** opens the rest of the list in the same style, and "How it works" moves to the next line.
4. **About:** the team, Book Now / Ask a Question, the reviews title with "5.0 ★★★★★ 32 Google reviews" beside it, and the names and stars of the first three review cards are all on one screen. There is no hard line across the portrait's shadow.
5. **FAQ:** six questions. **Range & Travel:** the map legend. **Contact:** Send.
6. **Narrow widths:**
   - At 900 px, the home and Services cards stack one per row.
   - At 375 and 320 px, there is no horizontal scroll, and About still has its tall photo on top.
