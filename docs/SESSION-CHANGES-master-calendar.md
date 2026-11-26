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
4. Unshare 513 TEST All Jobs from the site's identity and book: the booking and both emails go through exactly as normal (superseded by the fix round: no line in Elijah's email; the function log has `[master-cal] {"action":"copy-failed",…}`).
5. On production, once the id is set: after a few runs, every job in the window is on 513 All Jobs. Type a job into 513 Kris Bookings by hand: copied within 10 minutes. Delete it: the copy turns `CANCELLED: …`, Free and grey. Restore it from Trash: Booked again.
6. In GHL, link 513 All Jobs as the linked calendar; no availability calendar as a conflict calendar.

### Deviations from the spec
- The website writes and reconciles (Emmett, November 26) instead of the Apps Script mirror; the spec's `AllJobs.gs` and its contract check aren't built.
- Colours live in `config/master-calendar.json` by detailer name, not in JobsSync's `CALENDARS`.
- Only `Booked` and `Cancelled` are written; `Done` and `Paid` wait for open question 6.
- A copy's event id is derived from its booking key, so the two writers can't duplicate a copy even when they race (the spec relied on look-ups alone).
- Over the cancel cap, creates and updates still go ahead; only the marks are held.

## November 26, fix round (before tonight's release)

Merged `imperion-backend-docs` (65cafa9) first. Commits: the master fixes, the booking log lines, the docs.

