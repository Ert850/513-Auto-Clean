# 513 All Jobs: the master calendar for GoHighLevel

Built November 26, 2026 (branch `master-calendar`), from concept (d) of `docs/ONE-CALENDAR-SPEC.md`, with one change from the spec: **the website does the copying**, not an Apps Script (Emmett's decision). Nothing for Elijah to install or run.

## What it does

- **513 All Jobs** is a private Google calendar holding a copy of every booked job and nothing else. GoHighLevel (GHL) links to it.
- **At booking time,** `send-confirmation.mjs` writes the job to the detailer's bookings calendar and sends both emails exactly as before, and only then tries one quick copy to 513 All Jobs (one write per working day, all at once, by the booking key). It is capped at `writeTimeoutMs`; if it fails or Google is slow, it is logged and the next 10-minute run copies the job. Nothing a customer or Elijah sees depends on it.
- **Every 10 minutes,** `jobs-mirror.mjs` (a Netlify scheduled function, published site only) reads every detailer's bookings calendar and makes 513 All Jobs match: jobs typed in by hand, moves, edits, reassignments, deletes and restores. A copy changed or deleted on 513 All Jobs is put back as the original says.
- **The bookings calendars stay the truth.** Detailers keep working on their own calendars from their phones. 513 All Jobs is only ever written by the site, never read by it.
- **Only jobs are copied:** exactly what JobsSync counts in the Accounting sheet (`notAJob()` in `web/lib/availability/masterCalendar.ts`, checked against JobsSync's own patterns by `jobs-sync-contract.test.ts`). Not copied: Free events (fee blocks and the like), titles starting `OPEN`, `BEST`, `DNS`, `Busy`, `Blocked`, `Unavailable`, `Availability`, `Hold` or `Personal`, anything at the office address, and all-day events with no `$` amount. One difference on purpose: JobsSync skips `Day N of M` events to count a job once, but they are copied, one copy per working day like the originals.

## The copy

- **Title:** the original's, with the detailer always named first: `Kris: Full Interior, Jane Doe`, and `Elijah: Full Interior, Jane Doe` for jobs on 513 Auto Clean (which carry no name there). `SHORT NOTICE, accept or decline:` stays in front and `Day 2 of 2` stays as written, so JobsSync-style patterns read the copy the same way.
- **Who the detailer is,** as JobsSync decides it: a name already at the start of the original's title wins (`Kris: …` typed on Elijah's calendar stays Kris's, with Kris's colour), else the calendar's detailer. A booking the server gives to no detailer (`detailerFor()` finds none it knows who can do the job) is written to Elijah's calendar, so its copy is Elijah's.
- **Location:** copied, ZIP last.
- **Description:** a fixed header, then the original description word for word:
  ```
  Status: Booked
  Detailer: Kris
  Booking key: <the website's key, or manual:<event id> for a job typed in by hand>
  Source calendar: 513 Kris Bookings
  ---
  <the original description>
  ```
  A copy made at booking time says the bookings calendar's id on the `Source calendar:` line (no time is spent looking its name up); the next 10-minute run writes the name. Days 2 and on of a long job have no `WHO` line, because their originals carry none: only day 1's description has the customer's details and the total.
- **Colour:** by detailer, from `config/master-calendar.json` (`colors`; anyone not listed gets `defaultColor`).
- **What the mirror owns:** the title, description, location, start and end, Busy or Free, colour, and the two hidden fields. If anyone (by hand, or GHL under two-way sync) changes one of these on the copy, the next run changes it back, with a PATCH of those fields only. Anything else on the copy (guests, GHL's own fields) is left as it is. Whether GHL edits to a copy should ever flow back is a phase 2 question (spec, open question 3).
- **Hidden fields** (private extended properties): `bookingKey` (the original's key) and `sourceId` (the original's calendar id and event id).
- **A cancelled job** (its original deleted): the copy is kept, titled `CANCELLED: Kris: …`, set to Free so GHL stops blocking the time, coloured `cancelledColor` (graphite), `Status: Cancelled`. Restore the original from Google Calendar's Trash and the copy goes back to Booked. With `"cancelMode": "delete"` the copy is deleted instead.

## Settings: `config/master-calendar.json`

| Setting | Today | What it does |
|---|---|---|
| `colors` | Elijah 7 (Peacock), Kris 10 (Basil) | Event colour per detailer name. A new detailer gets a line here. |
| `defaultColor` | 9 (Blueberry) | For a detailer not listed. |
| `cancelledColor` | 8 (Graphite) | For a cancelled copy. |
| `cancelMode` | `mark` | `mark` keeps a cancelled copy as Free and grey; `delete` deletes it. |
| `maxCancelsPerRun` | 10 | More jobs than this looking deleted in one run means something else is wrong: none are marked, and Elijah gets one email. |
| `daysBack`, `daysAhead` | 14, 120 | The window the reconciler reads and keeps in step. Jobs outside it are left as they are. |
| `writeTimeoutMs` | 2500 | The most the booking-time copy may take, after both emails have gone. One write per working day, all at once; any still unanswered are abandoned and the reconciler copies them. |
| `runBudgetMs` | 20000 | Every Google call in a reconciler run ends by this time from its start (answered or not) and nothing new starts after it, so a run always finishes inside Netlify's limit for scheduled functions. The next run carries on (a first run with many jobs takes a few runs). The settings check (`checkMasterCalendar`) refuses a value that would not leave room under that limit. |

## Setup, once

**Done so far (November 26):** both calendars exist in the business Google account, and `ALL_JOBS_CALENDAR_ID` is set in Netlify per deploy context (steps 1 and 3). The ids are only in Netlify. Steps 2 and 4 to 6 are still to check or do.

### 1. Make the calendars (done)

In the Google account the site writes calendar events as (step 2):
1. Google Calendar, Other calendars, **+**, Create new calendar: **513 All Jobs**. Leave it private: do **not** tick "Make available to public". It holds customers' names, phones and addresses.
2. The same again: **513 TEST All Jobs**, for Deploy Previews and test bookings.

### 2. Give the site's identity write access

The site's calendar credentials (`netlify/functions/_gcal.mjs`) work one of two ways:
- **`GOOGLE_SERVICE_ACCOUNT_JSON` is set in Netlify:** the site writes as the service account. On each of the two new calendars, Settings and sharing, Share with specific people, add the `client_email` from that JSON (it ends in `iam.gserviceaccount.com`) with **Make changes to events**.
- **Otherwise (`GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REFRESH_TOKEN`):** the site writes as the Google account that ran `npm run gcal:token` (Elijah's). Create the calendars in that account and nothing needs sharing.

The same identity already reads and writes every bookings calendar (it writes the jobs there), which is all the reconciler needs.

### 3. Set `ALL_JOBS_CALENDAR_ID` in Netlify, per context (done)

Each calendar's Settings and sharing, Integrate calendar, **Calendar ID**. In Netlify, Site configuration, Environment variables, add `ALL_JOBS_CALENDAR_ID` with different values per deploy context:
- **Production:** the id of 513 All Jobs.
- **Deploy Previews and branch deploys:** the id of 513 TEST All Jobs.

Trigger a deploy. The id lives only in Netlify, never in the repo (the repo is public).

**Unset or empty means off:** bookings behave exactly as before and the 10-minute run logs one `[master-cal] {"action":"off"}` line and stops. The scheduled run happens on the published site only, so on a Deploy Preview only the booking-time copy is tested (on 513 TEST All Jobs), and its `Source calendar:` line keeps the calendar's id because no run comes to write the name.

### 4. Share 513 All Jobs

Only with **Elijah** and **GHL's Google account** (the account GHL is connected with), "Make changes to events" (GHL needs writer access to link a calendar). Nobody else: anyone who can see it sees every customer.

### 5. Link it in GHL

In GHL, the user's calendar integration: pick **513 All Jobs** (the production one) as the **linked calendar**. Never 513 TEST All Jobs: it holds test bookings from Deploy Previews.
- **Never add an availability calendar (513 Availability, 513 Kris Availability) as a GHL conflict calendar.** Their `OPEN` blocks are Busy, and GHL treats every Busy event as unavailable, so GHL would block exactly the hours that are open (spec, "What GHL does with Google calendars").
- Phase 1 rule: customers don't book through GHL. An appointment GHL creates on 513 All Jobs has no `sourceId`: the reconciler leaves it alone and logs a `not-ours` warning, but the website never reads 513 All Jobs, so that time could be sold twice. Copying GHL bookings back to a bookings calendar is phase 2 (spec, open question 4).

### 6. Check it

- Make a test booking on a Deploy Preview: within a few seconds a copy appears on 513 TEST All Jobs, titled with the detailer first and with the header in its description. The function log has `[booking] ok key=…` and `[master-cal] {"action":"copy",…}`.
- On production, after the first deploy with the id set, the 10-minute run copies the existing jobs over the next few runs (Netlify, Logs, Functions, `jobs-mirror`: one `[master-cal] {"action":"run", …}` line per run with the counts).

## Rules that keep it safe

- **The master must never be read.** Never add 513 All Jobs to JobsSync's `CALENDARS` (every job would count twice in the Accounting sheet), and never to any calendar the site reads for open time: `GOOGLE_CALENDAR_ID`, `GOOGLE_OWNER_AVAILABILITY_ID`, `GOOGLE_BUSY_ONLY_CALENDAR_IDS`, `GOOGLE_BOOKED_CALENDAR_ID`, or a `DETAILERS` calendar. The build fails if `ALL_JOBS_CALENDAR_ID` is one of those (`render-config.mjs`), and both writers refuse to run. `master-calendar.test.ts` checks JobsSync's list and that only `_mastercal.mjs` reads the setting.
- **The copy can't touch a booking.** It runs after the detailer's event is written and both emails have gone, so the reply, the calendar event and both emails are exactly what they were without it (`master-calendar.test.ts` checks this with the master working, failing and never answering). A failure is logged only (`[master-cal] {"action":"copy-failed",…}`), and the next 10-minute run copies the job. Nobody is emailed about it: the reconciler is the retry.
- **The reconciler writes nothing in a run where a calendar list failed** (a bookings calendar or 513 All Jobs). A copy is marked cancelled only after a direct look-up of its original says deleted (status cancelled, or not found on a calendar that run read). A look-up that fails, or look-ups cut short by `runBudgetMs`, mean no copy is marked cancelled that run; new and changed copies still go (they come from complete lists, and are written before the look-ups).
- **A copy whose bookings calendar wasn't read this run** (a detailer taken out of `DETAILERS`, say) is never looked up and never marked: it stays as it is, and the run logs one `unread-source` warning with how many.
- **Too many cancellations at once:** if more than `maxCancelsPerRun` jobs look deleted in one run, none are marked and Elijah gets one email ("CHECK: N jobs look deleted"). If they really were cancelled, mark the copies by hand or raise `maxCancelsPerRun` for one deploy.
- **It writes to 513 All Jobs and nowhere else**, and copies only jobs (above).
- **Logs** are one `[master-cal]` JSON line per action with booking keys and event ids only: never a title, name, phone or email. The list of actions is in `docs/BACKEND-LOGGING-STANDARD.md`, section 11.

## Adding a detailer

Today's steps (`docs/ADD-A-DETAILER.md`), plus a colour for them under `colors` in `config/master-calendar.json`. Their bookings calendar is picked up from `DETAILERS` on its own.

## Not built (from the spec)

- `Done` and `Paid` statuses: only `Booked` and `Cancelled` are written. Paid needs a signal the calendar doesn't carry (spec, open question 6).
- Copying GHL bookings back (phase 2).
