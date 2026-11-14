# JobsSync (updated November 14, 2026)

This is Elijah's `JobsSync.gs`, updated to match the way the website now writes bookings to
Google Calendar. It still fills the same two tabs in the Accounting sheet, **Jobs (auto)** and
**Jobs by Area**, with the same columns. Your Price override and Area override columns are
kept, and rows already in the sheet are matched by the same Event ID as before.

## What changed and why

- **Kris's jobs are read by ID.** The site writes Kris's bookings to his own calendar,
  "513 Kris Bookings". There is now a `CALENDARS` list at the top of the script with a place
  for its Calendar ID. Until you fill it in, the script looks the calendar up by name, as the
  old version did.
- **Detailer for your own jobs.** The site puts the detailer's name at the start of the title
  ("Kris: Full Interior, Jane Doe"), after "SHORT NOTICE, accept or decline: " when the job is
  less than a day away. Your own jobs carry no name, so they showed a blank detailer. They now
  show **Elijah**. A job on Kris's calendar with no name shows **Kris**.
- **Working-hours blocks are skipped.** `OPEN`, `OPEN +20%` (any `OPEN +N%`), `BEST ...` and
  `DNS` events are not jobs, and neither is any event marked **Free**. The old version only
  skipped titles starting with OPEN, Busy, Blocked and similar.
- **Free events need the Calendar API service.** The standard `CalendarApp` in Apps Script
  can't tell whether an event is Free or Busy (it has no `getTransparency`). The script now
  reads events through the **Google Calendar API advanced service**, which can. You turn it on
  once (step 3 below).
- **No double counting.**
  - The same event seen on two calendars counts once.
  - If the site wrote the same booking twice (a customer pressing Book twice), the copies
    share a hidden booking key and count once. If an earlier sync already gave the copy its
    own row, that row's Status becomes **Duplicate**, which the Jobs by Area totals leave out.
  - A repeating event now gets one row per date instead of all its dates fighting over one row.
- **Service names.** Website bookings now show the exact package names from the title, such
  as "Basic Exterior + Full Interior", plus "+ Steam" when the steam add-on was booked. The old
  keyword match called "Basic Exterior" a Basic Interior. Events you typed by hand still get
  the old categories.
- **Unchanged:** TOTAL, sales tax, pre-tax, SOURCE, HEARD ABOUT US, ZIP and area matching, the
  ZIP-to-area lists, the office address skip, the hourly trigger, the "513 Jobs" menu and the
  Jobs by Area formulas and chart. The website's tests check its bookings against these same
  patterns.

## Install (one time, about 5 minutes)

1. **Get Kris's Calendar ID.** In Google Calendar, open 513 Kris Bookings, then Settings and
   sharing, then Integrate calendar, then copy the **Calendar ID**. The account you install the
   script with must be able to see all event details on both calendars. If it can't, share the
   calendar with that account: Settings and sharing, then Share with specific people, then
   "See all event details".
2. **Paste the script.** Open the Accounting sheet, then Extensions, then Apps Script. Select
   all of the old JobsSync code, paste this `JobsSync.gs` over it, and put Kris's Calendar ID
   in place of `PASTE-KRIS-BOOKINGS-ID@group.calendar.google.com` near the top. Save.
3. **Turn on the Calendar API.** In the Apps Script editor, click **+** next to **Services**
   on the left, choose **Google Calendar API**, leave the identifier as `Calendar`, and click
   **Add**.
4. **Run it once.** In the function dropdown choose **setup**, then click **Run**. Approve the
   access it asks for (Advanced, then Go to project, then Allow). This also replaces the old
   hourly trigger with a new one, so there is still only one.

## Check it worked

- **Executions** (left side of the Apps Script editor): the latest `syncJobs` run says
  Completed. A line "Could not read calendar" or "No calendar ID" means step 1 or 2 needs
  another look.
- **Jobs (auto):**
  - Kris's jobs are there, with **Kris** in the Detailer column and "513 Kris Bookings" in the
    Calendar column.
  - Your own website bookings show **Elijah** as the detailer.
  - No rows titled OPEN, BEST or DNS. If any were added by the old version, delete those rows
    by hand; the new version won't touch or re-add them.
  - Total and Pre-tax on a website booking match the TOTAL and sales tax in its calendar event.
