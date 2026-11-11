# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

# 513 Auto Clean: project rules and lessons learned

Read this before changing anything. Every rule below came from a real bug or an owner decision. Add a line here, under the right heading, whenever you fix a bug whose cause could come back.

## Owner rules
- **Git:** push only to `eNov6`. Never push to `main` or open or merge PRs without the owner's approval. Parallel sessions commit to their own branch and never push.
- **Design:** keep the site's current look (colors, type, components in `styles.css`). Changes are cleanup and reorganization for conversion, not restyling.
- **Booking:** never break existing booking behavior. Check what the live site does first (`node web/scripts/check-live.mjs`, or step through the form without submitting). GoHighLevel runs *alongside* the current flow, not instead of it.
- **Wording:** for every change, ask whether the wording reflects the reality of the business. No em-dashes in anything a customer reads.
- **Tracking:** log every change, with what to test, in `docs/SESSION-CHANGES.md` (parallel sessions: `docs/SESSION-CHANGES-<topic>.md`). Each fixed bug gets its root cause written down.

## Build and test
- Node: `export PATH=/opt/homebrew/opt/node@22/bin:$PATH`. Build with `npm run build` at the root.
- Tests: `cd web && TZ=America/New_York npx vitest run`. 14 scheduling tests fail in any other timezone; that's a known issue in the tests, not a bug in the change.
- Generated, never hand-edited:
  - `CATALOG:*` regions: `SERVICES` (all package cards, the correction tiers, the offers banner) in both `index.html` and `services.html`; `OFFERS` in `index.html`; `ADDONS` in `services.html`; `FAQPRICE` in `faq.html` (source: `web/lib/catalog/`, `web/scripts/render-site.mjs`);
  - `TERMS:*` and `PRIVACY:*` regions (source: `web/lib/site/capabilities.ts`, `web/scripts/render-legal.mjs`);
  - `js/pricing.bundle.js`, `netlify/functions/_pricing.mjs`, `js/config.js`, `dist/`;
  - every `?v=` stamp;
  - everything between `CHROME:*` markers (source: `web/partials/`).
- If the legal wording changes, bump the date in `web/lib/site/legal.ts`, then run `npm run lock:legal`.

