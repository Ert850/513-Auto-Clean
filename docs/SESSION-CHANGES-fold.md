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

---

# Round 2: toned back to a moderate step, plus Range & Travel

## What the owner said
Summarised from the owner's review, their screenshots (11, 12 and 13) and later messages:
1. **Services, top:** "unnecessarily dense in the top right." Put the tabs and "See all add-ons" back on their own row, under the title.
2. **Services, below the cards:** too much white space before Additionals, and the page didn't show that another section follows. Later: "The offer banner should be visible and it should clearly imply that add-ons are below … Keep the down arrow." The owner chose from three rendered options: **B, the whole banner** (`fold-shots/services-option-A/B/C.png`).
3. **About:** the headshot was too small and the text too dense; the reviews may be cut off more, but the score should stay in view. Later: "it is not clear … that there are more full text reviews below."
4. **Range & Travel:** "Indiana isn't even visible above the fold and a ton of content is now getting cut … properly redesign the lower half."
5. **Overall:** "a moderate step between previous and current."

## Before and after
Each value is the bottom, in page px, of the item. The fold is 790, 720 and 950. **Bold** means it now fits. "Before" is round 1, as merged into `eNov6` (4c1aad1).

| Page | Item | 1440×790 | 1280×720 | 1920×950 |
|---|---|---|---|---|
| Services, Interior | Book buttons | 699 → **670** | 692 → **662** | 699 → **670** |
| Services, Exterior | Book buttons | 724 → **694** | 716 → **687** | 724 → **694** |
| Services, Interior | Offers banner, whole | 845 ✗ → **773** | 837 ✗ → 765 ✗ | 845 → **773** |
| Services, Interior | Additionals heading | 1069 ✗ → 894 ✗ | 1046 ✗ → 885 ✗ | 1069 ✗ → **894** |
| About | Google 5.0 score | 672 → **716** | 626 → **705** | 672 → **716** |
| About | First review cards (top edge) | 688 → **732** | 642 → **721** (just under) | 688 → **732** |
| Range & Travel | Ohio / Kentucky / Indiana cards | 1259 / 1107 / 1259 ✗ → **509 / 618 / 720** | 1230 / 1078 / 1230 ✗ → **505 / 614 / 717** | ✗ → **509 / 618 / 720** |
| Range & Travel | Map legend | 737 → 757 (inside) | 708 → **708** | 737 → **757** |
| FAQ / Contact | Last question / Send | 695 / 689 (unchanged) | 691 / 689 | 695 / 689 |

There is no horizontal scroll at 1440, 1280, 1920, 820, 375 or 320.

Screenshots (2×) are in the side-session notes folder, under `fold-shots/`: `r2before-*` (round 1), `r2final-*` (this round), and `services-option-A/B/C.png` (the three renders the owner chose from).

## Services
| Round 1 | Round 2 | Why |
|---|---|---|
| Tabs and "See all add-ons" stacked at the top right, beside the title | The tabs row is back under the title, on the left | Owner: "unnecessarily dense". |
| "SERVICES & PRICING" eyebrow above the title | Removed on this page | Owner's pick (option B). The nav already says where you are, and it pays for part of the banner. |
| 4 checklist items, then "N more included" | 3, then "N more included" | Option B: it pays for the rest of the banner. Every item is still one click away, and the home page still lists them all. |
| Offers banner: 98 px tall, 1.8rem under the cards, below the screen | Compact (no rule between the offers), 0.6rem under the cards, with **"Add-ons for any package ↓"** on its right, the same arrow as "See all add-ons ↓" | Owner: the banner should be visible and say that add-ons follow. The first offer drops the repeated "when you book together", since it already starts with "Booking … together?". |
| The section's 72 px bottom padding plus Additionals' 72 px top padding | One gap: `main > #services` padding-bottom 28 to 40 px; `#addons` padding-top 0 | Root cause of the blank band (a false floor). Scoped with `main >` because the home page has its own `#services`. |

On phones, the banner's link goes on its own line under the offers. Without a flex-basis on the offers, the link stayed beside them and squeezed them to one word per line.

The Exterior tab has the full-width correction card under its three package cards, so its banner is a scroll away on that tab; the Book buttons still fit. At 1280×720 the banner ends 45 px below the screen; the owner's target for it was 1440×790.

## About
| Round 1 | Round 2 | Why |
|---|---|---|
| Portrait: a 15rem strip stretched to the copy's height | Its own 4:5 frame at 20rem (320 × 400) | Owner: too small. The original was 445 × 555. |
| Story at full column width, line-height 1.6, tight gaps | 40rem measure (about 75 characters a line), line-height 1.65, wider gaps around the promises and buttons | Owner: too dense. 45 to 75 characters a line is the usual comfortable range (WCAG 1.4.8: no more than 80). |
| Review cards fully in view (names and stars) | The first screen ends on the cards' top edges, with avatars and names showing | Owner accepted more cut-off for a calmer About; a partly shown card is the cue that full reviews follow. |

## Range & Travel: the lower half redesigned
**What a visitor needs, in order:**
1. "Do you come to me?", which means the three states, at a glance.
2. "What does it cost?": the estimator.
3. Only then, the full town lists.