- **Jobs by Area** updates on its own. It counts only rows whose Status is Done.

## If something looks wrong

- **Error "Turn on the Google Calendar API service first":** step 3 was skipped.
- **Kris's jobs missing:** check the ID in `CALENDARS`, and that your account can see all
  event details on his calendar.
- **A new detailer:** add a line to `CALENDARS` with their bookings Calendar ID, the calendar's
  name and their name.

## Jobs longer than one day (November 13)

The website now writes a job that runs over several days as one event per day. Day 1 is the booking as before, with the total. Days 2 and on are titled "Day 2 of 2, ..." (after the detailer's name, if any) and carry no total, so this script skips them and the job is counted once.

## Cancelling a booking (November 14)

**To cancel a booking, delete its event in Google Calendar.** Elijah or Kris, on either
calendar, from the phone or the computer. Nothing to do in the sheet.

On its next run (within the hour, or "513 Jobs", then "Sync jobs now") the script finds the
row whose event is gone and sets its Status to **Cancelled**.

- **The row stays** in Jobs (auto), for the record. It is never deleted.
- **It leaves the totals.** Jobs by Area and Jobs by month count only rows whose Status is
  Done, so a Cancelled row is out of both. If you built a sum of your own over the Total or
  Pre-tax columns, make it count Done rows only, for example
  `=SUMIFS('Jobs (auto)'!I:I, 'Jobs (auto)'!C:C, "Done")`.
- **It stays Cancelled.** Later runs leave it alone and never add it again.
- **Changed your mind?** Restore the event from the calendar's Trash (Google Calendar,
  Settings, Trash). It comes back with the same ID, and the next run sets the row back to
  Upcoming or Done.

Deleting the event for a job that was really done also marks it Cancelled. Leave the events of
finished jobs on the calendar.

### What is safe

The script only marks a row Cancelled when all of these hold, so a hiccup never cancels a job:

- **Every calendar was read without an error** in this run. If one can't be read (sharing,
  a wrong ID, a Google quota or outage), nothing is marked, and the Executions log says
  "A calendar could not be read, so no rows were marked Cancelled this run."
- **The script wrote the row**: it has an Event ID, a Last synced time and one of the calendar
  names in `CALENDARS`. Rows you typed yourself are never touched.
- **The row's date is inside the dates the script reads** (from January 1, 2026 to 60 days
  ahead). Older or later rows are left alone.
- **A direct look-up of that one event, on every calendar, says it is deleted or cancelled.**
  An event moved to another date or to the other calendar is found and stays as it is. If the
  look-up itself fails, the row is left for the next run.
- **No more than 10 rows look deleted at once.** More than that usually means a wrong Calendar
  ID, not ten cancellations, so none are marked and the log says how many. If you really did
  cancel more than 10 in one go, raise `maxCancelsPerRun` near the top for one run.

Rows already Duplicate keep that status.

### Status values

Today the script writes **Upcoming**, **Done**, **Cancelled** and **Duplicate**. The Status
column is plain text, so it can hold the statuses planned for later (Booked, Completed, Paid,
Cancelled), when revenue will count only once a job is done and paid. That isn't built yet:
for now Done still means the event's end time has passed.

### Updating to this version

1. Open the Accounting sheet, then Extensions, then Apps Script.
2. Copy Kris's Calendar ID from the `CALENDARS` list at the top of the old code first. Select
   all of the old code, paste this `JobsSync.gs` over it, and put Kris's ID back in place of
   `PASTE-KRIS-BOOKINGS-ID@group.calendar.google.com`. Save.
3. In the function dropdown choose **syncJobs** and click **Run** once. Check Executions:
   Completed, and no "could not be read" line.
4. Nothing else changes: the Calendar API service and the hourly trigger stay as they are. No
   new trigger and no new permission.

The first run may mark rows whose events were deleted before this version (they had stayed
Upcoming). If the log says more than 10 rows look deleted, look them over before raising
`maxCancelsPerRun`.
