# Booking pipeline overhaul: branch `eNov10PipelineBranch`

Built overnight, November 10 to 11, for you to evaluate. It combines your 8 answers with the 11 ideas in `docs/BOOKING-PIPELINE.md`.

- **Scope:** only the booking form and the code it uses.
- **Branch:** started from `eNov6` at `fb29b30`. `eNov6` has not moved, so merging is a fast-forward with no conflicts. Nothing was pushed.
- **To see it:**
  - Local preview: <http://127.0.0.1:8790>. Open any Book Now.
  - If the preview isn't running, run `scratchpad/pipe-publish.sh` and start `scratchpad/demo-server.py 8790 scratchpad/pipe` (paths are in the session scratchpad).
- **Files changed:**
  - `js/funnel.js`, `book.css`;
  - `web/lib/availability/week.ts` (new) and its tests;
  - `web/lib/browser-entry.ts`, `js/pricing.bundle.js` (built), `web/lib/funnel.smoke.test.mjs`.
  - The build also re-stamps `?v=` on every page. Those page changes were left out of the commit; a rebuild after merging restamps them.

## Round 8 (November 10): the chosen time in the bottom bar, one-tap calendar, the leave dialog

### The chosen time sits in the bottom bar
- **What:** on the week view ("See additional times"), the chosen time's box now sits in the middle of the bottom bar, between the price and Continue, instead of above the grid. It keeps its red outline. On phones it takes the full width of the bar, above the price and Continue.
- **What it says, shortened so the bar stays a bar:**
  - day and span ("Fri, Nov 13, 10:30am to 2:30pm");
  - arrival window and price ("Arrive 10:30am to 11:30am · Standard price", or the fee and why);
  - the short-notice line when it applies;
  - the "Or start at" chips, which still book in one tap.
- **Kept in the page:** the coating note ("we book the coating for a warmer day") is too long for the bar and stays above the grid. So does "You picked … Show that week" when the chosen time is in another week.
- **Shown only on the week view.** Our recommended times, and every other step, clear it (`setPick('')` in `render()` and `paintRecs`).

### One tap on the calendar
- **What:** clicking a start on the week grid (the hover block already shows the whole detail) chooses it and moves on to Details, like the recommended times. On phones, tapping a time in the day's list does the same, because each row already shows the span and the fee.
- **Coming back** with Back shows the choice as the block on the grid and in the bottom bar, with the "Or start at" chips as the second chance to change it.
- **Same checks as before:** the move goes through `advance()`, so the live calendar check (`verifySlot`) still runs first.
- **Analytics:** `time_pick` still says `via: calendar` or `via: summary` (a chip in the bar).
- **Trade-off:** on a touch screen 520 px or wider (a tablet showing the grid), there's no hover, so a tap moves on without showing the block first. The cell already shows the start and the price, and Back shows the block.

### The leave dialog
- **"Throw it away" is now "Cancel my booking"** (sentence case, like the other buttons). It does the same thing: deletes the saved answers and closes.
- **Layout, from four buttons in four styles to three levels:**
  - one primary, "Back to my booking", in the booking form's own red Continue style, focused on open;
  - "Keep it for next time" and "I have a question" side by side, same outlined style, each with a small red icon;
  - "Cancel my booking" as quiet underlined text below.
- **CSS:** the `!important` overrides are gone; the rules use `.bk-leave-acts .bk-leave-go` specificity instead.

### Verified (headless Chrome, live calendar, test Kris)
- **1440×900:** clicking a grid start goes to Details; Back shows the bar box with the right span, fee and chip; the chip books and moves on; switching to recommended times clears the bar.
- **375×812 and 320×640:** the same, through the phone list. No sideways scroll; the bar is about 165 px tall, or 190 px with the short-notice line.
- **Leave dialog:** buttons render at 1440, 375 and 320; focus starts on "Back to my booking"; "Cancel my booking" closes and leaves no saved draft.
- **Tests:** 467/467.

### To test
- Week view: pick a start, press Back, check the bottom bar, then try an "Or start at" chip.
- Phone: the same, from the day list.
- Close with ✕ partway through, and try each of the four choices.

## Round 7 (November 10): privacy, payments, block fixes, recommended days, futureproofing

### Privacy policy (legal process followed)
- **New capability:** `weatherCheck` (on), in `web/lib/site/capabilities.ts`.
- **Generated from it:**
  - a "National Weather Service" entry in "Who we share it with";
  - a sentence under "Information collected automatically": the browser sends the detail's approximate location (address or ZIP, rounded to within about a kilometre), never name, contact details or street address, and the service sees the IP address.
