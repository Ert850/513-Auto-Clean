# Calendar booker ("See additional times"): branch `claude/calendar-booker-fda4ce`

Built November 11 from the owner's picks of rendered mockups (`docs/mockups/calendar-booker-options.png`, `calendar-standard-price-options.png`, `calendar-plain-rows-options.png`). Made to merge into `eNov10PipelineBranch`. Nothing pushed.

## What customers saw before (reproduced at 1440×790 and 375×812)
- **Laptop:** the calendar opened almost hidden. Only about one row showed above the pinned "Go to a date" bar, under the legend, a paragraph of fee rules and the "top half / bottom half" sentence. You scrolled the page, then scrolled again inside the calendar's own box.
- **"Later times"** sat under the "More below" pill.
- **Phone:** the day list started at 6am, not at the regular hours.
- **Every open time** was a green box with a tick or "Standard price", so a whole day read as one block of green.

## What changed
- **Wide screens (laptop, desktop, tablet), option C:** a strip of the seven days, then the open day as a timeline, one row per half hour.
  - Pointing at a start draws the whole job over the rows it covers: "10am to 12pm", the price once in the middle, and the star where the row has it. The rows under it hide their contents.
  - A click or tap shows the block solid for 0.45 s, then moves on to the next section (no delay with reduced motion). A touch screen sees the whole job too.
  - Half-hour starts are their own rows, so touch screens can reach them (the old grid needed a mouse for the bottom half of a box).
- **Phones, option B:** the week bar and the day strip stay pinned while the times scroll. Each part-of-day heading ("Midday", "Afternoon") stays pinned under them while any of its times are on screen, then gives way to the next.
- **Both:**
  - They open on 10am to 6pm. "Earlier times, 6am to 9:30am" and "Later times, …" open the rest. They open by themselves when the chosen time is there, or when the day has nothing in the regular hours.
  - A day with only evening times left starts at its first time, not under a column of grey rows.
  - Opening "See additional times" brings the calendar to the top of the window.
- **Plain rows, option S (owner, November 11):**
  - Times are white rows like the recommended-time cards, red edge on hover. No ticks, no green fill.
  - The price is said once per stretch of the same price: "Standard price" in green, "+$25 rush fee" in gold, then the rows after it are blank or "+$25". On a phone, a price the whole part of the day shares goes in its heading.
  - Taken times stay grey hatched on wide screens; the phone list leaves them out.
- **Day bars:** the bar under each date fills to how much of that day is still open (its starts out of the 33 the window allows, `dayOpenShare`). It is green when the day has standard-price times, gold when every time left has a fee, and hatched when nothing is open. Each day reads out "Friday, November 13, 22 times open".
- **Legend:** "★ Suggested", "Not available" (wide only) and "When is there a fee?", which opens one line: "Some times cost a little more: early or late starts, and times in the next 3 days. When a time costs more, it says so in gold." The old line named fixed hours (before 10am, from 6pm), which is no longer always true now that the fee hours come from each calendar's OPEN blocks (Kris is standard 6 to 7:30pm).

## Earlier decisions this reverses (each one the owner's pick on November 11)
- **The 7-column week grid** (round 2, answer 1, "Full week, Sunday to Saturday") becomes a 7-day strip and one day at a time on wide screens. The week is still Sunday to Saturday, with the same arrows and "Go to a date".
- **The calendar in its own scrolling frame** (round 15, B1) is gone: one scroll.
- **The mouse-only half-box starts** (round 10) are replaced by half-hour rows.
- **Green with a tick for standard price** (round 2, answer 2, as built) is replaced by white rows. The owner's own answer, "Unavailable in grey", stays.
- **"A good answer is ink" (CLAUDE.md):** "Standard price" is green by the owner's call. Logged in CLAUDE.md as an exception.

## Bugs found while building, with causes
- **40 and 80 px gaps in the phone list.** *Cause:* the part-of-day groups were `<section>`s, and `styles.css` pads every `section`. They are `div`s now (lesson in CLAUDE.md).
- **A column of grey daytime rows above today's evening times.** *Cause:* the timeline always began at 10am. A day with nothing in the regular hours now starts at its first time.

## Code
- `js/funnel.js`: `dayStrip`, `dayList` (phone), `dayTimeline`, `tlBlock`, `previewTl`, `foldsOpen`, `pinWeek`, `priceWords` and `priceTag` replace `weekGrid`, `weekList`, `frameWeek`, `halfStart`, `spanGeom`, `fitSpan`, `previewSpan` and `cellLabel`. The `data-wkfold` and `#bkFeeWhy` clicks replace `data-wkedge`.
- `web/lib/availability/week.ts`: `dayOpenShare`, `STARTS_PER_DAY` and `stretchStarts`, with tests.
- `book.css`: the grid, frame and edge rules are gone. New: `.bk-tl*`, `.bk-px`, `.bk-wk-fold`, `.bk-wk-feeq`, the bar meter, and the phone pins under `.bk-wk.narrow`.

## Checked (headless Chrome, live calendar, test Kris; bookings blocked)
- **1440×790, 1440×900, 820×1180 and 375×812:** no sideways scroll, no console errors, no booking request sent.
- **Wide:** pointing at Friday 10am draws "10am to 12pm | Standard price | Suggested" over 4 rows. A click shows it solid, then opens "Almost done" with "Fri, Nov 13 · arrive 10 to 11am". Reopening Time shows the chosen block.
- **The price once:** Friday says "Standard price" once in 19 rows. Wednesday (rush) says "+$25 rush fee", then "+$25".
- **Phone:** "Midday" pins at 234 px (under the strip) while its times show, and leaves with its last time. "Afternoon" takes its place.
- **Tests:** 511 of 511 (Eastern time), 6 new in `week.test.ts` plus new checks in the smoke test. Typecheck: one error, in `fee-standard-b.test.ts` from the pipeline branch, not touched here.

## To test
- Laptop: open "See additional times", point at a few starts (a fee one too), click one, then reopen Time.
- Try "Earlier times" and "Later times", and a day with only evening times.
- Phone: scroll a day and watch the headings stay pinned; tap a time.
- Tablet (touch, wide): tap a half-hour row; the block shows briefly, then the form moves on.

## Not done
- **Keyboard:** Tab reaches each row, but nothing draws the block on keyboard focus. The aria-label reads the full span and price.
- **On a phone at the very end of the list,** the pinned "Go to a date" bar sits about 45 px above the price bar instead of on it. This happened before this change too (the checkout section's bottom padding).
