# Booking pipeline overhaul: branch `eNov10PipelineBranch`

Built overnight, November 10 to 11, for you to evaluate. It combines your 8 answers with the 11 ideas in `docs/BOOKING-PIPELINE.md`.

- **Scope:** only the booking form and the code it uses.
- **Branch:** started from `eNov6` at `fb29b30`. On November 11 the calendar time-picker branch was merged in, `eNov6` was fast-forwarded to this branch, and both were pushed to GitHub as a backup. Nothing is on `main`.
- **To see it:**
  - Local preview: <http://127.0.0.1:8790>. Open any Book Now.
  - If the preview isn't running, run `scratchpad/pipe-publish.sh` and start `scratchpad/demo-server.py 8790 scratchpad/pipe` (paths are in the session scratchpad).
- **Files changed:**
  - `js/funnel.js`, `book.css`;
  - `web/lib/availability/week.ts` (new) and its tests;
  - `web/lib/browser-entry.ts`, `js/pricing.bundle.js` (built), `web/lib/funnel.smoke.test.mjs`.
  - The build also re-stamps `?v=` on every page. Those page changes were left out of the commit; a rebuild after merging restamps them.

## Round 19 (November 11, late): honesty audit, follow-up validation, merges

### Honesty audit (a check of every promise against what the code does)
- **Privacy policy (dated 2026-11-11, relocked):** names the private bookings calendar the jobs are written to, drops the reminders Resend does not send, and lists the after-booking answers among what we collect.
- **Short notice is a request everywhere:** the next steps, the customer email ("not confirmed until a detailer accepts it"), the owner's subject and heading ("SHORT NOTICE REQUEST"), and now the calendar event's title too. Root cause: short notice was added to the Done screen only, so three other places still said "confirmed".
- **Texts only for people who said yes:** the ETA text line appears only with SMS consent; everyone else reads "a call before we set off". The SMS opt-in wording says what is sent, how often, and STOP/HELP.
- **Smaller wording:** the filming promise matches the terms word for word; Full Interior's note names Stain Treatment and Ozone Odor Reset; the rating badges say "on Google" (the count is Google's alone, "& Yelp" was not true).
- **Clarity never records the booking form:** `data-clarity-mask` on `#bookFunnel` (`web/partials/scripts.html`). Balanced masking hides what is typed, not the Review screen that shows it back.
- **`/golf` and `/prestige`** redirect (302, temporary) to the home page tagged `utm_source=golf|prestige&utm_medium=print&utm_campaign=qr`, until the magazine pages exist.
- **`GOOGLE_CALENDAR_SERVER_KEY`** (optional): the booking functions use it first, so the browser key can be locked to the site's pages. Until it is set, don't restrict the browser key.
- **How far ahead: the same as the live site** (your call, November 11): the form offers 365 days again (it was 92 from the November 10 answers) and the server allows 400, as on `main`. The page says "We take bookings up to a year ahead" in the last bookable week. An audit fix had cut the server to 93 days; that is undone. Owner question 17 asks whether to shorten it.
- **CSP:** `api.weather.gov` added to `connect-src` (the forecast fetch would have been reported as a violation).
- **Docs brought up to date:** DETAILER_HOMES done, Google sign-in done, the colour scale, and the calendar switch-over order (below).
- **`npm run gcal:token`:** a Web application client (Google's docs: a localhost redirect is a web client), accepts the downloaded JSON's path, cleans pasted values, never opens a browser itself (it opened the wrong Chrome profile).

### The calendar switch-over, corrected
The 513 Auto Clean jobs calendar goes free/busy only **the minute this branch is live in production**, not before (today's live site reads its events in full and would stop seeing jobs) and not later (from that deploy, jobs written there carry customer names and addresses). The setting also hides events written before it. In `LAUNCH-CHECKLIST.md`, `DETAILERS-GUIDE.md` and `ANALYTICS-SETUP.md`.

### Bugs from the optional-questions validation, fixed (each verified in headless Chrome and against the server handler)
1. **Critical: a second booking in one visit crashed.** At checkout, Back and × move into the step bar; `done()` replaced the whole bar and deleted them, so Done had no × and the next `open()` or "Book another vehicle" threw. *Root cause:* two places own the bar, and only `renderNav` put the buttons back first. `done()` now does the same.
2. **Requests never said which days were asked for** (both emails said "not selected"). *Root cause:* the email read `state.preferredWindows`, which the old day picker filled and the new one does not. Both emails now print the days and parts of the day (`askedFor` on the server).
3. **Old answers were sent again as a "follow-up".** *Root cause:* `prepAnswered()` asked "is anything filled", not "did anything change on Done". It now compares with a snapshot taken when Done opens.
4. **"not answered" and "(not named)" on every booking email and calendar event.** Gone: the lines appear only when answered, otherwise one line says the answers come by follow-up email.
5. **Typed answers lost** on closing the tab, on "Book another vehicle", and racing "Something needs changing". Now sent on page hide and before the next booking, with `keepalive`. The next booking gets its own booking key.
6. **Wording per path:** a flexible day says "we confirm the day, usually within a few hours, and let you know the start time by the evening before" everywhere (Review, Done, steps, email); Review calls a request a request; "by email" only when they gave one; a booked time no longer says "only really settled once you have heard back" (requests still say it); "before travel" only while the drive is unmeasured; Help me decide without a time says it is a recommendation request, and its owner email says nothing is held and shows what they wrote; the travel line in both records says what the total holds; the promo saving is said once.
7. **Closing while Confirm was sending** sent an "unfinished booking" capture and hid the Done screen. Close waits for the send (up to 20 seconds), and nothing is captured mid-send.
8. Smaller: "Water: not sure" (not "unsure"); Help me decide's email has no "$0 total"; the abandoned-checkout phone check matches the server's (no area code starts with 0 or 1); the Yes / No / Not sure buttons are 44 px; Done has no empty footer strip on phones.

### The setup answers now reach the detailer (your go-ahead, November 11)
- **New function `booking-followup`** (`/api/booking-followup`). When someone answers "Help us get ready" for a booked time, the answers are also written onto that booking's calendar event, on whichever calendar it went to (Kris's jobs land on 513 Kris Bookings), under "AFTER BOOKING (Help us get ready)". Sending again replaces that part; it never repeats.
- **Why it can't be misused:** it only finds an event this site wrote, by the booking's own key, and only if the phone number matches the one the booking was made with (now kept privately on the event). It only works within 3 days of the booking, only touches its own section, gives the same answer for every miss, and is rate limited. It sends no email.
- The owner's follow-up email still goes as before. The thank-you says "Thanks, it is on your booking / Your detailer sees it with the job" when the calendar took it, otherwise "Thanks, we have it". A request (no detailer yet) shows "Send to us" instead of "Send to your detailer".
- **To test on a deploy preview:** book a time, answer on Done, press Send, then open the job on its calendar: the answers are at the bottom. Needs the Google sign-in values, which are set.
- Tests: `web/lib/booking-followup.test.ts` (5), and the function is in the hostile-input smoke test.

### Final validation of the merged `eNov6` (fixed, re-checked on 8799)
- **"Tell us when does" was a dead end** ("Carry on" with no Continue). *Root cause:* the Time section draws its Continue at render time only for a time or a request, and the day and part-of-day buttons update in place without a render. The handler now adds or removes the Continue itself. Re-checked: day plus midday, Continue, Agree, Review, Send request.
- The Done crash, "before travel" and the two savings figures were already fixed above; the multi-vehicle bar now says "multi-vehicle saving applied" too, so the amount is said once, in the table.
- **Phone package cards** (560 px and under) line up on the left again: a desktop rule (`.bk-pkgcard .bk-pkg { align-items: center }`) outranked the phone rule.
- **360 and 320 px:** the header tag line hides up to 364 px (the header was 361 px at 360 and the phone zoomed out); the Range & Travel tool and the home hero buttons no longer run past 320. Re-checked: page width equals the screen width on Home, Services and Range & Travel at both sizes.
- **Focus** stays on the promo box (or its Remove) after Apply, and on the extra after adding it, instead of falling to the page.
- **Smaller:** the checkout chip names vehicle 1's detail, then "+1 vehicle"; the request time bands say "usually +20%" (Kris's evening interior starts are standard); Help me decide's intro says a time within the next day is a request; Send with nothing answered says "Answer any of the questions above, then send."
- **Services full lists** open from 940 px tall (was 900): since the eyebrow came back (owner, November 10), the banner under full lists ended at 926. At 1440×790 the Book buttons end at 698 and the banner at 801, 11 px under the screen, as after the eyebrow decision; tell me if that should be tightened.

