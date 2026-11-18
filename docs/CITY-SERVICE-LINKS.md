# Links to the city and service pages: options, November 18, 2026

**Built: option C (both), owner's pick, November 18.** `web/scripts/page-links.mjs` writes every link. It's checked with all four drafts published in a local build:
- each page is linked from 12 pages;
- at 1440×790 the Services Book buttons are at 698 px and the Indiana card ends at 747 px, as mocked up;
- nothing scrolls sideways at 1440, 820, 375 or 320.

**How each spot reads its settings:** a service page names what it explains in its config (`"explains": { "tab": "interior" | "exterior" }` or `{ "addon": "<id>" }`, plus `"link"`, the link's words). A city page's state comes from its `areaServed`.

**From 820 to 999 px** the footer keeps its 4 columns, so "Get in Touch" wraps under the logo. The mockup didn't show this width; a screenshot went to Emmett on November 18.

**Not visible in the mockup, decided in the build:** while the Exterior tab is open, the Interior link keeps its space on wide screens, so "See all add-ons" doesn't jump sideways.

**Mockups:** `docs/mockups/eNov18-city-service-links.png`. They're real screenshots of the eNov14 build at 1440 and 375 px, with each option injected in headless Chrome, as if all four draft pages were published.

## Why this is needed

- **The audit's notice:** Imperion's audit flagged pages that only one other page links to (`IMPERION-AUDIT-2026-11-18.md`). The main pages are fixed by giving each one a single address: they're in every page's header and footer.
- **The new pages have few links:** the two city pages and the two service pages are only linked from what their generators write:

  | Page | Linked from today (once published) |
  |---|---|
  | A city page | the City guides list on Range & Travel; nearby cities (none yet: Delhi and Indian Hill are on opposite sides); the service pages' "We come to you anywhere in our service area, including..." |
  | A service page | the city pages' "what we do" links only |

- **The build now enforces a minimum:** it fails if a published page is linked from fewer than 2 other pages. Before option C, publishing one city page alone, or any service page before a city page, would have failed. With the footer, any page passes.

**Bug found while mocking up:**
- **What happens:** the City guides list that `render-locations.mjs` already writes into Range & Travel has no place in that page's grid, so the browser puts it after everything else. That's at the bottom of the left column on a laptop, and below "Get an exact quote" on a phone (see the "As built today" panels).
- **Why no one has seen it:** no city page is published yet.
- **Fix:** option B for cities.

## The options

**A. Footer links on every page** (every page with the shared footer: all but Privacy, Terms and 404, which keep their short footers).
- **What changes:**
  - a "Detailing" column lists the published service pages;
  - the published city guides go at the top of "Service Areas".
- **Effect:**
  - every page links to every published page, so the 2-page minimum is always met;
  - the footer grid goes from 4 to 5 columns from 1000 px; on phones the footer gets 2 to 4 lines longer.
- **Fold:** no change.
- **The footer's existing area links stay:** "West Chester / Mason" and "Florence / Covington" still point to the state cards.

**B. Links in context.**
- **Services page:**
  - "About interior detailing →" in the tab row, beside "See all add-ons", shown on the Interior tab only;
  - "More on stains and odors →" on the Stain Treatment add-on card.
  - **Fold (1440×790):** the Book buttons stay at 698 px, unchanged. On phones they move 39 px down.
- **Range & Travel:**
  - each state's card lists its published city guides ("City guides: Delhi & Price Hill · Indian Hill & Madeira" in Ohio);
  - this replaces the misplaced list described above.
  - **Fold (1440×790):** the Indiana card ends at 747 px instead of 720, still in view, and the map legend doesn't move.
- **Effect:** links where people are deciding, which also tells search engines what each page is about.
  - With all four pages published: cities have 3 linking pages and service pages have 3.
  - With only one city and one service page, the service page has 2 and the city has 2.

**C. Both A and B.**

## Recommendation

**C, both:**
- **A** guarantees the minimum for every future page, with no fold cost.
- **B for cities** is needed anyway, because the City guides list as built lands in the wrong place.
- **B for services** gives the links people would actually click when choosing a package.

**What each one needs to build:** each is generated from `config/locations/` and `config/services/` (published pages only), so a new page needs no edits elsewhere.
- **A:** the footer partial gets two lists that `chrome.mjs` fills.
- **B, cities:** `render-locations.mjs` writes into each state card instead of after the tool.
- **B, services:** each `config/services/*.json` names the package tab or add-on it explains.

**Wording:** the link text is the page names from config, or plain phrases: no prices and no promises.

**Questions:**
- A, B or C?
- For B's Services link: one line per tab when there's a page for it (exterior has none yet), or interior only?
