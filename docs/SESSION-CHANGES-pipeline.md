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
