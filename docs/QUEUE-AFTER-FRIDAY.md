# Queued for after the Friday, November 13 deliverables

Work that's agreed but deliberately not started before Friday. Newest first.

## Time step, "Need a different start?": fold the early and late times into two items (Emmett, November 12)

**Ask:**
- The dropdown under "More times on <day>" lists every start of the day. The early-fee and late-fee starts make it run past the screen: 25 rows on a Saturday.
- **Group them:**
  - one **Earlier** item at the top that opens the early-fee starts;
  - one **Later** item at the bottom that opens the late-fee starts;
  - the standard-price starts in between, in time order as now.

**Where:** `openMoreTimes()` in `js/funnel.js` (the `select[data-otherstart]`). The recommended cards, the "More times" chips, the phone list and the day timeline don't change.

**A native dropdown can't have a submenu.** A `<select>` has no second tier, and `<optgroup>` only adds a heading: it doesn't fold anything. Choices:
- **A. Recommended. Swap the list in place.**
  - The dropdown shows "Earlier times (+$43 fee) ›" first, the standard starts, then "Later times (+$43 fee) ›" last.
  - Choosing Earlier or Later refills the same dropdown with just those starts, headed by "‹ Standard times", and reopens it (`showPicker()` where the browser allows it, otherwise it stays focused for one more tap).
  - It keeps the phone's native picker, keyboard use and screen reader support.
- **B. Two quiet links under the dropdown,** "Earlier (+$43)" and "Later (+$43)", each opening a short row of chips like "More times". It's simpler, but it's not the one-item grouping asked for.
- **C. A custom menu with a flyout.** Rejected: flyouts work badly on touch, and it means rebuilding keyboard and screen reader support for one dropdown.

**Wording:**
- **Approved (Emmett, November 12):** "Earlier times (+$43 fee)" and "Later times (+$43 fee)". They're shorter than "See Earlier Times - Early Fee", and they give the price up front in the same "(+$43)" form the rows use.
- **If the fee differs between starts,** use "from +$43".
- **No em-dashes.**

**Rules for the build:**
- **Group by the early or late band** (`timeFeeApplies()`, morning or evening), **never by "has a fee".**
  - On a rush day, every start carries the rush fee. Grouping by "has a fee" would fold the whole list into one item.
  - Rush-only starts stay in the standard part, and keep showing their fee as now.
- **A start with both fees** (rush plus early or late) goes in its early or late group.
- **Leave out empty groups:** no Earlier item on a day without early-fee starts.
- **Choosing a start** behaves exactly as today (same `data-otherstart` handling, analytics `via`).
- **Check:**
  - Chrome, Safari and Firefox on a laptop, plus iPhone and Android pickers;
  - a rush day, a day with only late starts, keyboard only.

## Checkout: a small in-section Continue where it saves a reach (Emmett, November 12)

**Ask:** add back the small Continue under a checkout section's boxes, as a second way to move on with less mouse travel. It started with "Your details" (Name, Phone, Email). The bottom bar's red Continue stays exactly as it is.

**This reverses part of an owner decision from the same day.** Round 20 (`SESSION-CHANGES-pipeline.md`; `CLAUDE.md`, "Checkout continues from the bottom bar only") removed every in-section Continue. Rewrite that `CLAUDE.md` rule when this is built.

**Why Round 20 removed them, and why neither reason applies now:**
- **Below the fold:** under a long section (Address, Time) the button sat below a laptop's fold. The show rule below never draws it there.
- **"Your time" off centre:** the card in the bar centred off to the right. That came from hiding the bar's Continue, and the bar keeps its button.

### Design (Emmett's direction, November 12)

**1. One rule decides where the button shows, for every section.**
- **Where:** the section is Contact, Address, Time or "Almost done". The button is drawn under that section's last row of boxes.
- **When the section opens,** measure where the button would sit on screen once the section is at rest. That's after the form's own scroll, and after `revealTravel()` on Address.
- **Show it only when both of these hold:**
  - **It fits:** the whole button is above the pinned bottom bar, with a small margin. No button below the fold, which was Round 20's reason.
  - **It saves a reach:** its distance to the bar is at least a set gap, for example 160 px (a named constant, tuned on screen). If the section ends just above the bar, the bar's Continue is already as close, and a second button is clutter.
- So a short section on a tall window gets the button, a long section or a short window doesn't, and no section is a special case. That answers "inconsistent between sections": the rule is the consistency.
- **Only re-decide when the section opens, on a window resize, or on a rotation.** Never on scroll or while typing. A button appearing and disappearing mid-task would move the folded rows under it.
- **Add a little hysteresis around the threshold,** so a window resized near the limit doesn't flicker.
- **Time:** the button follows the bar's: shown only once there is a time or a request (`ckNextIdle()`).