The old layout answered these in the reverse order. Two cards of town names sat under the map, and Indiana started at 1259 px.

**Pattern:** service-area pages typically lead with the regions served and their main counties or cities, a map, and a lookup. The full town list (written for search) comes after or behind a disclosure, not as a wall above the fold.

**Layout:**
- From 820 px wide, the left column is 24rem: the estimator, then three compact state cards, then the fine print and buttons. The map and its legend fill the right.
- Each state card shows:
  - the state name;
  - its area codes;
  - its counties (Indiana, which has only six towns, shows the towns themselves);
  - "All 51 towns +" or "All 17 towns +", which opens the county-grouped list in the card's own type. The toggle uses the same style as "How it works".
- On phones the order is estimator, map, states, then extras.

**Kept:**
- all 74 towns, still in the HTML (closed, not removed), the same set as the `robots.txt` comment;
- the ids `#area-oh`, `#area-ky` and `#area-in` on the cards, for the footer links;
- the "Don't see your town? Just ask" line under the tool;
- the look: the same cards, pin icons, red area codes and dotted county rules.

**The map:**
- It is 20 px shorter on short screens (`clamp(320px, 100vh - 385px, 380px)`), so its legend, which now takes two rows in the narrower column, stays visible at 1280×720.
- **Bug fixed:** at that height Leaflet's `fitBounds` snapped from zoom 9 to 8 (whole levels only), and every dot shrank into a knot around Cincinnati. `zoomSnap: 0.25` in `js/travel.js` lets it land between levels.

**Removed:** the `.area-lists` layout rules, orphaned now that the cards live in `.at-states`.

## Root causes, round 2
1. **Two same-paper sections stacked both paddings** (72 + 72 px). That band read as the end of the page.
2. **The first screen ended on clean edges:** the card bottoms on Services, and the end of the team section on About. With nothing cut off, there was no sign that the page continues.
3. **Stacked margin inside the cards:** `main .svc-card .svc-how { margin-bottom: 1rem }` outranked `.svc-toggles > details { margin: 0 }`, adding 16 px to every folded card (always the tallest card in the row).
4. **Range & Travel listed every town before saying which states are covered,** in a separate block under a 380 px map.
5. **Leaflet snaps to whole zoom levels,** so a slightly shorter map dropped a full level.

## Files
| File | Change |
|---|---|
| `services.html` | <ul><li>The tabs row is back under the title.</li><li>The eyebrow is removed.</li><li>"See all add-ons" has a ↓ icon.</li></ul> |
| `web/scripts/render-site.mjs` | `FOLD_AT` is 3. With `fold` (services.html only), the banner's first offer is shorter and the `.svc-next` link is added. |
| `about.html` | Unchanged since round 1 (the `#rvScore` slot). |
| `service-area.html` | `.area-lists` is replaced by `.at-states`, inside `.areas-tool`, with compact state cards and "All N towns" disclosures. |
| `js/travel.js` | `zoomSnap: 0.25`. |
| `styles.css` | <ul><li>Services: intro spacing, the `#services` / `#addons` gap, the compact banner, `.svc-next`, the phone banner wrap, card padding and the toggle-margin fix.</li><li>About: the round-2 block.</li><li>Range & Travel: `.at-states`, the card rules, the grid areas, the map height and the area section-head margin.</li><li>`.area-more` joins the toggle selectors.</li></ul> |
| `CLAUDE.md` | The "Sub-page fold" section is updated: the owner's "too dense" rejection, ending the first screen on something cut off, the section-padding and margin-stacking rules, and the About and Range & Travel layouts. |

## How to test
1. `export PATH=/opt/homebrew/opt/node@22/bin:$PATH && npm run build`
2. `cd web && TZ=America/New_York npx vitest run` (409 of 409 pass).
3. Serve `dist/` with the cache disabled, in a 1440×790 window:
   - **Services:** on the first screen you see the title, the tabs row, three cards with Book buttons, and the whole pink banner with "Add-ons for any package ↓".
     - Click it, or "See all add-ons ↓": the page lands on Additionals just under the header.
     - All six Book buttons open the form with their package (checked over CDP).
     - "N more included +" opens the rest of the list.
   - **About:** a full-size portrait, an easy-to-read story, the buttons, the reviews title with the 5.0 score, and the tops of three review cards at the bottom of the screen.
   - **Range & Travel:**
     - The estimator, the Ohio, Kentucky and Indiana cards, and the map with its legend are all on the first screen, at 1280×720 too.
     - "All 51 towns +" opens the county lists.
     - The footer link "SE Indiana" lands on the Indiana card.
     - The map opens at the usual zoom, with the dots spread out.
4. **Phones:** at 375 and 320 px there is no horizontal scroll. The Services banner's link sits on its own line, and the Range & Travel order is estimator, map, states, extras.

## Open
- The **Exterior** tab's banner is a scroll away: the correction card sits between the packages and the banner.
- At **1280×720** the Services banner ends 45 px below the screen, and the About cards' top edge is 1 px below it.
- The Range & Travel intro is still three centred lines. Widening it to two would push lines past about 120 characters.