### Fixes, each with its root cause
1. **The copy could hold up or change a booking's emails.** Root cause: it ran between the calendar write and the emails, with a name look-up and a GET before each POST, so a slow master spent up to `writeTimeoutMs` before Elijah's email, and a failure changed his email ("NOT ON 513 ALL JOBS", which was also a false alarm: the reconciler copies the job anyway). Now it runs after both emails, one POST per day with its deterministic id, all at once (409 = there), no look-ups, ended by an abort signal at `writeTimeoutMs`; failures are logged only. `ownerEmail` is a2a5869's again. Proven: `master-calendar.test.ts` (off, on, failing, hanging: same reply, same non-master calls in the same order, same emails, same events), and once by hand against a2a5869's own `send-confirmation.mjs` (8 cases: Kris job, owner with two vehicles, retry, no key, failed write, no time, customer email refused, a two-day job; times off/on/failing/hanging): identical replies, calls, Resend bodies and events. The by-hand harness isn't kept (it needs the old file).
2. **The reconciler copied things that aren't jobs.** Root cause: it skipped only `OPEN|BEST|DNS`, a pattern of its own, while JobsSync also skips Free events, Busy/Blocked/Hold/Personal titles, the office and all-day events with no `$`. Now one function, `notAJob()`, built from JobsSync's own patterns; `jobs-sync-contract.test.ts` reads them and `jobRow`'s rules out of `JobsSync.gs`, so a change there fails the test. `Day N of M` stays copied on purpose.
3. **Which of two originals sharing a key kept it depended on list order.** Root cause: "first seen" in a list sorted by start time, so moving one event could swap which original the copy followed. Now: the one the copy already follows, else the earliest `created`, then the lower id. Tested with the list in both orders, and with an older duplicate turning up later.
4. **Look-ups were unbounded and reached calendars not read.** Root causes: no time limit on any Google call (`runBudgetMs` was only checked between writes, and look-ups ran before writes, so slow look-ups could starve new copies and a hanging call could outlast Netlify's 30 s), and a copy from a calendar no longer in `DETAILERS` was looked up and its 404 taken as deleted. Now every call in a run is ended at `runBudgetMs` by an abort signal (sign-in included), copies and updates go before look-ups, cut or failed look-ups mean no cancels that run, and copies from unread calendars are skipped with one `unread-source` warning.
5. **404 meant "gone" on any calendar.** Root cause: Google answers 404 for a calendar it can't open as well as for a missing event. `lookupOriginal` now takes `readThisRun`; elsewhere a 404 is an error.
6. **409 after a not-found look-up was counted as "exists".** Root cause: it assumed only the other writer could hold the id, but Google keeps a deleted event's id after a look-up stops finding it. Now a PUT with status confirmed puts it back; a failed PUT is logged and counted as failed. The fake doesn't decide how Google answers that PUT (undocumented): the test runs both answers.
7. **A name in the original title lost to the calendar's detailer.** Root cause: the title code replaced any crew name with the calendar's, unlike JobsSync (`(title.match(DETAILER) || [])[1] || cal.detailer`). Now the title's name wins for the title, `Detailer:` line and colour.
8. **An update wiped GHL's own fields.** Root cause: updates were a PUT of the whole event. Now a PATCH of the mirror's own fields, and only when one differs; a PUT only when an event switches between all-day and timed (a PATCH can't). GHL edits to those fields are still put back: documented as a phase 2 question.
9. **Resend's error text could put a customer's address in the log** (gap G5). `redact()` replaces addresses and phone numbers in `send-confirmation.mjs`, `_giftmail.mjs` and `cart-capture.mjs`.
10. **A booking left no log line** (gap G1). One `[booking] ok|check key=… detailer=… days=… calendar=… owner=… customer=…` line, no customer data.
11. **A failed customer email isn't in Elijah's email** (gap G4). Not reordered: his email goes first on purpose (if only one gets through, it must be his), so the failure is in the `[booking]` line (`check … customer=failed`) and Resend's own line.

Not fixed, still documented: a multi-day job whose day 2+ write fails (gap G11).

### Tests
- `master-calendar.test.ts` 35 (was 27 before), `jobs-sync-contract.test.ts` +3. Full suite 958 pass (`TZ=America/New_York`). `npm run build` and `CONTEXT=production npm run build` pass.
- `fake-gcal.ts`: abort signals end a request as fetch does, `created` on every event, per-calendar delays, a refused Resend address, and `purge` (get 404, insert 409) with the PUT answer chosen per test.

### Docs
`BACKEND-LOGGING-STANDARD.md` and `BOOKING-PROCESS-FLOW.md` (and their PDFs, re-rendered the same way: headless Chrome, marked 12.0.2, mermaid 10.9.1) describe the code as now: the `[booking]` line, every `[master-cal]` action, the cap by `maxCancelsPerRun`, failure rows, title order, jobs-mirror reading the bookings calendars and writing the master, which failures reach Elijah and which only a log. `MASTER-CALENDAR-SETUP.md`: both calendars exist and the setting is set per context (ids only in Netlify). Two new CLAUDE.md rules, one rewritten.

### Still unproven
- Against real Google: the 409 on a long-deleted id and what a PUT to it answers; PATCH merging `extendedProperties.private`; `AbortSignal` ending a real call mid-flight. All handled both ways in code, but only the fake has run them.
- A real booking and run on a Deploy Preview / production with the setting on.

## Verification pass 4 follow-ups (November 26)

- **Two copies of one key** (a stray left by a race Google didn't catch): the copy at the key's own id (`masterEventId`) is the one kept and updated, whatever order Google lists them in. Before, list order decided, so a stray could stay Busy "Booked" over a cancelled time. `planMirror` takes the id function from `jobs-mirror.mjs`.
- **One event on two read calendars** (a bookings calendar invited as a guest): copied once, for the first detailer in DETAILERS order. Before, both got the key `manual:<id>` and the copy swapped detailers every run, a write GHL saw every 10 minutes.
- **Test:** `cd web && TZ=America/New_York npx vitest run lib/master-calendar.test.ts` ("planMirror: duplicates and shared events").
- **Left as noted, not fixed:** the booking reply can wait up to `writeTimeoutMs` when Google hangs (inside Netlify's synchronous limit); `redact` also masks dates and long ids in logged provider errors; held copies are looked up again each run.
