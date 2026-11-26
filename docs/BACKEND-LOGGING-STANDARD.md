# Backend logging standard: what the 513 Auto Clean backend records

For Imperion, who are connecting GoHighLevel (GHL). Written November 26, 2026, against branch `eNov14` (commit `a2a5869`), and brought up to date the same day for branch `master-calendar`, which adds the master calendar (section 11) and the booking log lines below. Every statement was read from the code; file names are given so each one can be checked. Its companion is `docs/BOOKING-PROCESS-FLOW.md` (how a booking moves); `docs/BOOKING-PIPELINE.md` (November 9) covers the booking form's screens and is not repeated here.

**The short version.**

1. **The record of truth for a job is its Google Calendar event** on the detailer's bookings calendar. Everything else (emails, the Accounting sheet, the new master calendar, GHL) is a copy of it or an alert about it.
2. **Elijah's owner email is the alert channel.** Every way a booking can fail to reach the calendar puts a word in that email's subject (`NOT ON THE CALENDAR`, `CHECK THE TIME`, `CHECK THE PRICE`), and a second, independent email (Web3Forms) says `CHECK THE CALENDAR` when the site could not confirm it saved the booking.
3. **Netlify function logs record failures**, under the short prefixes quoted below, **plus one `[booking]` line per booking** and the master calendar's `[master-cal]` lines. Netlify keeps them for a day (a week on some plans), so they are for debugging and for tying a failure to a booking key, not for counting or auditing bookings.

Contents:

1. Summary table
2. Netlify function logs
3. Google Calendar: the booking event
4. Emails (Resend and Web3Forms)
5. Stripe: payments, gift cards, webhook deliveries
6. The Contact form (Web3Forms)
7. Unfinished checkouts (`cart-capture.mjs`)
8. JobsSync and the Accounting sheet
9. Analytics and A/B tests
10. The visitor's browser console
11. The master calendar, 513 All Jobs (live since November 26)
12. What Imperion can rely on, and the gaps found
13. Open questions for Imperion

---

## 1. Summary table

