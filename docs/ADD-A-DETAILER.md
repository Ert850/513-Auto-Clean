# Adding a detailer, and keeping job details private

Two Google calendars per detailer and one Netlify setting. The booking form and the booking email function both read that one setting, so there's nothing else to keep in step.

Work in Google Calendar as **elijahthackerllc@gmail.com**.

---

## Part 1. Make your jobs calendar private (do this first, once)

**Why:** today the "513 Auto Clean" calendar is public with **full details**, and that's where booked jobs are written: customer name in the title, phone and address in the description. Anyone with its ID, which is in the site's public config, can read them. After this change the site reads only its busy times.

**Order matters:** do step 1 before step 3. The site has to be reading the calendar as busy-only before the details are hidden.

1. **Netlify, add a setting.**
   - Go to Site configuration, then Environment variables, then Add a variable.
   - Key: `GOOGLE_BUSY_ONLY_CALENDAR_IDS`
   - Value (your 513 Auto Clean calendar):
     ```
     75726fed82aa92a27201386beda7b3a15f550a3a5691e5e6cfc51382f0f0b9cf@group.calendar.google.com
     ```
   - Scopes: Builds **and** Functions.
   - Save, then Deploys, then Trigger deploy.
2. **Check the site:** open Book Now and reach "Pick your time". Real times should still show (not the "standard start times" note).
3. **Google Calendar:**
   - Go to 513 Auto Clean, then Settings and sharing, then Access permissions.
   - Under "Make available to public", change "See all event details" to **"See only free/busy (hide details)"**.

**Keep OPEN blocks off this calendar.** They live on "513 Availability", as they do today. Free/busy can't see a title, so an OPEN block here would count as busy.

**To undo:** set public access back to full details, then delete the Netlify setting and redeploy.

---

## Part 2. Add a detailer (example: Kris)

### 1. Make two calendars

In Google Calendar, go to Other calendars, then +, then Create new calendar. Make:

| Calendar | What goes on it | Public access (Settings and sharing) |
|---|---|---|
| **513 Kris Availability** | OPEN blocks for his hours. Make an event titled `OPEN` for each stretch he can work, repeating weekly. Anything else on it blocks time | Make available to public, **See all event details**. It holds nothing private |
| **513 Kris Bookings** | His jobs. The site writes them here | Make available to public, **See only free/busy (hide details)** |

### 2. Let the site write jobs to his bookings calendar

On **513 Kris Bookings**, go to Settings and sharing, then "Share with specific people", and add:
- **The account the site writes calendar events with, set to "Make changes to events":**
  - If Netlify has `GOOGLE_SERVICE_ACCOUNT_JSON`, add the `client_email` from inside it (it ends in `iam.gserviceaccount.com`).
  - If the site writes as your Google account (the OAuth settings), you own the calendar already; nothing to add.
- **Kris himself**, so he can see his jobs: "See all event details", or "Make changes to events" if he should move them.

### 3. Copy the two calendar IDs

Each calendar's Settings and sharing, then "Integrate calendar", then **Calendar ID**. It looks like `abc123...@group.calendar.google.com`.

### 4. One Netlify setting

Site configuration, then Environment variables, then Add a variable:
- Key: `DETAILERS`
- Scopes: Builds **and** Functions
- Value (paste this, then replace the two IDs):

```json
[
  { "name": "Kris", "does": "interior",
    "availability": "PASTE-KRIS-AVAILABILITY-ID@group.calendar.google.com",
    "bookings": "PASTE-KRIS-BOOKINGS-ID@group.calendar.google.com" },
  { "name": "Elijah", "owner": true }
]
```

- **Order is the booking preference.** The first person free for a time gets the job. Kris is first here, then you.
- **`does`:** `"interior"`, `"exterior"`, or `"all"`. A job with any exterior work only goes to someone who does exterior.
- **Your own entry** (`"owner": true`) only sets your place in the order; your calendars stay as they are. Leave it out and you book last.
- **Several people can be booked at the same time.** Each is checked against their own calendars.

Save, then Trigger deploy.

### 5. Check it

- **Book Now, an interior package, to "Pick your time":** Kris's open hours should now appear alongside yours.
- **Book a test interior job:**
  - the booking email says **Detailer: Kris**;
  - the job appears on 513 Kris Bookings, titled `Kris: ...`;
  - nothing appears on yours.
- **If Kris never shows up,** open the browser console on the booking form. A line starting `[513] DETAILERS setting:` says what's wrong with the entry, such as a missing ID or a name listed twice. A bad entry is skipped; it never breaks the form.

### Adding a third person, or removing one

Add or delete their `{ ... }` entry in `DETAILERS` (mind the commas between entries) and redeploy. Nothing else changes.

---

## Not built yet

- **A menu to pick the order.** Today the order is the order of the list in `DETAILERS`. A real menu needs a small admin page behind a login; that's a follow-up.
- **Their own personal calendars.** Your personal (iCloud) calendar blocks your times only. If a detailer has one, block those times on their availability calendar (any event that isn't `OPEN` blocks time).
