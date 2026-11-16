# Recommended improvements, November 16, 2026

From five validation cycles over eNov14 and the queued UI round. Everything the cycles found that was clearly a defect is already fixed on `eNov14` (`SESSION-CHANGES-pipeline.md`, "Validation cycle 1" to "5"). What's left is below: changes to what customers see, which need Emmett's go after a mockup, and a few that need a decision.

**Mockups:** `docs/mockups/eNov16-improvements-mockups.png`. Each shows the eNov14 build beside the same page with the change injected in headless Chrome.

**A to F are built on eNov14 (Emmett, November 16: "Build all six").** What changed and what to test: `SESSION-CHANGES-pipeline.md`, "Improvements A to F built". The items without mockups are not built.

Nothing here touches `main` or the live site. Each is built on `eNov14` (or a later branch) after a go, and ships with a merge.

## With mockups (A to F): customer-facing, each needs a go

Ranked by how much each costs a booking today.

| | What | Problem today | Proposed | Size |
|---|---|---|---|---|
| A | **Checkout bar on small phones** | At 320 px the bar is 349 px wide: Back covers "Checkout" and the Contact tab, × covers Review. | Back, "Checkout", × on one row; the four tabs on a second row that always fits. CSS only, phones only (`book.css`). | Small |
| B | **Time step on short phones** | At 320×640 the first recommended time is under the bars. | Contact and Address shrink to one line each. "Pick the time that suits you" is said once (Elijah's start-times line stays). | Small |
| F | **Landing pages: Book Now on a phone's first screen** | `lp-golf` and `lp-prestige` have no Book button on the first screen at 375×667. | Book Now right under the headline. | Small |
| E | **Travel fee box in ink** | Pink box, red price: reads as an error (red means brand or "that did not work"). | Neutral box, price in ink. "Too far for a mobile detail" stays red: it is a problem. | Small |
| D | **Add a vehicle** | Opens a bare "Build your detail" with no Back and no sign it's vehicle 2. | Titled "Vehicle 2", with vehicle 1's summary and "Back to vehicle 1". | Medium |
| C | **"Need a different start?": early and late starts folded** | A Saturday lists 26 starts, past the screen. | Option A from the queue, wording approved November 12: "Earlier times (+$X fee)" and "Later times (+$X fee)" open their starts in place, with "Back to standard times". `$X` from `feeText()`, never typed. | Medium |

## Without mockups

**Booking reliability:**
- **Two customers confirming the same time within about a second can both get in.** The server reads the calendar, then writes. Fix: after writing, read the time again; if another event now overlaps, mark the newer one "CHECK THE TIME" and tell Elijah in the owner email. Server only. (Cycle 2.)

**Accessibility and touch** (each small; one mockup sheet if wanted):
- Phone tap targets under 40 px in the booking form:
  - "How it works" is 17 px tall;
  - "Change to suggested?" is 19 px;
  - "Tell us when suits" is 28 px;
  - "Add a vehicle" is 32 px;
  - Back and × are 34 px.

  (Cycle 4.)
- Keyboard focus drops to the page when a size or service card moves the form on. Fix: focus the new step's heading. (Cycle 4.)
- At 1440 the step tabs are 715 px wide inside the 680 px form: Vehicle touches the edge, Review is cut. Fix: narrower package summaries in the tabs. (Cycle 4.)

**Decisions for Emmett** (no code until answered):
- **`context_outline.txt`** (on `main` since 77636b4) holds Elijah's personal phone, full legal name and payment handles in the public repo.
  - Remove it?
  - Purge it from history along with the email (runbook step 4)?

  Either way it's a PR to `main`, so it comes after the freeze.
- **Legal wording, one update after the freeze** (runbook step 6):
  - the privacy policy's "tap";
  - the terms' travel charge, which no longer matches the price;
  - "two versions" (the headline test has three);
  - "kilometre", "outdoor tap".
- **Elijah's 5 photo pairs:** production builds now fail until each is checked (`"reviewed": true`) or dropped. `third-row-seat-stains` is a portrait against a landscape and should be re-cropped or dropped.

**Already queued** (`STATUS-2026-11-15.md`, "Queued, not started"):
- the booking form with fewer page changes (A9);
- the four service buttons' animations;
- the photo pipeline;
- the FAQ display;
- the CRM booking link;
- `check-live.mjs` always saying STALE.