| System | What is recorded | Where | Who can see it | How long it is kept | What a failure looks like |
|---|---|---|---|---|---|
| Netlify function logs | Failures, one line each, with a short prefix (section 2); one `[booking]` line per booking; `[master-cal]` lines for the master calendar | Netlify, the site's Functions page, per function | Members of the Netlify team | At least 24 hours of function activity; 7 days on some plans (Netlify's docs) | A line such as `gcal insert 403 ...`, `resend 422 ...` or `[booking] check ...` |
| Google Calendar booking event | The job: title, location, description blocks, start and end, the booking key (hidden) | The detailer's bookings calendar (Elijah: 513 Auto Clean; Kris: 513 Kris Bookings) | The calendar's owner account and the detailer it is shared with. The public sees free/busy only | Until deleted. A deleted event sits in Google Calendar's Trash for 30 days | No event, and the owner email subject starts `NOT ON THE CALENDAR` |
| Owner email (Resend) | Every booking, request and "help me decide", with any failure in the subject | Elijah's inbox (`OWNER_EMAIL`), and Resend's dashboard | Elijah; Resend account users | Gmail: until deleted. Resend: 30 days (Resend's pricing page) | Not received; `resend <status>` in the Netlify log |
| Customer email (Resend) | Confirmation, held time, or request received | The customer's inbox, and Resend's dashboard | The customer; Resend account users | As above | Not received; `resend <status>` and `[booking] check … customer=failed` in the log. Elijah's email can't say (it is sent first, on purpose; gap G4) |
| Booking email (Web3Forms) | A second copy of every booking, from the browser | Elijah's inbox | Elijah | Gmail: until deleted. Web3Forms keeps a short history on its free plan | The customer sees "Something went wrong sending that" if this AND the site's own save both failed |
| Stripe | Gift card payments, each card's value, balance, status and a short history; webhook deliveries | Stripe dashboard | Stripe account users | Payments: indefinitely. Events: 30 days in full through the API | A webhook delivery with a non-2xx answer; an owner email starting `CHECK:` |
| Contact form (Web3Forms) | The question, name, phone, email, consent answers, arrival source | Elijah's inbox | Elijah | As Web3Forms above | The visitor sees an error naming the business phone |
| Unfinished checkout (`cart-capture.mjs`) | Name, phone or email, what they had picked | Elijah's inbox (Resend). **Not GHL** | Elijah | As Resend above | `resend <status>` in the log, or an uncaught error (gap G7) |
| JobsSync | One row per job: date, status, service, ZIP, area, totals, lead source, detailer | The Accounting sheet, tabs "Jobs (auto)" and "Jobs by Area" | Whoever the sheet is shared with | Rows are never deleted; cancelled jobs stay as `Cancelled` | `console.warn` lines in Apps Script's Executions; no email (gap G9) |
| Analytics (GA4, Clarity) | Page views and booking form events, only after the visitor accepts analytics | Google Analytics and Microsoft Clarity | Property users | Google's and Microsoft's own retention settings | Nothing: measurement never breaks the page |
| A/B test version | Which version each booker saw | The owner email ("A/B tests" row) and the calendar event (`A/B TESTS` block) | As the email and the event | As the email and the event | Missing row: the visitor was in no running test |
| Master calendar, 513 All Jobs (new) | A copy of every job, with a parseable header | A private Google calendar (`ALL_JOBS_CALENDAR_ID`) | Elijah and GHL's Google account | Copies are kept; cancelled ones stay, marked, unless `cancelMode` is "delete" | A missing or stale copy and a `[master-cal]` warning; the 10-minute run puts it right. Only "too many cancels at once" emails Elijah |

---

## 2. Netlify function logs

**Where.** Netlify, the 513-auto-clean site, then the Functions page (Cloud compute, then Functions), then the function. Also `netlify logs` from the Netlify command line. Deploy Previews have their own logs.

**How long.** Netlify's documentation: "Logs are retained for at least 24 hours of function activity, even after a new function deployment. This log retention period increases to 7 days for certain pricing plans." Log Drains (sending logs to another service) are Enterprise only. So a failure must be noticed within a day, which is why the emails in section 4 are the real alert channel.

**Who.** Anyone on the Netlify team for the site.

**Format.** Most lines are `console.error("<prefix>", <detail>)` (or `console.log` for the success lines). The prefix is a fixed string; the detail is a status code and the first 200 to 500 characters of the other service's answer. Resend's answer is logged with email addresses and phone numbers replaced by `[email]` and `[phone]` (`redact()` in `send-confirmation.mjs`). Two kinds of line carry a booking key: `[booking]` (below) and the master calendar's `[master-cal] {json}` (section 11). Netlify adds its own start, end and duration lines around each run.

**The `[booking]` line.** `send-confirmation.mjs` writes one per booking that gets past the calendar step (not for a repeat, and not when the time was taken):

```
[booking] ok key=bk_… detailer=Kris days=1 calendar=written owner=sent customer=sent
[booking] check key=bk_… detailer=owner days=0 calendar=failed:http_403 owner=sent customer=none
```

| Field | Values |
|---|---|
| first word | `ok` when the calendar has it (or it is a request with no time), Elijah's email went, and the customer's did not fail; else `check` |
| `key` | the booking key (`-` when the browser sent none) |
| `detailer` | the detailer's name, or `owner` for Elijah's own calendar |
| `days` | how many events were written (0 for a request or a failed write) |
| `calendar` | `written`, `written-unchecked` (the CHECK THE TIME case), `request` (no time chosen), or `failed:<reason>` (the reasons in section 3) |
| `owner`, `customer` | `sent`, `failed`, `none` (no customer email given) or `unconfigured` (no `RESEND_API_KEY`) |

It never carries a name, phone, email or address.

### Every log line in the code

| Function (file in `netlify/functions/`) | What it does | Prefixes it writes (exact) | Logs a success? |
|---|---|---|---|
| `send-confirmation.mjs` | Reprices the booking, re-checks the time, writes the calendar event, sends both emails, then the master copy | `BUSINESS_PHONE` (a bad phone setting), `resend network`, `resend` (status and Resend's answer, addresses and phones redacted), `calendar write` (the whole error object, when writing threw), `still free: only with the form's drive` (console.log, the slot time), `[booking]` (above), `[master-cal]` (`copy`, `copy-exists`, `copy-failed`, `clash`; section 11) | **Yes:** one `[booking]` line per booking |
| `_gcal.mjs` (shared) | Google sign-in, writing, finding and patching events | `gcal oauth refresh` (the OAuth refresh token was refused), `gcal token` (the service account was refused), `gcal insert` (writing an event failed, with Google's message), `gcal find` (looking up a booking key failed), `gcal patch` (adding follow-up answers failed) | No |
| `_detailers.mjs` (shared) | Reads the fee calendar and re-checks a time | `fee calendar` (the OPEN block fee could not be read; the fee shown stands), `still free` (the re-check could not read a calendar; the booking is written as one to check) | No |
| `booking-followup.mjs` | Adds the "Help us get ready" answers to the booking's event | None of its own; only the `gcal ...` lines above | No |
| `cart-capture.mjs` | Emails Elijah about a checkout left unfinished | `resend` (addresses and phones redacted) | No |
| `personal-busy.mjs` | Elijah's personal (iCloud) calendar as busy times | **None.** A failed feed answers 502 to the browser and is never logged (gap G6) | No |
| `travel.mjs`, `_routes.mjs` | Measures the drive with Google Routes | **None.** A failure answers `routes_error` and the price falls back | No |
| `reviews.mjs` | Google reviews for the site | `places` | No |
| `create-payment.mjs` | Stripe intent for a booking (switched off: `cardOnFile` and `payInFull` are off in `web/lib/site/capabilities.ts`) | `create-payment` | No |
| `paypal-order.mjs` | PayPal and Venmo (switched off) | `paypal auth`, `paypal create`, `paypal capture` | No |
| `gift-checkout.mjs` | Starts a gift card purchase on Stripe | `gift-checkout: Stripe refused a payment method, using card and Link. Switch it on in the Stripe dashboard:`, `gift-checkout` | No |
| `gift-webhook.mjs` | Stripe's signed webhook: issues, refunds, disputes | `gift-webhook` (event type and error). Its answer to Stripe (`issued`, `ignored`, `already applied`, `retry`...) is visible in Stripe's delivery log | No (but see Stripe, section 5) |
| `gift-card.mjs` | The certificate page | `gift-card issue`, `gift-card` | No |
| `gift-send.mjs` | "Send it to someone" | `gift-send: the owner email didn't send`, `gift-send: owner email`, `gift-send: emailed, but couldn't mark it sent`, `gift-send` | No |
| `gift-admin.mjs` | Elijah's gift card tool | `gift-admin` | No (changes go to the card's history in Stripe) |
| `gift-deliver.mjs` | Scheduled, hourly (`netlify.toml`, `schedule = "0 13-23 * * *"`): sends dated cards | `gift-deliver catch-up`, `gift-deliver catch-up search`, `gift-deliver` | **Yes:** one line per run, `gift-deliver {"sent":…,"failed":…,"busy":…,"gaveUp":…,"waiting":…,"stopped":…,"caught":…}` |
| `gift-rebuild.mjs` | Scheduled, daily (`schedule = "15 5 * * *"`): rebuilds the site on sale dates | `gift-rebuild` (the build hook's status, or the error) | **Yes:** `gift-rebuild <status>` on the days it runs a build |
| `_giftmail.mjs` (shared) | Gift card emails through Resend | `resend network`, `resend` (addresses and phones redacted) | No |
| `jobs-mirror.mjs` | Scheduled, every 10 minutes (`netlify.toml`, `schedule = "*/10 * * * *"`), published site only: keeps 513 All Jobs in step | `[master-cal] {json}`, one line per action (section 11) | **Yes:** one `[master-cal] {"action":"run",…}` line per run with the counts (or `{"action":"off"}` while the setting is unset) |

Two prefixes are shared: `resend` and `resend network` are written by `send-confirmation.mjs`, `cart-capture.mjs` and `_giftmail.mjs`. Netlify shows logs per function, so the function name tells them apart.

---

## 3. Google Calendar: the booking event (the record of truth)

Written by `writeCalendar()` in `send-confirmation.mjs` through `createBookingEvent()` in `_gcal.mjs`, with the site's own Google sign-in (an OAuth refresh token, `GOOGLE_OAUTH_*`, or a service account, `GOOGLE_SERVICE_ACCOUNT_JSON`; the reply to the browser says which, as `auth`).

**Which calendar.** The bookings calendar of whoever was given the time: `bookings` in their `DETAILERS` entry (Kris: 513 Kris Bookings), or for Elijah `GOOGLE_BOOKED_CALENDAR_ID`, else `GOOGLE_CALENDAR_ID` (513 Auto Clean). No event is written for a request (no time chosen).

**The event, field by field** (`eventTitle()`, `eventDescription()`, `bookingEvents()` in `send-confirmation.mjs`). The patterns below are the ones Elijah's Accounting sheet reads; `web/lib/jobs-sync-contract.test.ts` fails if they change.

| Field | Content |
|---|---|
| Title | `[SHORT NOTICE, accept or decline: ][<Detailer>: ]<Package> + <Package>, <Customer name>`. Help me decide: `[<Detailer>: ]HELP ME DECIDE, <name>`. The short-notice prefix is added when the start is inside `config/scheduling.json` `shortNoticeHours`. Elijah's own jobs carry no detailer name. A title can never start with `OPEN` (it would read as working hours): `_gcal.mjs` prefixes `Booking:` |
| Location | Street, city, state, ZIP, with the ZIP last |
| Start | The chosen start (the start of the arrival window) |
| End | The planned arrival plus the work: `slot + (arrivalLateMin + work minutes)`. `arrivalLateMin` is the larger of the form's figure and the server's re-check (`writeCalendar()`), so the next job that day is spaced from when this one really ends |
| Busy/Free | Always Busy (`transparency: "opaque"`), so it blocks the time |
| Hidden fields | Private extended properties: `bookingKey` (the browser's key, `bk_…`, made once per booking by `bookingKey()` in `js/funnel.js`) and `phone` (ten digits, so a follow-up must name the same phone). Not shown in Google Calendar's apps |

**Description blocks, in order:**

```
** HELP ME DECIDE. No package chosen. Price to agree before starting. **   (help me decide only)
WHO  <name>  <phone>  <email>
WHERE  <street, city, state, ZIP>

VEHICLE 1  <label>  [<size>]
  <Package> + <Package>
  + <Add-on>, <tier>

PRICE
  <line label>: $<amount>          (one per price line, travel and sales tax included)
  TOTAL: $<amount>
  TO COLLECT on the day            (or PAID IN FULL online, only while payInFull is live)
  On site: about <hours> hours

ON ARRIVAL
  Outdoor tap / Outdoor outlet / Parking / Notes / ** NEEDS A LOCATION SORTED **

SOURCE
  <the tagged link they arrived through, e.g. a print QR code>
A/B TESTS
  <test: version>
HEARD ABOUT US
  <their answer>

DAYS                                (multi-day jobs only)
  Day 1 of N. ...

AFTER BOOKING (Help us get ready)   (added later by booking-followup.mjs)
  Outdoor tap: ... Parking: ... Vehicle: ... Notes: ...
```

**Multi-day jobs.** A job longer than one day is one event per working day (`multiDayEvents()`, planned by `web/lib/availability/multiDay.ts`). Day 1 is the booking, with `TOTAL:` and every block above. Days 2 and on are titled `[<Detailer>: ]Day N of M, <packages>, <name>`, carry no total, and have their own key (`<key>:day2`, `<key>:day3`), so the Accounting sheet counts the job once (`CONTINUATION_DAY` in `tools/jobs-sync/JobsSync.gs`).

**Idempotent by key.** Before writing, `findBookingEvent()` looks for an event with the same `bookingKey` within a day of the start. Found: nothing is written and no email goes (`duplicate`). A retry never makes a second event or second emails.

**Who sees it.** The calendar owner's account; the detailer the calendar is shared with (Kris has "Make changes to events" on his). The bookings calendars are public as free/busy only, so the booking form (and anyone) sees only that a time is taken.

**How long.** Until someone deletes it. A deleted event can be restored from the calendar's Trash for 30 days. Google Calendar keeps no edit history for these calendars, so a changed time or a deleted job leaves no trace on the calendar itself; the Accounting sheet (section 8) and the master calendar (section 11) are where a deletion is remembered.

**What a failure looks like.** No event, and Elijah's owner email subject starts `NOT ON THE CALENDAR`, with the reason in a red box: `unconfigured`, `no_slot`, `auth_failed`, `bad_times`, `http_<status>` (from Google), `day<N>_<reason>` (a later day of a multi-day job failed), `threw`, or `this time is already taken (<why>)`. The Netlify log has the matching `gcal ...` or `calendar write` line.

---

## 4. Emails

Sent through Resend (`send()` in `send-confirmation.mjs`, `sendMail()` in `_giftmail.mjs`) from `RESEND_FROM`, and, for bookings and questions, a second time from the browser through Web3Forms. Without `RESEND_API_KEY` no Resend email is sent at all, and the function answers `{ sent: false, reason: "unconfigured" }`.

### Booking emails

| Email | Sent by | To | Subject (exact patterns) | When |
|---|---|---|---|---|
| Owner email | `send-confirmation.mjs` `ownerEmail()`, sent **first** | `OWNER_EMAIL`, reply-to the customer | `[NOT ON THE CALENDAR, \| CHECK THE TIME, \| CHECK THE PRICE, ]<BOOKING \| SHORT NOTICE REQUEST \| REQUEST \| HELP ME DECIDE>, <name>, <$total or "no package yet">[, <when>]` | Every booking, request and help-me-decide, unless it was a duplicate or the time was taken |
| Customer email | `customerEmail()`, sent second | The customer, if they gave an email | `Confirmed: your detail on <when>`, `We have your booking for <when>`, `We have your short-notice request for <when>`, `Your time is held for <when>`, `We have your request, 513 Auto Clean` | Same |
| Booking email (Web3Forms) | The browser, `sendRecord()` in `js/funnel.js` | Elijah's inbox (Web3Forms access key) | `[CHECK THE CALENDAR, ]<BOOKING, \| SHORT NOTICE REQUEST, \| REQUEST, \| HELP ME DECIDE, >[<Detailer>, ]<name>, <$total>, <when>` | After every booking and request, whatever the server said, unless the server answered that the time was taken. So Elijah normally gets **two** emails per booking |
| Follow-up (Web3Forms) | The browser, the Done screen | Elijah's inbox | `BOOKING FOLLOW-UP, [<Detailer>, ]<name>, <when>` | When the customer answers "Help us get ready" |

**"Confirmed" means the calendar has it.** The customer email says Confirmed only when real calendars are live (`liveCalendar`), the start is outside `shortNoticeHours`, the event was written, and the time was checked just before writing (`confirmed` in `customerEmail()`). Otherwise it says "we will confirm".

**Failure lines in the owner email** (`ownerEmail()`), each a coloured box at the top and a word in the subject:

| Subject word | Box text (from the code) | Cause |
|---|---|---|
| `NOT ON THE CALENDAR` | "NOT ON THE CALENDAR (reason). The time is still open to other customers: add it by hand now." | The event write failed (reasons in section 3) |
| `NOT ON THE CALENDAR` | "NOT ON THE CALENDAR: this time is already taken (they have already paid / their browser could not read the calendar, so they chose from standard hours / we could not check whether this was a repeat ...). Nothing was put on the calendar: offer them another time" | Someone else has the time, but turning this customer away would be wrong; the customer is told we will confirm |
| `CHECK THE TIME` | "CHECK THIS TIME: the calendar could not be read just before it was written, so it was not checked against the other jobs. It is on the calendar. Make sure nothing else is booked then ..." | The re-check could not read a calendar (`still free` in the log) |
| `CHECK THE PRICE` | "CHECK THE PRICE: vehicle N had nothing chosen, so it was left out of this booking ..." | A vehicle with no package was dropped by the server's price check |
| `CHECK THE CALENDAR` (Web3Forms only) | "CHECK THE CALENDAR: the site could not confirm it saved this booking. Add it to the calendar if it is not there." | The browser got no good answer from `send-confirmation` within 15 seconds (`CONFIRM_WAIT_MS`), or a refusal |

The owner email also carries Who, When, Where, Detailer, SMS consent, Marketing consent, Source, Heard about us and A/B tests rows, the customer's notes and the receipt. It carries **no booking key** (gap G2).

**Where to look.** Elijah's Gmail is the lasting copy. Resend's dashboard shows each email's delivery status (delivered, bounced) for 30 days. Web3Forms has its own short history.

---

## 5. Stripe

**Booking payments: off.** `cardOnFile`, `payInFull` and `digitalWallets` are `live: false` (`web/lib/site/capabilities.ts`), so `create-payment.mjs` and `paypal-order.mjs` are deployed but unused, and `send-confirmation.mjs` counts "paid in full" only while `payInFull` is live. A booking today has nothing in Stripe.

**Gift cards: live** (`config/gift-cards.json` `checkout.enabled`). There is no database: **each card lives on its own Stripe PaymentIntent's metadata** (`_giftcards.mjs`):

- value, balance, status (`gift_status`: active, used, void, disputed), expiry, who it is for, delivery state (`gift_deliver`: now, pending, sent, failed, cancelled) and which emails went (`gift_mail_buyer`, `gift_mail_to`, `gift_mail_owner`);
- `gift_log`: a dated history, one entry per change, e.g. `2026-11-24 issued $50; 2026-12-02 used $30 (note), left $20`. Written by the webhook, `gift-admin.mjs` (redeem, void, resend), `gift-deliver.mjs` and `gift-send.mjs`. Stripe caps a metadata value at 500 characters, so `appendLog()` keeps only the newest part of a long history (gap G10);
- `gift_last_event` and `gift_last_req`: the last Stripe event and the last admin request applied, so a repeat is applied once.

**Webhook deliveries.** `gift-webhook.mjs` is signed (`STRIPE_WEBHOOK_SECRET`). Stripe's dashboard (Workbench, the endpoint, Event deliveries) shows every delivery with the status code and the function's one-word answer (`issued`, `ignored`, `already applied`, `not a gift card`, `retry` on a 500). Stripe retries a failed live delivery for up to 3 days; events are available in full for 30 days. The function answers 500 (so Stripe retries) only when Elijah's own gift email failed: his email carries every other failure.

**The hourly catch-up.** If the webhook never arrives, `gift-deliver.mjs` finds cards with no owner email after a quarter of an hour, sends what the webhook would have, and tells Elijah to check the webhook's signing secret.

**Owner emails about gift cards:** `Gift card sold: $<value> for $<paid>` (with `CHECK: ` in front when something failed), `Gift card sent to someone: ...`, `CHECK: gift card ending <last4>` (refund or dispute), `CHECK: <n> gift card email(s) couldn't be delivered`.

**Who and how long.** Stripe dashboard users. Payments and their metadata are kept indefinitely; events in full for 30 days.

---

## 6. The Contact form (Web3Forms)

`contact.html`, submitted by `script.js` straight from the browser to Web3Forms. No Netlify function is involved, so **nothing is logged on the site's side**.

- **Recorded:** name, phone, email, the question, the consent tick boxes as "yes" or "no" (`data-yesno`), and the arrival source. Wording comes from `config/contact-form.json`.
- **Where:** Elijah's inbox. **Kept:** in Gmail until deleted; Web3Forms keeps a short history on its free plan.
- **Failure:** the visitor sees an error asking them to call or text the business number. Nothing else records it. The `question_sent` analytics event fires on success, only for visitors who accepted analytics.

---

## 7. Unfinished checkouts (`cart-capture.mjs`)

**This is not a GHL feed.** It emails Elijah, through Resend, when someone who typed a name and a phone number or email at checkout leaves without booking (`checkoutFollowUp` is live). The comment in the file says GHL's own "you did not finish your booking" reminder is meant to take this over, "not built yet". No code in the repo calls GoHighLevel: `GHL_PRIVATE_TOKEN` and `GHL_LOCATION_ID` (`docs/GHL-SETUP.md`) are read by nothing.

- **Recorded:** subject `Unfinished booking: <name>`, with phone, email, what they had picked, where they arrived from and how they heard of us. One per departure, sent by `navigator.sendBeacon` from `js/funnel.js`.
- **Where:** Elijah's inbox only. **Kept:** in Gmail; Resend's 30 days.
- **Failure:** `resend <status>` in the Netlify log and `{ captured: false, reason: "send_failed" }`. A network failure reaching Resend is not caught in this function and surfaces only as Netlify's own error for the run (gap G7).

---

## 8. JobsSync and the Accounting sheet

`tools/jobs-sync/JobsSync.gs`, an Apps Script in Elijah's Accounting sheet, runs every hour (`setup()` installs the trigger) and from the sheet's "513 Jobs" menu.

- **Reads:** the bookings calendars in its `CALENDARS` list (513 Auto Clean, 513 Kris Bookings), January 1, 2026 to `CONFIG.daysAhead` ahead. Never the availability calendars, never 513 All Jobs.
- **Writes:** tab "Jobs (auto)", one row per job, matched by event ID: Event ID, Date, Status, Title, Service, ZIP, Area, Total, Pre-tax, Lead source, Detailer, Calendar, Price override, Area override, Last synced. No phone numbers or emails are copied. Tab "Jobs by Area" totals Done rows only.
- **Skips:** Free events, titles starting OPEN, BEST, DNS (and Busy, Blocked and similar, `skipTitle`), "Day N of M" events, the office address, and all-day events with no `$` amount. 513 All Jobs copies exactly the same set, except "Day N of M" events, which it copies (section 11; `jobs-sync-contract.test.ts` keeps the two in step).
- **Status:** `Upcoming`, `Done` (the end time has passed), `Cancelled` (the event was deleted, or its title says cancelled, no-show or refunded), `Duplicate` (the same `bookingKey` seen twice).
- **Cancel safeguards:** a row is marked Cancelled only when every calendar was read without an error, a direct look-up confirms the event is gone, and no more than `CONFIG.maxCancelsPerRun` rows look deleted in one run.
- **Logs:** Apps Script's Executions page, as `console.warn`: `Could not read calendar <id>: <error>`, `No calendar ID for "<name>": ...`, `A calendar could not be read, so no rows were marked Cancelled this run.`, `<n> rows look deleted from the calendars, more than <max>, so none were marked Cancelled. ...`, `Could not check event <key>: ... Its row was left as it is.` Only a missing Calendar API service throws.
- **Who and how long.** The sheet: whoever it is shared with; rows are kept for good. The Executions log is short-lived (Google keeps Apps Script's Cloud logs about 30 days by default).
- **Failure:** a warning nobody is sent (gap G9). A thrown error triggers Google's own failure notification email to the script's owner.

---

## 9. Analytics and A/B tests

- **GA4 and Microsoft Clarity** (`js/analytics.js`) load only after the visitor presses Accept; with no ids set, nothing loads. Google's advertising features are off.
- **Booking form events** (`track()` in `js/funnel.js`, sent through `AC_TRACK`): `booking_open`, `booking_step`, `checkout_open`, `checkout_section`, `time_pick`, `time_change`, `time_recs_shown`, `time_taken_at_confirm` (lost the time to another booker at Confirm), `checkout_left`, `heard_about`, `addon_add`, `booking_complete` or `booking_request` (on Done), `booking_followup`, and others. The Contact form adds `question_sent`.
- **A/B tests** (`config/experiments.json`, `docs/AB-TESTING.md`): the version is stored in the visitor's browser. Every GA4 event carries `exp_variant_string`. Every booking carries the version in the owner email ("A/B tests" row) and the calendar event (`A/B TESTS` block), so bookings can be counted per version **without** analytics consent. Count bookings from the emails, not from analytics alone.
- **Arrival source** (a tagged link such as a print QR code) rides with the booking the same way (`SOURCE` block, "Source" row), consent or not.
- **Who and how long.** Users of the GA4 property and the Clarity project, under those services' own retention settings (GA4's event data retention is set in the property; Clarity keeps recordings for a limited time). Elijah's Gmail and the calendar keep the per-booking copy.
- **Failure:** nothing; measurement is wrapped so it can never break the page.

---

## 10. The visitor's browser console

Only visible to someone with the browser's developer tools open on the booking form, so useful when testing, never as a record:

- `[513] DETAILERS setting: <problems>`: a bad entry in Netlify's `DETAILERS` (that detailer is skipped).
- `[513] calendar: <error>`: a calendar could not be read; the form shows standard hours instead (labelled as times still to confirm).
- `[513] slot painting failed`.

---

## 11. The master calendar, 513 All Jobs (live since November 26)

Built on branch `master-calendar` from the spec (`docs/ONE-CALENDAR-SPEC.md`, concept (d)), with the website doing the copying. It does nothing until Netlify has `ALL_JOBS_CALENDAR_ID`. Setup and every rule: `docs/MASTER-CALENDAR-SETUP.md`. Settings: `config/master-calendar.json`.

- **Which calendar.** Production links to **513 All Jobs**; Deploy Previews and branch deploys write to **513 TEST All Jobs** (a different `ALL_JOBS_CALENDAR_ID` per deploy context). GHL must link only the production 513 All Jobs.
- **Written at booking time,** by `send-confirmation.mjs`, after the detailer's event is written **and after both emails have gone**: one write per working day, all at once, each under an id made from its booking key (so a retry, or the reconciler racing it, can never make a second copy: Google answers 409 and that counts as done). No look-ups first; the whole step is capped at `writeTimeoutMs`. It can't change the reply, the event or either email. A failure is logged only (`copy-failed`); the reconciler copies the job on its next run.
- **Kept in step** by `jobs-mirror`, a Netlify scheduled function every 10 minutes, **on the published site only** (scheduled functions never run on a preview). It reads every bookings calendar in `DETAILERS` and the master over a window from `daysBack` days ago to `daysAhead` days ahead, every page, and:
  - copies jobs typed in by hand (key `manual:<event id>`), and any booking-time copy that failed;
  - follows edits, moves and moves to the other detailer's calendar (the event id stays the same);
  - puts back a copy changed or deleted on the master. It owns the title, description, location, times, Busy/Free, colour and the two hidden fields: a change to any of these on the copy (by hand, or by GHL under two-way sync) is undone, by a PATCH of those fields only. Anything else on the copy (guests, GHL's own fields) is left alone. Whether GHL edits should flow back is a phase 2 question;
  - marks a copy `CANCELLED: …`, Free, grey, `Status: Cancelled` when a direct look-up finds its original deleted (or deletes it, when `cancelMode` is "delete"), and sets it back to `Booked` when the original is restored;
  - leaves alone any event on the master it didn't make (no `sourceId`, for example one GHL created), logging `not-ours`.
- **Only jobs are copied:** exactly what JobsSync counts (section 8): not Free events, not titles starting OPEN, BEST, DNS, Busy, Blocked, Unavailable, Availability, Hold or Personal, not the office address, not all-day events without a `$` amount. `Day N of M` events are copied (JobsSync skips them only to count a job once).
- **The copy's format, for GHL to parse:**
  - Title: the detailer first (`Kris: …`, `Elijah: …`), then the original title, after any `SHORT NOTICE …:` prefix. A name already at the start of the original's title wins over the calendar's detailer, as in JobsSync: `Kris: …` typed on Elijah's calendar stays Kris's. A booking the server could give to no known detailer (`detailerFor()` in `_detailers.mjs` returns none) is written to Elijah's calendar, so its copy is Elijah's.
  - Description: a header, then the original description word for word, so every block in section 3 is still there:
    ```
    Status: Booked            (or Cancelled)
    Detailer: <name>
    Booking key: <bk_… or manual:<event id>>
    Source calendar: <calendar name>
    ---
    <the original description>
    ```
    A copy made at booking time names the calendar by its id until the next run writes its name. Days 2 and on of a long job have no `WHO` line (their originals carry none); day 1 has the customer and the total.
  - Private extended properties `bookingKey` and `sourceId` (the original's calendar and event).
  - Colour per detailer (`colors`); `cancelledColor` when cancelled.
- **Safeguards** (`jobs-mirror.mjs`):
  - a list that fails (a bookings calendar or the master) means nothing is written that run;
  - a copy is marked cancelled only after a direct look-up of its original says deleted, and a 404 counts as deleted only on a calendar read without an error that run;
  - a look-up that fails means no cancels that run (new and changed copies still go: they come from complete lists);
  - a copy whose bookings calendar wasn't read that run (a detailer taken out of `DETAILERS`) is never looked up or marked;
  - more than `maxCancelsPerRun` copies looking deleted in one run: none are marked, and Elijah gets one email, `CHECK: <n> jobs look deleted, 513 All Jobs left as it was`, once for those jobs;
  - time: every Google call in a run ends at `runBudgetMs` from its start, answered or not, and nothing new starts after it, so a run finishes well inside Netlify's limit for scheduled functions. Copies are written before look-ups; look-ups cut short mean no cancels that run, and the next run carries on.
- **Write-only for the site.** The booking form and the server never read the master for availability, and JobsSync never reads it, so a copy can never block or count twice. The build fails if `ALL_JOBS_CALENDAR_ID` is a calendar the site reads (`masterClash`).
- **For GHL:** link the production 513 All Jobs only. **Never use an availability calendar as a GHL conflict calendar:** an OPEN block is Busy, and GHL blocks on Busy, so GHL would read open working time as booked.

### Its log lines

Each is `[master-cal] {"action":"<action>", …}`, with booking keys, event ids and counts only, never a title, name, phone or email. In `send-confirmation`'s log:

| Action | Meaning |
|---|---|
| `copy` | The copy was written at booking time |
| `copy-exists` | Already there (409): a retry, or the reconciler got there first |
| `copy-failed` | Not written (`reason`: `http_<status>`, `timed out`, `auth_failed`...). The next run copies it |
| `clash` | `ALL_JOBS_CALENDAR_ID` is also a calendar the site reads: nothing copied (the build refuses this too) |

In `jobs-mirror`'s log:

| Action | Meaning |
|---|---|
| `off`, `unconfigured` | The setting is unset, or Google sign-in isn't set up: nothing done |
| `run` | One per run: `created`, `updated`, `restored`, `putBack`, `cancelled`, `held`, `failed`, `foreign`, `duplicates`, `skipped` (not jobs), `unread`, `stopped` (out of time) |
| `abort` | A list failed (`read` says which, `reason` why): nothing written this run |
| `created`, `updated`, `put-back`, `update`, `restore` | A copy written, changed, put back after being deleted on the master, or set back to Booked |
| `cancel`, `cancel-delete` | A copy marked cancelled, or deleted |
| `kept` | The original is still there but is no longer a job (turned Free, say): the copy is left as it was |
| `create-failed`, `update-failed`, `restore-failed`, `cancel-failed` | One write failed (`reason`); counted in `failed`. A copy whose id Google won't reuse is put back with a PUT; if that fails too the reason starts `id taken (409)` |
| `abort-cancels` | A look-up failed: no cancels this run |
| `cancels-skipped` | No cancels this run (a look-up failed, or out of time) |
| `budget` | `runBudgetMs` reached; the next run carries on |
| `unread-source` | Copies whose bookings calendar wasn't read this run, left as they are (`count`) |
| `not-ours` | Events on the master without a `sourceId` (GHL's, or typed by hand), left alone (`count`, `ids`) |
| `duplicate-copy` | Two copies with one booking key on the master, the second left alone |
| `cancel-cap`, `cancel-cap-emailed`, `cancel-cap-email-failed`, `cancel-cap-tag-failed` | Too many cancels at once: held, Elijah emailed (or the email failed), the held copies tagged so the email comes once |
| `run-failed` | The run threw (a bug): the reason, nothing else |

---

## 12. What Imperion can rely on, and the gaps found

**Rely on:**

- A booked job that the customer was told is **Confirmed** is on the detailer's bookings calendar, Busy, with `TOTAL:` and the blocks above.
- Every booking that is **not** on the calendar reaches Elijah's inbox with `NOT ON THE CALENDAR` or `CHECK THE CALENDAR` in the subject, through at least one of two independent senders (Resend from the server, Web3Forms from the browser).
- A retry never makes a second event or a second set of emails (booking key).
- A deleted event is the cancel signal: JobsSync marks its row Cancelled; the master marks its copy Cancelled (within the safeguards in section 11).
- Every booking that gets past the calendar step leaves one `[booking]` line with its key, so a log line, the calendar event and the master's `Booking key:` line can be tied together.

**Do not rely on:**

- Netlify's logs as a history: kept a day to a week.
- The master calendar's copy being there the moment a booking is made: it usually is, but a failed booking-time copy is only logged, and the next 10-minute run fills it in.
- Anything in GHL from the website today, except (once switched on) the master calendar.
- Analytics for booking counts.

### Gaps found in the code's logging

Found at `a2a5869`. G1 and G5 are fixed on branch `master-calendar`, G2 and G4 in part; the rest stand.

| # | Gap | Where | Effect |
|---|---|---|---|
| G1 | ~~A successful booking writes no log line~~ **Fixed:** one `[booking]` line per booking (section 2) | `send-confirmation.mjs` | Netlify's log now shows each booking that got past the calendar step, by key |
| G2 | The booking key is never shown in Elijah's email. **In part:** it is now in the `[booking]` line and on the master copy's `Booking key:` line | `send-confirmation.mjs`, `ownerEmail()` | A person reading only the owner email still can't see the key |
| G3 | Some calendar outcomes are never logged: `unconfigured`, `no_slot`, `bad_times`, and "already taken" with a reason to keep the customer. Google's refusals and sign-in failures are logged by `_gcal.mjs` (`gcal insert`, `gcal token`, `gcal oauth refresh`), but without the booking | `writeCalendar()` in `send-confirmation.mjs`; it logs only `calendar write`, on a throw | The reason is in the owner email and the browser's reply only; with Resend down, it is nowhere on the server side |
| G4 | A customer email that fails is logged but Elijah is not told. **In part:** the `[booking]` line now says `check … customer=failed` with the key. Elijah's email still can't say: it is sent first on purpose (if only one email gets through, it must be his), so the order was kept | `handler()` in `send-confirmation.mjs` | A customer may wait for a confirmation that bounced, unless someone reads the log |
| G5 | ~~Logging the refused Resend answer can write a customer's email address into Netlify's logs~~ **Fixed:** Resend's answer is logged with addresses and phone numbers replaced (`redact()`), in `send-confirmation.mjs`, `cart-capture.mjs` and `_giftmail.mjs`. `gift-deliver`'s give-up email still lists recipients' addresses to Elijah, which is intended | as listed | None in the logs |
| G6 | Elijah's personal calendar feed failing is never logged | `personal-busy.mjs`, `readPersonal()` | His personal conflicts silently stop counting; nobody knows |
| G7 | `cart-capture.mjs` does not catch a network failure reaching Resend | the bare `await fetch` | The unfinished-checkout email is lost with only Netlify's generic error |
| G8 | A time lost to another booker at Confirm (409) writes no server line | `send-confirmation.mjs`, `calendar.taken` | Only `time_taken_at_confirm` in analytics, for consenting visitors |
| G9 | JobsSync's warnings (a calendar unreadable, too many cancels) reach no one | `JobsSync.gs`, `console.warn` | The sheet can stop updating cancellations with no alert |
| G10 | A gift card's history is cut to its newest 500 characters | `appendLog()` in `_giftcards.mjs` (Stripe's metadata limit) | A card used many times loses its oldest entries; Stripe's payment record keeps the money side |
| G11 | A multi-day job whose day 2 or later fails to write is reported as "NOT ON THE CALENDAR ... The time is still open" although day 1 was written; a retry then finds day 1 and stops, so the missing days are never written | `writeCalendar()` | Elijah must add the later days by hand; the message overstates the problem |
| G12 | The GHL feed planned in `docs/GHL-SETUP.md` (contacts, the "Website bookings" pipeline) does not exist in code | no file reads `GHL_PRIVATE_TOKEN` | GHL receives nothing from the site until the master calendar is switched on |
| G13 | A master copy that fails at booking time, and every `jobs-mirror` warning except too many cancels, reach no one but the log | `_mastercal.mjs`, `jobs-mirror.mjs` | By design (the next run is the retry), but a master that keeps failing (unshared, say) shows only as missing copies and `[master-cal]` warnings |

---

## 13. Open questions for Imperion

1. **What will GHL do with the jobs:** reminders and review requests (one-way sync may be enough), or appointments with workflows (two-way sync)? (`docs/ONE-CALENDAR-SPEC.md`, question 1.)
2. **How should GHL match a job to a contact:** the `WHO` line in the copy's description, a guest on the event, or the website sending the contact to GHL directly (the feed in `docs/GHL-SETUP.md`, not built)? (Spec question 2.)
3. **Under two-way sync, what does GHL do** when a Google event is deleted, or turned Free and titled `CANCELLED: …`? That decides `cancelMode` ("mark" or "delete"). Should a cancel made in GHL cancel the real job? Today it cannot. (Spec question 3.)
4. **Will customers ever book through GHL** (its calendar links or chat widget)? An appointment GHL creates on 513 All Jobs is invisible to the website, so that time could be sold twice. (Spec question 4.)
5. **Is the master's delay acceptable:** instant for website bookings, up to 10 minutes for hand-typed jobs, edits and cancels? (Spec question 5.)
6. **Which GHL user and Google account will link 513 All Jobs,** so Elijah can share it with "Make changes to events" and nothing else?
7. **Do you need a log you can read** (for example a daily summary email of bookings and failures, built from the `[booking]` lines or the `jobs-mirror` run summary), or are the owner emails and the master calendar enough for your monitoring?
8. **Should the unfinished-checkout capture go to GHL** (a contact plus a "did not finish" workflow) instead of, or as well as, Elijah's email? It carries no marketing consent ("One follow-up only"), so any GHL workflow must respect that.
9. **GHL edits to a copy** (a renamed or moved appointment under two-way sync) are put back by the next 10-minute run, because the bookings calendars are the truth. Should any of them flow back to the detailer's calendar instead (phase 2)?
