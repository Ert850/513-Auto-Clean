# 513 Auto Clean, everything still to build

Last updated 2026-09-10.

Every feature discussed but not yet shipped, in one place. Sourced from the
original brief in `context_outline.txt`, the plan in
`.claude/plans/help-me-build-a-smooth-gizmo.md`, and everything since.

Ordered so nothing depends on something below it. The one thing that outranks
every item here is the stated goal: **convert a visitor onto the calendar
quickly and simply, without needing to call or text.** Anything that does not
serve that waits.

Status key: **[ ]** not started · **[~]** partly built · **[x]** done, listed
for reference.

---

## Now: finish taking money

Nothing else matters until a stranger can pay at 11pm.

- [~] **Payment step live end to end.** Stripe Payment Element and PayPal
  Orders v2 are both written. Blocked on your accounts. See
  `LAUNCH-CHECKLIST.md`.
- [ ] **Webhook-confirmed bookings.** The booking must be confirmed by
  Stripe's webhook, not the browser redirect. Redirects get lost to dead
  batteries and tunnels; the webhook does not.
- [ ] **Database-backed slots** with the GiST exclusion constraint, so two
  people paying at once produces one booking and one clean "that slot just
  went" instead of a double booking.
- [ ] **15-minute holds** on a slot while someone is paying, expiring on their
  own.
- [ ] **Terms and Cancellation Policy pages**, with the cancellation ladder
  written out inline at the checkbox rather than behind a link.
- [ ] **Cancel and reschedule** against the refund ladder, with the admin
  dialog showing the computed charge *before* you confirm it. Never do the
  72-hour maths in your head.
- [ ] **Customer booking link**, so someone can move a time or change what is
  included without calling. The decision logic is written and tested
  (`bookingChange.ts`, `cancellation.ts`); what is missing is the stored
  booking to point it at, which needs Neon.
  **When this ships, put it back into `terms.html`**: section 5 currently
  says to call or text, because that is all that works today.
- [ ] **On-site price adjustment.** You keep the right to revise the price
  after inspecting the vehicle. Needs a line in the booking UI, a clause in
  the Terms, and an admin control to revise the total before charging.
- [x] Server-side price recomputation, so amounts cannot be tampered with
- [x] Travel fee ladder, sales tax, multi-vehicle discount, combo discount
- [x] Live availability reader that works with your calendar as it is today

---

## Next: the admin panel, so this saves you time instead of costing it

You will use this in driveways on a phone. Mobile first, not mobile "works".

- [ ] **Auth**: signed cookie password plus TOTP two-factor, 30-day session.
  Two-factor is not optional: this panel can issue refunds and read every
  customer's home address.
- [ ] **Today screen.** The 95% screen. Today and tomorrow as cards: time,
  name, tap to call, tap to navigate, package, total, balance due, and a big
  **Charge balance** button. Make this one perfect; the rest can be good.
- [ ] **Bookings list and detail**, with reschedule, cancel, refund.
- [ ] **Packages and prices editor.** Edit a price, it is live in a second,
  everywhere. The catalog already supports this; it needs a UI.
- [ ] **Settings**: pay-in-full discount, combo discount, mileage constants,
  buffers, lead time. Every write into an audit log with before and after.
- [ ] **Availability viewer.** Read-only view of the *parsed* OPEN blocks, so
  you can confirm what you typed on your phone was understood, plus blackout
  dates and a "block off today" button.
- [ ] **Pay link generator.** Pick a customer, pick a package or a free amount,
  generate, send by text. This is how you convert a phone call without ever
  touching a card number.

---

## CRM

The customer relationship half. This is where the repeat revenue is: a
detail is a one-time sale, a maintenance relationship is an annuity.

### Customer records

- [ ] **Customer profiles.** One record per person: every vehicle they own,
  every job, every photo, every note, lifetime value, how they found you.
- [ ] **Vehicle records** under the customer. Year, make, model, size, colour,
  paint condition, coating status and date, known problem areas, "do not use
  X on the trim" style notes. A returning customer should never be asked
  anything you already know.
- [ ] **Job history with condition notes.** What you found on arrival, what you
  did, what you could not fix. Protects you on a dispute and makes the next
  visit faster.
- [ ] **Merge and dedupe.** The same person books as "Beth" and
  "Elizabeth" from two phone numbers, and you need those to be one customer.
- [ ] **Import** the customers you already have, from the Google Sheet.

### Communication

