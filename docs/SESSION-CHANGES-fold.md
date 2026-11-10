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

---

# Round 3: the home page below the hero, and Services' full lists on tall screens

## What the owner said
- **Main session, from the owner:** "Trim vertical whitespace on the home page … Services and pricing needs the most help, as you can show key conversion items paired on the same screen."
- **The owner, directly:** "trim vert whitespace on the lower segments while preserving the main above the fold section." The hero is untouched: at 1440×790 it already ends with the dark trust bar showing at the bottom, which is the scroll cue.
- **Home Services:** I rendered three options (`fold-shots/home-services-option-1/2/3.png`). The owner chose **whitespace only**: "it keeps the visible increase in services as price increase instead of hiding behind popup / extension buttons." So the home cards keep every checklist item.
- **Services page (owner, with a sample screenshot):** "At sufficient screen sizes the subpage with services can … render without the show more included option," with less space between the offers and the Additionals heading.

## Home page: before and after
"Jump" is the view after clicking Services in the nav, which lands the section under the 73 px header. Values are the bottom edge, in viewport px, of each item.

| Item | 1440×790 | 1280×720 | 1920×950 |
|---|---|---|---|
| Services section height | 1169 → **895** | 1153 → **888** | 1169 → **898** |
| Gap from the Results band to Services content | 128 → **82** | 116 → **75** | 128 → **84** |
| Gap from Services content to the booking band | 144 → **103** | 128 → **92** | 144 → **104** |
| Jump: title block ends | 380 → **282** | 372 → **279** | 380 → **284** |
| Jump: tabs | 476 → **352** | 467 → **348** | 476 → **354** |
| Jump: prices | 616 → **448** | 607 → **445** | 616 → **450** |
| Jump: Book buttons | 1019 ✗ → 826 ✗ (36 px short) | 1010 ✗ → 822 ✗ | 1018 ✗ → **828** ✓ |
| Jump: offers banner | 1171 ✗ → 929 ✗ | 1162 ✗ → 925 ✗ | 1170 ✗ → **931** ✓ |

On a 1440×900 or 1536×864 window, the jump shows the Book buttons (826 and 828) and most of the banner (929 and 930).

The hero, the trust bar, the review ticker and the Results band are unchanged. Phones (375 and 320) have no horizontal scroll; the home Services section is 2225 → 1959 px tall at 375.

Screenshots (2×), in `fold-shots/`: `r3before-home-services-jump-*` (before), `r3-home-services-jump-*` (after), and `home-services-option-1/2/3.png` (the options).

**Rules applied** (from rounds 1 and 2):
- One gap between bands, not two stacked paddings.
- The title block runs wider, so the title and intro take two lines each, not three. That is a change of measure, not of type size: the home title keeps its 2.7rem.
- Card spacing is set by line height and margins; no text was shrunk.
- The compact offers banner: no rule between the two offers, and less padding.

## Services page: full lists on tall screens
- **On a window at least 1000 px wide and 900 px tall,** `script.js` opens every "N more included" and adds `.svc-full` to `<html>`, which hides the toggles. Every inclusion then reads as one list, as in the owner's sample.
  - The threshold is measured: with full lists, the Interior banner ends at 898 px and the Additionals label at about 950 px.
- **Below that height** (1440×790, 1280×720), the round-2 fold stays: 3 items, then "N more included +".
- **The gap under the banner is one gap:** `main > #services` bottom padding is 16 to 24 px (it was 28 to 40). On a 1920×1000 window the "ADDITIONALS / Add-ons for any package." heading shows under the banner (`fold-shots/r3-services-full-1920x1000.png`).

## Files
| File | Change |
|---|---|
| `styles.css` | <ul><li>`body > #services` (home only) padding, title-block measure and margins, tabs gap.</li><li>The card density rules now cover the home cards too, adding `body > #services`, which matches only the home page; `.svc-how` margin is .4rem 0 .85rem.</li><li>The compact banner also applies to home.</li><li>`body > #quote` padding is 40 to 64 px.</li><li>`.svc-full` rules.</li><li>`main > #services` bottom padding.</li></ul> |
| `script.js` | `syncFold()`: a media query (`min-width: 1000px` and `min-height: 900px`) opens the `.svc-more` lists and sets `.svc-full`. |
| `CLAUDE.md` | Round 3 lessons. |

Not touched:
- the header and footer (`web/partials/`, `CHROME:*`);
- the hero markup and the hero image CSS;
- the Results carousel's JS, and all gallery CSS, including its outer spacing.

## How to test
1. `export PATH=/opt/homebrew/opt/node@22/bin:$PATH && npm run build`, then `cd web && TZ=America/New_York npx vitest run` (416 of 416 pass).
2. **Home page:** click "Services" in the nav. On a desktop window (1920×950) you see the title, the tabs, three cards with every checklist item and their Book buttons, and the whole offers banner. Every gap between bands is one gap.
3. **Services page:**
   - In a tall window (1920×1000) there are no "N more included" toggles: all items show, and the Additionals heading is under the banner.
   - Shrink the window below 900 px tall and the toggles come back. Make it taller again and they open.
   - All Book buttons open the form with their package.