- **The booking form fetches weather only while `weatherCheck` is on,** so the policy and the behaviour can't drift.
- **Effective date:** stays 2026-11-10, the date of the change. The earlier 2026-11-10 change wasn't live either; a history note is in `legal.ts`. `npm run lock:legal` was re-run.
- **Checked:** legal tests (33) pass, no em-dashes, terms unchanged.

### Payments: Kris's fee-free hours
- **Bug:** `create-payment` and `paypal-order` repriced the booking without the detailer, so a card or PayPal charge would add the late fee the booking email had waived.
- **Root cause:** the detailer lookup lived only in `send-confirmation`.
- **Fix:**
  - one shared helper, `netlify/functions/_detailers.mjs` (`detailerFor`, `timeFeeWaived`), used by all three functions;
  - the browser sends `detailer` with both payment requests;
  - only names in the deploy's own `DETAILERS` count.
- **Tested:** the shared helper; payment itself is switched off.

### Calendar block fixes
- **Clipping.** A block sits at its exact minute (12:30 starts halfway down the 12pm row), so the cells it half covered showed cut-off "+$43" text above and below. Every cell a block touches, chosen or previewed, now hides its contents and keeps only its outline.
- **The star.** A suggested start keeps its star on the block's red time bar, top right, for the chosen time and for the hover preview.

### "Our recommended times" as days
- **Before:** three separate times, all of them rush upsells on a rush week.
- **Now:** three DAY bars, each listing its two best starts ("Friday, Nov 13: 10am to 12pm or 4pm to 6pm").
  - Tapping a day opens it in place (animated, or instant with reduced motion) into two small time bars; tapping one books it and moves on. A day with one start books on the first tap.
  - **At most one fee day** (`maxFeeDays: 1`), so 2 of 6 slots are upsells and the rest are the soonest standard-price days. Fee days fill in only when nothing else is open.
- **One config,** `TIME_RECOMMENDATION_RULES` in `week.ts` (days 3, timesPerDay 2, maxFeeDays 1). `recommendDays()` takes `scoreFor`, so analytics can later order starts by what converts. 7 tests.

### Futureproofing
- **Detailer skills:** `does` is a free list of words ("interior", "exterior", "correction", "coating", or anything new), and a job lists the words it needs. A new kind of work is a word in `DETAILERS`, not code. Help me decide needs every skill, so it stays with Elijah.
- **Analytics events** (they do nothing until analytics is on and accepted):
  - `time_pick` (how it was picked, fee %, days ahead, start hour, detailer);
  - `time_view_all`;
  - `addon_add` (add-on, tier, whether it was recommended, which screen).

  These are the data the add-on ranking (`recommend.ts` `signals.score`) and the time ranking (`recommendDays` `scoreFor`) are built to use.

### Verified
- **Tests:** 467 of 467.
- **Headless Chrome, live calendar, test Kris (preview only), 1440 and 375:**
  - Tuesday (rush, +$25) then Friday and Saturday at standard price, so exactly one fee day;
  - opening a day shows its two times and moves focus to the first; a tap books it and opens the details step;
  - `time_pick` is recorded with `via: "recommended"` and `detailer: "kris"`;
  - the cells under the block show no contents; the star shows on the chosen and the previewed block.
- **Bug found while validating:** the focus ring on the first time was clipped by the opening animation. The open panel now has 4 px of room.

## Round 6 (November 10, night): weather by kind of job, cover, Kris's fee hours

### Weather rules (owner's answers; numbers in `web/lib/availability/weather.ts`)
| Work | Coldest | Rain stops it | Clear sun and hotter than |
|---|---|---|---|
| Interior | any | over 20 mm/h | never |
| Exterior | 40°F | over 4 mm/h (mist and light rain are fine) | 100°F |
| Correction and polishing | **50°F** (design choice: between exterior's 40 and coating's 60; the owner said "colder than 60 to some extent") | any rain | 85°F |
| Ceramic coating | 60°F | any rain | 85°F |

