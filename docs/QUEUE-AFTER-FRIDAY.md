# Queued for after the Friday, November 13 deliverables

Work that's agreed but deliberately not started before Friday. Newest first.

## Elijah's follow-up answers (November 13): what changes

- **Kris arrives at 6pm** (question 16, yes). Build the queued `outboundFree` change so the start of any working stretch counts as the start of the day. His 6pm BEST is then a true 6pm arrival, and long drives no longer drop it.
- **Package prices are fixed but wait** until today's prices are shown to convert:
  - Maintenance $115, Basic $145, Full $235;
  - Full + Steam $315 (steam +$80 on Full);
  - steam on any other package $115;
  - Showroom Ready Restoration "starts at $445", +3 h, Elijah only.
- **Prestige Living:** assume it prints January 1, so its landing page must be final before then.
- **Cancelling and accounting:**
  - a cancelled booking must leave the Accounting sheet;
  - perhaps a job counts only once the detailer confirms it was done (for example, JobsSync counts a job only when its event is marked done, and drops rows whose event was deleted);
  - longer term, accounting runs through GoHighLevel, with payments to the business account.

## From the final pre-release review (November 13): fix after launch

Full reports are in that session; the screenshots are in the session scratchpad (`review/shots/`). Fixed before launch: see `SESSION-CHANGES-pipeline.md`, "Final pre-release review".
- **Booking and calendar:**
  - **The job length never reaches the drive measure,** on either side. The browser sends `service=` while `travel.mjs` reads `serviceMin`, and `_routes.mjs` reads `cart.serviceDurationMin`, which the cart never has. Both measure the drive home at the start time, so they agree today. Fix both together: the drive home is measured at the finish, and the screen and the receipt use the same value.
  - **A server-side free/busy check** before writing an event, for two people taking the same time.
  - **Turnstile:** render it for every booking before setting `TURNSTILE_SECRET_KEY`, or every booking fails.
  - **Multi-day:** send the browser's day plan to the server, and the emails list every day.
  - **Typed numbers to move into settings:** 24 h short notice, the 30 min drive fallback, `[0, 6]` correction days, "within the hour", promo labels, and the 365/400 booking horizon.
  - **Browser-local dates in request days and `verifySlot`:** a visitor outside Eastern time sees them shifted.
- **UI (each needs a mockup first):**
  - **Checkout header:** Back and × cover text at 820 px with long package names, and at 320. With two vehicles it shows vehicle 2's size.
  - **The travel fee box is styled like an error** (pink and red; the color rule says red means brand or error).
  - **Help me decide:** the bar shows the travel fee as if it were a price; "4 hours covers our longest single-vehicle detail" is false (Showroom Ready is 7 to 8 h); and the Time step's first screen is all text.
  - **"Add a vehicle"** opens a bare restart: no "Vehicle 2" label, no Back.
  - **A 6am pick is steered to 6pm** (`steerFor` assumes suggestions are fee-free).
  - **Tax appears unlabelled** in the bar once the ZIP is in.
  - **Hover styles stick after a tap on phones:** wrap them in `@media (hover: hover)`.
  - **The time picker on short screens:** nothing visible at 320×568, and a cramped calendar view at 1440×790.
  - **Layout shift at 820 px:** the home page (reviews ticker) and Range & Travel.
  - **Landing pages on phones:** no Book button on the first screen.
- **Smaller:**
  - "Tap" on desktop;
  - the close dialog says "Cancel my booking" before any booking exists;
  - the multi-vehicle saving wording, and two different saving figures;
  - "10:00 AM" vs "10am";
  - recommended-time labels;
  - the calendar opens on past days;
  - "No extra cost" wraps on `/booking.html`;
  - the phone menu's names, and Contact Us twice;
  - Contact placeholders cut, and the heading repeated;
  - the Exterior tab fold;
  - exterior times after dark (a business question).

## Elijah's answers (voice recording, November 12): what to build

Each answer is on its question in `QUESTIONS-FOR-ELIJAH-PACKAGES.md`.

- **Prices.** He says the site's interior prices were already wrong: Basic Interior is $135 and Full Interior $225, not the $125 and $215 the site shows. The new prices are:
  - Maintenance $115;
  - Basic Interior $145;
  - Full Interior $235;
  - Full Interior + Steam $295 (steam presented as normally $115, "$80 for you today").

  The Full + Steam arithmetic needs his confirmation first (question 2). Prices change only in `web/lib/catalog/`; the build stamps them everywhere else.
- **Interior packages:**
  - Maintenance stays on top, marked "only for customers who had a detail in the last 3 months";
  - then Basic, then Full;
  - an always-shown "add steam" button under Full turns it into Full Interior + Steam, the "Most popular" lead offer;
  - steam counts as 1 hour internally (5 hours for Full + Steam), and the wording keeps "1 h 30 min";
  - steam on Basic stays an extra, and steam added to Full any other way gets the Full + Steam price.
- **Showroom Ready Restoration** is an interior add-on:
  - priced $445 to $495 (one figure needed, question 8);
  - only on Full and Full + Steam;
  - Elijah only;
  - old links map to Full + this add-on at the same total;
  - low effort.
