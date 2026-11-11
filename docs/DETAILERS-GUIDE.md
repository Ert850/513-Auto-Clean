# Booking hours and detailers: how to change them

This guide covers changing working hours, best start times, fees and who is offered first, and adding or removing a detailer. None of it needs a programmer. Everything happens in two places: **Google Calendar** and **Netlify**.

## Before you start

- **Google Calendar:** sign in as **elijahthackerllc@gmail.com**. In your Chrome ("Browser 1") it is the third account, so this link opens it directly: calendar.google.com/calendar/u/2
- **Netlify:** sign in at app.netlify.com and open the 513 Auto Clean site.

## How the booking form decides what to offer

- **OPEN events** say when someone can work. Only times inside an OPEN event can be booked.
- **BEST events** mark the start times we recommend first, for example Kris at 6pm.
- **A "Priority" line** in each calendar's description says who is offered first: 1 goes first, then 2.
- **Anything else on an availability calendar blocks time,** like a dentist appointment, unless it is set to Free. So do booked jobs on a bookings calendar.
- **Each OPEN block sets its own price.** A start costs what the block it starts in says: `OPEN` is the standard price, `OPEN +20%` adds 20%, `OPEN +35%` adds 35%, any number. A job may run on into the next block; only where it starts counts.
- **Rush:** a booking for today or tomorrow adds 20% (2 days, set in `config/rush-fee.json`). With a block's fee the two together are capped at 30%, unless the block alone asks for more.
- **No OPEN blocks at all:** nothing can be booked (owner, November 11: "if it doesn't say open, you can't book"). If a calendar can't be read when a booking is priced, the fee falls back to the old clock rule, +20% before 10am or from 6pm.
- **Customers see a 1-hour arrival window**, for example "We arrive between 6 and 7pm", and the drive may use that hour. So a detailer whose OPEN starts at 6pm can be booked for 6pm, as long as the drive is under the hour.
- **Each detailer drives from their own home** (Netlify `DETAILER_HOMES`, section E). Their drive sets their travel fee and how close together their jobs can be.

## The calendars

Each detailer has two calendars.

| Calendar | Holds | Sharing (Settings and sharing, Access permissions) |
|---|---|---|
| **Availability** (for example "513 Kris Availability") | OPEN events, BEST events, time off, and the Priority line | Public, **See all event details** (nothing private is on it) |
| **Bookings** (for example "513 Kris Bookings") | The jobs the website books | Public, **See only free/busy (hide details)** |

Your own calendars are **513 Availability** (your OPEN and BEST events, Priority 2) and **513 Auto Clean** (your jobs).

**Never put OPEN or BEST events on a bookings calendar.** A bookings calendar is read as busy times only, so they would block time instead.

---

## A. Change someone's working hours (OPEN)

1. Open Google Calendar.
2. Find the OPEN event on that person's availability calendar and click it, then click the pencil (Edit).
3. Change the start or end time, or the days under the repeat setting.
4. Click **Save**. When asked, choose **This and following events** for a lasting change, or **This event** for one day only.

To add new hours:

1. Click **+ Create**, then **Event**.
2. Type the title `OPEN`.
3. Set the day and the start and end times.
4. Click **Does not repeat** and choose **Weekly**, or **Custom** to pick several days.
5. Under the calendar name, choose the person's availability calendar.
6. Leave it as **Busy**. *Until the new booking form is live, OPEN must be Busy; after that, Busy or Free both work.*
7. Click **Save**.

## B. Change the best start times (BEST)

A BEST event marks one recommended start time. Only its start time matters.

1. Click **+ Create**, then **Event**, and type the title `BEST`.
2. Set the start time (for example 6:00pm) and make it 15 minutes long.
3. Set it to repeat (Weekly, or Custom to pick the days).
4. Choose the person's availability calendar.
5. Change **Busy** to **Free**. *This matters: a BEST event left on Busy blocks that time.*
6. Click **Save**.

To move a best time, edit the BEST event's start time. To stop offering it, delete the event ("This and following events").

## C. Block time off (holiday, appointment)

**For a whole day off:** click that day's OPEN event, choose **Delete**, then **This event**. No OPEN means no bookings that day.

**For part of a day:** create an event titled **DNS** (do not schedule) for the hours that can't be booked, on that person's bookings calendar or availability calendar, and leave it **Busy**. This is the owner's preferred way, because it says plainly that the time is not to be booked. Any other Busy event (for example "Dentist") blocks the same way.

## D. Change who is offered first (Priority)