**2. Position by window size**, using the same test as the time picker (`phoneView()`, under 768 px):
- **Tablet and up:** the boxes sit in a row, so the button goes under the row, left-aligned, under the first box (Name on "Your details"). That's the shortest reach from where the pointer just was.
- **Phone:** the boxes stack, so the button goes after the last box (Email), never between two. The same show rule applies. On most phones a section like Address won't qualify, which is right: the bar is already under the thumb.

**3. One code path:** the button calls the same `advance()` as the bar, which finishes the open section (`ckAdvance`). Validation, errors and scrolling to an error are identical.

**4. Screen readers:** both buttons are labelled "Continue" and do the same thing. The inline one comes straight after the boxes in tab order, so keyboard users meet it first. Nothing else is needed. Enter and the phone's Go key already continue from the last box.

**5. Look:** the small dark button from before Round 20 (in the parent of `bf608f0`). No new style.

### Checks when built
- **Sizes:** 1440×790, 1280×720, 820×1180, 700×400, 375×812 and 320 px.
- **At each size, for each section:** shown or hidden as the rule says, never under the bar, never between stacked boxes.
- **Stability:** resizing across the threshold doesn't flicker; the "Your time" card stays centred.
- **Booking paths:** every path still reaches Done, with no console errors.
- **Effort:** about 1 hour, with the checks.
- **Timing:** build it after the ad blocker fix lands. That fix may rename classes in `js/funnel.js` and `book.css`.

## Photo pipeline: the website gallery pulls from Google Drive (Elijah, team brief section 5, November 11)

**Goal:** the results gallery is built from the shared Drive folder "513 Auto Clean Photos / 03 Website", so new photos reach the site without code changes. The current site photos get replaced.

**Plan:**
1. **A build step** (`web/scripts/`): list "03 Website" through the Google Drive API, download each photo, make the sizes the gallery uses today (420, 760 and 1120 px WebP, plus a JPEG fallback), and rewrite `data/gallery.json`. If Drive can't be reached, the build keeps the last good gallery instead of failing.
2. **Before/after pairs** from file names, for example `crv-interior-before.jpg` and `crv-interior-after.jpg`. A photo without its pair is left out, and the build log says which.
3. **Triggering it:** Drive can't call Netlify on its own. Either a small Apps Script in the folder checks for changes hourly and calls a Netlify build hook, or the site rebuilds daily.
4. **Privacy check before publishing** (team brief 8.3): license plates blurred; no faces, house numbers or papers. The pipeline can't judge that, so "03 Website" must only hold approved photos.
5. **Later, with the GHL keys:** load "02 Selects" into GoHighLevel's media storage.

**Needs from Elijah:**
- the folder ID;
- access: either "anyone with the link can view" (an API key is enough) or private (shared with a service account we create);
- the naming rule for pairs;
- daily rebuild or the build-hook script.

**Needs from Emmett:** a Google account for the folder (UC mail isn't one).

## Interior packages: three tiers, Full Interior + Steam as its own package (Elijah, messages November 11)

**What Elijah decided:**
- **Interior has three packages, not four** ("4 is too complicated").
- **Full Interior + Steam becomes its own package** ("Try as a separate package"). He also floated a "button directly under Add Steam Cleaning".
- **Showroom Ready (interior) leaves the package list** and can become an add-on, "Showroom Ready restoration or something".
- **Exterior stays the same.**
- **Driven from JSON** rather than hard-coded ("JSON would be good"), like `config/rush-fee.json`.

**Still to settle with him before building:**
- **Which three:** for example Basic, Full, and Full + Steam, with Maintenance kept for returning customers.
- **Prices:**
  - the Full + Steam package price (Full plus the $75 steam extra, or a bundle price);
  - the "Showroom Ready restoration" add-on price, and what it includes.
- **Old quote links and bookings** that name `showroom-interior` need a mapping.
- **The $100 minimum** for one-off restoration jobs (brief 7.1).
- **Fill Kris first** (brief 7.1): check the Priority order in the calendars' descriptions.

**Read first:** `docs/BUSINESS-CONTEXT.md` (Elijah, November 11: what sells, customers' words, why leads don't book). It names Full Interior + Steam as the lead offer.

**Touches:**
- `web/lib/catalog/` (prices live only there);
- the package cards rendered into `index.html` and `services.html`;
- the booking form's package step and level meter (`pkgLevel()`, which is catalog order);
- the recommendations;
- the extras-step wording;
- tests.