- **Exterior:** remove Showroom Ready (exterior), and offer Paint Correction and Protection as its own choice instead.
- **Restoration entry point:** the first screen offers Interior, Exterior, Paint Correction and Protection, and Stain, Spill and Odor Removal. Each has its own page, and one-off jobs can be upsold to a package.
- **Hours:** "6 AM to midnight, 7 days a week" (texts, calls and bookings) replaces "7 AM to 10 PM" on the site (footer partial, home contact block, Contact page, and the home page's hidden business data `openingHoursSpecification` 06:00 to 24:00). Imperion sets the same on Google. About 10 minutes.
- **FAQ program:**
  - draft 50 to 100 search-driven questions for Elijah to answer in his own words;
  - show about 5 on the FAQ page;
  - an expanded FAQ or blog index for search behind them.
- **Landing pages:** Prestige Living and golf final by the beginning of January. Prestige prints around 2028.
- **Capacity:** ignore the capacity notes in `BUSINESS-CONTEXT.md`. OPEN blocks decide.

## Per-detailer follow-ups from the November 12 audit (not urgent with today's schedule)

Found by the audit for Kris's new Monday to Thursday days. Fixed already: the event end, the reassignment check, the fee waiver outside his hours, and the build check of `DETAILERS` (`SESSION-CHANGES-pipeline.md`, Round 22). Left:
- **Kris's evening drive:** waits on question 16. If yes, `outboundFree` in `slots.ts` should treat the start of any working stretch (`dayOpens`) as the start of the day, not only a start before `IGNORE_OUTBOUND_BEFORE_MIN` (10am).
- **The week grid and the day timeline judge "standard price" by the clock, not the calendar.**
  - `week.ts` `suggested && !premium` uses `bandOf`, so Kris's 6pm BEST (standard price on his calendar) gets no star in the grid.
  - `REG_FROM`/`REG_TO` (10am to 6pm) fold his standard-price 6 to 7pm starts under "Later times".
  - Fix: pass `timeFeeApplies` into `buildWeek`, and fold by fee.
- **`feeWhy` names any fee before noon "early start" and after noon "late start".** It should come from the block.
- **Multi-day jobs plan on the owner's calendar only** (`funnel.js`, multi-day branch). That's fine while correction and coating are Elijah's.
- **Assignment ignores fees:** a higher priority can get a +20% start a lower priority would do at standard price. No effect today.
- **Site-wide clock limits are in code, not config:**
  - `DEFAULT_BOOKING_WINDOW` (6am, last start 10pm, finish by midnight);
  - `IGNORE_RETURN_AFTER_MIN`, `TIME_BANDS`, `MIN_NOTICE_MIN`, `SHORT_NOTICE_HOURS`;
  - correction's weekend-only `[0, 6]` in `funnel.js`, which ignores `CORRECTION_RULES.weekendOnly`.

  Move them to `config/` when a detailer needs hours outside them.
- **The server never checks a booked time against the detailer's calendar.** The browser re-checks (`verifySlot`), and an edited request could skip it. Add a server-side `computeSlots` check in `send-confirmation`.
- **Stale examples** of the old Tue-Sat schedule and 3/3/1 capacity: `BOOKING-PIPELINE.md`, `DELIVERABLES-2026-11-13.md`, and code comments in `crew.ts`, `week.ts` and `funnel.js`.

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
  - The dropdown shows "Earlier times (+$X fee) ›" first, the standard starts, then "Later times (+$X fee) ›" last.
  - Choosing Earlier or Later refills the same dropdown with just those starts, headed by "‹ Standard times", and reopens it (`showPicker()` where the browser allows it, otherwise it stays focused for one more tap).
  - It keeps the phone's native picker, keyboard use and screen reader support.
- **B. Two quiet links under the dropdown,** "Earlier (+$X)" and "Later (+$X)", each opening a short row of chips like "More times". It's simpler, but it's not the one-item grouping asked for.
- **C. A custom menu with a flyout.** Rejected: flyouts work badly on touch, and it means rebuilding keyboard and screen reader support for one dropdown.

**Wording:**
- **Approved (Emmett, November 12):** "Earlier times (+$X fee)" and "Later times (+$X fee)". They're shorter than "See Earlier Times - Early Fee", and they give the price up front in the same "(+$X)" form the rows use.
- **$X is never written in.**
  - It's the group's fee, worked out from the booking's own price with the same `feeText()` the rows use.
  - The fee is a percentage of the job, and comes from the calendar's fee blocks, so it changes with the package, the vehicle and the calendar.
  - The $43 in the screenshot was one booking's fee.
- **If the fee differs between starts in a group,** say "from +$X", with the smallest.
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

## Checkout: a small in-section Continue where it saves a reach: BUILT (November 12)

Built and logged in `SESSION-CHANGES-pipeline.md` (Round 22). The design that was here is now the `CLAUDE.md` rule "Checkout continues from the bottom bar, plus a small in-section Continue only where it fits".

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
