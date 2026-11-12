# Calendar setup: who is offered first, and the best times

Everything here is set in Google Calendar, so changing a best time or who goes first never needs a code change or a redeploy. Work as **elijahthackerllc@gmail.com**.

The site reads three things from each detailer's **availability** calendar:

| What | How you set it | What the site does with it |
|---|---|---|
| **OPEN** events | An event titled `OPEN` for each stretch the person can work, repeating weekly. You use these already. | Times inside OPEN blocks can be booked. |
| **BEST** events (new) | An event titled `BEST` starting at an ideal start time, any length (15 minutes is tidy), repeating weekly, set to **Show as: Free**. | Those start times are what "Our recommended times" offers. |
| **Priority** (new) | One line in the calendar's **Description**: `Priority: 1` | Who is offered first. 1 goes first, then 2, and so on. |

Anything else on an availability calendar still blocks time, unless it's set to **Show as: Free**. That's why BEST events have to be Free: they mark a time and never take it away.

---

## Part 1. Kris

Skip any step you've already done.

### 1. Make his two calendars
Google Calendar, then Other calendars, then **+**, then Create new calendar:

| Calendar | Public access (Settings and sharing, Access permissions) |
|---|---|
| **513 Kris Availability** | Make available to public: **See all event details** (it holds nothing private) |
| **513 Kris Bookings** | Make available to public: **See only free/busy (hide details)** |

On **513 Kris Bookings**, under "Share with specific people", add Kris (See all event details) and, if Netlify has `GOOGLE_SERVICE_ACCOUNT_JSON`, the service account's `client_email` (Make changes to events).

### 2. His working hours: OPEN events
On **513 Kris Availability**, make an event titled `OPEN` for each stretch he can work, repeating weekly. His hours (owner, November 12; until then Sunday and Monday all day and Tuesday to Saturday evenings):
- **Monday:** 8:00am to 12:00am.
- **Tuesday to Thursday:** 6:00pm to 12:00am.
- **Friday to Sunday:** none. Those days are Elijah's alone.

Jobs always finish by midnight; the site already plans for that.

### 3. His best times: BEST events
On **513 Kris Availability**, each titled `BEST`, 15 minutes long (only the start time matters), repeating weekly, set to **Show as: Free**:
- **Monday:** 10:00am.
- **Tuesday to Thursday:** 6:00pm.

Not 6pm on Monday: his ideal hours there are 10am to 6pm, so a 6pm start carries the late fee. To offer 10:30am too, add a second BEST event at 10:30.

### 3b. His fee-free hours: the calendar decides
Since fee standard B (November 11), the fee comes from the OPEN block a start falls in: `OPEN` is standard price, `OPEN +20%` carries the fee. Kris's 6 to 7:30pm block is plain `OPEN`, so his 6, 6:30 and 7pm starts are standard; 7:30pm and later pay the fee.

His `DETAILERS` entry's `noFeeStarts` is only a stand-in for when his calendar can't be read. Since November 12 it never applies to a time outside his OPEN blocks (a Friday, say). Keep it in step with his evenings: `"Tue-Thu 18:00-19:00"` (Netlify still had `"Tue-Sat 18:00-19:00"` on November 12). The build checks the whole `DETAILERS` value and stops on a mistake.

### 4. Put him first
**513 Kris Availability**, then Settings and sharing, then **Description**: type `Priority: 1`

### 5. Send me the two calendar IDs
Each calendar's Settings and sharing, then Integrate calendar, then **Calendar ID** (it ends in `@group.calendar.google.com`). Paste both in the chat. I'll wire them into the preview tonight, and into Netlify's `DETAILERS` setting when we go live.

---

## Part 2. You (Elijah)

All on your existing **513 Availability** calendar, the one with your OPEN blocks.

### 1. Your best times: BEST events
Make these, each titled `BEST`, 15 minutes long, set to **Show as: Free**:
- **10:00am**, repeating weekly, every day.
- **4:00pm**, repeating weekly, every day.
- **6:00pm**, repeating weekly, **Monday to Friday only** (no 6pm at weekends).

### 2. You go second
**513 Availability**, then Settings and sharing, then **Description**: `Priority: 2`

---

## How the site uses this

- **"Our recommended times":** each day shows the first-priority detailer's best times (Kris at 6pm). "More times on Friday" shows the next detailer's best times for that day (your 10am, 4pm and 6pm), not every half hour.
- **Only real openings:** a best time is offered only when that person is OPEN and free for the whole job, plus travel. A booked job, or any other Busy event, removes it.
- **To change a best time:** move or delete the BEST event. To change who goes first, change the Priority numbers. The site picks it up on the next page load.
- **Fees still apply by the clock:** your 6pm best time carries the late fee. Kris's doesn't, because his fee-free 6 to 7pm is set in his Netlify entry (`noFeeStarts`).
- **No BEST events on someone's calendar:** the site falls back to today's suggestions for them (straight after another job, else 10am and 4pm).

## Rules worth knowing

- **OPEN events can be Busy or Free;** they count either way.

- **Titles:** they only have to start with the word, so `BEST`, `Best` or `BEST evening` all work. The same goes for `OPEN`.
- **BEST events must be Free.** A BEST event left on Busy blocks that time, like any other event.
- **Only on availability calendars.** Never put OPEN or BEST events on a bookings calendar: a free/busy reader only sees "busy".
- **One Priority number per person.** If two calendars share a number, or one has none, the order in Netlify's `DETAILERS` setting breaks the tie.
