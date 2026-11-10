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

## The new path, shortest case

| | Before (`eNov6`) | Now |
|---|---|---|
| Screens | 9 | **8** (Vehicles screen folded into Extras) |
| Taps, Book Now to booked | 15 | **about 11** |
| Required typed fields | 5 (street, city, ZIP, name, phone) | **3** (street via the address pick, name, phone) |
| Required answers | 13 | **8** (size, service, package, time, address, name, phone, terms) |

The time counts as answered because our suggestion is preselected. These numbers are counted from the flow, not measured on real customers.

## Your answers, and what was built

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
