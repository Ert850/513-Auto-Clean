# Help me decide with two vehicles: what option B involves

From Emmett's agent, November 17, 2026. One question for Elijah, with the background the options sheet left out.

**The short version:**
- **Your pick:** B. On vehicle 2: "Not sure what this one needs? We recommend and price it on the day. Vehicle 1 stays as booked."
- **It can be done** without changing how a one-vehicle booking works today.
- **It's the largest change on the list.** Help me decide isn't a setting on a vehicle today. It's a switch that turns the whole booking into a different kind of booking. B means teaching each of these to handle a booking that is only half priced:
  - the price;
  - the calendar hold;
  - the card step;
  - both emails;
  - the calendar event your Accounting sheet reads.
- **Before it's built, it needs six decisions from you** (below). If those feel like more than the case is worth, A or C are much smaller.

## How Help me decide works today (one vehicle)

When a customer taps Help me decide, the whole booking becomes a "come and look, then recommend" visit:
- no price is shown, and no fee is added, since there is no price to add it to;
- no card step and no paying ahead;
- the calendar blocks 4 hours, which covers the longest single-vehicle detail;
- your email's subject starts "HELP ME DECIDE" and says "no package yet";
- the calendar event says "Nothing priced yet. Agree it with them before starting." and has no TOTAL line, so your Accounting sheet has nothing to copy until you price it.

With one vehicle, "the booking" and "the vehicle" are the same thing, so this works cleanly.

## Why it can't simply be copied onto vehicle 2

- **About 80 places ask one yes-or-no question:** the site checks "is this a Help me decide booking?" in about 80 places:
  - 51 in the booking form;
  - 21 in the part that writes your calendar event and emails;
  - 8 in the server's checks.
- **Each assumes the answer covers the whole booking.** For B the true answer is "vehicle 1 is priced, vehicle 2 isn't", and every one of those places has to handle "partly". That's the work.
- **What went wrong before we hid it:** Help me decide picked on vehicle 2 sent vehicle 1's package as an advice request, held for the wrong length, and left out the vehicle that actually needed advice. That's why, today, Help me decide only shows while there's one vehicle.

## The three options again

- **A. Help me decide for the whole visit.**
  - The customer says how many vehicles and each one's size, and we look at all of them.
  - This really is today's behaviour repeated, so it's small and low risk.
  - It needs one setting from you: how long to block for 2 or 3 vehicles.
- **B. This vehicle only, priced on the day (your pick).**
  - Vehicle 1 is booked and priced as normal; vehicle 2 is looked at on the day.
  - It's the closest match to "one car I know, one I don't".
  - It's large.
- **C. No new option.** One line under vehicle 2: "Pick the closest, and tell us about it in the notes at checkout. We confirm the price before we start." One sentence, no server change.

Building B includes A: if every vehicle is marked "not sure", the booking becomes today's Help me decide request.

## What B needs you to decide

Each one has a recommendation. "Yes" means it stands.

1. **The multi-vehicle discount.** Two or more vehicles take 10% off everything. Vehicle 2 has no price at booking.
   - **Recommended:** vehicle 1 shows the 10% off now, and vehicle 2 gets it on the day. If vehicle 2 isn't done after all, vehicle 1 keeps the discount. It's the simplest to explain, at a small cost.
   - **Alternative:** no discount shown until the day.
   - **Answer:**
2. **How long the calendar blocks.**
   - **Recommended:** vehicle 1's own time plus the same 4-hour Help me decide block. With a long vehicle 1 that's a full day, so fewer start times will fit.
   - **Alternative:** a shorter block for vehicle 2 (you name it).
   - **Answer:**
3. **Short-notice and early or late fees.** These are a percentage of the price.
   - **Recommended:** on vehicle 1's price at booking, as usual, and on vehicle 2's price when you set it on the day. The booking says so.
   - **Alternative:** on vehicle 1 only.
   - **Answer:**
4. **The card and paying ahead.**
   - **Recommended:** the card step stays as usual for vehicle 1. "Pay in full now" is turned off for these bookings, since a second amount comes on the day.
   - **Alternative:** no card at all, like Help me decide today.
   - **Answer:**
5. **Your calendar event and Accounting sheet.**
   - **What the event would say:** the TOTAL covers vehicle 1 only, with a line "VEHICLE 2: priced on the day, add it to the TOTAL".
   - **Why that's enough:** you said accounting happens only once a job is done and paid.
   - **Recommended:** you (or the detailer) correct the TOTAL on the event once vehicle 2 is priced, before marking the job paid. Nothing in your sheet's script changes.
   - **Is that workable,** or does it need to work another way, for example once GoHighLevel takes the bookkeeping?
   - **Answer:**
6. **What the customer reads.**
   - **On vehicle 2:** "Not sure what this one needs? We look at it on the day, recommend, and agree the price with you before we start. Vehicle 1 stays as booked."
   - **On the price bar:** vehicle 1's price "+ vehicle 2, priced on the day".
   - **In their confirmation email:** the same.
   - **Answer:**

## Risk and timing

- **Nothing changes on the live site before the merge.** Nothing here goes live until the current work (eNov14) merges, after toll-free approval. B would be built after that.
- **This is where the mistakes have been.** The last four checks of the booking form all found mistakes in the two-vehicle parts, which is exactly what B changes. So B would be built so that a one-vehicle booking takes exactly today's path, with tests proving nothing old changed, and a full check before it ships.
- **How to tell if B is worth it:** if two-vehicle customers needing advice are rare, C now and A later cover most of it for a fraction of the work. Your booking emails will show it: look for two-vehicle bookings with "not sure" in the notes.

## The question

**Knowing this, do you still want B?**
- If yes: answer 1 to 6 above.
- If not: A, C, or C now and A later.

**Answer:**