## Pages
- **Everything shared comes from ONE source, `web/partials/`:** `head.html` (config, Turnstile and analytics scripts), `header.html` (top bar, header, phone menu), `footer.html` (footer, phone bar) and `scripts.html` (the booking form's mount, `book.css`, fonts, the pricing bundle, `funnel.js`, `script.js`). `npm run build` (`web/scripts/render-chrome.mjs`) writes them into every page between `CHROME:HEAD|HEADER|FOOTER|SCRIPTS` markers. **Never edit those regions in a page; edit the partial and rebuild.** `chrome.test.ts` fails on drift, ignoring `?v=` stamps. Page-specific scripts (`gallery.js`, `reviews.js`, `travel.js`) go right after `CHROME:SCRIPTS:END`, so they run after the pricing bundle. **The booking form is on every page**, so Book Now (`{{book}}`) is `book.html` everywhere and opens in place. The five per-page values are derived in `web/scripts/chrome.mjs`. A new page gets all four marker pairs, is added to `CHROME_PAGES`, and gets everything else listed below.
- A new page has to be added to:
  - `FILES` in `web/scripts/build-dist.mjs`, or it is never published;
  - `PAGES` in `web/scripts/stamp-assets.mjs`;
  - `sitemap.xml`.
- A page whose Book buttons should open the booking form in place needs `<div id="bookFunnel" hidden>`, `book.css`, `js/vendors.js`, `js/pricing.bundle.js` and `js/funnel.js` (as on `index.html` and `services.html`), and its Book links must be `href="book.html"`, which the form intercepts. On pages without the form, Book links are `index.html#book`.
- **The home page keeps the full package cards** (the owner reverted a compact teaser: "it looked fine before"). `CATALOG:SERVICES` is rendered into both `index.html` and `services.html`. Ask before replacing an established section's look, even for a decided restructure.
- **Never link to a hidden element** (such as an inactive tab panel) without something that reveals it first.
- **One "How it works" style everywhere:** a small red toggle reading "How it works +" ("-" when open), and a grey panel with a 2 px left rule (`.svc-how`, `.ad-how`, `.svc-explain .how-body`). A new collapsible joins those selectors; it doesn't get its own look.
- **The question form (Contact Us, `#inquiry`) has its own page, `contact.html`.** Every Contact or Ask link is `contact.html`. The booking form's "ask a question" and "change my booking" carry what the person entered there via `sessionStorage` (`ac-question`, read once and deleted by `script.js`). The privacy policy says so; keep it true.
- **Nav names, in one order everywhere** (header, phone menu, footer Explore): Results, Services, Meet the Team, Reviews, Range & Travel, FAQ, Contact Us.
- **A two-column layout must give the wide column to the main content at every width it applies.** Reordering with `order` also changes which grid track an item lands in.
- When a section moves to another page, re-point the links *inside* it (`book.html` becomes `index.html#book`, `#inquiry` becomes `index.html#inquiry`).

## Scrolling and layout (bugs fixed November 9–10)
- **Never hard-code the sticky header's height.** `script.js` sets `scroll-padding-top` from `#header.offsetHeight`. A fixed 90 px against a 73 px header made every jump stop 17 px short.
- **No `scroll-behavior: smooth` on `html`.** It also animates arriving at `page.html#section` from another page: the page opened at the top and slid thousands of pixels. `script.js` glides in-page clicks itself.
- **Content that loads late moves anchors.** The gallery, the review ticker and the web fonts all grow the page after first paint. `script.js` `pinTo()` holds a jump's target for 2.5 s. New late-loading content above an anchor either reserves its space or relies on that hold.
- **Scrollable boxes show their scrollbar.** macOS hides scrollbars until you scroll, so a box that scrolls internally (an opened review) gives no sign that there's more. Style it with `::-webkit-scrollbar` (drawn permanently in Chrome, Edge and Safari), and **don't** set `scrollbar-width` or `scrollbar-color` on the same element: in Chrome 121+ they switch the WebKit styling off. Firefox gets those under `@supports (-moz-appearance: none)`.
- **No orphaned words.** Headings use `text-wrap: balance`; running text uses `text-wrap: pretty` (base rules next to the `h1–h4` rule in `styles.css`). Don't override them. Greedy wrapping left 156 single-word last lines across 6 pages × 6 widths, worse on wide screens, where heading size grows but `.section-head` stays 660 px. What's left after the fix (10 at 820 px) comes from cards too narrow for their checklist items. Fix the column count, not the text.
- **Rotating content gets a measured height, not a guessed one.** The reviews ticker used fixed rem heights (8.4 / 5.2) that wasted 4 to 31 px at every width. `js/reviews.js` `fitStage()` now measures the tallest review at the current width (again on resize and once fonts load). Do the same for any carousel or ticker.
- **A sub-page's first section doesn't get home-page section padding.** `main > section:first-child` caps the top padding at 24 px. The usual 56 to 81 px separates stacked home sections; under the header it pushed every title 60 to 90 px down and the Contact form off a laptop screen. **Check that the main content of each page fits a 1440×790 viewport** (a laptop browser window).
- **Anchor targets sit where the scroll should land:** `#top` is the first element in `<body>`, above the top bar.
- **Check the page's real width at 375 and 320 px**, not just for scrolling: compare `innerWidth` with the device width, and check `visualViewport.offsetTop`. A header 4 px too wide made phones zoom out, and every jump to a section landed about 9 px low, while `scrollWidth > innerWidth` still said everything was fine.
- **`.field input` (width 100%, padding, border, background) is for text boxes, but it matches radios and checkboxes inside `.field` too.** The contact pills' radios stretched to the full pill and pushed the words outside. Any control that isn't a text box, inside `.field`, needs `width: auto; padding: 0; border: 0; background: none`.
- **`.field label { display: block }` beats single-class component rules.** Any component built from `<label>`s inside `.field` (such as the `.pref` pills) has to restate its display, or it falls back to block and stacks.
- **Form rows align on their boxes (`align-items: end`).** A label that wraps must not push its input below its neighbour's.
- **The logo's spray trigger is black.** On dark backgrounds (the footer, the mobile menu) it sits on a light rounded tile (`.footer .brand .mark-img`, `.mobile-menu .brand .mark-img`). Any new dark placement needs the same tile.
- **`images/logo-mark.png` is mostly transparent**: the bottle fills only x 40–78 and y 18–93 of 120×120. Size it with `object-fit: cover` and a narrow width, not as a square.

## Service cards (bugs fixed November 10)
- **Cards are flex columns, so margins add instead of collapsing.** Two stacked margins (list 1.05rem + toggle .9rem) made a 31 px gap. And the last block above `.svc-foot { margin-top: auto }` needs its own bottom margin: in the tallest card of a row, `auto` is 0 and that block sits flush on the button.
- **`ul.feat` is the package checklist only.** `.svc-card ul.feat li { display: flex }` outranks lower-specificity list rules. Putting `feat` on the correction tier list split every tier into three squeezed columns.
- **No `flex-wrap` on an icon + text row.** The text's flex-basis is its full one-line width, so it always wraps onto a row of its own under the icon. Use `nowrap` and give the text `flex: 1; min-width: 0`.
- **A mobile-only rule written after a `min-width` media query overrides desktop too** (same specificity, later wins). Wrap it in `max-width: 819.98px`.

## Sub-page fold (fixed November 10, toned back in round 2)
- **The owner's acceptance test, at 1440×790** (a laptop window; 1280×720 and 1920×950 are checked too), with nothing scrolled:
  - Services: every visible package card's Book button, and the whole offers banner with its "Add-ons for any package ↓" link (owner's pick of three rendered options).
  - About: the 5.0 Google score, and the tops of the first review cards as the cue that the reviews follow.
  - Range & Travel: the estimator, the Ohio, Kentucky and Indiana cards, the map and its legend.
  - FAQ: every question.
  - Contact: the Send button.

  Measure with `fold.mjs` (side-session notes folder; serve `dist/` on your port) before and after any change above these.