1. In Google Calendar's left side panel, under **My calendars**, point at the availability calendar and click the three dots, then **Settings and sharing**.
2. In **Description**, write `Priority: 1` for the first choice, `Priority: 2` for the next, and so on.
3. It saves by itself.

Today Kris is Priority 1 and you are Priority 2. When two people are free at the same time, the job goes to the lower number.

## E. Change prices by time, and where someone drives from

**Prices, in Google Calendar:** split an OPEN event into blocks and put the fee in the title.
1. Click the OPEN event, then the pencil. Change its end to where the price changes (for example 6:00pm). Save, **This and following events**.
2. Click **+ Create**, **Event**, title `OPEN +20%` (or any percentage), from 6:00pm to 12:00am, repeating on the same days, on the same availability calendar, left **Busy**. Save.
3. Blocks that touch count as one stretch, so a job can still run across the line.

**Or lay fee blocks over a plain day.** Keep one `OPEN` event for the whole day and add `OPEN +20%` events over the hours that cost more, set to **Free**. Where blocks overlap, the higher fee wins. Your own calendar (513 Availability) must use this layout until the new booking form is live: the current live site ignores Free events, but it mishandles a day split into touching blocks (no times for two-day jobs, and 10am read as the start of a day).

**Home addresses, in Netlify (server-only, never shown on the site):**
1. **Site configuration**, **Environment variables**, **Add a variable**: key `DETAILER_HOMES`, and tick **Contains secret values**.
2. Value, by name, any number of people: `{"Kris": "123 Example St, Cincinnati, OH 45202"}`
3. Save, then **Trigger deploy**. Anyone not listed, and you, drive from the shop address (`SHOP_ORIGIN_ADDRESS`).

**Arrival window (optional):** in someone's `DETAILERS` entry, `"arrivalWindow": 30` gives them 30 minutes instead of the usual 60.

**Old setting:** `"noFeeStarts"` in `DETAILERS` only matters when a calendar can't be read at booking time; tagged OPEN blocks replace it.

## F. Change what someone does (Netlify)

In the same **DETAILERS** setting, `"does"` lists the work they take:
- `"interior"`, `"exterior"`, `"correction"` (polishing and paint correction) or `"coating"`;
- several as a list, for example `["interior", "exterior"]`;
- `"all"` for everything.

A job only goes to someone who does every part of it. Save, then **Trigger deploy**, as in E.

## G. Add a new detailer

1. **Make their two calendars.** In Google Calendar's left side panel, click **+** next to "Other calendars", then **Create new calendar**. Make "513 *Name* Availability", then "513 *Name* Bookings".
2. **Share them.** For each one, open **Settings and sharing**:
   - Availability: tick **Make available to public**, and choose **See all event details**.
   - Bookings: tick **Make available to public**, and choose **See only free/busy (hide details)**. Under **Share with specific people**, add the detailer (See all event details), and add the website's service account (Make changes to events) if Netlify has `GOOGLE_SERVICE_ACCOUNT_JSON`. Its address ends in `iam.gserviceaccount.com`.
3. **Add their hours and best times** on the availability calendar (sections A and B), and their **Priority** line (section D).
4. **Copy both calendar IDs.** In each calendar's Settings and sharing, scroll to **Integrate calendar**, then **Calendar ID**. It ends in `@group.calendar.google.com`.
5. **Add them to Netlify.** In **DETAILERS**, add an entry like this, before your own `{ "name": "Elijah", "owner": true }` line. Mind the commas between entries.
   ```
   { "name": "Sam", "does": "interior", "noFeeStarts": "Tue-Sat 18:00-19:00",
     "availability": "PASTE-AVAILABILITY-ID@group.calendar.google.com",
     "bookings": "PASTE-BOOKINGS-ID@group.calendar.google.com" },
   ```
   Leave out `"noFeeStarts"` if they have no fee-free hours.
6. **Save, then Trigger deploy.**
7. **Check it** (section I).

## H. Remove or pause a detailer

- **Pause** (for example a week off): delete their OPEN events for those days (section C). Nothing else changes.
- **Remove:** in **DETAILERS**, delete their `{ ... }` entry and its comma, then Save and Trigger deploy. You can keep their calendars for the records.

## I. Check that a change worked

1. Open the website and press **Book Now**.
2. Choose a package their skills cover, and continue to the checkout.
3. At **Time**, the recommended days should show their best times. **More times on ...** shows everyone else's best times that day.
4. **If someone never shows up:**
   - check their calendars are public;
   - check the OPEN event's title starts with OPEN;
   - check a BEST event is set to Free;
   - then open the browser console on the booking form. A line starting `[513] DETAILERS setting:` names what is wrong in Netlify.

---

## Rules that matter

