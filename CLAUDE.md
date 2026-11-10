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
  - every `?v=` stamp.
- If the legal wording changes, bump the date in `web/lib/site/legal.ts`, then run `npm run lock:legal`.

## Pages
- `index.html`, `services.html`, `about.html`, `service-area.html` and `faq.html` share a header, mobile menu, footer and mobile bar, **copied into each file**. A change to any of them goes into all five.
- A new page has to be added to:
  - `FILES` in `web/scripts/build-dist.mjs`, or it is never published;
  - `PAGES` in `web/scripts/stamp-assets.mjs`;
  - `sitemap.xml`.
  It must also load `js/config.js` and `js/analytics.js`.
- A page whose Book buttons should open the booking form in place needs `<div id="bookFunnel" hidden>`, `book.css`, `js/vendors.js`, `js/pricing.bundle.js` and `js/funnel.js` (as on `index.html` and `services.html`), and its Book links must be `href="book.html"`, which the form intercepts. On pages without the form, Book links are `index.html#book`.
- **The home page keeps the full package cards** (the owner reverted a compact teaser: "it looked fine before"). `CATALOG:SERVICES` is rendered into both `index.html` and `services.html`. Ask before replacing an established section's look, even for a decided restructure.
- **Never link to a hidden element** (such as an inactive tab panel) without something that reveals it first.
- **One "How it works" style everywhere:** a small red toggle reading "How it works +" ("-" when open), and a grey panel with a 2 px left rule (`.svc-how`, `.ad-how`, `.svc-explain .how-body`). A new collapsible joins those selectors; it doesn't get its own look.
- **The question form (Contact Us, `#inquiry`) lives on `faq.html`.** Every Contact link is `faq.html#inquiry`. The booking form's "ask a question" and "change my booking" carry what the person entered there via `sessionStorage` (`ac-question`, read once and deleted by `script.js`). The privacy policy says so; keep it true.
- **Nav names, in one order everywhere** (header, phone menu, footer Explore): Results, Services, Meet the Team, Reviews, Range & Travel, FAQ, Contact Us.
- **A two-column layout must give the wide column to the main content at every width it applies.** Reordering with `order` also changes which grid track an item lands in.
- When a section moves to another page, re-point the links *inside* it (`book.html` becomes `index.html#book`, `#inquiry` becomes `index.html#inquiry`).

## Scrolling and layout (bugs fixed November 9–10)
- **Never hard-code the sticky header's height.** `script.js` sets `scroll-padding-top` from `#header.offsetHeight`. A fixed 90 px against a 73 px header made every jump stop 17 px short.
- **No `scroll-behavior: smooth` on `html`.** It also animates arriving at `page.html#section` from another page: the page opened at the top and slid thousands of pixels. `script.js` glides in-page clicks itself.
- **Content that loads late moves anchors.** The gallery, the review ticker and the web fonts all grow the page after first paint. `script.js` `pinTo()` holds a jump's target for 2.5 s. New late-loading content above an anchor either reserves its space or relies on that hold.
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

## Colors (fixed November 10)
- **Red means the brand and "that did not work", nothing else.** A price or any good answer is ink (`--text`). The travel fee in `--red` looked exactly like the error message under it.
- **Changing a section's background means re-checking every color in it.** Colors picked on a dark band (red accents, white rings, a red top band on a traffic-light scale) changed meaning on paper.
- **An ordered scale is one hue, light to dark, not a traffic light.** Check it with the dataviz validator (`validate_palette.js --ordinal` and the categorical check against its neighbours): the old travel scale had two bands 2.2 apart for red-green colour blindness.
- **A legend key is drawn exactly like the mark it explains.** Travel fee colors live only in `BANDS` in `js/travel.js`; map dots are solid (`fillOpacity: 1`) and every key or dot in the page uses `.tmap-key i, .sg-dot, .fee-dot` (18px, 2px white ring = Leaflet radius 8, weight 2).

## Verifying UI changes
- **The in-app browser pane, when hidden, does not run smooth scrolling or the browser's own jump-to-section on page load.** Don't trust scroll measurements from it. Drive headless Chrome over CDP with real mouse events instead (the nav click checker lives in the session scratchpad).
- **Disable the browser cache, or add a query string, when testing a rebuilt `dist/`.** A cached `index.html` keeps loading the old scripts. Two test runs were wasted on stale pages.
- **A full-page CDP capture (`captureBeyondViewport`) is not what a visitor sees.** It drew the fixed mobile bar over the middle of the map, showed untiled grey maps and dropped the Check button. Confirm anything odd with a plain viewport screenshot after scrolling to it.
- **Parallel sessions each use their own preview port** (main session 8799; give each other session its own, e.g. 8790, 8791). Two sessions on 8765 stopped each other's servers and mixed one session's files into another's test run.
- Check at 1440, 820 and 375 px wide: no horizontal scroll, and nothing overlaps the mobile bar.
