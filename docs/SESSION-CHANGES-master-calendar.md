# 513 All Jobs, the master calendar: session changes (branch `master-calendar`)

Built November 26, 2026 on `eNov14` (a2a5869). Not pushed. Design: `docs/ONE-CALENDAR-SPEC.md`, concept (d). Setup for the humans: `docs/MASTER-CALENDAR-SETUP.md`.

## November 26: the website copies every job to 513 All Jobs

Emmett's decision: the live site does the export, no Apps Script, nothing for Elijah to run. Off until `ALL_JOBS_CALENDAR_ID` is set in Netlify.

### What changed
- **`config/master-calendar.json` (new):** colours per detailer, default and cancelled colour, `cancelMode` (`mark` or `delete`), `maxCancelsPerRun` (10), the window (14 days back, 120 ahead), `writeTimeoutMs`, `runBudgetMs`. Checked on load (`checkMasterCalendar`); a bad value fails the build.
- **`web/lib/availability/masterCalendar.ts` (new), through `_pricing.mjs`:** the copy's title (detailer first, after any SHORT NOTICE), its description header, colour, hidden `bookingKey` and `sourceId`, the cancelled mark, and `planMirror` (what one run changes).
- **`netlify/functions/_mastercal.mjs` (new):** reads and writes the master. A copy's event id is a hash of its booking key (`masterEventId`), so a retry or the two writers racing can't make a second copy: looked up first, put back if deleted on the master, inserted if missing, and a 409 on insert means the other writer got there.
- **`send-confirmation.mjs`:** after the detailer's event(s) are written, one copy per event (one per working day), bounded by `writeTimeoutMs`. A failure is its own line in Elijah's email ("NOT ON 513 ALL JOBS"), never in the subject, the customer's email or the reply. `writeCalendar` collects the events it wrote in a list that never reaches the reply. `ownerEmail` takes `masterFail`.
- **`_gcal.mjs`:** `bookingEventBody` (the event createBookingEvent writes, taken out unchanged so the copy is made from exactly that), `bookedCalendarId` exported, and `gcalRequest` (one call on a named calendar; an empty id never falls back to the bookings calendar).
- **`netlify/functions/jobs-mirror.mjs` (new), scheduled every 10 minutes in `netlify.toml`:** reads every detailer's bookings calendar (from `DETAILERS`, never the availability calendars) and the master, every page, then copies hand-typed jobs (`manual:<event id>`), follows edits, moves and reassignments, puts back copies changed or deleted on the master, marks copies whose original is confirmed deleted by a direct look-up (title `CANCELLED: …`, Free, graphite, `Status: Cancelled`), and sets a restored one back to Booked. Leaves events without a `sourceId` (GHL's) alone with a `not-ours` warning. Skips OPEN, BEST and DNS.
- **Safeguards:** any failed read (list or look-up) and the run writes nothing; more than `maxCancelsPerRun` confirmed deletes and none are marked, Elijah emailed once (the held copies are tagged `cancelHeld` after the email goes); writes only to the master; `masterClash` refuses a master that is also a calendar the site reads, in the build (`render-config.mjs`) and in both writers.
- **Logs:** one `[master-cal]` JSON line per action, keys and event ids only.
- **Docs:** `CLAUDE.md` (two rules under "Live calendars"), `docs/MASTER-CALENDAR-SETUP.md`, a pointer at the top of the spec, a line in `ADD-A-DETAILER.md` (a colour per new detailer), and a comment in `JobsSync.gs` above `CALENDARS` saying never to add the master.

### Tests
- `web/lib/master-calendar.test.ts` (new, 27 tests) against `web/lib/fake-gcal.ts`, a stand-in Google Calendar and Resend: off is unchanged (the same calls and reply unset, empty or blank; on, the booking's own calls and reply are the same); the copy's title, description, location, times, colour and hidden fields; Elijah named; retries and repeat writes make one copy, and the reconciler then changes nothing; a failing or hanging master leaves the booking and emails alone and is reported to Elijah only; multi-day copies; the reconciler's hand-typed copy, window, skips, edits, moves, put-backs, delete marked after a look-up, 404, delete mode, restore, moved out of the window, read and look-up failures, the cancel cap and its one email, GHL events untouched, pagination, nothing customer-identifying logged; JobsSync's `CALENDARS` has no All Jobs calendar, only `_mastercal.mjs` reads the setting, and every clash is refused.
- Also checked once by hand, not kept: the new `send-confirmation` with the master off against the base commit's (a2a5869), six cases (a Kris job, an owner job with two vehicles, a retry, no key, a failed write, no time): identical calls and replies.
- `functions.smoke.test.ts` imports `jobs-mirror` with hostile input.
- Full suite: 947 pass (919 before).

### What to test by hand
1. With `ALL_JOBS_CALENDAR_ID` unset, a booking on a Deploy Preview behaves exactly as before, and no `[master-cal]` line appears in the function log except the scheduled run's `off`.
2. Set it on Deploy Previews to 513 TEST All Jobs (setup step 3). Book a test job for Elijah and one for Kris: each appears on 513 TEST All Jobs within seconds, titled `Elijah: …` / `Kris: …`, its description starting with the five-line header, coloured Peacock / Basil.
3. Press Confirm twice (or retry after an error): still one copy.
4. Unshare 513 TEST All Jobs from the site's identity and book: the booking and both emails go through; Elijah's email has the "NOT ON 513 ALL JOBS" line; the customer's says nothing about it.
5. On production, once the id is set: after a few runs, every job in the window is on 513 All Jobs. Type a job into 513 Kris Bookings by hand: copied within 10 minutes. Delete it: the copy turns `CANCELLED: …`, Free and grey. Restore it from Trash: Booked again.
6. In GHL, link 513 All Jobs as the linked calendar; no availability calendar as a conflict calendar.

### Deviations from the spec
- The website writes and reconciles (Emmett, November 26) instead of the Apps Script mirror; the spec's `AllJobs.gs` and its contract check aren't built.
- Colours live in `config/master-calendar.json` by detailer name, not in JobsSync's `CALENDARS`.
- Only `Booked` and `Cancelled` are written; `Done` and `Paid` wait for open question 6.
- A copy's event id is derived from its booking key, so the two writers can't duplicate a copy even when they race (the spec relied on look-ups alone).
- Over the cancel cap, creates and updates still go ahead; only the marks are held.