- **Fitting is not the only goal: the owner rejected "too dense".** Round 1 put the Services tabs beside the title and shrank the About photo to a 15rem strip. The owner called the first "unnecessarily dense" and the second "too small". Fit the core content with a moderate amount of air; if it won't fit, say so rather than squeeze.
- **End the first screen on something cut off, not on a clean edge** (NN/g "illusion of completeness"). A screen that stopped just under the card bottoms, followed by a 144 px blank band, read as the end of the page twice.
- **Two adjacent sections on the same background must not both keep their full padding.** `#services` (72 px bottom) on top of `#addons` (72 px top) made the false floor. Sub-pages now use one gap (`main > #services + #addons { padding-top: 0 }`).
- **Check every margin inside a flex column for stacking.** `main .svc-card .svc-how { margin-bottom: 1rem }` outranked `.svc-toggles > details { margin: 0 }` and added 16 px to every folded card.
- **The margins are thin.** Book buttons sit about 25 to 40 px inside 790. Full Exterior's tagline fits four lines only because the card has 1.2rem side padding (at 1.4rem it ran five lines).
- **Sub-page titles are the compact size** (`main > section:first-child .section-head h2`, the size `.inq-head` set on Contact). Home-page section titles at 2.7rem took three lines and 140 px of a laptop screen.
- **Page-wide defaults on sub-pages go through `:where()`.** `main > section:first-child .section-head { margin-bottom }` outranked `.svc-intro .section-head { margin-bottom: 0 }` and quietly added 26 px under the Services title.
- **`index.html` has no `<main>`**, so `main …` rules reach the sub-pages only. The card density rules and the `#services` gap rules rely on that; the home page has its own `#services`.
- **On `services.html` a package checklist folds after 3 items** (`FOLD_AT`) behind "N more included", on one row with "How it works" (`render-site.mjs` `servicesHtml({ fold: true })`). The same option makes the banner compact and adds its add-ons link. The home page keeps the full lists and the old banner. A toggle that opens takes the full row (`.svc-toggles > details[open]`). The Services page has no eyebrow (owner's pick).
- **Range & Travel leads with the states, not the towns:**
  - Three compact cards (`.at-states`) sit under the estimator, in its left column: name, area codes, counties, and "All N towns +".
  - All 74 towns stay in the HTML. Keep `#area-oh`, `#area-ky` and `#area-in` on the cards; the footer links point there.
  - The map uses `zoomSnap: 0.25`: with whole zoom levels, a map 20 px shorter dropped from zoom 9 to 8.
- **Package cards go three across only from 1000 px.** At 820 px each card was 230 px wide, and three-word checklist items left one word alone on a line.
- **About from 1000 px:**
  - The portrait keeps its 4:5 frame at 20rem wide.
  - The story is held to 40rem (about 75 characters a line) at line-height 1.65.
  - `js/reviews.js` puts the Google score into `#rvScore`, beside the "Cincinnati keeps coming back." title.
  - `.reviews` is transparent there, because its background cut the portrait's shadow.

- **Round 3: show the lists where they fit, and ask before folding them.** The owner wants every package checklist visible wherever there is room: the growing lists show the price steps. The home page keeps full lists, with spacing trimmed only. On `services.html`, `script.js` opens every "N more included" and hides the toggles (`.svc-full`) on windows at least 1000 × 900 px; below that height the fold stays. If a card grows, re-measure that 900 px threshold: with full lists the banner must end inside it.
- **Home page rules use `body > #services` / `body > #quote`.** The sub-pages wrap their sections in `<main>`, and the home page has its own `#services`. The hero and the trust bar are the owner's first screen; leave them alone unless asked.
- **When the owner must choose between layouts, render the options** as real screenshots of the page, with the changes injected in headless Chrome (see `fold-shots/*option*`). They pick quickly and precisely from images, and the pick is logged.

- **The Google rating is in two places on the home page:** the hero pill (`.hero-badge .hb-text`) and the trust badge (`#google-badge .g-text`). Both use the same words, the build stamps both from `data/reviews.json` (the `Rated … from N reviews on Google` regex in `render-site.mjs`), and `js/reviews.js` `syncBadges()` updates both. A new copy of the rating needs all three, or it will drift.
- **The hero has one solid button (Book Now).** View Services and Contact Us are `btn-ghost on-dark`; on phones they share a row. Don't bring back `btn-light` there.

## Results carousel (built November 10)
- **No `.reveal` on anything inside a sideways track.** A card parked off to the side never intersects the viewport, so it stays invisible and fades up late when it slides in. Put `.reveal` on the carousel.
- **No hover pause on the carousel** (the owner found it non-intuitive: the sweep kept freezing as the mouse crossed the photos). Clicks, drags, the chevrons, the dots and keyboard focus on a handle take over.
- **The play button is the state.** Anything that pauses the carousel shows Play on it; anything that restarts it (idle timer, scrolling back into view) shows Pause again. Never keep a hidden "held" flag that the button doesn't show.
- **Animate the handle with `transform` and `opacity` only, from one `requestAnimationFrame` loop over a fixed timeline.** `left` and `clip-path` per frame meant layout and a repaint of the photo every frame. Timers between phases, and waiting for photos mid-run, showed up as stutters and pauses. Fetch the next view's photos a whole sweep ahead.
- **A stopped sweep puts its handles back in the middle**, and while it runs the handle and the label of the hidden side fade out near the edges. A half-clipped knob with a "Before" label over the after photo looked broken in a screenshot.
- **Every card in view wipes on one shared clock, in a 6 s cycle (owner's decision, November 10: "much faster, less time on the before and more focus on the after", "sync the wiper anims").** 1 s still in the middle, 1 s to the right edge (the before), 1 s to the left edge (the after), 2 s still on the after, then 1 s in which the track moves on by 1 card (2 when 3 are in view) while every handle glides back to the middle. The `WIPE`, `RETURN_MS` and `SLIDE_MS` constants in `js/gallery.js` and the `.ba-track` transition (1s) in `styles.css` make up that timeline; change them together. This replaces the earlier staggered, own-clock wipes (3 s rest, cards 2.5 s apart, about 15 s a cycle). Don't bring the stagger or the long cycle back without the owner.
- **The right edge shows the before, the left edge the after** (`--pos` is how much of the before is showing). So "right, then left" ends on the after.
- **The track and the handles' return share one start.** The shift begins on the same frame as the return, from the one `requestAnimationFrame` loop. A separate timer for the track brought the handles home at random moments and cut off restarted wipes.
- **Start each wipe cycle as one group and wait for the whole group's photos.** Per-card photo waits let some cards start before others whenever one was still loading (after a jump back, or on a slow connection), which breaks the sync.
- **The endless loop rearranges the real cards; it never clones them** (as Swiper 9+ and Embla do). Clones would duplicate every photo and every focusable handle. It needs at least twice as many comparisons as are in view to slide smoothly.
- **Focus pauses only when it is keyboard focus** (`:focus-visible`). A clicked button keeps focus, so a focus pause would stop the carousel for good after one click.
- **Lazy images in a sideways track never load early enough.** Switch the next card's images to `loading = 'eager'` just before it is shown, and wait for them before animating.
- **How many cards are in view lives in CSS** (`--ba-per` on `.ba-track`, read by `js/gallery.js`), alongside the `sizes` attribute in `js/gallery.js`. Change all three together.
- **Pause from the visitor is final**: only their Play restarts it. A pause from a touch (click, drag, chevron, dot, keyboard focus) ends on its own after 12 s idle or when the carousel is scrolled away and back. Off screen and a hidden tab only suspend it.

## Live calendars (November 11)
- **Never edit an event on a calendar the live site reads (513 Auto Clean, 513 Availability) without first running the live site's own code (`main`) against the change.** Splitting the OPEN block into touching blocks looked safe because `mergeIntervals` joins them, but two other places did not: `computeSlots` read each block start as the start of a day (a 10am start straight after a job ending at 10am), and `multiDay.ts` `covered()` needed one block to cover a whole day (no two-day jobs). Fixed in the pipeline; `main` still has both.
- **Fee blocks sit over a plain OPEN day, set to Free,** on any calendar `main` reads: one Busy `OPEN` for the hours, `OPEN +20%` blocks over it marked Free. `main` drops Free events; the pipeline counts OPEN whether Busy or Free and takes the higher fee where blocks overlap.

## Colors (fixed November 10)
- **Red means the brand and "that did not work", nothing else.** A price or any good answer is ink (`--text`). The travel fee in `--red` looked exactly like the error message under it. One exception, the owner's call: the dearest band on the travel map is red (next rule).
- **Changing a section's background means re-checking every color in it.** Colors picked on a dark band (red accents, white rings, a red top band on a traffic-light scale) changed meaning on paper.
- **The travel map is a traffic light, by the owner's decision (November 10):** green, light green, amber, orange, red (`#2f9e5e #7cb342 #f0a93f #ec6d2a #c62828`).
  - He tried a one-hue amber-to-brown ramp and rejected it: the top bands were hard to tell apart, while orange next to red reads at a glance.
  - Its known weak spot: the two greens are close for red-green colour blindness, so the legend and the popups always carry the amounts.
  - Don't change it back to one hue. Any other ordered scale: one hue, light to dark, checked with the dataviz validator (`validate_palette.js --ordinal`).
- **A legend key is drawn exactly like the mark it explains.** Travel fee colors live only in `BANDS` in `js/travel.js`; map dots are solid (`fillOpacity: 1`) and every key or dot in the page uses `.tmap-key i, .sg-dot, .fee-dot` (18px, 2px white ring = Leaflet radius 8, weight 2).

- **The time picker's "Standard price" is green (owner, November 11)**, a second exception to "a good answer is ink". Times themselves are white rows like the recommended-time cards, with no ticks and no green fill. A fee is gold. The price is said once per stretch of the same price (`stretchStarts` in `week.ts`), not on every row.

## Booking form time picker (rebuilt November 11)
- **No `<section>` inside the booking form.** `styles.css` gives every `section` 40 to 72 px of padding, so wrapping the phone list's part-of-day groups in `<section>` opened 40 and 80 px gaps. Use a `div` (with `role="group"` where it groups).
- **A heading that stays pinned while its items show is `position: sticky` inside a wrapper holding only its group.** It leaves with the wrapper. When other bars are pinned above it, measure their heights (`pinWeek()` sets `--wk-h`, `--wk-strip`); never guess them.
- **Phones (window under 768 px) show the day's list; tablets and up show one day as half-hour rows** (owner's picks B and C). Decide by the window (`phoneView()`), not the form: the form is at most 680 px on any big screen, so its width can't tell a big phone from a laptop, and a 520 px form-width line sent 540 to 600 px phones the laptop design.
- **No dead grey rows on the timeline** (owner, November 11). Rows run from the first time shown to the end of the last one's job (`timelineRange`). Grey hatching is only a gap between two times. The rows after the last start are that job's tail, drawn empty with a faded hour, never as times: offering the late times that fall in a tail grew the rows again, until "Later times" never folded.
- **A pinned bar's height can change after it is measured** (a web font wrapping a line at 320 px). Re-measure with a `ResizeObserver`.

## Verifying UI changes
- **The in-app browser pane, when hidden, does not run smooth scrolling or the browser's own jump-to-section on page load.** Don't trust scroll measurements from it. Drive headless Chrome over CDP with real mouse events instead (the nav click checker lives in the session scratchpad).
- **Disable the browser cache, or add a query string, when testing a rebuilt `dist/`.** A cached `index.html` keeps loading the old scripts. Two test runs were wasted on stale pages.
- **A full-page CDP capture (`captureBeyondViewport`) is not what a visitor sees.** It drew the fixed mobile bar over the middle of the map, showed untiled grey maps and dropped the Check button. Confirm anything odd with a plain viewport screenshot after scrolling to it.
- **Never serve the owner's preview straight from `dist/`, and never stop the preview server to rebuild.** `build-dist.mjs` deletes `dist/` and copies images last, so a page loaded mid-build gets everything but the photos. That's how the owner saw a broken hero (alt text and a `?` icon) on the local demo. Serve a separate preview folder by path, and after a build passes, swap a fresh copy in with a rename (copy to `preview.new`, then `mv`). The server keeps running. Production is unaffected: Netlify publishes each deploy atomically.
- **The demo server must send `Cache-Control: no-store`** (`demo-server.py` in the session scratchpad, not plain `python3 -m http.server`). The plain server sends no cache rules and compares file times only to the second. A photo fetched mid-copy stayed cut short in the owner's browser and kept showing as broken after the files were fixed.
- **Check Safari's engine on screen, not offscreen.** A WebKit view in a window that's never shown paints no images and pauses CSS animations (a grey hero, no text: a false alarm). Headless Chrome's `--window-size` can't go below about 500 px, so use CDP device emulation for 375 and 320.
- **Parallel sessions each use their own preview port** (main session 8799; give each other session its own, e.g. 8790, 8791). Two sessions on 8765 stopped each other's servers and mixed one session's files into another's test run.
- **Hide a separator together with the item it separates.** The footer's "Analytics choices" link was hidden (no analytics ids) but its "·" stayed, which showed as "· ·". The link and its leading dot are now one hidden `<span data-analytics-choices>`.
- **Background tabs throttle smooth scrolling.** A parallel (multi-tab) click check reported in-page smooth-scroll clicks as hundreds of px off; the same clicks in a foreground tab landed exactly. Run parallel checks for cross-page and instant jumps, and re-check in-page smooth scrolls in one foreground tab. Print results as they happen: a check that only writes at the end loses everything if it's interrupted.
- Check at 1440, 820 and 375 px wide: no horizontal scroll, and nothing overlaps the mobile bar.
