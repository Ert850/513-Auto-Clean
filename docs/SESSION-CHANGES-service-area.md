# Session changes: service-area.html cleanup

Branch: `claude/service-area-cleanup-b4bca3` (based on `eNov6` at 948775e). Not pushed.
Commit: 05cd68d. Files: `service-area.html`, `styles.css` (Service Area and Travel readout blocks only).

## Setup for testing

```bash
export PATH=/opt/homebrew/opt/node@22/bin:$PATH && npm run build
python3 -m http.server 8790 --directory dist
```

Open http://localhost:8790/service-area.html at 1440x900, 820 wide, and 375x812.

## Changes

| # | Change | Where | How to test |
|---|--------|-------|-------------|
| 1 | Section is light (`--paper`), like About and FAQ, not the dark home-page band. Text, input, suggestions dropdown, result, legend, buttons all moved to the light tokens (`--text`, `--text-soft`, `--red`, `--red-deep`, `--line`, `--paper-2`). Removed `on-dark` from the eyebrow and both ghost buttons. | `styles.css` `.areas`, `.at-*`, `.sg-*`, `.area-*`, `.tmap-key`, `.travel-out`, `.travel-fine`, `.leaflet-container` bg; `service-area.html` `#areas` | Light page between the light header and the dark footer. Type `Flor`: dropdown is white with a red fee. Enter `45040`: "$20 to $35" in red, Mason line below. |
| 2 | Clear end of page: the light section now meets the dark footer, plus more bottom padding (`clamp(48px, 6vw, 80px)`). | `styles.css` `.areas` | Scroll to the bottom: obvious edge between the "Don't see your town?" note and the footer. |
| 3 | Legend moved from the side column to directly under the map; legend keys drawn with the same white ring as the map dots (13px, 2px white border, thin dark outline). | `service-area.html` `.at-map`; `styles.css` `.tmap-key i` | Legend sits under the map, colors match the dots. |
| 4 | Zoom hint ("Click the map then scroll to zoom...") had no CSS rule and sat flush on the map. Now `.55rem` gap, small soft text. | `styles.css` `.at-zoomhint` (new) | Space between map bottom and hint. |
| 5 | Side column split into `.at-side` (label, input, result) and `.at-extra` (fine print, pin button, pin hint, quote button), placed by grid areas. Phone order: search, map, extras. From 820px: search and extras on the left, map on the right spanning both. | `service-area.html` `.areas-tool`; `styles.css` `.areas-tool`, `.at-side/.at-map/.at-extra`, 820px media block | At 375x812 the map top is at about 536px (was 944px), so part of it shows on the first screen. At 1440 the map is on the right. |
| 6 | Empty boxes no longer leave gaps: `.travel-out` lost `min-height` and has no top margin while empty; `.at-pinhint:empty` is hidden; fine print has no top margin. | `styles.css` | Before a search, no blank band between the input and the fine print, or above "Get an exact quote". |
| 7 | Desktop fold: section top padding `clamp(32px, 4vw, 56px)`, map 430 to 380px, intro max-width 760px. | `styles.css` `.areas`, `.areas .section-head`, 820px `.at-canvas` | At 1440x900 the whole estimator (input, map, legend, hint) is above the fold and the town card tops show at the bottom edge. |
| 8 | Town lists grouped under small headings with a dotted rule (`h4.area-grp`). Ohio by side of town: Central Cincinnati, East side, North, West side, Farther north. Northern Kentucky by county: Kenton, Campbell, Boone. Southeast Indiana stays one group (6 towns). Same 74 towns as before, checked by script; the robots.txt comment still matches. | `service-area.html` `.area-lists`; `styles.css` `.area-grp` (new) | Each card shows uppercase group labels with a dotted line to the edge. |
| 9 | From 820px, Ohio takes a wide left column (`1.4fr`) and Kentucky and Indiana stack on the right, replacing 3 equal columns of very different heights. | `styles.css` `.area-lists`, `.area-oh` | At 1440 and 820: Ohio left, two shorter cards right, no tall empty card. |

## Verified

- `npm run build`: OK. `cd web && TZ=America/New_York npx vitest run`: 409 of 409 pass.
- 1440, 820, 375: no horizontal scroll (`scrollX` stays 0). ZIP 45040 gives "$20 to $35" at 1440 and 375. Leaflet map loads, no console errors.
- Contrast on the light ground: `--text-soft` on paper is about 6:1, `--red` about 5.6:1, `--red-deep` on white about 6.5:1.

## Notes for the merge

- The build rewrites `?v=` stamps in every page. I reverted those so this commit touches only the two files. Run the build again after merging.
- `index.html`, `script.js` and `js/travel.js` are unchanged. All element IDs are unchanged.

## Not changed / for the owner

- The schematic fallback map (only shown if Leaflet fails) keeps its dark card.
- At 375 the shared header's menu button extends 4px past the viewport (body `overflow-x: hidden` hides it, so there is no scroll). This is from the shared header, so I left it alone.
- At 820 the map column is 360px wide because the search column needs the full 22rem for the placeholder text. This is the same as before.
- After a search, `travel.js` replaces the "Drop a pin" button's contents and drops its pin icon. This also happened before this change.
- robots.txt says "Anderson Township", "Colerain Township", "Delhi Township"; the page says "Anderson", "Colerain", "Delhi". This was already the case before this change.
