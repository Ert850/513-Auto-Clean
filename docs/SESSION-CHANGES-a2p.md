# A2P overnight changes (November 12 to 13, 2026)

Branch `claude/a2p-nov12-8a6544` (the plan called it `a2p-nov12`). The brief is `docs/OVERNIGHT-A2P-PLAN.md`. Nothing is pushed, merged or deployed, and no calendar event was touched.

## Follow-up, November 13: calendar fixes and decision mockups

Emmett asked for every open bug from the T5 review to be fixed, and for mockups of the open design choices. Commit `1e74ac4` holds the fixes. Tests: 651 pass (15 new in `web/lib/availability/calendar-review-fixes.test.ts` and `jobs-sync-contract.test.ts`).

| # | Fix | Root cause | Test |
|---|---|---|---|
| 1 | `verifySlot` checks a job longer than a day with the same multi-day search that offered it (`multiDayStillFits`). | It ran the one-day slot search, which no multi-day job can pass, so every one was refused as taken. | An option on an empty OPEN window still fits; a job since booked on day 2 makes it taken; `verifySlot` calls it. |
| 2 | One calendar event per working day (`multiDayEvents`, `bookingEvents` in `send-confirmation.mjs`). Day 1 is the booking as before (TOTAL, tax, SOURCE, HEARD ABOUT US) plus a DAYS line; days 2+ are "[Name: ]Day N of M, packages, customer", with no TOTAL and their own booking key (`key:dayN`). `JobsSync.gs` skips them (`CONTINUATION_DAY`), and the contract test carries the same pattern. | `endMs = slot + whole job`: Saturday 8am to Sunday 4am, which left Sunday's real hours bookable. | Saturday and Sunday 8am to 6pm; day 1 has TOTAL and SOURCE, day 2 has neither, and the JobsSync pattern skips day 2 only. |
| 3 | A multi-day start needs only the work inside OPEN; a drive out of up to an hour sits before the day, as in `computeSlots`. Nothing may clash with the whole block, drive included. | `covered()` tested the block with the drive. | OPEN from 8am offers an 8am start with a 30 minute drive; a busy hour in the drive still clashes. |
| 4 | The owner's fee is read from 513 Auto Clean and 513 Availability (`ownerFeeCalendars`, minus busy-only calendars), like the form. | The server read only 513 Availability. | An `OPEN +20%` on 513 Auto Clean is charged 20%. |
| 5a | One calendar failing fails the pooled read, so callers fall back as for a single calendar. | The failure was swallowed: a jobs calendar that failed made its hours sellable. | The read rejects. |
| 5b | `DNS` blocks time even when Free (Google's default for all-day events). | Every Free event was dropped. | An all-day Free DNS is busy; a Free birthday isn't. |
| 5c | "OPEN 20%" and "OPEN (+20%)" parse like "OPEN +20%". | The `+` was required. | `openFeeBp`. |
| 5d | Every page of an event list is read (`nextPageToken`, up to 20 pages, then it fails rather than guess). | Only the first page was read. | Two pages, both read. |
| 5e | The weekday rule applies to every day of a multi-day job. | Only day 1 was checked, so a weekend-only job started Sunday ran into Monday. | Saturday is offered, Sunday isn't. |
| 5f | `docs/CALENDAR-SETUP.md` no longer says a Busy BEST blocks time (the new code never did). It still says to keep BEST Free, because the live site (`main`) has no BEST and treats a Busy one as a job. It also documents DNS and the fee spellings. | | |

**Not changed:** the multi-day "still free?" check reads the same calendars the offer did, without Elijah's personal calendar, as `paintMultiDay` does. Adding it only to the check would refuse times the form had just offered.

**Decision mockups** (real screenshots from the built branch on the 8792 preview, each option injected, measured; recommendation first):
- `docs/mockups/a2p-decision-1-texts-box.png`: keep the one box in Your details (recommended); back in Almost done; or both, with a pre-ticked short box in Almost done.
- `docs/mockups/a2p-decision-2-small-continue.png`: leave it (recommended); a compact box brings it back at 1280×720 only, at exactly 160 px; folding in the terms line brings it back nowhere.
- `docs/mockups/a2p-decision-3-request-quote-fold.png`: tighter only below 760 px tall (recommended: the button lands at 624 to 681 at 1280×720, and 1440×790 is unchanged); leave it; boxes side by side (worse, 731 to 789).
- `docs/mockups/a2p-decision-4-book-header-pill.png`: pill in the dark top bar (recommended: all six links at 1440, links and More at 1000); leave it (menu button at 1000); a smaller pill (no better).
- `docs/mockups/a2p-decision-5-area-pills.png`: "Southeast Indiana" (recommended, matches the mockup and the Range & Travel cards; one word in the footer partial) or "SE Indiana".

None of the options is applied: each waits for Emmett's pick.

## Morning report

| Task | Done? | How it was checked | For Emmett before merging |
|---|---|---|---|
| T1 one phone number | Done | A real build with `BUSINESS_PHONE=5555550100` left no trace of 279-2915 in `dist/` in any of the nine formats searched, and `tel:` and the hidden `"telephone"` read +15555550100. A bad value (`513-555-01`) stops the build: "BUSINESS_PHONE: the phone number "513-555-01" is not 10 US digits." Unset, the stamping step changes nothing: compared with the pre-change build, `dist/` differs only where T2 to T4 changed the pages and in the `?v=` stamps. Tests: `a2p.test.ts` T1. | Not through `js/config.js`, see T1 below. Set `BUSINESS_PHONE` in Netlify for **all** scopes (builds and functions). |
| T2 Request a quote | Done | Matches the mockup at 1440 and 375 (`docs/mockups/a2p-contact-built.png`). Request Quote sits at 717 to 774 px at 1440×790, inside the fold (it was at 795 to 853 before trimming). Flipping `mode` to `"question"` and rebuilding gave today's `contact.html` back except for the region markers and the T4 hours. Neither box is required, both are unticked. The `ac-question` hand-off fills `#q-message`, whose id is unchanged. Tests: `a2p.test.ts` T2. | At 1280×720 the button is below the fold (774 > 720). The owner's test is 1440×790 only. The question box's three-line placeholder is cut at its new height. |
| T3 booking form texts box | Done | Matches the mockup at 1440 and 375 (`a2p-booking-built.png`). The small Continue spot was re-checked at the six sizes (below). The smoke tests walk every booking path to Done and all pass. Tests: `a2p.test.ts` T3, `funnel.smoke.test.mjs`. | The box **moved** from "Almost done" to "Your details" (two boxes for one answer would be confusing), so "Almost done" lost its old "Text me about this booking" box. At 375×812 and 1280×720 the hint line "Add your name and phone to continue" is now hidden by the 160 px rule; the mockup shows it at 375. |
| T4 hours | Done | No page says 7 AM or 10 PM. The footer, the home contact block and the Contact page say "6 AM to midnight", and the hidden data says `"opens": "06:00", "closes": "24:00"`, all from `config/business.json`. Test: `a2p.test.ts` T4. | Google's documentation writes a midnight close as `23:59`. "24:00" is valid ISO time and what the plan asked for. If Search Console complains, change `closes` to `"23:59"` (the words still say midnight only for 24:00 or 00:00, so check the words too). |
| T5 calendar review | Done; all fixed November 13 | A read-only subagent review, with probes, then every finding fixed with a test (follow-up above). | Multi-day jobs now write one event per day: JobsSync needs the updated script before correction is bookable. |
| T6 JobsSync | Delivered | `tools/jobs-sync/JobsSync.gs` and `README.md`. The subagent checked the title and description parsing against the real `eventTitle` and `eventDescription` (Kris, short notice, owner, help me decide), and that OPEN, OPEN +N%, BEST, DNS and Free events are skipped. The double-count handling needs the real sheet and was not run. | Elijah has to paste Kris's bookings calendar id, turn on the Calendar API advanced service, run `setup` once, and delete any old BEST or DNS rows. Nothing is deployed. |
| T7 /book page | Done | Matches the mockup at 1440 and 375 (`a2p-bookpage-built.png`). At 1440×790 the whole card fits (it ends at 655 px). `/book` serves it (through the preview server's copy of the rewrite). Picking a size opens the form at step 2 (Service) with that size set, and the modal grows out of the card over 300 ms. It switches instantly with reduced motion. Closing ("Keep it", or "Cancel my booking") returns to the page with the size still chosen. The phone's Book Now opens the form. A test video set in `video.src` played muted inline at 272×484 (9:16). No sideways scroll at 320. Header sweep from 700 to 1500 px: Book Now is always in view, nothing clips, and there's no sideways scroll. | `/book` used to be a **301 to /#book** (on `main` too). Browsers that followed it keep going to the home page's form, which still books. The pill makes the header switch to the menu button below about 1040 px on this page (about 880 elsewhere). Area pills say "SE Indiana", as in the footer list they come from; the mockup says "Southeast Indiana". |

**Tests:** 636 pass (614 before; 22 new in `web/lib/site/a2p.test.ts`). `npm run build` passes. `tsc --noEmit` reports two errors, both in test files this branch doesn't touch (`booking-followup.test.ts`, `fee-standard-b.test.ts`).

**Not checked:** a real booking or quote sent end to end (no submits from the preview), Safari, and ad-blocker lists for the new class names (`inq-tick`, `inq-terms`, `bk-terms-line`, `loc-pill`, `bp-*`). The names avoid every prefix CLAUDE.md lists, and "consent" was kept out of them on purpose.

---

## T1. One phone number

- **What:** `config/business.json` `"phone"` is today's number, the one the repo is written with. `BUSINESS_PHONE` in Netlify (10 US digits, any format) overrides it.
  - `web/lib/site/business.ts`: `parsePhone`, `businessPhone`, `swapPhone` (keeps each place's format: `(513) 279-2915`, `(513)&nbsp;279-2915`, `513-279-2915`, `513.279.2915`, `5132792915`, `+15132792915`, `+1-513-279-2915`) and `phoneTrace`.
  - `web/scripts/phone-stamp.mjs`, run by `build-dist.mjs` last: it swaps the number in every text file in `dist/`, then fails the build if any trace of the old one is left.
  - `stamp-assets.mjs` folds the number into the `?v=` hashes when it isn't the repo's (`phoneHashSalt`).
  - `send-confirmation.mjs` emails use `businessPhone()`; `price-list.mjs` too.
- **Root cause of the design:** the source can't be rewritten (the terms' wording fingerprint), so the swap happens in `dist/`. But `dist/js` is cached for a year under a hash of the **source**, so a swapped number would never reach a returning visitor's cached `funnel.js`. The salt fixes that, and it's empty when unset, so an unset build is byte for byte the same.
- **Departure from the plan:** the plan routed `funnel.js` and `script.js` through `js/config.js`. Stamping `dist/` already covers them (and `pricing.bundle.js`, which also carries the number), with one mechanism instead of two.
- **Test:** `BUSINESS_PHONE=5555550100 npm run build`, then `grep -rE '279.?2915' dist` finds nothing.

## T2. Contact form, "Request a quote"

- `config/contact-form.json`: `mode` (`"quote"` now) and both wordings. `web/scripts/contact-form.mjs` renders the heading and the form card between `CONTACT:HEAD` and `CONTACT:CARD` markers (called from `render-site.mjs`). `"question"` mode is checked against a saved copy of the November 12 form (`web/lib/site/fixtures/`).
- Quote mode: fields Name, Phone, Email / Vehicle, City or ZIP, best way / question, condition; the two boxes in Imperion's exact words, with the number from T1; the terms line; Request Quote; subject "QUOTE REQUEST from 513autoclean.com"; fine print "No spam, ever. We only use your info to send your quote."
- `script.js`: boxes marked `data-yesno` are sent as `yes` or `no` under their names, so the email always shows "SMS consent: no" and "Marketing: no". A form's `data-success` overrides the thank-you line; quote mode says "Thanks, your quote request is in. I'll get back to you shortly, usually the same day." (new wording, not in the plan, because "your question is in" was wrong for a quote).
- **Fold:** quote mode put the button 63 px under 1440×790. Quote mode only (`.inq-quote`): text boxes 6.25rem to 4.6rem, tighter field and box spacing. Question mode is untouched.
- **To revert after approval:** set `"mode": "question"` and deploy.

## T3. Booking form texts box

- `js/funnel.js` `rDetails()`: the texts box (`consentBox('sms', ...)`, unticked, optional) with `SMS_CONSENT` in the A2P words, and the terms line, under Name, Phone and Email. Removed from `rAgree()`.
- The booking email line is now `SMS consent: yes/no` (was `SMS: YES/no`). `consent.sms` and the calendar event are unchanged; `jobs-sync-contract.test.ts` passes.
- `a2p.test.ts` keeps `SMS_CONSENT` word for word equal to `contact-form.json` `smsBox`.
- **The small Continue spot, re-checked** (walk to Your details, headless Chrome):

  | Window | Before | Now |
  |---|---|---|
  | 1440×790 | shown | shown (194 px above the bar) |
  | 1280×720 | shown (263 px) | hidden: the box and terms line leave under 160 px |
  | 820×1180 | shown | shown (359 px) |
  | 700×400 | hidden | hidden |
  | 375×812 | shown (251 px) | hidden: under 160 px |
  | 320×568 | hidden | hidden |

  The bar's Continue is the main way in every case, as the rule intends.

## T4. Hours

- `config/business.json` `hours` (`06:00` to `24:00`), said in words by `hoursText()`.
- The footer partial uses `{{hours}}` (`chrome.mjs`). `render-site.mjs` `HOURS_STAMPS` covers the home contact block, the Contact page list and the JSON-LD, and fails the build if a pattern's count changes.
- **Root cause of the mismatch:** the words were typed in four places while the hidden data said 06:00 to 22:00. Neither came from a setting.

## T5. Calendar backend review (read-only)

Not fixed tonight. Bugs 1 to 3 only affect jobs longer than one day (paint correction), which aren't bookable yet; the fix writes one event per day, which changes what JobsSync reads, so it needs a decision. Bug 4 only bites if fee blocks are put on the jobs calendar.

1. **A multi-day booking always fails the "still free?" check** (`js/funnel.js` `verifySlot`): it calls `computeSlots` with the whole job's minutes, which never fit one OPEN block. The customer is told someone took the time.
2. **The server writes a multi-day job as one continuous event** (`send-confirmation.mjs` around 385): Saturday 8am to Sunday 4am instead of Saturday and Sunday 8am to 6pm, so Sunday stays bookable (a double booking).
3. **Multi-day starts need the drive inside OPEN** (`web/lib/availability/multiDay.ts` `covered()`), against the module's own rule that the drive sits outside the day. It only matters if OPEN starts later than 8am minus the drive.
4. **The server reads the owner's fee blocks from one calendar** (`_detailers.mjs` `blockFeeFor`: `OWNER_AVAILABILITY` only), while the browser reads all of them. A Free `OPEN +20%` placed on the 513 Auto Clean calendar would be quoted but not charged.

Lower confidence: a failed read of one calendar among several is swallowed (its jobs vanish); Google makes all-day events Free by default, so an all-day "DNS" is ignored unless set to Busy; `docs/CALENDAR-SETUP.md` says a Busy BEST blocks time but the code never does; `OPEN 20%` (no plus) charges 0; no `nextPageToken` paging (fine for today's windows); multi-day starts check the weekday of day 1 only.

## T6. JobsSync

`tools/jobs-sync/JobsSync.gs` and `README.md` (subagent; its summary is in the README). Reads 513 Auto Clean and Kris's bookings calendar (id to paste; found by name until then), the detailer from the title by the contract test's pattern (Elijah when none), skips OPEN, OPEN +N%, BEST, DNS and Free events (needs the Calendar API advanced service; CalendarApp can't see Free), keeps the money, tax, SOURCE, HEARD ABOUT US and ZIP patterns, and counts a booking sent twice once.

## T7. Booking page at /book

- `booking.html`, `config/booking-page.json` (`video.src`, `video.poster`, both empty). `render-site.mjs` writes the video slot (`BOOKPAGE:VIDEO`: the hero photo, cropped 9:16, while `src` is empty; otherwise a muted, looping, inline, autoplaying video with `preload="metadata"`) and the area pills (`BOOKPAGE:AREAS`, from the footer partial's area list). A video path must be a file in `images/` or the build fails; `build-dist` now copies referenced `.mp4` and `.webm` files.
- `js/funnel.js`: `mountSizeSteps()` paints `rSize()` into `[data-bk-sizestep]`. A pick calls `openWithSize()` (open, set the size, advance to step 2), and `flipFrom()` animates the modal from the card. `close()` repaints the page's size cards. No copied markup.
- Header: `{{locpill}}` in `header.html`, filled only for `booking.html` (`chrome.mjs`), so Priority+ measures it. Where the header shows the menu button, the page shows its own pill.
- Phones (under 720 px): video, rating (stamped from `data/reviews.json` like the badges; `reviews.js` isn't loaded here), and a fixed Book Now in place of the usual bottom bar.
- Registered: `CHROME_PAGES`, `FILES`, stamp `PAGES`, render-site `PAGES`. `noindex` meta plus an `X-Robots-Tag` header for `/booking*` and `/book`. Not in the sitemap.
- `netlify.toml`: `/book` is now a 200 to `/booking.html` (was a 301 to `/#book`). `/book.html` is unchanged.

## Files

New: `config/business.json`, `config/contact-form.json`, `config/booking-page.json`, `booking.html`, `web/lib/site/business.ts`, `web/lib/site/a2p.test.ts`, `web/lib/site/fixtures/contact-question-*.html`, `web/scripts/phone-stamp.mjs`, `web/scripts/contact-form.mjs`, `tools/jobs-sync/*`, `docs/mockups/a2p-*-built.png`.