4. **Phones:** at 375 and 320 px there is no horizontal scroll, and the home and Services cards stack.

## Open
- At **1440×790** and **1280×720**, the home Services jump shows the title, tabs, prices and full checklists, but the Book buttons sit 36 px (1440×790) or about 100 px (1280×720) below the screen. That is the cost of keeping every checklist item visible, which the owner chose.

---

# Round 4: home first-screen review (suggestions only)

The home page's unscrolled first screen, reviewed on `eNov6` at 3ef01d2 and served from a swapped preview folder (not `dist/`). **No site files were changed;** this section is the only commit. The hero image loaded at every size (1600w WebP on desktop, 960w on a phone).

## Measurements
Each value is the viewport y-coordinate (px) where the element ends. ✓ means fully on the first screen; "part" means it is cut by the bottom edge.

| | 1440×790 | 1280×720 | 1920×950 | 1470×830 | 1512×860 | 375×812 |
|---|---|---|---|---|---|---|
| Header ends | 113 | 113 | 113 | 113 | 113 | 113 |
| Hero badge ("Mobile detailing across Greater Cincinnati") | 216 ✓ | 211 ✓ | 229 ✓ | 219 ✓ | 222 ✓ | 218 ✓ |
| Headline (lines) | 492 ✓ (3) | 487 ✓ (3) | 505 ✓ (3) | 495 ✓ (3) | 498 ✓ (3) | 423 ✓ (4) |
| Sub-copy | 597 ✓ | 592 ✓ | 610 ✓ | 601 ✓ | 603 ✓ | 570 ✓ |
| Book Now / View Services / Contact Us | 679 ✓ (one row) | 673 ✓ | 691 ✓ | 682 ✓ | 684 ✓ | 651 / 725 / 799 ✓ (stacked) |
| Scroll cue (mouse icon) | 737 ✓ | 726, 6 px cut | 763 ✓ | 744 ✓ | 749 ✓ | not shown below 960 px |
| Hero ends / trust strip starts | 759 | 748 (below) | 785 | 766 | 771 | 882 (below) |
| Google badge | 852, 9 px visible | below | 878 ✓ | 859, half | 864, nearly | below |
| Four promises | below | below | 872 ✓ | 1st row ✓ | both rows ✓ | below |
| Reviews ticker | below | below | 50 px visible | below | below | below |

No horizontal scroll at any size. Screenshots (2×): `fold-shots/r4-home-first-*.png`.

## Is any change necessary? No.
Judged against the rules from rounds 1 to 3:
- **First-screen priorities:** what (detailing), where (Cincinnati), how (they come to you), who (a UC student-owned team) and the primary action (Book Now) are fully visible at all six sizes, with nothing overlapping.
- **False floor:**
  - From 1440×790 up, the screen ends on the dark trust strip's top edge, with the scroll icon above it: a clear cue that the page goes on.
  - At 1280×720 and on a phone, the hero photo runs off the bottom edge. A cut-off image is itself a continuation cue, so nothing reads as the end of the page.
- **Laptop windows:** all six sizes show the full pitch and all three buttons.
- **Density:** the headline is large (252 px, three lines, about a third of a 790 px screen), but it is the page's signature, and the owner asked to keep the hero.

The first screen does its job. The suggestions below are improvements, not fixes.

## Suggested improvements, ranked by impact and effort
Mock renders, made by injecting changes in headless Chrome only, are in `fold-shots/r4-mock-*.png`.

**1. Put the Google rating in the hero badge.** *(Impact high, effort low.)*
- **What:** replace the pill's text with "★★★★★ Rated 5.0 from 32 reviews on Google & Yelp" (`r4-mock-A-1440x790.png`).
- **Rule:** social proof at the point of decision, and first-screen priorities.
- **Gain:** the strongest proof would be on the first screen at all six sizes. Today it is fully visible only at 1920×950, partly at 1470 and 1512, and not at all at 1440×790, 1280×720 or on a phone. It costs 0 px on desktop.
- **Work:** the pill's text; one more selector in `js/reviews.js` `syncBadges()` so the count stays live; and the build's rating stamp (`render-site.mjs`).
- **Risks:**
  - The rating would appear twice in a row (the hero, then the trust strip below).
  - The "Mobile detailing across Greater Cincinnati" line goes, though the top bar ("Mobile detailing • We come to you") and the headline still say it.
  - On a phone the pill wraps to two lines (+22 px), pushing Contact Us 9 px below an 812 px screen, unless it's paired with suggestion 2.

**2. One primary button; the other two are secondary.** *(Impact medium, effort low.)*
- **What:** "View Services" and "Contact Us" become outlined buttons on the photo (the existing `.btn-ghost.on-dark` look, with a light tint behind them). On phones they share one row under a full-width Book Now (`r4-mock-B-375x812.png`; desktop in `r4-mock-ABC-1280x720.png`).
- **Rule:** one primary call to action per screen; competing equal-weight buttons cause hesitation.
- **Gain:** Book Now becomes the only solid button. On a phone the buttons take 74 px less: the hero ends at 808 instead of 882, and all three buttons end by 725.
- **Risks:**
  - The two white buttons are part of the current look.
  - Outlined buttons need enough contrast where the photo is bright. They read well in the renders, but check this on a real phone.