- **"Clear sun"** means under 30% cloud in the forecast, read from the NWS `skyCover` layer. A hot overcast hour, or a clear cool one, is workable, so mornings and evenings stay open naturally.
- **Garage or covered spot:** an optional, unticked box on the address step for everyone (owner's choice). It lifts the rain and sun limits, never the cold. It's printed in your email.
- **"Correction books anyway":** ceramic coating never blocks a time. When a start suits the rest of the job but not the coating, the time is offered with "The coating moves to a warmer day". The summary explains it, and your email says "COATING: ... book the coating for a warmer day".
- **The note under the legend** now names the reason: too cold for which work, rain, a downpour, or heat. It suggests the covered box when rain or heat is the reason.
- **Warm spells:** inside the 7-day forecast a warm day is bookable even in winter. Past it, the season decides: exterior March to October, correction April to October, coating May to September.
- Interior jobs now read the forecast too (for downpours), except when covered.

### Kris: no late fee on 6 to 7pm starts
- **Setting:** `DETAILERS` gets `"noFeeStarts": "18:00-19:00"` (first and last start, inclusive). The rush fee still applies.
- **Same price on both sides:** the pricing engine has one flag, `timeOfDayWaived`. The browser sets it for whoever the start is assigned to, and the server sets it on its own from its copy of `DETAILERS`, so the email receipt matches what the customer saw and a request can't claim it.
- **Recommendations:** they skip early and late hours, but now ask "does a fee actually apply for this detailer?". Without that, Kris's fee-free evening starts could never be recommended.
- **Not covered:** card and PayPal payments (both switched off) don't pass the detailer yet. Wire that in before turning payments on.

### No daily cap
Nothing built, by the owner's direction: the hours on each availability calendar set the pattern. The example and the `noFeeStarts` setting are in `docs/ADD-A-DETAILER.md`.

### Verified
- **Tests:** 461 of 461 in Eastern time. The weather, crew, week and recommendation tests also pass on a UTC clock (36).
  - New: every weather rule, including cover, heat needing both hot and clear, and coating needing 60°F even covered; the fee waiver in the engine and in server repricing (6:30pm: 20% without, 0% with); evening recommendations for a fee-free detailer.
- **Headless Chrome with a test Kris (preview only):**
  - Friday 6pm and 7pm read "standard price" and 8pm reads "+$25 late start fee";
  - the 6pm total is $134.75 (no fee) and the 8pm total $161.70 (with the fee).
- **With a made-up forecast inside the page:**
  - cold for exterior: no times, with "below 40°F, too cold for exterior work";
  - a downpour for interior: those days drop, the note says so, and suggests the box;
  - the same, ticked "covered": the times come back and the note goes.
- **Test lesson:** a calendar click redraws the grid, so a test must find a cell again after each click. A stored reference points at a cell that's gone.

## Round 5 (November 10, night): Extras layout, block text, late rows

### Extras
- **The second-vehicle offer is now on the first screen.** A slim light card at the top: "Another vehicle at this address? Take 10% off both, $43 on one like this", with "Add a vehicle".
  - **Before:** it was at the very bottom, under every add-on.
  - **Why light:** a light card rather than the dark panel, so it doesn't compete with the add-ons or Continue (cross-sell guidance: visible, saving stated, never in the main path).
  - With two vehicles it lists them, with the saving.
- **Every add-on is listed.** No "See all extras" fold: "Recommended for your [package]", then "More extras" (or "More interior extras" and "More exterior extras"), under the same grey caps subheader. The "More below" cue shows there's more.
- **Recommendations are their own module** (`web/lib/catalog/recommend.ts`, 5 tests).
  - Today: the hand-picked order per side, then popularity; anything the package covers or blocks drops out.
  - It takes `signals.score`, such as how often an add-on is booked with that package. Once analytics can say that, scores outrank the hand-picked order with no change to the booking form.

### The chosen block's note was cut off ("Rush + early 3…")
- **Cause:** the note was one line with an ellipsis, in a column about 80 px wide. "Rush + early 30%" needs about 88 px.
- **First fix:** the note may wrap to two centred lines, and a fixed height decided when to drop it.
- **Second cause, found while validating:** fixed heights were guesses. Worse, the block's lines are a flex column and flex children shrink by default, so a crowded 2-hour block squeezed "6am" and "to 8am" instead of overflowing. The overflow check never fired.
- **Fix:**
  - lines never shrink (`flex-shrink: 0`);
  - after drawing, and on resize, `fitSpan()` measures each block and drops the note, then the fee, only if they don't fit;
  - the text is a step smaller in windows under 760 px.
- **Lesson:** fit text by measuring, never by a guessed height; and a flex column that must overflow needs `flex-shrink: 0` on its children.

### The 8pm block ran off the bottom of the grid
- **Cause:** rows ended at the last START hour (10pm), but a chosen time is drawn as the whole job, and a 4-hour job from 8pm ends at midnight. The rows were defined by starts, not by when a job can end.
- **Fix (owner's direction: driven by job length, not a fixed cutoff):** `lastRowFor(duration, hasExterior)` works out the latest start the booking rules allow for this job (10pm, but no later than midnight minus its length, and 8pm for exterior), adds its length, and the grid keeps 10pm as its base, adding rows only down to that finish.
  - A 2-hour or 4-hour interior job adds an 11pm row.
  - A 1- or 2-hour exterior job adds none.
  - Added rows are never start times, so they're grey.
- **Also:** a line above the grid says "Each box is a start time. Pick one and the block shows the whole detail, start to finish."

### Verified
- **Tests:** 454 of 454, including `lastRowFor` and `recommendAddons`.
- **Headless Chrome with real data, 8 cases:**
  - widths 1440, 1280 and 760;
  - jobs of 1¼, 2 and 4 hours, interior and exterior;
  - 6am rush, 10am rush, 7pm rush and 8pm;
  - each block, and a hover preview, checked for any cut-off line and for staying inside the grid. All pass;
  - the grid ends at 11pm for interior jobs and 10pm for short exterior ones.
- **Extras** at 1440×790 and 375: the vehicle offer is on the first screen, everything is listed, and the cue shows.
- One test case was wrong, not the page: Maintenance Interior isn't offered on the package step.

## Round 4 (November 10, night): small fixes

- **"More below" cue on every step.**
  - **Cause:** on Extras at 1440×790 the first screen ended exactly at the bottom of a card, so it read as the end of the step (the "illusion of completeness" CLAUDE.md warns about).
  - **Fix:** a small "More below" button over a fade at the bottom edge. It shows only while more than 48 px is below the fold, hides near the end, scrolls on tap, and updates as panels open or times arrive (`updateCue`).
  - **Verified** in headless Chrome with real mouse input: shown on Extras, a click scrolls 338 px, hidden at the end.
- **The day bar no longer shows the grid through it.** Two causes:
  1. Past days (Sun, Mon) were faded with `opacity` on the whole header cell, so its background faded too and the hatched cells showed through. Now only the text fades.
  2. The day bar is seven separate sticky cells with 3 px gaps, and rows scrolling underneath showed through the gaps. One solid strip now sits behind the whole bar.

  **Lesson:** a sticky header built from separate cells needs one backdrop, and is never faded with `opacity`.
- **Gold lines:** a fine 1.5 px dash at 75%, instead of a 2 px dashed border.
- **The chosen block's fee:** in the Rush tag's gold, with a small grey note under it ("Rush 20%", "Early 20%", "Rush + late 30%"). Standard times show "Standard" in green with no note. Short blocks drop both.
- **Verified:** 445 tests; headless Chrome screenshots at 1440×790 of Extras with the cue and of the grid scrolled under the day bar, with a "6pm | +$64.50 | Rush + late 30% | to 10pm" block.

## Round 3 (November 10, night): small fixes

- **The chosen job reads as one price.**
  - **Before:** the block was see-through, so the "+$25" in every hour under it showed, and it looked like $25 an hour.
  - **Now:** the block is solid, with the start at the top, the job's fee once in the middle ("+$25", or "Standard"), and "to 1pm" at the bottom.
  - The hover preview works the same way. Blocks too short for three lines drop the middle one.
- **Gold dashed lines** (the site's `--amber`, as on the Rush and Early/Late tags) where a fee starts or stops: at 10am, at 6pm, and after the last rush day.
- **Wording:** "Hours are in Cincinnati Time Zone (EST)". It reads EDT in summer weeks, taken from the date shown, so it's always true.
- **Filming question:**
  - the same white rounded box as the Terms and texts questions, with small Yes and No buttons beside the question (stacked under it on phones);
  - the contact fields share one row on desktop, and filming comes before the Terms box;
  - at 1440×790, filming's Yes/No and the Terms tick are both on the first screen. Nothing was cut: the Terms and texts wording stays as it was;
  - the optional texts box is the only part below the fold.
- **Your answer:** "within 24 hours is a request pending a detailer" stays as built.
- **Verified:** 445 tests; in the browser, the solid block and preview values, 3 gold lines, the EST line, both required answers above the fold at 1440×790, and the phone at 375 with no sideways scroll.
- **Test note:** the Stripe and PayPal function tests call those services' real test servers and can time out on a slow connection. Re-run before suspecting code. Both passed on a re-run.

## Round 2 (November 10, evening): your answers and fixes

**New order:** Vehicle, Service, Package, Extras, **Where, Time**, Details, Confirm. The times offered depend on the drive there and on the weather at that address, so the address comes first. The fee is measured again for the time picked, because traffic matters.

### The time step
- **Our recommended times.** Three big options, soonest first (rush days included), at most two from one day, never an early or late hour.
  - Each shows its start and estimated end ("10am to 12pm"), with any fee in small grey text ("+$25 rush fee").
  - **One tap books it and moves on** (after the calendar re-check).
  - Within a day, Kris comes first when he's free.
- **See additional times** opens the week calendar, with "Our recommended times" to go back.
- **The week shows every bookable hour, 6am to 10pm.**
  - Early and Late are labelled up the side, in the Rush tag style.
  - Fee hours look as bookable as standard ones, with the fee in quiet grey.
  - A suggested hour has the same border as any other (a star marks it); only your choice is red.
- **The whole job is drawn.**
  - Picking a start draws a red block from start to estimated end, in that day's column, with the start at the top and "to 3:30pm" at the bottom.
  - Hovering a start previews a dashed block.
  - The summary above reads "Friday, November 13, 11am to 3:30pm". Other starts in that hour are one-tap chips with end times.
  - Phones list each hour as "10:30am to 2:30pm".
- **Header:** "Pick your time" with "Nothing is charged until the next step. Pick what works for you." in small grey underneath.
- **Placement:** "None of these work? Tell us when does" sits beside "See additional times", and in the calendar view at the right of the "Go to a date" bar. "What time could we start?" replaces "And what time of day could you start?".
- **No preselection any more:** the three recommendations replace it.

### Your answers
| Answer | Built |
|---|---|
| Filming: always ask, required | Back on the details step as a required Yes or No. The Terms wording ("we ask at the time of booking") stays true |
| Some questions must feel mandatory but not block | Water, power and parking are back on Confirm, worded as ordinary questions, no "Optional" tag. A booking never fails for want of them. The Done-screen follow-up is gone |
| 1 hour notice is fine, but say it isn't confirmed | Earliest start is now + 60 minutes. Within 24 hours it's a **short-notice request**: said on the option, Confirm, Done ("Request sent ... not confirmed until we reply") and in your email subject |
| Large vehicles take longer | Medium +15 min, large +30 min, in the quote, the calendar hold, the time offered and the server's own check |
| Kris: own calendars, interiors only, can overlap, prefer Kris | `DETAILERS` setting (see `docs/ADD-A-DETAILER.md`). Each detailer's calendars are checked on their own; every time goes to the first person free who can do the whole job; the job is written to their bookings calendar, titled "Kris: ..."; your email says "Detailer: Kris". Nothing changes until the setting exists |
| Weather | National Weather Service, free, no key: two plain JSON GETs for the customer's location (address pick, else ZIP centre). Exterior: not under 40°F, not over 4 mm/h rain. Correction, polish, coating: not under 60°F, no rain. Past the forecast (about 7 days) exterior is open March to October and correction May to September; if the forecast can't be read, the season rule applies. A note explains greyed-out times ("Exterior details are back in spring") |

### Bugs found and fixed (root causes)
1. **The calendar stopped at 5pm.**
   - **Cause:** the fallback hours (used when no calendar can be read) were built from the browser's local midnight, ignoring their own `timeZone`. On a Mac set to Central European time, "5am to 1am" became 11pm to 7pm in Cincinnati, so a 2-hour job's last start was 4pm.
   - **Who it affected:** the original funnel used the same code, so it had the same limit for any visitor outside Eastern time. With the real calendar, both run to 10pm (8pm for exterior). Two weekday checks (correction weekends, weekend anchors) had the same mistake.
   - **Fix:** all three use Cincinnati time. A test fails on the old code under a Paris clock and passes on the fix in New York, Paris and Tokyo.
   - **Also:** the grid now always draws 6am to 10pm, so a week with no evening openings no longer reads as "we close at 5".
2. **Selection wasn't obvious on suggested times.** Suggested cells had a darker border than the selection ring. Now every cell has the same border, and the choice is a red block.
3. **Only the start showed.** A cell marked one hour, so a 4-hour job looked like a 1-hour slot. Calendar apps draw an event from start to end, and booking pages (Calendly, OpenTable) list "start to end". The grid, list, summary and recommendations now all show the full span.
4. **Privacy: the jobs calendar was public with full details** (live today).
   - Jobs written by the booking function carry names, phones and addresses.
   - **Fix (needs you):** read jobs calendars through Google's free/busy endpoint (start and end only), then hide details on the calendar. Steps are in `docs/ADD-A-DETAILER.md`, Part 1. Kris's bookings calendar is set up that way from the start.
5. **Stale server bundle.** The booking function's built file (`_pricing.mjs`) hadn't been rebuilt, so `parseDetailers` didn't exist there. The functions test caught it before anything shipped.
   - **Lesson:** after changing `server-entry.ts`, rebuild with `npm run build:server` (the full build does).

### Verified
- **Tests:** 445 of 445 in Eastern time.
  - New: week, weather, crew, fallback hours, busy-only calendars, and the server writing Kris's job to his calendar.
  - The new modules also pass on a UTC clock (and the fallback-hours and calendar tests in Paris and Tokyo).
  - Retired: preselection.
  - The 14 to 17 scheduling tests that fail outside Eastern time build their dates in local time. They fail identically before and after, so they're test-only.
- **Browser, with the live calendar (read-only):**
  - Where, then Time, then a recommendation;
  - one tap moves on after the re-check;
  - filming required;
  - setup questions on Confirm;
  - short-notice wording;
  - Kris gets the interior job and you the exterior (with a test Kris pointed at your calendars, in the preview only);
  - the weather request and the free/busy read work from the browser;
  - phone layout at 375 wide.

  All sends were faked inside the page.
- **Not verified:**
  - real Places coordinates (no Places key locally; the ZIP centre was used);
  - a real calendar write to Kris's calendar (tested with a fake Google);
  - your personal calendar feed (not available locally).

### Questions for you
1. **Rain threshold:** is 4 mm an hour the right meaning of "heavy rain"? It's one number, easy to change.
2. **Polishing:** I counted it with correction and coating (60°F, no rain). Right?
3. **Season months:** exterior March to October past the forecast, correction May to September. Right?
4. **Short notice:** "within 24 hours is a request" OK, or a different window?
5. **Part 1 of `docs/ADD-A-DETAILER.md`** (private jobs calendar): OK to do once this branch is live?

## The new path, shortest case

| | Before (`eNov6`) | Now |
|---|---|---|
| Screens | 9 | **8** (Vehicles screen folded into Extras) |
| Taps, Book Now to booked | 15 | **about 11** |
| Required typed fields | 5 (street, city, ZIP, name, phone) | **3** (street via the address pick, name, phone) |
| Required answers | 13 | **8** (size, service, package, time, address, name, phone, terms) |

The time counts as answered because our suggestion is preselected. These numbers are counted from the flow, not measured on real customers.

## Round 1: your answers, and what was built

> Superseded where Round 2 above says otherwise: no preselected suggestion (three recommended times instead), filming back on the details step as required, water, power and parking back on Confirm, Where before Time.

| # | Your answer | Built |
|---|---|---|
| 1 | Full week, Sunday to Saturday | The time step is a week calendar with ‹ › chevrons, a "This week" link and "Go to a date". It opens on the current week. If that week has nothing open, it moves forward to the first week that does |
| 2 | Unavailable in grey; intuitive and on-brand | Grey hatching means unavailable. Green with a tick is standard price, amber with "+$36" is a fee, and red is "your choice". Each state has a mark besides its color. The legend sits above the calendar |
| 3 | Up to me | One "Unavailable" state. It doesn't show how full the calendar is |
| 4 | Show every hour, but steer (maybe default 10am or 4pm) | Every bookable hour shows. A ★ marks the day's suggested starts: right after an existing job first, otherwise 10am and 4pm (10am, 1pm and 4pm at weekends), never an early or late hour. **One suggestion is already selected** on the first day without the rush fee, in a box above the calendar ("Our suggestion ... Continue to take it, or pick any other time below") |
| 5 | Cap at 3 months | `MAX_BOOK_DAYS = 92`. The forward chevron and the date box stop there, and the page says "we take bookings up to 3 months ahead" |
| 6 | SMS an unticked checkbox; filming after booking | Terms is one required tick box. Texts are an optional, unticked box. Filming is asked on the Done screen |
| 7 | Keep the upsell, make it easier to skip and browse | Extras opens with "**Recommended for your [package]**" (2 or 3 add-ons). The rest folds under "See all extras (N)". The button reads "**No extras, continue**" until something is added |
| 8 | Get the real capacity facts; steer toward what's efficient for the business | See "Capacity" below. The steering is: suggested starts that pack the day, a preselected standard-price time, and recommended add-ons that earn the most per hour of work |

## My ideas from `BOOKING-PIPELINE.md`

| # | Idea | Status |
|---|---|---|
| 1 | Address pick fills city, state, ZIP | **Built.** One Place Details call in the same autocomplete session, so it's billed as one session. If it fails, the old behavior remains. Tested with a faked Google reply, because localhost has no Places key; **check it on the deploy preview** |
| 2 | Terms box; SMS optional; filming later | **Built** (answer 6) |
| 3 | Fold Add another vehicle into Extras | **Built.** One line with the real saving ("10% off both, $51 on one like this"). The vehicle list appears once there are two. The optional make-and-model box moved to Confirm |
| 4 | Remove the "within 3 days" checkbox | **Built.** The rush fee is now set from the chosen time |
| 5 | Inline checks for phone and ZIP | **Built.** They run as the field is left |
| 6 | Merge Service into Package | **Not built** (see question 5). It changes the first decision screen and the Help me decide and Browse entry points. Better as its own change |
| 7 | Water, power, parking off the Confirm screen | **Built.** On the Done screen with filming, under "Help us prepare (optional)". Sent as a "BOOKING FOLLOW-UP" email by its button, or automatically when the Done screen closes with anything answered |
| 8 | Promo box in one place | **Not built.** The code says the package-screen box is there on purpose: customers holding a code want to watch it come off while they choose |
| 9 | Single column on phones | Already true; nothing to change |
| 10 | Progress bar follows the customer's own path | **Built.** Help me decide no longer jumps from 22% to 67% |
| 11 | Weekly calendar picker | **Built** (answers 1 to 5) |

## Decisions I made on my own

- **The suggestion is preselected, not just marked.** That is your "default selection" idea. It never preselects:
  - an early or late hour;
  - a rush day, while a week has anything else;
  - anything for someone who chose "Help me choose a time". That would quietly turn their request into a booking.

  A tapped time stays put when weeks change; only our suggestion moves.
- **The suggestion box sits above the calendar.** Early rows push standard hours below the first screen, and the steer should be the first thing read.
- **No per-day job cap in the browser.** The 3/3/1 pattern is Chris's capacity (from your voice note), and nothing enforces it today. A browser-only cap is easy to get around. It belongs in the calendar's OPEN blocks or a server rule; see question 4.
- **Every booked time is now shown in Cincinnati time.** This was a real bug (below).
- **Recommended add-ons:**
  - Interior: pet hair, stains, ozone, steam.
  - Exterior: tire and rim shine, engine bay, headlights, paint decontamination.
  - Anything already included in the package drops out. Full Exterior already has the first two exterior picks.
  - Chosen from popularity and earnings per hour of work. Each list runs longer than it shows so there are always 2 or 3.
- **Kept:** the "Want to add anything?" picker on Confirm. It's one line and the last chance to upsell.
- **Kept:** the multi-day job list (a three-day job doesn't fit an hour grid) and the Help me decide path (now with the calendar too).
- **Drafts:** the saved-draft key moved to v2, because step numbers changed. An old saved draft starts fresh instead of landing on the wrong screen.

## Bug found and fixed: times shown in the visitor's time zone

- **Symptom:** the Mac running the preview is on European time. The Time tab read "Nov 12, 4 PM" for a 10am Cincinnati start.
- **Root cause:** every display of the booked time used `toLocaleString` with no `timeZone`, so it followed the visitor's clock. That included the subject and body of the booking email Elijah receives. The scheduling maths was always right, because it uses Cincinnati time; only the words were wrong. Anyone booking from outside Eastern time, or Elijah reading the email while away, saw a wrong time.
- **Fix:** all 16 displays pass `timeZone: 'America/New_York'`.
- **Lesson for `CLAUDE.md` when this merges:** a booked time is shown with `timeZone: TZ`, never the visitor's zone.

## Capacity, the ground truth for question 8

From the live calendar (read only), the code, and your voice notes:

- **The OPEN blocks restrict nothing.** The 513 Availability calendar is OPEN every day, 6am to midnight, for the next 3 months.
- **No customer jobs are booked** in that time.
- **What actually limits times is Elijah's personal calendar feed** (`/api/personal-busy`). It blocks recurring weekday times through about December 11, then almost nothing. Sundays are essentially free.
- **3/3/1 (3 jobs Sunday, 3 Monday, then 1 a day) is Chris's capacity** in the voice note. Nothing in the code or calendar enforces it, and the scheduler books one van.
- **Earnings per hour of work** (including about 1 hour of travel and setup):
  - Full Exterior earns the most, $49 to $54 an hour.
  - Showroom Interior is $49 to $53, and the Interior + Exterior combo $48 to $51.
  - Express Exterior earns the least, $33 to $44.
  - Among add-ons, an engine bay is about $100 an hour and tire and rim shine about $90; most others are about $50.
- **Side findings:**
  - The Google Calendar key answers requests from any website (it isn't restricted by referrer).
  - A same-day booking about an hour ahead is possible, with the rush fee.
  - A large vehicle adds price but no time.

## Questions for you

1. **Filming wording.** Terms section 10 says "We ask separately, at the time of booking". It's now asked on the Done screen, right after booking, and if skipped we treat it as no. Keep the wording, or change it to "right after you book"? (A legal text change, so not done on this branch.)
2. **Calendar key.** Restrict it to your domains in the Google Cloud console? It currently answers requests from any website.
3. **Minimum notice.** A booking about an hour ahead is possible today, with the rush fee. Set a minimum, such as 12 hours?
4. **Capacity and Chris.** Should the site enforce 3/3/1 (in the OPEN blocks, or a server rule)? Does the booking form need to book Chris before the November 23 marketing push? Per-technician scheduling isn't built.
5. **Merge Service into Package** (idea 6): build it as a follow-up, or leave it?
6. **The ★ also shows on rush days**, marking the hour that packs that day best. Our suggestion itself never picks a rush day while another day is open. OK?
7. **Large vehicles:** do they really take no longer than small ones? If they do take longer, the scheduler books too little time for them.
8. **Push this branch to GitHub?** It's local only, per the rule that anything outside `eNov6` needs your OK.

## What to test

- **Desktop (1440 and 1280 wide):**
  - Book Now, then a package, through to Time;
  - a suggestion is preselected above the calendar, and Continue takes it;
  - tap a fee hour: the summary names the fee and the total moves;
  - ‹ ›, "This week" and "Go to a date" work, and nothing goes past 3 months.
- **Phone (375):**
  - the day strip and hour list show, with no sideways scroll;
  - Rush tags appear on the first 3 days;
  - a day with nothing open says so.
- **Extras:**
  - Full Interior, Full Exterior, and both together each show sensible recommendations;
  - "See all extras" opens;
  - "No extras, continue" changes to "Continue" once something is added;
  - Add another vehicle works, and the 10% saving shows.
- **Contact:**
  - Continue with Terms unticked is refused, with a message;
  - texts are optional;
  - there is no filming question.
- **Confirm:** make-and-model box and notes box; no water, power or parking questions.
- **Done:**
  - "Help us prepare" asks filming, water, power and parking;
  - Send shows a thank-you;
  - closing with answers still sends them.
- **On the deploy preview, with real keys:**
  - real calendar times and Elijah's busy times;
  - the address pick fills city, state and ZIP;
  - the follow-up email arrives with the booking.

## Verified tonight

- **Tests:** 427 of 427 in Eastern time. That's 10 new for the week calendar, also passing on a UTC clock, and 3 new for the funnel. The 5 old tests that described removed screens were rewritten for the new ones.
- **In the browser (localhost, desktop and 375 wide), the whole flow to the Done screen:**
  - the email and calendar calls were faked inside the page, so **nothing was sent**;
  - the booking email's text was checked: time in Cincinnati time, "SMS: no", "Filming: asked after booking";
  - the follow-up email's text was checked;
  - the rush-plus-early fee is right: $255 × 1.3 = $331.50;
  - after "Help me choose a time", no time is preselected.
- **Not checked yet:**
  - real calendar data (localhost has no calendar key, so the preview uses standard hours);
  - a real Places reply;
  - keyboard arrow-key movement around the grid (Tab works; arrow keys aren't built);
  - any real send.

## Leftovers noticed, not touched

- `book.css` still has `.bk-time`, `.bk-times`, `.bk-bucket` and `.bk-juston` rules from an older slot design. They were unused before tonight.
