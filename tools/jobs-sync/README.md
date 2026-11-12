# JobsSync (updated November 12, 2026)

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