- [ ] **One inbox.** Texts, emails and form submissions in a single thread per
  customer, so you are not reconstructing a conversation across three apps.
- [ ] **Auto-responses.** An instant, human-sounding reply to any inbound
  enquiry outside working hours, with a link straight into the booking funnel.
  Speed of first reply is the single strongest predictor of winning the job.
- [ ] **Canned replies** for the questions you answer weekly.
- [ ] **Booking confirmation** by text and email, immediately.
- [ ] **Reminders** at 48 hours, 24 hours, and 2 hours before.
- [ ] **"On my way" text** with a live arrival window, sent from the phone.
- [ ] **Abandoned booking recovery.** Someone picked a time and did not pay,
  text at 1 hour, 24 hours, 72 hours with a link back to their exact cart.
  Usually the single biggest conversion win on this whole list.
- [ ] **Post-job feedback gate.** Private 1 to 5 rating first. Four and five go
  to your Google review link, one to three come privately to you. Turns a bad
  day into a phone call instead of a public review.
- [ ] **Maintenance rebooking nudges** at a per-service interval. A Full
  Interior customer at 3 months, a coating customer at 6.
- [ ] **Win-back** for customers who have gone quiet past their interval.

### Recurring revenue

- [ ] **Maintenance packages.** Monthly or quarterly plans, billed
  automatically on a Stripe subscription, with the slot pre-booked. The
  Coating Maintenance Plan at $149/month is already in the catalog, unbuilt.
- [ ] **Coating warranty tracking.** A coating is warranted only if it is
  maintained. Track the annual sealant refresh, remind them, and log it.
- [ ] **Gift cards and prepaid multi-detail packs.**
- [ ] **Referral tracking.** A code per customer, credit applied automatically.

### Sales pipeline

- [ ] **Lead stages**: new, quoted, booked, done, follow-up, lost, with a
  reason on lost. You cannot fix what you cannot see.
- [ ] **Quote requests that are not instant bookings**, mainly correction work
  and fleet, routed to a photo-upload consult step rather than checkout.
- [ ] **Fleet and dealership pipeline**, separate from consumer leads. These
  are contract conversations, not self-serve bookings.

---

## Proof: photos and video

Everything here exists to answer "will they actually do a good job on *my*
car". It is the highest-leverage content work.

- [ ] **Job photos from your phone.** Admin, tap the job, upload. Auto-creates
  `YYYY-MM-DD - description` in your Drive folder, links it to the customer
  record, tags before and after.
- [ ] **Auto-fed public gallery**, sorted by job type, so uploading a job also
  updates the website. Today the gallery is a hand-maintained manifest.
- [~] **Before and after album.** Paired slider is live on the front page. It
  needs to grow from the Drive feed instead of being hand-listed.
- [ ] **Filter the gallery by service and vehicle type**, so someone with a
  black truck full of dog hair can find a black truck full of dog hair.
- [ ] **Video proof clips.** Short, silent, autoplaying loops of the actual
  work: extraction pulling colour out of a seat, a clay towel going over a
  panel, ozone running.
- [ ] **The (i) markers.** `videoUrl` fields are already reserved on every
  component, package and add-on tier. Nothing renders until the clips exist.
  When they do, the marker appears everywhere that item is listed, at once.
- [ ] **Video explainers per service.** Ninety seconds each on what a Full
  Interior actually includes, what correction does and does not fix, what a
  coating is. Attach to the "How it works" toggles already on the page.
- [ ] **Hero video** behind the top of the page, with a static image fallback
  and a data-saver check. The infrastructure is planned, the footage is not
  shot.
- [ ] **VRM section** (vehicle reconditioning and maintenance), as a distinct
  offer from detailing.

---

## Content and SEO

- [ ] **City landing pages.** `/mobile-detailing/west-chester` and so on, from
  the 74 towns already in the structured data. This is the inbound play, and
  it is how dealership contracts actually arrive.
- [ ] **Service detail pages**, one per package, deep-linking into the funnel
  with that package pre-selected. The deep links already work.
- [ ] **Blog**, with a weekly prompt and topics auto-sourced from trending
  searches and gaps in what competitors cover. **Articles written by you, not
  by AI**, as you specified.
- [ ] **"How to detail" explainers.** How to keep leather from cracking, why
  automatic car washes cause swirl marks, what to do about a spill before it
  sets. These rank, they build authority, and they pre-sell the thing you do
  better than the reader can.
