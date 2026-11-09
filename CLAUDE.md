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
  - `CATALOG:*` regions in `index.html`, `services.html` and `faq.html` (source: `web/lib/catalog/`, `web/scripts/render-site.mjs`);
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
- When a section moves to another page, re-point the links *inside* it (`book.html` becomes `index.html#book`, `#inquiry` becomes `index.html#inquiry`).

## Scrolling and layout (bugs fixed November 9–10)
- **Never hard-code the sticky header's height.** `script.js` sets `scroll-padding-top` from `#header.offsetHeight`. A fixed 90 px against a 73 px header made every jump stop 17 px short.
- **No `scroll-behavior: smooth` on `html`.** It also animates arriving at `page.html#section` from another page: the page opened at the top and slid thousands of pixels. `script.js` glides in-page clicks itself.
- **Content that loads late moves anchors.** The gallery, the review ticker and the web fonts all grow the page after first paint. `script.js` `pinTo()` holds a jump's target for 2.5 s. New late-loading content above an anchor either reserves its space or relies on that hold.
- **Anchor targets sit where the scroll should land:** `#top` is the first element in `<body>`, above the top bar.
- **`images/logo-mark.png` is mostly transparent**: the bottle fills only x 40–78 and y 18–93 of 120×120. Size it with `object-fit: cover` and a narrow width, not as a square.

## Service cards (bugs fixed November 10)
- **Cards are flex columns, so margins add instead of collapsing.** Two stacked margins (list 1.05rem + toggle .9rem) made a 31 px gap. And the last block above `.svc-foot { margin-top: auto }` needs its own bottom margin: in the tallest card of a row, `auto` is 0 and that block sits flush on the button.
- **`ul.feat` is the package checklist only.** `.svc-card ul.feat li { display: flex }` outranks lower-specificity list rules. Putting `feat` on the correction tier list split every tier into three squeezed columns.
- **No `flex-wrap` on an icon + text row.** The text's flex-basis is its full one-line width, so it always wraps onto a row of its own under the icon. Use `nowrap` and give the text `flex: 1; min-width: 0`.
- **A mobile-only rule written after a `min-width` media query overrides desktop too** (same specificity, later wins). Wrap it in `max-width: 819.98px`.

## Verifying UI changes
- **The in-app browser pane, when hidden, does not run smooth scrolling or the browser's own jump-to-section on page load.** Don't trust scroll measurements from it. Drive headless Chrome over CDP with real mouse events instead (the nav click checker lives in the session scratchpad).
- **Disable the browser cache, or add a query string, when testing a rebuilt `dist/`.** A cached `index.html` keeps loading the old scripts. Two test runs were wasted on stale pages.
- Check at 1440, 820 and 375 px wide: no horizontal scroll, and nothing overlaps the mobile bar.