- **Event titles only have to start with the word:** `OPEN`, `Open hours` and `BEST evening` all work.
- **BEST events must be Free.** OPEN events must be Busy until the new booking form is live.
- **Repeating events:** "This event" changes one day. "This and following events" changes it from then on.
- **Netlify changes need a deploy** (Deploys, Trigger deploy) before they take effect.
- **Your jobs calendar (513 Auto Clean) stays public with full details for now.** The current live site needs that to see booked jobs. Once the new booking form is live you will be told to switch it to **See only free/busy (hide details)**, so customers' names and addresses are no longer public.

## Kris today (for reference)

- **Hours (OPEN):** Sunday and Monday 8am to midnight; Tuesday to Saturday 6pm to midnight. Jobs finish by midnight.
- **Best times (BEST):** Sunday and Monday 10am; Tuesday to Saturday 6pm.
- **Prices (fee standard B, set up November 11):** Sunday and Monday `OPEN +20%` 8 to 10am, `OPEN` 10am to 6pm, `OPEN +20%` 6pm to midnight. Tuesday to Saturday `OPEN` 6 to 7:30pm (so 6, 6:30 and 7pm starts are standard), `OPEN +20%` 7:30pm to midnight.
- **Priority:** 1. **Does:** interior only.
- **Calendars:**
  - 513 Kris Availability: `18f753f8e633da3dec644bca2d658fdccc42ee05a043adbf46dbc939ec88f2dd@group.calendar.google.com` (public, all event details).
  - 513 Kris Bookings: `b79865896edf56c9cc9985c8607a0a4dfec5df71b032ff7c16d3dae23e793826@group.calendar.google.com` (public, free/busy only). Still to do: share it with Kris once we have his email.
- **His Netlify `DETAILERS` entry (saved November 10):**
  ```
  [{"name":"Kris","does":"interior","noFeeStarts":"Tue-Sat 18:00-19:00",
    "availability":"18f753f8e633da3dec644bca2d658fdccc42ee05a043adbf46dbc939ec88f2dd@group.calendar.google.com",
    "bookings":"b79865896edf56c9cc9985c8607a0a4dfec5df71b032ff7c16d3dae23e793826@group.calendar.google.com"},
   {"name":"Elijah","owner":true}]
  ```

## You (Elijah) today

- **Best times:** 10am and 4pm every day, and 6pm Monday to Friday. Your 6pm carries the late fee.
- **Prices (fee standard B, November 11):** one `OPEN` 6am to midnight (Busy), with `OPEN +20%` 6 to 10am and 6pm to midnight laid over it, set to **Free**. The same prices as today's clock rule, and the live site sees only the plain OPEN.
- **Priority:** 2. **Does:** everything.
- **Calendars:** 513 Availability `9f26a370ac8629b6df3f7f4e8181aa1086f3acb2b47866e01a1b868cd4ab8161@group.calendar.google.com` (your OPEN and BEST events), and 513 Auto Clean `75726fed82aa92a27201386beda7b3a15f550a3a5691e5e6cfc51382f0f0b9cf@group.calendar.google.com` (your jobs).
- **Netlify `GOOGLE_BUSY_ONLY_CALENDAR_IDS`** is set to the 513 Auto Clean ID, so the new booking form reads your jobs as busy times only, never their details.

## Netlify settings, for the record

- `DETAILERS` and `GOOGLE_BUSY_ONLY_CALENDAR_IDS` use **All scopes**, with the same value in every context (choosing scopes needs a paid Netlify plan). Neither is marked secret: both are written into the page's `js/config.js`, and a secret value there fails the build.
- **Writing booked jobs onto the calendars: set up November 11, live from the next deploy.** The one-time Google sign-in (`npm run gcal:token`) is done, and its three values are in Netlify as `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` and `GOOGLE_OAUTH_REFRESH_TOKEN` (secret, every context). **The minute that deploy goes live, make 513 Auto Clean free/busy only** (Google Calendar, the calendar's settings, Access permissions, "See only free/busy"), because from then on the jobs written there carry customer names and addresses. Not before: today's live site reads that calendar's events in full and would stop seeing your jobs. The setting hides events already written too. If the sign-in ever stops working (a changed Google password, or the access removed), run `npm run gcal:token` again and replace the refresh token.
- **Calendar key for the server (optional):** `GOOGLE_CALENDAR_SERVER_KEY`. With it, the browser's `GOOGLE_CALENDAR_API_KEY` can be restricted to the site's own pages in Google Cloud (HTTP referrers), which the booking functions never pass. Without it, the functions use the browser key, as now, so don't restrict that key until this one is set.