- [ ] **Analytics with a cookie banner that genuinely blocks** until accepted.
  There is currently no measurement at all, which means no baseline to
  improve against.
- [ ] **`/travel-fee` page** publishing the ladder openly. Transparency
  converts better than concealment on a late-appearing fee.
- [x] Structured data: 74 named cities, FAQ schema, offer catalog, booking
  action, aggregate rating synced to real review counts
- [x] Sitemap, robots, Open Graph, Twitter cards

---

## Social publishing

Realistic about which platforms actually allow this.

- [ ] **Editor page.** Your editor drops a finished video, the system generates
  platform-specific captions, tags and titles from one master post. Batch and
  schedule.
- [ ] **YouTube first.** Cleanest API, OAuth only, no app review.
- [ ] **Google Business Profile posts and photos.** Needs application approval,
  days to weeks. Also gates the live reviews pull.
- [ ] **Instagram and Facebook.** Meta App Review, 2 to 6 weeks, commonly
  rejected two or three times over unclear screencasts. May never approve for
  a two-person shop.
- [ ] **TikTok.** Skip the API. Unaudited apps can only post private drafts,
  which is the same work as browser automation for less result.
- [ ] **X.** Basic tier is $200/month, more than the entire rest of the stack.
  Manual or nothing.
- [ ] **Local publisher.** A Playwright app on the editor's machine for the
  platforms with no usable API. Never headless, human taps Post. Expect
  roughly 30 minutes a week of selector maintenance.
- [x] Live Google review ticker and grid

---

## Business expansion

- [ ] **Fleet and dealership page.** Public tiers at $145/car for 1 to 3
  months, $140 at 6, $130 at 12, a volume calculator showing their monthly
  cost, and a B2B enquiry form into a separate pipeline. No self-serve
  booking.
- [ ] **Paint correction and coating live.** Priced and listed today, marked
  temporarily unavailable. Turn on when you have the reps and the setup.
- [ ] **Affiliate products page.** The products you actually use, so the
  people who ask what you used can buy it.
- [ ] **Educational and training page.** Longer form than the blog. Also the
  foundation if you ever want to train or franchise.
- [ ] **Second technician scheduling.** Patrick is already in reviews. The slot
  engine assumes one van; two means real resource scheduling.

---

## Accounting

- [ ] **Stripe to Google Sheets auto-append**, mirroring your existing column
  structure: bookings, tips, tax, refunds, mileage.
- [ ] **Fast mobile expense entry with receipt photo capture**, modelled on the
  Google Form you use now.
- [ ] **Card purchases** via monthly bank CSV into the same table.
- [ ] **Then measure how much manual entry is actually left** before paying for
  Plaid. Production access needs review and small accounts have hit monthly
  minimums around $100, which alone would exceed the entire rest of the stack.
- [ ] **Per-service materials cost** for real margin tracking. The field exists
  in the schema; nothing populates it.
- [ ] **Mileage log for taxes**, which falls out of the drive-time data you are
  already computing per job.

---

## Phone

Not before launch. See `LAUNCH-CHECKLIST.md` for why Google Voice blocks this.

- [ ] **Port (513) 279-2915 to Twilio.** 1 to 2 week window where the number is
  fragile. Slow season only.
- [ ] **Ring your cell first**, fall through to the agent.
- [ ] **Start with an agent that only takes a message and texts your pay
  link.** Do not let it quote prices or book. Realistic latency is half a
  second to two seconds a turn, and a bad AI answer loses a customer a human
  would have won.
- [ ] **Voicemail transcription into the customer record.**

---

## Known debt

Small things I would want cleaned up eventually.

- [ ] **Add SRI hashes to the Leaflet tags** in `index.html`. Left off
  deliberately rather than guessed, since a wrong hash blocks the file
  silently.
- [ ] **Delete the calendar fallback branch** in `js/funnel.js`, marked
  `TEMPORARY`, once the calendar key is live.
- [ ] **Rotate the secret iCal URL** that was pasted into a chat.
- [ ] **Refresh `data/reviews.json`** whenever new reviews land. Dates are
  absolute, so the "days ago" wording never goes stale on its own.
- [ ] **`readme.md` is badly out of date.** It still describes a no-build-step
  site with a Web3Forms quote form.
- [ ] **`context_outline.txt` is superseded** in several places: prices, the
  deposit rule, the WordPress recommendation, the Refresh Package that does
  not exist. Worth marking rather than deleting, since the goals section is
  still the best statement of what this is for.
