# Toll-free verification of (866) 371-5948: notes for Imperion (November 14)

From a research and site audit (Twilio and GoHighLevel guidance). The site is frozen from submission until approval.

## Use in the submission

- **Opt-in URLs:** https://513autoclean.com/contact.html and the same form on https://513autoclean.com/ (between the reviews and "Our work"). The booking form has the same SMS box at checkout.
- **Privacy URL:** https://513autoclean.com/privacy.html. **Terms URL:** https://513autoclean.com/terms.html. Both are linked in every page's footer and next to the opt-in.
- **Use case:** "Customer care: appointment confirmations, reminders, on-the-way alerts and replies to quote or booking questions for a mobile car detailing business in Cincinnati. Customers opt in by ticking an unchecked, optional box on our website forms."
- **Sample messages:**
  1. "513 Auto Clean: Hi Sam, your Full Interior detail is booked for Sat Nov 22 at 9:00 AM. Reply STOP to opt out, HELP for help. Msg & data rates may apply."
  2. "513 Auto Clean: Reminder, we are coming tomorrow at 9:00 AM. Reply with any questions. Reply STOP to opt out."
  3. "513 Auto Clean: Your detailer is on the way and should arrive by 9:00 AM. Reply STOP to opt out, HELP for help."
- **Volume:** low, roughly 100 to 300 messages a month (estimate; Elijah to confirm).
- **HELP reply:** "513 Auto Clean: call or text (866) 371-5948 or email 513autoclean@gmail.com. Msg & data rates may apply. Reply STOP to opt out."

## Changed on the site for it (November 14)

- **Terms, section 11:** it no longer says texts are "sent by hand… no automated messaging". It describes the program and has a program paragraph with frequency, rates, STOP, HELP, "carriers are not liable", and the support phone and email.
- **Privacy, section 4:** "Text messaging originator opt-in data and consent will not be shared with any third parties or affiliates." There is no carve-out.
- **Privacy, section 5:** lists "Our text messaging provider" (named generically so a provider change needs no rewrite).

## For Imperion and Elijah to decide (not changed on the site)

- **The consent wording is Imperion's, word for word**, as their document asked. The audit flagged that the first box mixes alerts and "occasional marketing" in one consent. Twilio prefers separate consents, and the second box doesn't say "texts". Its suggested alternative, if Imperion wants it:
  - "I agree to receive text messages from 513 Auto Clean about my quote or appointment (confirmations, reminders, on-the-way alerts and replies to my questions). Message frequency varies. Msg & data rates may apply. Reply STOP to cancel, HELP for help. See our Terms and Privacy Policy. Consent is not a condition of purchase."
  - "I also want to receive texts from 513 Auto Clean with offers and discounts. Frequency varies. Msg & data rates may apply. Reply STOP to cancel, HELP for help."
- **Business email:** the site and the form use 513autoclean@gmail.com. Twilio prefers an email on the business domain (for example one at 513autoclean.com). That's a submission-form field; the site can keep Gmail.
- **Legal name and address:** use the exact registered legal name, and the address on file, in the form. The site says "513 Auto Clean" and "Cincinnati, OH" only. If the registered name differs, the reviewer may flag the mismatch.
- **Proof of consent:** each Contact form and booking email records "SMS consent: yes/no". Keep those emails as the consent record.

## Live validation before the freeze (November 13, after PR #10)

- **Pages:** 11 live pages at 1440, 375 and 320 wide. All return 200 with no console errors and no sideways scroll. All show (866) 371-5948, with no trace of the old number. The home-page form sits between the reviews and the gallery.
- **Quote forms:** the home page and Contact page forms were submitted on live (the Contact one with the SMS box ticked). Both showed the thank-you message.
- **Booking form on live:**
  - steam is $80 with Full Interior and $115 with Basic Interior;
  - travel is measured from the address ($20 for Mason), and tax and total are right;
  - real times are offered, including Kris's 6 PM weekday times;
  - Escape opens the leave dialog, and Back returns to the booking.
- **Real bookings through the booking endpoint:**
  - 4 events were written. Each reply had calendar ok, and a retry with the same key returned "duplicate" with no second event.
  - Kris's booking landed on his bookings calendar. (Sending his display name instead of his id booked the owner. That was the test's mistake: the form sends the id, `detailerParam()`.)
  - All 4 events were deleted, and the times were offered again afterwards.
- **Not re-read live:** the event description format (guarded by `jobs-sync-contract.test.ts` on the same code, and checked on a real event on November 13), and a time disappearing while booked (the same read path that brought the times back after deletion).
- **For the queue, not now:** on the Package step, Continue goes straight to checkout, and Extras is reached through its chip. The week picker opens on the current week, with past days greyed.
