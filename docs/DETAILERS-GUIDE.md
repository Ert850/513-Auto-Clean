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
- **Fees follow the clock:** an early start (before 10am) or a late start (6pm or later) adds 20%. A booking within 3 days (rush) adds 20%. Early or late plus rush adds 30% in total.
- **A detailer's fee-free hours** remove the early or late fee for starts they work anyway (Kris, Tuesday to Saturday, 6 to 7pm). These are set in Netlify, not in the calendar.
- **Customers see a 1-hour arrival window**, for example "We arrive between 10 and 11am". Aim to arrive near its start.

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

**For part of a day:** create any event (for example "Dentist") on that person's availability calendar and leave it **Busy**. It blocks that time.

## D. Change who is offered first (Priority)

1. In Google Calendar's left side panel, under **My calendars**, point at the availability calendar and click the three dots, then **Settings and sharing**.
2. In **Description**, write `Priority: 1` for the first choice, `Priority: 2` for the next, and so on.
3. It saves by itself.

Today Kris is Priority 1 and you are Priority 2. When two people are free at the same time, the job goes to the lower number.

## E. Change fee-free hours (Netlify)

1. In Netlify, open **Site configuration**, then **Environment variables**.
2. Find **DETAILERS**, click the three dots, then **Edit**.
3. Change that person's `"noFeeStarts"`. Examples:
   - `"Tue-Sat 18:00-19:00"`: starts from 6 to 7pm, Tuesday to Saturday, have no early or late fee.
   - `"18:00-19:00"`: the same, every day.
   - `"Sun,Mon 08:00-09:30; Tue-Sat 18:00-19:00"`: two windows. Separate them with a semicolon.
   - Times use the 24-hour clock, and both ends are included. The rush fee still applies.
4. Click **Save**.
5. Open **Deploys**, then **Trigger deploy**, then **Deploy site**. The change goes live when the deploy finishes (about a minute).

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
- **Fee-free:** Tuesday to Saturday, 6 to 7pm (`"Tue-Sat 18:00-19:00"`).
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
- **Priority:** 2. **Does:** everything.
- **Calendars:** 513 Availability `9f26a370ac8629b6df3f7f4e8181aa1086f3acb2b47866e01a1b868cd4ab8161@group.calendar.google.com` (your OPEN and BEST events), and 513 Auto Clean `75726fed82aa92a27201386beda7b3a15f550a3a5691e5e6cfc51382f0f0b9cf@group.calendar.google.com` (your jobs).
- **Netlify `GOOGLE_BUSY_ONLY_CALENDAR_IDS`** is set to the 513 Auto Clean ID, so the new booking form reads your jobs as busy times only, never their details.

## Netlify settings, for the record

- `DETAILERS` and `GOOGLE_BUSY_ONLY_CALENDAR_IDS` use **All scopes**, with the same value in every context (choosing scopes needs a paid Netlify plan). Neither is marked secret: both are written into the page's `js/config.js`, and a secret value there fails the build.
- **Not set up yet: writing booked jobs onto the calendars.** Every booking is emailed, but nothing puts the job on 513 Auto Clean or 513 Kris Bookings, so add each job by hand until this is done. It takes a one-time Google sign-in (`npm run gcal:token`), whose three values go into Netlify as `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` and `GOOGLE_OAUTH_REFRESH_TOKEN`.
