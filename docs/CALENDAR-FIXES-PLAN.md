# Booking and calendar fixes: what each one is, before any is done

**Where these come from:** the November 13 pre-release review and the November 12 per-detailer audit (`QUEUE-AFTER-FRIDAY.md`).

**How each will be checked:** built on `eNov14`, each with its own tests, then a real booking end to end on the private test site, which writes only to the TEST calendars. Nothing reaches the live site until the unfreeze and your PR approval.

## Recommended, in this order

### 1. The server checks the time is still free before booking it (double-booking guard)

- **Today:** the booking form re-checks the time just before Confirm, in the browser. The server then writes the event without checking again.
- **The risk:** two people who pick the same time a few seconds apart both get it. So does a request edited by hand, since it skips the browser check.
- **The fix:** before writing, the server reads the detailer's calendars and runs the same slot search the form uses. If the time is gone, the customer is told plainly to pick another, and nothing is written. The owner gets no "booked" email.
- **Risk of the fix:** a calendar read that fails. In that case it fails like today: the booking is treated as a request, never as a silent double booking.
- **Effort:** about 3 to 4 hours.

### 2. Dates for visitors outside Eastern time

- **Today:** in a request ("these days work for me") and in the final time check, some dates come from the visitor's own clock. Someone booking from another time zone, such as a parent booking for a UC student, can see request days shifted by a day near midnight.
- **The fix:** every date the booking uses comes from Cincinnati time, as the rest of the pipeline already does.
- **Effort:** about 1 to 2 hours.

### 3. The drive home is measured at the end of the job, not the start

- **Today:** both the screen and the server measure the drive home as if leaving at the start time. They agree, so the price shown is the price charged. But for a job ending at rush hour, the drive home (and its fee) is measured in the wrong traffic.
- **The fix:** send the job length to both drive measurements, so both measure the drive home at the finish time. The screen and the receipt must still show the same figure; a test proves they match.
- **Effort:** about 2 hours.

### 4. Kris's evening times show as standard price in the week view

- **Today:** the week grid and the day view judge "standard price" by the clock (10am to 6pm), not by Kris's calendar. So his 6pm start, which is standard price on his calendar, gets no star and is folded under "Later times".
- **The fix:** both read the fee from the calendar, like the price already does. Also, the fee's name ("early" or "late start") comes from the calendar block, not from before or after noon.
- **Effort:** about 2 to 3 hours.

### 5. The last typed scheduling numbers move into settings

- **The numbers:** the 24-hour short-notice window, the 30-minute drive fallback, correction's weekend-only days, "within the hour", and the 365/400-day booking horizon.
- **The fix:** move them into `config/`, with no change in behaviour. It means a change later is one value, not a code hunt. This is the same rule that bit us with the rush-fee days.
- **Effort:** about 2 hours.

## Later (no effect today)

- **Bot protection (Turnstile):** setting its secret key today would make every booking fail, because the form doesn't show the widget yet. Fix it before anyone sets the key.
- **Multi-day jobs:** send the form's day plan to the server, and list every day in the emails. Only paint correction and coating run over several days, and they aren't offered yet.
- **Assignment and fees:** when two detailers could take a time, prefer the one with no fee. No effect with today's schedules.
- **The "513 All Jobs" mirror calendar for GoHighLevel:** `ONE-CALENDAR-SPEC.md`, concept d. It's a separate build, and it waits for Imperion's answers.

**Total for 1 to 5:** about 10 to 13 hours, done one at a time, each tested on its own.