### Review price table: extras as plain lines (owner's screenshot, November 11)
- **Bug:** each extra on Review drew as a big bordered box with a hover lift that did nothing. *Root cause:* the table gave each row its line kind as a class, and an extra's kind is `addon`, the class of the site's add-on cards on the Services page (`styles.css .addon`). Rows are now `ln-` + kind; only `addon` collided.
- **Now:** a bold "Extras:" line with no price, then each extra indented, with its option in grey only when it adds something ("Stain Treatment  Moderate to major removal  $100"), prices in the usual column. With several vehicles, "Extras (vehicle 2):".
- **To test:** Review with two extras, at 1440 and 375 wide.

### Day timeline: one block at a time, fee words where you can see them (owner's screenshot, November 11)
- **Bug: a big "Suggested" box, only sometimes.** *Root cause:* with a time already chosen (often the suggested one, picked from the recommended cards), the timeline draws that job as a block. Pointing at another start drew the preview block on top of it instead of replacing it, so the two overlapped and the chosen job's visible top hour, tagged "Suggested", read as the suggestion taking a whole block. It only happened with a time chosen and the pointer on a start inside its job. Now pointing hides the chosen job and its rows show again; blocks carry no "Suggested" tag, so a suggestion is only ever its own row with the star.
- **The fee in words on the first row you can see.** The words ("+$25 rush fee", "Standard price") were on the first row of each same-price stretch even when a block covered that row, leaving "+$25" alone below it. Rows under a block (chosen or pointed at) now count as hidden; otherwise still once per stretch.
- **Earlier and Later times fold again** whenever the day or the week changes (day buttons, the week arrows, This week, Go to a date), as they do when the calendar opens.
- **To test:** pick a recommended time, open See additional times, point at a start inside the chosen job (one block only, the suggested row back with its star); open Earlier times, then change day: folded again.

### Timeline follow-ups (owner, November 11)
- **Fee words follow scrolling** ("the highest visible row in general"). The highest row you can see of each same-price stretch says the price in words. A row counts as out of sight when it is scrolled above the window's top, under the phone's pinned part-of-day heading, or under a block. It updates on every scroll, resize and repaint (`markAllLeads`, from `updateCue`). Re-checked by scrolling at 1440 and 375 px.
- **The day bar measures against this job.** It showed open starts out of 33 (every half hour, 6am to 10pm), but a long detail must finish by midnight and exterior work starts by 8pm, so a free day read about 85% for a 4.5-hour job. It is now out of the starts a free day could offer this job (`startsPossible`: 28 for 4.5 hours, 29 for a 2-hour exterior job). Free days read 100%.
- **The suggested star stays visible over a block** (chosen or pointed at), on its own row; the rest of a covered row stays hidden.

### Day timeline layout, option C (owner's pick, November 11)
- **Why:** the half-hour rows ran the full width with only a small price in them, the hour labels were small and grey, and a job block was a big empty box. About 6 hours of a day fitted a laptop screen.
- **Now** (tablets and up; phones keep their list):
  - hour labels are 1rem and extra bold, half hours 0.84rem and not faded;
  - rows are 30px high (36 before) and 18rem wide, so about 8 hours fit;
  - a card beside them shows the day, the time, its price in words, "Arriving between 6 and 7am" and the detailing time, with a red "Choose this time" button. It shows the chosen time, else the suggested start, else the first, and follows the start being pointed at. Its button is the same start as the row, so it picks the time the way a tap does. It stays in view while the day scrolls;
  - the block says the time and "About 2 hrs detailing" (the price is on the card).
- **To test:** See additional times at 1440, 1024 and 820 wide: point at starts (block and card follow), scroll down (the card stays), press Choose this time (the form moves on).

### Still open from that validation
- When the card-on-file switch goes live, its payment box should carry the short-notice line and the "a few quick questions" line too (latent: the switch is off).

### Checked
- Tests 518 of 518 (Eastern time). Validation scripts re-run on the rebuilt preview: Done keeps ×, reopen and "Book another vehicle" work with no console errors, one follow-up per change, none untouched, page hide sends typed answers once; server emails show the asked-for days, the short-notice heading and event title, no "not answered".

## Round 18 (November 11): Review as option D, setup questions after booking