**3. A slightly shorter hero on short windows.** *(Impact low to medium, effort low.)*
- **What:** `.hero` padding becomes `clamp(32px, 5vh, 84px)`, down from `clamp(48px, 8vh, 84px)` (`r4-mock-C-*`).
- **Rule:** end the first screen on something cut off, with the next band in view.
- **Gain:** at 1280×720 the hero ends at 705, not 748, so the trust strip's edge shows. At 1470×830 the whole Google badge shows (it ends at 809). Taller screens don't change.
- **Risk:** on short windows the scroll icon then overlaps the bottom of the buttons (visible in `r4-mock-ABC-1280x720.png`). It would need hiding below about 760 px of height. It also touches the hero, which the owner asked to keep.

**4. Not recommended: a smaller headline.**
Setting it in two lines on desktop would save about 84 px and bring the whole trust strip onto a 1440×790 screen. But it is the hero's signature look, and the owner asked to preserve it.

If only one is done, do **1**: it adds no height and puts the 5.0 rating on every first screen. **1 + 2** together keep phones tidy.

---

# Round 5: the Google rating in the hero, and one primary button

The owner approved suggestions 1 and 2 from Round 4: first directly ("Do 1 and 2"), then through the main session. The changes were committed as ea0b030 and merged with `eNov6` at 9781daf. Suggestion 3 (a shorter hero) is **not** approved, so the hero's headline, photo, padding and scroll cue are unchanged. The trust strip keeps its Google badge.


| File | Change |
|---|---|
| `index.html` (hero only) | <ul><li>The pill reads "★★★★★ Rated 5.0 from 32 reviews on Google & Yelp" (`.hb-stars`, `.hb-text`), replacing "Mobile detailing across Greater Cincinnati" and its pulsing dot.</li><li>View Services and Contact Us use `btn-ghost on-dark` instead of `btn-light`.</li><li>The hero `<picture>`/`<img>` is untouched.</li></ul> |
| `js/reviews.js` `syncBadges()` | Updates `#google-badge .g-text` and `.hero-badge .hb-text` together, so the count stays live in both places. The build's existing stamp (`Rated … from N reviews on Google`) already covers both. |
| `styles.css` | <ul><li>`.hero-badge .hb-stars` (amber).</li><li>`.hero-cta .btn-ghost.on-dark` gets a light tint behind it.</li><li>Below 560 px, Book Now is full width and the two outlined buttons share a row.</li><li>Removed, now unused: `.hero-badge .dot`, `@keyframes pulse`, `.btn-light`.</li></ul> |

**After** (before: `fold-shots/r4-home-first-*.png`; after: `fold-shots/r5-home-first-*.png`):

| | 1440×790 | 1280×720 | 1920×950 | 1470×830 | 1512×860 | 375×812 | 320×640 |
|---|---|---|---|---|---|---|---|
| Rating pill | 216 ✓ | 211 ✓ | 229 ✓ | 219 ✓ | 222 ✓ | 240 ✓ (2 lines) | 226 ✓ (2 lines) |
| Buttons end | 679 ✓ | 673 ✓ | 691 ✓ | 682 ✓ | 684 ✓ | 747 ✓ (was 799) | 733 (Book Now cut at 659) |

- **Desktop:** positions are unchanged (0 px). The rating is now on every first screen.
- **375 px phone:** the three buttons take 74 px less.
- **320×640:** the smallest phone shows the rating, headline and sub-copy, with Book Now just under the edge. The old two-line pill did the same.
- **Checks:** no horizontal scroll at any size (at 320 the two outlined buttons are 157 + 136 px, with no overflow). 416/416 tests pass.

Screenshots (2×): `fold-shots/r4done-home-first-*.png`.

**Verification after merging `eNov6`:**
- **The build stamp covers both texts and is safe to re-run.**
  - `web/scripts/render-site.mjs` replaces `/Rated [0-9.]+ from \d+ reviews on Google/g` across the pages. In `index.html` it now matches twice, the pill and the trust badge, both set from `data/reviews.json` (5.0, 32).
  - A simulated 4.9 and 33 stamp changes both texts. A second run changes nothing (no double replacement).
- **The live sync updates both.** In a test copy where `data/reviews.json` said 33 and the stamped HTML said 32, the page showed "Rated 5.0 from 33 reviews on Google & Yelp" in both the pill and the trust badge after `js/reviews.js` ran.
- **Buttons:**
  - View Services (`data-book-browse`) opens the booking form's browse view.
  - Contact Us is still `contact.html`.
  - Book Now still goes to `#quote`, its existing destination on the home page ("Let's get your car booked", where "Start My Booking" opens the form).
- **Phone hero height:** 882 → **830 px** at 375 (52 px shorter). The button row saves 74 px, and the pill takes back 22 because the rating text wraps to two lines on a phone.
- **Checks:** no horizontal scroll at 375 or 320. 416/416 tests pass.
