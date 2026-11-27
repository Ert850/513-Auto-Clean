# Plan: Imperion's access to the calendars, and 513 All Jobs in GoHighLevel

Draft, November 26, 2026. Nothing here is done yet. The decisions are marked **Decide**.

**Done, November 27 (Emmett's go, from the business account in Chrome):** Imperion's Google account has **513 All Jobs: Make changes and see all event details** (not "manage sharing", so it can't share on), and **See event details** on 513 Auto Clean, 513 Kris Bookings, 513 Availability and 513 Kris Availability. Each showed "Sharing settings saved" and lists Imperion with that permission. 513 TEST All Jobs is not shared with them. One address that already had edit access on the bookings and Kris calendars was left as it was. `check-live.mjs` 0 failed afterwards.

**Package and agent handoff sent to Imperion (Emmett, November 27):** `IMPERION-PACKAGE.pdf` (39 pages) with `IMPERION-AGENT-HANDOFF.md`. Next: their answers to the handoff's section 6, and step 5's check after a week.

**Sheet: not shared.** The likely file, "Accounting LLC (Responses)", has 15 tabs including Employee Details and Elijah's other businesses' monthly tabs, and no JobsSync jobs tab was visible. Sharing the file would show all of it. Elijah decides: a separate file holding only the jobs (for example a JobsSync tab copied into its own sheet, or JobsSync pointed at a new file), shared as Viewer.

**Update, November 26 evening:**
- Imperion sent the Google account to share with (kept out of this public repo; Emmett has it). It's also the account GoHighLevel will connect with unless they say otherwise.
- They also asked for **Elijah's tracking sheet**, the job records sheet that JobsSync fills from the bookings calendars (Elijah installed JobsSync). It holds one line per job: the title (customer's name first), service, ZIP, totals, lead source and detailer, plus Elijah's own override columns and any other tabs in that file.
- Step 0's wording is written (on `eNov14`, privacy version 2026-11-26): the Google Calendar row now names the sheet and says only we and the listed providers can see the details, and a new row covers "our customer management provider". Calendar events carry no texting consent, so the opt-in sentence stays true. It goes live with Emmett's yes and a PR.

**Goal:** Imperion can review the calendars behind the website, and the GoHighLevel (GHL) calendar view shows every booked job, by linking **513 All Jobs**: one calendar, the detailer's name first in each title, a colour per detailer. Setup and safety rules are in `docs/MASTER-CALENDAR-SETUP.md`. The questions Imperion still has to answer are in `docs/IMPERION-PACKAGE.pdf`.

"The GHL page" here means the calendar view inside the 513 sub-account in GHL. If it means a page Imperion builds for customers, the plan changes: GHL must never show or sell times while the website is the only thing that books (step 4).

## 0. Before anything is shared: the privacy policy (blocks every step below)

`privacy.html` section 5 says customer data is shared "only with the service providers below". GHL appears there only as "our text messaging provider", which gets a mobile number and the message, "only to deliver it". The calendars hold each customer's name, phone, email, address and notes. Sharing them with GHL, and through GHL with Imperion, isn't covered today.
- [ ] Add a row to `PROCESSORS` in `web/lib/site/capabilities.ts`, named generically like the texting row (the provider could change), for example: "Our customer management system, and the agency that runs it for us: keep our schedule of booked jobs, with your name, phone, email, address and notes, so we can send reminders and follow up. They may not use it for anything else." **Decide** the exact wording with Elijah, and whether Imperion is named.
- [ ] Reword the Google Calendar row too: it says "That calendar is private: anyone else sees only that the time is taken." That stops being true once 513 All Jobs is shared.
- **Timing (Emmett, November 26):** Imperion says the website isn't part of the toll-free verification now and we have free rein to update it, so the policy can change before approval.
- [ ] Bump the date in `web/lib/site/legal.ts`, run `npm run lock:legal`, build and test. This is a change to `main`, so it needs a PR and Emmett's yes. It has to be live before step 2.
- [ ] Check the texting rule on the same page: "originator opt-in data and consent will not be shared with any third parties". A job's notes carry the customer's texting choice. GHL is the texting provider, so that's probably fine, but it's worth one line to Imperion.

## 1. What each calendar is, and who should get it

All are in the business Google account (Elijah's). Sharing is done by that account, in Google Calendar, Settings and sharing, "Share with specific people".

| Calendar | What it holds | Imperion's Google account | GHL's Google account |
|---|---|---|---|
| **513 All Jobs** | A copy of every booked job (customers' details, the total, some notes with Elijah's payment handles) | Through GHL only (no direct share needed) | **Make changes to events** (GHL can't link a calendar without it). The mirror puts back any copy that's edited or deleted. |
| 513 Auto Clean (Elijah's bookings) | The real jobs; JobsSync reads them into the Accounting sheet | **See all event details**, for the review only, if they ask | Never |
| 513 Kris Bookings | Kris's real jobs | Same as above | Never |
| 513 Availability, 513 Kris Availability | Open hours (`OPEN`, Busy), fee blocks (`OPEN +20%`, Free), `BEST`, `DNS` | **See all event details**, for the review only | **Never, above all not as a conflict calendar:** GHL would block exactly the open hours |
| Elijah's job records sheet (JobsSync) | One line per job, totals, Elijah's overrides and any other tabs in the file | **Viewer**, for monitoring (they asked). Elijah shares it from Google Sheets; check the file's other tabs first | n/a |
| 513 TEST All Jobs, 513 TEST Bookings, 513 TEST Kris Bookings | Test bookings from Deploy Previews | Never | Never |
| The personal calendar (`PERSONAL_CALENDAR_ICS`) | Private | Never | Never |

**Never "Make changes" on a bookings or availability calendar** for anyone outside the business. One edit there changes what the website sells, and what goes into the Accounting sheet.

**Decide:**
- Imperion's Google address, and the Google account GHL is connected with (they may be the same). GHL's calendar connection belongs to one GHL user.
- Read-only on the bookings calendars, or only 513 All Jobs (in GHL) and the availability calendars? Recommended: 513 All Jobs through GHL, plus read-only on the two availability calendars. That shows them everything the website uses, without a second copy of every customer.
- ~~Whether payment handles should stay in the copies' notes.~~ They stay (Emmett, November 27). The mirror copies descriptions word for word. Dropping those lines would be a small change to `jobs-mirror` (a setting in `config/master-calendar.json`), built before step 3.

## 2. Share (after step 0 is live)

- [ ] Elijah shares **513 All Jobs** with GHL's Google account: Make changes to events.
- [ ] If decided, Elijah shares the availability calendars (and the bookings calendars) with Imperion's account: See all event details.
- [ ] Check from Imperion's side that each shared calendar appears, and that nothing else does.

## 3. Link 513 All Jobs in GHL (Imperion, in the 513 sub-account)

- [ ] The GHL user's calendar settings, Connections, Google: connect the account from step 2.
- [ ] **Linked calendar: 513 All Jobs** (the production one, never 513 TEST All Jobs).
- [ ] **Conflict calendars: none.** Above all, no availability calendar.
- [ ] One-way or two-way sync: Imperion's answer to the open question. Until they answer, pick the setting that only reads from Google, if GHL offers one.
- [ ] Check: this week's jobs show in the GHL calendar view, named and coloured per detailer, with cancelled jobs in grey as Free. Compare against the mockup in the package.

## 4. Rules for phase 1 (tell Imperion with the access)

- **No customer books through GHL.** No GHL booking link or chat widget sells times on this calendar. The website never reads 513 All Jobs, so the same hour would be sold twice. Selling through GHL is phase 2 (GHL's bookings copied back to a detailer's calendar first).
- An event GHL makes on 513 All Jobs is left alone by the mirror, but the website never sees it.
- Edits to a copy in GHL are put back within 10 minutes. Changes go on the detailer's own calendar.
- Don't add 513 All Jobs to any other tool that counts jobs (JobsSync, a second CRM import), or every job counts twice.

## 5. Check after a week, and how to undo

- [ ] Netlify, Logs, Functions, `jobs-mirror`: the `[master-cal] {"action":"run",…}` lines have no failures, and no `not-ours` warnings (an event GHL made).
- [ ] Ask Imperion what they saw, and collect their answers to the package's questions before building anything else (closed-time blocks, fee windows, weather, per-detailer calendars).
- **Undo:** Elijah removes the shares in Google Calendar. Nothing on the website changes: the site writes 513 All Jobs whether or not anyone reads it, and nothing reads it back.