### What changed
- **Review and book, option D (owner).** The review is the price table, the time, two rows that open in place ("Have a promo code?" and "Add an extra"), one "Nothing to pay today" box, and Confirm: under one phone screen (604 px at 375, against about 3 screens before). The duplicate "Pay after the detail" card is gone when there is nothing to choose. An opened row stays open while extras or a code change (`state.revOpen`).
- **"Help us get ready", after booking (owner).** The Done screen asks the outdoor tap, outlet, parking, vehicle and notes questions in one card, with a red **Send to your detailer** button (owner's colour). The answers go to the owner as a "BOOKING FOLLOW-UP" email through Web3Forms, as in round 1; if the screen closes with anything answered, they are sent quietly (`sendPrep(true)` in `close()`). Answering a question on the Done screen no longer scrolls the page.
- **Price table.** The arrival line has its own full-width row under "Your time". *Root cause of "Basic / Interior" wrapping:* the arrival line sat in the price column with `white-space: nowrap`, so that column took the room the labels needed.
- **Phone checkout bar.** Tab names only, so all four fit between back and close. *Root cause of the clipped "CONTACT":* the sub-labels ("Cincinnati", "Nov 13, 6pm", "$134.75") made the bar wider than a phone, and it scrolled under the back arrow.
- **Weather, said at the top.** When the forecast removes days, one line under "Our recommended times": "Cold weather limits exterior times to about the next week." The full note stays at the foot. This explains why a cold-weather exterior job can show only "Soonest" and "Also open": every day left is inside the 3-day rush window, so there is no "In 3 days" or "Weekend" day to offer.

### What to test
- Review on a phone: under one screen; open "Add an extra", add one, the row stays open and the total changes; apply a code in its row.
- Book: the Done screen shows "Help us get ready"; answer and press Send (a follow-up email arrives); answer and just close (it is still sent); answer nothing and close (nothing is sent).

### Flagged for future review (owner, November 11)
- **Exterior bookings almost always pay the rush fee in cold months.** The weather rules leave exterior times only inside the forecast (about a week), and the rush window is 3 days, so in winter most exterior and combined jobs can only be booked with the rush fee. Consider a rush-fee bypass for exterior work, for example no rush fee for exterior bookings more than 1 day out, or no rush fee when the weather is what limits the dates.

## Round 17 (November 11): fees from the calendar, homes per detailer, the arrival hour

### What changed
- **Fee standard B (owner).** Each OPEN block's title sets the early or late fee for starts inside it: `OPEN` standard, `OPEN +20%` twenty percent, any percentage. With a rush, the two are capped at 30% unless the block alone asks for more. A calendar with no OPEN blocks keeps the clock rule (+20% before 10am or from 6pm). The payment and booking functions read the same block from the detailer's calendar (`_detailers.mjs` `blockFeeFor`). If the calendar can't be read at that moment, they keep the fee the customer was shown, never more than the clock rule.
- **Each detailer drives from their own home (owner).** `DETAILER_HOMES` in Netlify, server-only and secret, is JSON by name: `{"Kris": "address"}`. The travel function, the card and PayPal functions and the booking email measure the drive from that home. The booking form measures each detailer's drive once per address (`/api/travel?detailer=`), so each detailer's offered times allow for their own drive, and the fee follows whoever has the chosen time. Not listed: the shop address, as before. Home addresses never go into `DETAILERS`, because that setting is written into the public page.
- **The arrival hour (owner).** A start is an arrival window, "6pm" meaning 6 to 7pm, so the drive may use it, after an OPEN block begins or after a previous job ends. The job is planned from the real arrival. Default 60 minutes; `"arrivalWindow"` in a `DETAILERS` entry changes it per detailer. Kris's 6pm is now offered.
- *Root cause, fees not read for Elijah:* `loadCrew` rebuilt the owner's window field by field to add his personal calendar, which dropped the new fee list. It now copies the window whole.

- **Promo code on the package page (bug, owner).** "Have a promo code?" opened onto nothing until a package was picked; most noticeable on Both, which starts with nothing picked. *Root cause:* the box draws nothing before there is a price (a rule from when it sat open on the page); round 16 put it inside the fold. Inside the fold it now always shows, and a code typed first applies once a package is picked.
- **Icons in the done rows (owner).** Vehicle, Service, Package and Extras show their picture between the step name and the answer (the size's car, the service's picture, a sparkle for extras).
- **Both: on to the exterior list (owner).** Picking an interior package with no exterior yet scrolls the Exterior list up.

- **Package "How it works", option A (owner).** Two short lists, "Includes" (the components; "Everything in Basic, plus" for a step-up package) and "Not included", then one line on what to do about it. The not-included items and the tip come from each package's own "It does NOT" sentence (`notIncluded` and `tip` in `web/lib/catalog/seed.ts`). The old paragraph helper `noteWithoutList` went with it.
- **Checkout top bar (owner).** At checkout the title row is gone: "Checkout" is the bar's own heading, the detail is one chip ("Basic Interior", "Small · Edit") that goes back to the first page, and back and close sit at the bar's two ends. On a phone the bar is the four checkout tabs alone. About 70 px more for the content on a laptop, 80 on a phone (three recommended times fit on a phone).
- **Time headings (owner).** "Our recommended times" now uses the small group-label look (as "Interior" and "Exterior" on the package page), so it reads as a sub-heading under "Pick your time".
- **Space under the done rows (owner).** 1.1rem between the last done row and the open section's heading.
- **Error messages in side-by-side rows (bug, owner's screenshot).** A Phone error lifted Phone's label and box above Name and Email.
  - *Root cause:* since round 16 a field's message went inside the field, and the Name, Phone, Email row aligns its fields on their bottoms, so the taller field moved up. The same cause, a message placed next to a control that sits in a row of side-by-side items, also affected the vehicle and service pictures, the package cards, the request days and the week grid (a squeezed column inside the row), as it once did the recording Yes and No.
  - *Fix, at the root:* `placeMsg` never puts a message inside a row: it climbs out of every multi-column flex or grid row and places it under the whole row. The two field rows (`.bk-row2`, `.bk-row3`) give every field three aligned tracks, label, box and message (CSS subgrid), so a message sits under its own field and nothing else moves; labels still align on their bottoms. Text boxes get the red outline themselves (`outlineOf`), not their whole column.
  - Test: Continue with Name and Phone empty and a bad email at 1440, 820 and 375; City empty and a 3-digit ZIP.
- **"About 4 hrs detailing" (owner).** The time line reads "arrive 4 to 5pm · about 4 hrs detailing", in the Time row and in Review.
- **Live-site check after the calendar split (November 11).** The live site's code (main) reads the split blocks as separate days in two places. Jobs that run across two days got no times; 10:00 counted as a start of day, so a 10am booking could follow a job ending at 10am with no drive time; and the first evening time today moved from 6:30 to 7pm. Ordinary single-day times and prices were unchanged.
  - *Root cause:* `computeSlots` built `dayOpens` (and `dayCloses`) from the unmerged OPEN blocks, and `multiDay.ts` `covered()` needed one block to cover a whole day. Fixed in the pipeline: both use merged stretches.
  - *Live fix, calendar only:* Elijah's 513 Availability goes back to one `OPEN` 6am to midnight, Busy, with the two `OPEN +20%` blocks laid over it, set to Free. Main ignores Free events. The pipeline counts OPEN Busy or Free and takes the higher fee where blocks overlap (`blockFeeAt`).

### Must happen before this goes live
- ~~Retag the OPEN blocks~~ Done November 11 by the setup session, checked: Kris and Elijah read +20% before 10am and from 6pm, standard 10am to 6pm, Kris standard 6 to 7:30pm Tuesday to Saturday, in the booking form and in the server's own read. The live site is unaffected (it reads `OPEN +20%` as OPEN and merges touching blocks).
- ~~**`DETAILER_HOMES`** with Kris's address~~ Done November 11 (Netlify, marked secret).
- **Make the 513 Auto Clean jobs calendar free/busy only the minute the first production deploy of this branch goes live.** The Google sign-in values are in Netlify for every context, so that deploy starts writing customer names and addresses onto the calendar, which today is shared publicly with full details. Not earlier: the live site (`main`) still reads that calendar's events in full and would stop seeing jobs. The setting also hides events written before it. Steps in `docs/DETAILERS-GUIDE.md`.

### Checked
- Tests 502 of 502 (Eastern time), 13 new.
- Preview against the real calendars: Kris's 6pm leads Wednesday, Friday and Saturday; your times read your calendar.

## Round 16 (November 10, late): the checkout as folding sections, two reviews, an engine check

### What changed
- **The checkout works like the first page.** Contact, Address, Time, Almost done, Review: one open at a time, each with its own Continue, folding to a summary row with Change. The top bar has two groups, YOUR DETAIL and CHECKOUT. `*` Required and "(optional)" labels are back.
- **From the two checkout reviews (fixed):**
  - A chosen time stays done only while it still fits. An extra or a second vehicle that makes the job longer re-checks the time; if it no longer fits, Time reopens and says why ("Your detail now takes about 3 hrs, so the time you picked no longer fits"). *Root cause:* the time was checked only at Confirm, which then said, wrongly, "Someone booked that time".
  - A resumed draft whose time has passed reopens Time ("The time you picked has passed"). *Root cause:* drafts kept `slot` with no age check.
  - "Someone booked that time" now shows at the top of Time. *Root cause:* `flash()` had no field to sit by, so it went to the foot of the form, under the week grid.
  - Every problem in a section shows at once, each inside its own field's box, so the row keeps its shape. The outline and the message stay until that field is right, then go (they used to stay or vanish on a 3 s timer). `aria-invalid` and `aria-describedby` are set.
  - Leaving a finished section that has since been broken (phone changed to "555") keeps it open, with the message. *Root cause:* opening another section did not re-check the one being left.
  - After a section opens, focus goes to its first field, or else to its heading. *Root cause:* only Contact and Address had `data-focus`, so focus fell to `<body>`.
  - After Continue, the whole checkout is shown from the top when it fits; otherwise the folded row just above the open section. *Root cause:* scrolling to the section title left the rows above half under the header.
  - The chosen time reads one way everywhere: "Fri, Nov 13 · arrive 10 to 11am · about 2 hrs". "10am to 12pm" next to "arrive 10 to 11am" read as two promises.
  - The time in Review is ink, not red (CLAUDE.md, Colors). Once Time is done, the bottom bar no longer repeats it, unless it carries a suggestion. The suggestion's "Moved to Friday" message is grey, not red.
  - Said once: "Nothing is charged today" left the terms box; "first 10 minutes free" left the travel hint.
  - The calendar legend no longer says "point at one". Its back link reads "Back to recommended times".
  - On/off buttons (recording, water, power, the request days and times, flexible days) carry `aria-pressed`. The week grid is a group of buttons, not a `grid` with no rows.
  - A flexible day already chosen shows as chosen, with its panel open, when Time is reopened.
  - Help me decide shows no "$0" on the Review tab. A promo shows one saving (under the total, tax included), not two different figures.
  - Bigger touch targets for the bottom bar's Change and "Tell us when suits". On phones, summary rows wrap to two lines, and the price table's labels no longer wrap.
  - The "More below" cue hides while the section's Continue is on screen.
  - The leave panel says contact details reach us only when a phone or email we could use was given. Enter in the notes box no longer jumps to the optional water question.
- **One name per fee (owner's approval, November 10).** "Rush fee", "Early start fee", "Late start fee", or "Rush and late start fee", everywhere: the price table and the booking email ("Late start fee (20%)"), the bottom bar and the calendar ("+$25 late start fee"), the request bands ("+20% late start fee"). It replaces "Premium time", "Rush booking and premium time" and "+$25 early". The rates and hours are unchanged and match `main` (`web/lib/pricing/rules.ts`: 20% before 10am or from 6pm, 20% within 3 days, 30% at most).
- **Browse: "Packages first" (owner, November 10).** A new sort switch, on by default, that works together with whichever sort is chosen: packages, then add-ons, each in price, popularity or length order. Tap it to turn it off. Test: Browse shows packages first at "Price, low first" and at "Most popular"; turning it off mixes add-ons in.
- **From the engine check (fixed):**
  - *All-day events were 4 to 5 hours early.* A bare date ("2026-11-20") was read as midnight UTC, 7pm the evening before in Cincinnati, so an all-day Vacation left its own evening bookable. Now local midnight (`eventTime`).
  - *OPEN and BEST matched any title starting with those letters* ("Opening night", "Bestie's wedding"). Now the whole word (`titleIs`). "Open house" and "Best Buy" still read as the keywords; see Questions.
  - *6pm starts went missing.* `computeSlots` stopped scanning at the first start whose drive home did not fit, but from 6pm the drive home is not needed, so a later start could fit. It now carries on.
  - *The 6pm drive-home exemption applied with a job booked later that day* (a 7pm start ending at a 9pm job). It now applies only at the real end of the day.
  - *A recommended time with a late fee led a day that had a fee-free best time* (Kris's 6pm ahead of Elijah's 10am). No fee now comes before priority.
  - *The steer and the calendar stars ignored a detailer with no BEST events* once anyone had some. They now use that detailer's day suggestions, as the recommended times do.
  - *The server gave any named detailer the job and their fee-free hours,* even for work they don't do (Kris on an exterior job: no late fee, his calendar). `detailerFor` now checks `canDo` against the cart (`wireNeeds`).
  - *Fee-free hours accepted malformed text* ("Sun Mon", "Tue-Sat-Sun", "18:99"). Now refused, with the problem message.
  - *The heat check paired cloud with the whole hot span,* not the job's hours. Now all three must overlap.
  - `Priority: 1000` read as 100.

### What to test
- Checkout: Continue with everything empty (every message at once); fix one field (its message goes); reopen Contact, break the phone, click Time (stays open).
- Pick a 10pm Saturday, then add Pet Hair at Review: Time reopens with the reason.
- Keep a draft, come back after its time: Time reopens with "has passed".
- An all-day event on an availability calendar blocks that whole day, and only that day.
- On the next pipeline deploy preview: one of Elijah's booked jobs on 513 Auto Clean removes its time from the booking form (it is now read busy-only, through `GOOGLE_BUSY_ONLY_CALENDAR_IDS`).

### Left from the calendar setup (November 10)
- Share 513 Kris Bookings with Kris, once we have his email.
- Writing booked jobs onto the calendars: the one-time Google sign-in was done November 11 and its three values are in Netlify (secret). It takes effect on the next deploy; check that a test booking lands on its calendar. Until then, every job goes onto its calendar by hand.
- Right after that deploy goes live (not before, which would blind `main`, and not days later): make the 513 Auto Clean jobs calendar free/busy only. The Netlify half is done.
- If the fee standard changes (option B), Kris's `DETAILERS` entry changes with it.

### Questions for the owner
- **Titles:** should only upper-case `OPEN` and `BEST` count? Today "Open house party" still switches a calendar to working-hours mode, and a Busy "Best Buy pickup" is read as a best time.
- **First job of the day:** the drive out is ignored only for starts by 10am, so an OPEN block from noon cannot offer noon.
- **No OPEN events:** a detailer with none is offered 5am to 1am every day (for example Kris on holiday). Should no OPEN mean no bookings?
- **Rain for paint correction:** "any rain" is more than 0.25 mm an hour today.
- **Server time rules:** the server checks only that a time is in the future and within 400 days; the 6am to 10pm window, the 30-minute grid, 60 minutes' notice and 92 days are enforced in the browser only.

### Checked
- Tests 489 of 489 (Eastern time), 20 new.
- Headless Chrome at 1440×900 and 375×812, using the reviewers' own scenarios: errors, the stale time, the past draft, the flexible day, focus, scroll. No console errors.

## Round 15 (November 10, night): two pages, a checkout, recommended times from the calendars

Built from the owner's two transcripts and your notes. The numbered list is `docs/PIPELINE-ROUND-15-PLAN.md`, and the calendar setup for Kris and Elijah is `docs/CALENDAR-SETUP.md`.

### A. Recommended times come from Google Calendar
- **BEST events:** events titled `BEST...` on an availability calendar mark ideal start times. They never block time, whether set to Busy or Free (`web/lib/google/publicCalendar.ts`). That was the only code change the setup needed; the times themselves are set in Google Calendar.
- **Priority:** "Priority: N" in a calendar's Description orders the detailers (`parsePriority`; lower goes first; the `DETAILERS` order breaks a tie). It's read from the events list Google already returns, so it costs no extra request.
- **The three days** (`recommendBestDays` in `week.ts`, `TIME_RECOMMENDATION_RULES` version `best-1`):
  - **Soonest;**
  - **the first day past the rush window,** labelled by its distance ("In 3 days", or "Tomorrow"), never by its price;
  - **Weekend.**
  - Each leads with the first-priority detailer's best time that day. If that detailer isn't free for the whole job, the next one's best time leads instead.
- **"More times on Friday":** only the other detailers' best times that day, plus one quiet "Need a different start?" dropdown for any other start. A detailer with no BEST events falls back to the day-packing suggestions.
- **Same source everywhere:** the calendar's stars and the "Change to suggested?" pill now follow the BEST times too.
- **Fees on the cards are quiet:** one plain line, and nothing at all for the standard price.

### B. The calendar view
- **Opens on the regular hours:** a frame shows 10am to 6pm, with the day names pinned inside it.
- **Markers:** "Earlier times" above and "Later times" below. They fade when there's nothing more in that direction, and a click scrolls 4 hours.
- **Not changed:** the phone day list.

### C. Checkout: Where, Time, Accept and Confirm on one page
- **Order:** Your details (name, phone, email) → Where → When → Almost done (terms, "Can we record during the detail?", texts, "Where did you hear about us?") → Review and book.
- **Same steps underneath:** the same renders and validators, checked top to bottom, and an error points at the field on the same page.
- **Picking a time** selects it, redraws the summary below (its fee, "your time is held") and moves the page down to "Almost done". Confirm still checks the time is free (`verifySlot`).
- **The calendar is read on entering checkout** and when the job, the address or cover changes, not on every tick box (`slotsKey`). An address typed on the checkout refreshes the times once it settles.
- **Shorter text:**
  - the terms are one line with their two cancellation numbers;
  - recording is "For short clips on our social media. We always blur faces, license plates and anything private."
  - email no longer says "(optional)", though it still isn't required.
- **"Where did you hear about us?":** an optional dropdown. The answer goes with the booking and into the calendar event, and analytics records `heard_about`.

### C3. A checkout left unfinished (owner: "capture now, send via GHL later")
- **What happens:** someone who typed their name plus a phone or email at checkout, and leaves without booking, is emailed to the owner once (`netlify/functions/cart-capture.mjs`, `/api/cart-capture`), with what they had picked.
- **When it fires:** on closing the form or leaving the page. It's sent once per contact and cart, and never after "Cancel my booking".
- **Safeguards:** it sends only while the privacy capability `checkoutFollowUp` is live, it only ever emails the owner's own address, and it's rate limited.
- **GoHighLevel:** its "you didn't finish" reminder replaces this email once its keys are set. That part isn't built, because it can't be tested yet.
- **Privacy (legal process):**
  - the policy now lists "where you heard about us" and the unfinished-checkout details;
  - the browser-draft paragraph no longer says nothing reaches us;
  - the leave dialog says the checkout details reach us.
  - The date stays 2026-11-10 (same day, not live yet). The lock was re-run, and the legal tests pass.

### D to G. The first page: Vehicle, Service, Package and Extras grow in place
- **One growing page:** each answer folds to a one-line "VEHICLE: Medium, Change" row, and the next question slides up under it (respecting reduced motion).
- **Vehicle:** three picture cards, Small, Medium, Large, with the extra price as its own mark ("No extra cost", "+$10", "+$25").
- **Service:** three picture cards, left to right Interior, Both ("Save $25"), Exterior, then "Not sure? Help me decide" as its own row. The "See all services and prices" sentence is gone; "Browse through all options" stays.
- **Packages:**
  - one line each (name, the one-line promise, price, time), with "How it works" inside the card: what's included, then the note;
  - "Have a promo code?" folded;
  - at 1440×900, all three interior packages are fully visible.
- **Extras:** hidden behind "View additional options for your detail" (opened by itself once one is added). The cards are smaller, with "How it works" beside the description. The second-vehicle line stays.
- **Continue** reads "Continue to checkout".
- **Reading level** (Flesch-Kincaid grade): vehicle 1.1, service 1.1, recommended times 2.0, the yeses 4.0, packages 5.3 (the owner's own lines), extras 7.7 (the owner's own button wording).

### H. The results carousel
- **What changed:** built on `eNov6` (`8f6f180`) by a helper and merged here. The 6 s cycle runs in sync on every card: 1 s still, 1 s right, 1 s left (ending on the after), 2 s hold, 1 s shift with the handles going back to the middle.
- **Measured:** timings to within 50 ms at 1440 and 375, with 0 ms skew between cards. `CLAUDE.md` is updated on `eNov6`.

### Bugs found and fixed while checking
- **Scroll overshoot:** scrolling to a section overshot by 132 px, because `offsetTop` counts from the modal, not the scroll area. Fixed with `scrollToEl`.
- **The site's section padding** (styles.css `section { padding-block }`) put about 150 px above every first-page question. Fixed with `#bookFunnel .bk-sec { padding: 0 }`.
- **The "More below" fade** washed out the "See additional times" bar whenever any pinned bar existed. It now lifts only while the bar is really stuck at the bottom.
- **The calendar-frame code** threw in the test page's simplified DOM, and any throw drops the calendar to "tell us when suits". It's now wrapped, since it's only cosmetic.
- **Stale summary:** picking a time didn't redraw the summary below it. The checkout now redraws, with the times painted from memory in the same pass.

### Verified (headless Chrome, live calendar, test Kris; tests 476/476, types clean)
- **The flow at 1440×900 and 375×812:**
  - picture cards, and the answered-question rows with the slide-in;
  - 3 packages visible, and "How it works" opens without selecting;
  - extras folded, then 5 shown;
  - the checkout's 5 sections;
  - recommended times "Soonest / In 3 days / Weekend";
  - "More times" (best chip plus a 31-option dropdown);
  - a pick moves to "Almost done" (8 px from the top);
  - Confirm with the terms unticked holds, with the right message;
  - the calendar opens with 10am first, with both markers.
- **No script errors.**

### Not verified yet
- **The BEST times and Priority with real events:** the calendars don't have them yet, so the fallback suggestions are what ran. Check again once Kris's and Elijah's calendars are set up.
- **The unfinished-checkout email:** it needs the production email key, so it's untested end to end. The function is tested without a key.
- **A real booking sent from the new checkout:** I never press Confirm on live services.
- **The "Both" picture** may want a better drawing.
- **Lessons for `CLAUDE.md` after the merge:**
  - scroll by measuring against the scroll area;
  - the site's `section` padding reaches inside the booking form;
  - cosmetic code must never throw inside the calendar painter.

## Round 14 (November 10): setup questions optional again, two layout bugs

### "Getting set up on the day" is optional again (owner)
- **The original pipeline:** `eNov6` showed "Optional" in the heading, said "None of this is a requirement, and no answer here changes your price", and marked the parking box "(optional)". It has never blocked a booking, on either branch.
- **Why it changed:** round 1 removed those labels after the owner's note that some questions should "still be mandatory feeling".
- **Now:** the "Optional" tag and "(optional)" on parking are back. The intro says "None of this is required, and no answer changes your price", then "Skip any you are not sure about".
- **Moving these questions to after the booking, still with one email:** investigated, not changed (owner: "keep as is for now"). Today `send-confirmation` writes the calendar event, then emails the owner and the customer, all at once when the booking is sent. Two ways to keep one email:
  1. **Hold the owner's email.** Write the calendar event at once (that's what holds the time), send the customer's confirmation at once, and send the owner's single email when the customer finishes or skips the setup questions on the done screen. A safety net sends it anyway after about 10 minutes if they close the tab. That needs somewhere to keep the pending booking (Netlify Blobs) and a scheduled function: about half a day of work, plus tests.
  2. **Keep the email as it is and add the setup answers to the calendar event.** The done-screen answers update that booking's event description through a small endpoint that only accepts a token issued for that one booking. No storage and no second email, but the answers are on the calendar, not in the email. About two hours.
  
  Owner decision needed before building either.

### Bug: the filming error squeezed into the buttons (owner's screenshot)
- **Root cause:** `flash()` puts the message after the nearest `.bk-field`, `.bk-check` or `.bk-cards`. The filming buttons sit in none of those, so the message went right after the Yes button, inside the Yes/No grid, and became a column one word wide. `showProblem()` outlined the Yes button alone for the same reason.
- **Fix:** `.bk-acc`, the yes-or-no question block, joins both lists. The message now goes under the whole question, and the whole question is outlined.
- **Verified:** the message is outside the button row, Yes keeps its 38 px height, and the outline is on the question.

### Bug: the promo code box touched the payment card (owner's screenshot)
- **Root cause:** `.bk-promo` had a top margin only, and `.bk-payopts` has none above it.
- **Fix:** 1.1rem under the promo box (now 18 px between them).

### Verified (headless Chrome, live calendar, test Kris)
- **Sizes:** 1440×900 and 375×812.
- **Tests:** 470/470, after updating one smoke test that round 1 wrote to require the opposite ("not labelled optional").
- **A process slip:** commit `239f2ac` went in with that test failing, because I chained the commit after a `grep` of the test output instead of after the test run's exit code. Fixed in `38993e5`. From now on, commits follow the test run's exit code.

## Round 13 (November 10): a bigger "More times" target, the suggestion as a grey pill

### "More times on Saturday": a bigger target
- **The problem:** the link was a thin line of text inside a card that books on any other tap, so a near miss booked the card's time.
- **Fix:** an invisible area 10 to 12 px wider on every side (`.bk-pick-more::before`). The words don't move.
- **Verified:** taps 8 to 10 px above, below, left and right of the words all open the day's times.

### Bug: "Change to suggested?" overflowed, and read as part of the chosen time (owner's screenshot)
- **Root cause:** the round 12 tab was capped at the box's width (`max-width: calc(100% - 1rem)`) and never wrapped. With a short time like "12pm to 2pm" the box is narrower than the tab's text, so "10am to 12pm" ran past the tab's edge. In red and joined to the box, it also looked like part of the choice.
- **Fix:** it's now a separate small grey pill, 4 px under the box: neutral colours, a thin grey border, sized to its own text and centred on the box. It's an offer, not a warning; hovering only darkens the text and border.
- **Room:** the bar's bottom padding grows while the pill shows. On phones the row below the box has 1.2rem more space, so the pill clears Continue.
- **Verified at 1440×900 and 375×812:**
  - the pill's text fits;
  - it stays inside the bar and clear of Continue;
  - taking it still switches the time and the pill disappears.
- **Tests:** 470/470.

## Round 12 (November 10): spacing, hour labels, fees in gold, the suggestion as a tab

### Spacing and the hour labels
- **Above "Our recommended times":** the gap is down from 35 px to about 24 px. The time list's 16 px top margin no longer applies when nothing sits above it (`.bk-body > .bk-slots:first-child`).
- **Hour labels:** .72rem becomes .8rem. The hour column narrows from 2.9rem to 2.55rem and the Early/Late column from 1.3rem to 1.2rem. That's less empty space between the labels and the hours, and each day column is about 1 px wider.

### Fees easier to spot
- **Calendar and legend:** calendar fees are bold, in the gold of the Rush, Early and Late tags. The "+$" key in the legend matches. A light gold background was tried and taken out (owner: "looks weird and worse").
- **Elsewhere:** the phone list, "More times" and the bottom bar show the fee in the same gold.
- **Bottom bar wording:** the fee is now compact, "+$37.50 rush + early". The full wording, short notice included, is on the later steps. The price block keeps "about 2 hrs on site" on one line (it wrapped when the bar got busy).

### Bug: the suggestion was a downsell (owner's screenshot)
- **What happened:** for a 6am pick at +$37.50 (rush and early), the bar suggested 10am at +$25 (rush only).
- **Root cause:** in round 9 I read "not at the cost of a timing fee upsell" as "never suggest a time that adds a fee". It means never steer anyone off a time they're paying an early or late fee for.
- **Fix:** the suggestion now has to cost exactly the same (`steerFor`). Suggested starts are never early or late, so a fee pick gets no suggestion.
- **Verified:** the 6am pick shows no suggestion. A 10:30am standard-price pick still offers 10am.

### The suggestion as a tab under the box
- **Wording:** "★ Change to suggested? 10am to 12pm" (was a "SUGGESTED" button inside the box).
- **Look:** a thin tab hanging from the bottom of the "Your time" box, outside it. It covers the box's bottom border where they meet, so the two read as one piece.
- **Room:** the bar's bottom padding grows a little while the tab shows (`.bk-foot.steering`). On phones, the row under the box gets more space (`.bk-pick.has-steer`).
- **Also:** with the button gone from inside the box, the tick moved into the "Your time" label.

### Verified (headless Chrome, live calendar, test Kris)
- **Sizes:** 1440×900 and 375×812. No sideways scroll. The box is as tall as Continue (53 px).
- **The tab:** shows and switches the time; it never shows for a fee pick.
- **Tests:** 470/470. The first run failed 14 tests: the test page's stand-in DOM gives the bar box no parent element. Now guarded in `markSteering`.

## Round 11 (November 10): rush fee check, fine print, pinned bars, "Your time", filming after the terms

### Rush fee: checked, no bug
- **The worry:** the rush fee always read +$25.
- **What I checked, on the live preview:** the fee on every calendar box against what the total goes up by when that box is booked, for five carts.

  | Cart | Service price | Rush (20%) | Rush with early or late (30%) |
  |---|---|---|---|
  | Basic Interior, small | $125 | +$25 | +$37.50 |
  | Showroom Ready Interior, small | $395 | +$79 | +$118.50 |
  | Full Interior, large | $240 | +$48 | +$72 |
  | Basic Interior, medium, with pet hair | $185 | +$37 | +$55.50 |
  | Full Exterior, small | $245 | +$49 | +$73.50 |

- **Result:** every label matched the surcharge the quote charges. The calendar (`deltaFor`) and the quote (`applySurchargeCents`) both take the rate from `computeSurcharge` and apply it to `serviceSubtotalCents`.
- **Why it looked fixed:** +$25 is 20% of the $125 Basic Interior that was being tested.

### Bug: the calendar's fine print lost its style
- **Root cause:** round 9's edit to the bottom-bar rules in `book.css` found the end of a media block by searching for the first `}` after its last rule. That matched the rule's own brace, so the block's closing `}` was left orphaned. Browsers drop the rule after a stray brace, which was `.bk-wk-fine`, so the note fell back to body text.
- **Fix:** removed the brace.
- **Guard:** `web/lib/site/stylesheets.test.ts` now fails on any unbalanced brace in `book.css` or `styles.css`.
- **Lesson for `CLAUDE.md` after the merge:** never cut CSS by searching for a closing brace; check brace balance after any scripted CSS edit.

### i) The fine print, moved and quieter
- **Fee rules:** "Early is before 10am and late is 6pm or later; rush is within 3 days. Early or late plus rush is 30% in total." now sits as a small grey line under the legend, beside the "+$" key it explains (was a paragraph under the calendar).
- **Time zone:** "Hours are in Cincinnati Time Zone (EST)" moved under the week title, next to the dates it applies to. In the last bookable week it adds "We take bookings up to 3 months ahead".

### ii and iii) The ways on, pinned to the bottom
- **What's pinned:** "See additional times" with "None of these work? Tell us when does" under our recommended times, and "Go to a date" with the same link on the calendar. Each bar sticks to the bottom of the window (`.bk-pinbar`), full width, with a light top shadow.
- **"More below":** the cue sits above the pinned bar (`updateCue`).
- **The flexible card:** extra picks now also leave room for the pinned bar plus a 44 px peek of the next card, so the first screen ends with "Flexible on the time?" half cut off (81 px showing at 1440×900).
- **Trade-off:** the 4th pick no longer fits within the 860 px the booking form can reach.
- **Phones:** the links shorten to "Tell us when suits" and "Go to", so each bar is one row (61 px). At 375×812 the third pick ends right at the bar, so the flexible card starts under it, and "More below" points to it.

### iv) The chosen time reads as yours
- **Look:** the box in the bottom bar now has a red tick, a red "YOUR TIME" label and a faint red fill.
- **Size:** it keeps the one-row size, as tall as Continue (53 px on a laptop, 52 px beside 53 on a phone).

### v) Filming after the terms
- **Order on Your details:** name, phone and email; then the terms; then "Can we film and photograph the detail?"; then texts. Filming is still a required answer.

### Bug: the chosen block looked misshapen after Back or Change (owner's screenshot)
- **Root cause:** the hour box under the chosen block kept its own "selected" look (red outline, pink fill). A half-past start's block begins halfway down its box, so the top half of that box showed above the block as an empty red band. It only showed after Back or Change, because a pick now moves straight on.
- **Fix:** on the calendar the block is the selection. The box keeps `aria-selected` but no longer gets the selected style (`.bk-wk-c.on` removed).
- **Verified:** booked 6:30am with a real mouse and pressed Back. No cell under the block has a red border, and the slice above the block is a plain 6am box.

### Verified (headless Chrome, live calendar, test Kris)
- **Sizes:** 1440×900, 1440×1100 and 375×812. No sideways scroll.
- **Tests:** 470/470, including the new stylesheet check.

## Round 10 (November 10): half-hour starts back

The owner asked for half-hour starts again, so every start the original pipeline offered can be booked again, in each place a time is picked:
- **Week calendar, with a mouse or trackpad:** a box is an hour. Its top half books the start on the hour, its bottom half the start at half past, and the hover block shows which (for example "6:30am +$37.50 to 8:30am"). The note above the calendar says so. A tap, or the keyboard, books the box's usual start. The halves are too small to tap reliably, so touch screens keep one start per box (`halfStart`, `data-starts`, `data-pick`).
- **Phone day list:** each hour has its other start beside it as its own button, "or 2:30pm".
- **"More times on Friday":** every start that day, half hours included, 4 across (3 on phones), under the part-of-day headings the phone list uses.
- **Analytics:** `time_pick` adds `start_min`.
- **Gap that's left:** a touch screen wide enough to show the calendar rather than the phone list (a tablet) so it can't reach a half-hour start on the calendar. It still can through "More times" on a recommended day.

### Verified (headless Chrome, live calendar, test Kris)
- **1440×900, with real mouse movement:** the top half previews 6am and the bottom half 6:30am. A click books 6:30am (`start_min: 30`). Back shows the 6:30am block and the bottom bar.
- **375×812, touch:** 8 "or" buttons for the day. "or 2:30pm" books 2:30pm.
- **"More times":** 33 starts under 4 headings.
- **Tests:** 467/467.

## Round 9 (November 10): recommended times as top picks (option C), the bottom bar, the 11pm row

### Research behind it (short)
- **Baymard** (delivery and booking slot pickers): people misread availability and miss workable times. The fix that tested best is a clear day-then-time hierarchy, with every option's fee visible.
- **Agatz, Fan and Stam** (grocery delivery slots): a label alone steers choices about as well as a discount. Yang et al. rank slots from real booking data. So the picks carry reasons, and analytics records what is offered and what is booked.
- **Calendly, Fresha, Square, Housecall Pro:** one sensible default already in front of the customer, explained rather than pushed.

### Our recommended times: option C (owner's pick of three rendered options)
- **Picks, not days:** each card is one tap that books, labelled with why it's offered. The day is the headline, the time beside it, and the tags (Standard price, or the fee and short notice) below.
- **Reasons, in order:**
  - Soonest;
  - First at the standard price (only when the soonest carries a fee, which explains the old jump from Tuesday to Friday);
  - Weekend;
  - Morning or Afternoon (when every pick so far is the other half of the day);
  - Next week;
  - "Also open" fills any gaps.
- **Fees:** only "Soonest" may carry a fee, and at most one pick does (`maxFeePicks`).
- **More rows when there's room:** 3 always; up to 2 more while the card still ends inside the first screen. Today that's 4 on a laptop and on tall phones, and 3 on a 375 px phone.
- **"More times on Friday"** (was "Other times that day", owner asked for clearer wording): opens that day's starts in place, one per hour, with the fee or "Standard price" and the star. One tap books.
- **"Flexible on the time?" (owner: yes, no discount):**
  - pick a day, and we text the start time by the evening before;
  - it's the same request as "Tell us when does" (`state.prefer`), so it's priced, sent and confirmed the way requests always are;
  - only days with a standard-price start are offered;
  - the booking email says `FLEXIBLE DAY: any start that day. Text them the start time by the evening before.`
- **Code:** `recommendPicks()` and `daySuggestions()` in `web/lib/availability/week.ts` replace `recommendDays()`. `TIME_RECOMMENDATION_RULES` holds the reasons, `shown`, `extraWhenRoom`, `maxFeePicks` and a `version`. `scoreFor` remains the hook for analytics scores.

### The bottom bar
- **One row, as tall as Continue** (it was 129 px on a laptop and 190 px on a phone).
- **From the Time step to the last step:** the chosen time and its price. On later steps it adds "Change", which goes back to Time.
- **Gone** when the booking is sent, and for requests.
- **The suggestion (owner: "closest suggested time but not at the cost of a timing fee upsell"):**
  - the nearest starred start the same day that costs no more than the chosen one, so the rush fee can't change either;
  - shown as "★ Suggested 10am to 12pm";
  - not shown when the chosen time is already a suggested one, or once they've taken a suggestion.
- **Switching on a later step** checks the calendar in place (`verifySlot`) and stays on that step. If the time was just taken, they keep theirs, and a message says so.

### Analytics (sent only once analytics is on and the visitor accepts)
- **`time_recs_shown`:** rules version, count, the flexible option, and each pick as `reason:fee%:days ahead:start hour`. Sent once per distinct set.
- **`time_pick`:** now adds `rank`, `reason` and `rules`. `via` is `recommended`, `recommended_more`, `calendar` or `steer`.
- **New:** `time_more_open`, `time_flex_open`, `time_flex_pick`, `time_steer_shown`, `time_steer_used`, `time_change`.
- **What this is for:** offer and booking rates per rank and reason, and an A/B test between rule versions.

### Bug: an 11pm row nothing can reach (owner's screenshot, Showroom Ready)
- **Root cause:** `lastRowFor()` predicted the latest end from the booking-window rules (latest start 10pm, done by midnight). It missed two rules that remove starts:
  - before 6pm, the drive home has to fit inside the day too;
  - the OPEN hours can end before midnight.

  So it assumed a 7 hour job could start at 5pm and end at midnight. 5pm plus 7 hours plus the drive home runs past midnight, so 5pm is never offered. The latest real start is 4pm, its block ends at 11pm (the top of the 11pm row), and that row could never be reached.
- **Fix:** `lastRowForSlots(slots, duration)` draws rows past 10pm only when a start actually offered runs into them. Whatever rule removed a start, its row goes with it.
- **Verified on the live calendar, three weeks each:**
  - Showroom Ready (7 hours): 17 rows, ending at the 10pm row;
  - Basic Interior (2 hours): keeps the 11pm row, because a 10pm start really runs to midnight.
- **Lesson for `CLAUDE.md` after the merge:** derive display limits from the real offered data, not from a copy of the rules.

### Compared with what the original pipeline (`eNov6`) lets you book
- **Same slot rules:** `computeSlots` uses the same buffer, last-job and first-job rules. The new pipeline only removes starts on purpose:
  - weather by kind of job;
  - a detailer who can't do the work;
  - Kris's calendar;
  - the 3 month cap.
- **Half-hour starts:** the original offered every start, :00 and :30, through "Expand to select other times". Round 9 briefly offered one per hour. Restored the same day (owner: "Add half-hours back"; details under Round 10).

### Verified (headless Chrome, live calendar, test Kris)
- **1440×900 and 375×812:**
  - cards and reasons as above;
  - "More times on Friday" opens with focus on the suggested time;
  - a non-suggested pick shows the suggestion on Details;
  - taking it switches in place and the suggestion disappears;
  - Change returns to Time;
  - a suggested pick shows no suggestion;
  - the flexible day goes to Details as "Times requested", with no bar.
- **Not checked:** the bar on the Done screen. It's cleared in code (`setPick('')`), but I didn't send a real booking to see it.
- **Tests:** 467/467; types clean.

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
