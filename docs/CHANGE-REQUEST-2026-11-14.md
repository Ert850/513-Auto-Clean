# Change request, November 14: last push before the toll-free verification

**Branch:** `eNov6` → PR into `main` → live. After this, the live site freezes until Imperion's toll-free verification is approved. Everything else goes to the new `eNov14` test branch.

**Imperion must not submit until this push is live and validated.** The submission is checked against what the site shows, and nothing can change afterwards.

## CR-1. Both consent boxes on the /book page (Imperion, voice message, November 14), required

**What they asked:** the two boxes from the Contact page ("I consent to receive SMS…" and "I want to receive news…") must also be on the `/book` page, below the booking form. The booking form itself stays as it is.

**Build:**
- On `booking.html`, under the card with the size step, add:
  - the two boxes with Imperion's exact wording, unticked and optional;
  - the "By continuing you agree to our Terms & Conditions and Privacy Policy" line, both linked.
- **Generated, not typed:** the wording comes from `config/contact-form.json` (`smsBox`, `marketingBox`), the same source as the Contact form, through a new `BOOKPAGE:CONSENT` region. `a2p.test.ts` already checks that the booking form's SMS box says the same words; it gains a check for this region.
- **The boxes are real, not decoration.** A box that records nothing would mislead the reviewer and the customer.
  - **The /book SMS box:** ticking it pre-ticks the booking form's own SMS box (`state.consent.sms`). The booking form's box stays the final answer, because the customer can still change it at checkout.
  - **The /book marketing box:** it goes into the booking as `consent.marketing`. `validateWire` accepts it as a boolean, and the booking email to Elijah reads "Marketing: yes/no", like the Contact form's email.
  - **The calendar event description doesn't change,** so `jobs-sync-contract.test.ts` must still pass.
- **Layout:** mock up current vs proposed at 1440 and 375 before building (CLAUDE.md design rule). The card itself doesn't move, so the size cards stay on a 1440×790 screen; the boxes sit under it.

**Done when:**
- the boxes and line match the Contact page word for word at 1440 and 375;
- they are unticked and optional;
- a booking started on /book with the SMS box ticked arrives with "SMS consent: yes", and one with marketing ticked arrives with "Marketing: yes";
- a booking started anywhere else is unchanged;
- there's no sideways scroll at 320.

## CR-2. Package prices and names (Elijah, November 12 and 13), owner request for this push

**From the recorded answers** (`QUESTIONS-FOR-ELIJAH-PACKAGES.md`, `QUEUE-AFTER-FRIDAY.md`):

**Interior:**

| Package | Now | New |
|---|---|---|
| Maintenance (only for customers detailed by us in the last 3 months) | $95 | $115 |
| Basic Interior | $135 | $145 |
| Full Interior | $225 | $235 |
| **Full Interior + Steam** (new package, "Most popular", the lead offer) | Full + $80 steam = $305 | **$315** |
| Showroom Ready (interior package) | $395 | leaves the package list |

**Add-ons:**

| Add-on | Change |
|---|---|
| **Showroom Ready Restoration** (new) | "Starts at $445"; about +3 hours; only on Full and Full + Steam; booked with Elijah only; quoted on condition |
| Steam | $115 on any package other than Full. Added to Full, it becomes Full Interior + Steam at $315, so there's no second way to the same thing at a different price. |

**Exterior:** unchanged, unless you pick otherwise below.

**Build:**
- Everything changes in `web/lib/catalog/` only. The build stamps it into:
  - the cards on the home page and Services, on phones and desktop alike;
  - the structured data, the FAQ price block and the price list and its PDF;
  - the booking form (package step, level meter `pkgLevel()`, Help me decide, browse list);
  - the terms' Basic Interior example, through STAMPS. That changes the terms, so they're re-dated and re-locked.
- The browse list's "Under $X" filters (`funnel.js` `caps`) are a typed price list today. They become derived from the catalog.
- **Old quote links and saved drafts** that name `showroom-interior` map to Full Interior + Showroom Ready Restoration, priced at today's prices. A link must never fail to open.
- **The calendar event, JobsSync and the booking email** read package names from the catalog. Check that the new names appear correctly and the TOTAL line is unchanged in format.

**Done when:**
- `grep` of `dist/` finds no $95, $135, $225 or $395 package price, and no "Showroom Ready" package card;
- every price matches the tables at 1440 and 375, on the home page, Services, the booking form and the price list;
- the server prices every package and add-on combination the same as the booking form (tests);
- an old `showroom-interior` link opens;
- the Services first screen still passes the owner's 1440×790 check, and the 940 px full-list rule is re-measured.

## CR-3. Customer wording that is misleading today (from the Monday queue), low risk

- **"Ready to book?" block (home page):**
  - "Nothing is charged until we confirm your time" becomes "Know your price before you book. Pay on site once your detail is complete." (Elijah's wording; true: payment after the detail, no deposit);
  - "Add more than one vehicle and save 10% on each extra" becomes "Explore our detailing packages and find the right service for your vehicle", linking to Services. This also removes a typed STAMPS number.
- **The booking form's "Nothing is charged today"** on the booking path becomes the same pay-on-site wording. The request and quote lines ("until you agree to it") stay.
- **Done when:** no customer text says or suggests a charge at booking or confirmation, and the terms and FAQ agree.

## CR-4. Decided with Emmett (November 14)

- **Exterior:** "Showroom Ready (Paint Correction and Protection)" is renamed "Paint Correction and Protection", at the same price.
- **"Booked in" wording:**
  - email title: "Thanks {name}, you're fully confirmed for your detail with 513 Auto Clean.";
  - subject: "Confirmed: your detail on {day and time}";
  - the booking form's final screen: "You're fully confirmed";
  - the email's next line becomes "Thank you for your trust and support. We hope you're as excited as we are!"
- **Kris's 6 PM arrival:** the start of any working stretch counts as the start of his day (`outboundFree` in `slots.ts`), so his 6 PM is a true 6 PM arrival. Each detailer's start location is already configurable (`DETAILER_HOMES` in Netlify); check that Kris's entry exists.
- **JobsSync:** a deleted booking event marks its row Cancelled, keeps it, and leaves it out of totals. Built in `tools/jobs-sync/`, for Elijah to install. It doesn't touch the website.
- **/book layout:** waiting for Emmett's comments and files before building (mockups in `docs/mockups/book-consent-*`).

## Validation for the whole push (before the merge, then live)

1. Build, all tests, and new tests for CR-1 and CR-2.
2. Local preview at 1440, 375 and 320: every page, the /book boxes, the package cards, and the booking form with each package and steam.
3. A review agent on the diff (correctness, the booking and calendar path).
4. After the merge, on live:
   - the page sweep;
   - both quote forms;
   - 2 real bookings (one from /book with both boxes ticked, one with Full Interior + Steam), checking the emails' consent lines and the calendar events;
   - delete the bookings and confirm the times come back.
5. A dropped-task agent: everything in this request and in Imperion's original document is either done or deliberately tabled.
