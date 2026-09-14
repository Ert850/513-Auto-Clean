# What is blocking a fully working site

Last updated 2026-09-14.

Everything on the site works today except the parts that need an account in
your name. This is that list: what you have to do, what you have to send me,
and exactly what breaks until you do.

`SETUP.md` has the click-by-click steps for each service. This page is the
tracker: what is blocked, by whom, and how bad it is.

**When you finish one of these, flip its switch.** `web/lib/site/capabilities.ts`
has one line per feature. Set `live: true`, run `npm run build`, and the terms
and the privacy policy rewrite themselves to describe what the site now
actually does, down to which companies handle customer data. A test fails the
build if a page and the switches ever disagree, so neither page can promise
something that is not working or name a processor that is not in use.

The switches, as of today. Five of nine live, each verified against
production rather than assumed:

| Switch | State | Verified by |
|---|---|---|
| `cardOnFile` | **live** | `/api/create-payment` returns a `seti_` client secret |
| `liveCalendar` | **live** | the funnel paints real openings from 513 Auto Clean |
| `measuredTravel` | **live** | `/api/travel` answers `source: "routes"` |
| `automatedEmail` | **live** | `/api/send-confirmation` returns `sent: true` |
| `placesAutocomplete` | **live** | Places returns suggestions for the browser key |
| `digitalWallets` | off | no PayPal client id. The chooser is hidden until there is one |
| `automatedTexts` | off | A2P 10DLC not registered |
| `bookingLink` | off | no Neon database |
| `botCheck` | off | no Turnstile keys |

**Not a switch, but still missing: the calendar WRITE.** Bookings reach the
inbox and do not reach the calendar, because `GOOGLE_SERVICE_ACCOUNT_JSON` is
not set. `/api/send-confirmation` reports `calendar: {ok:false, reason:
"unconfigured"}` on every booking. SETUP.md 4a is the walkthrough.

**Email and text are separate switches on purpose.** Resend is a signup and
one DNS record, so `automatedEmail` can go live this week. A2P 10DLC is days
to weeks of carrier review, and until it clears, business texts are silently
filtered: they look sent and never arrive. Do the email one first and the
site starts confirming bookings on its own while the text registration is
still in a queue. Until then the pages say plainly that Elijah confirms by
hand and texts the ETA himself, because he does.

**Never paste a secret key into a chat, a commit, or the HTML.** Secrets go in
`web/.env.local` (gitignored) and into Netlify's environment variables. The
only things safe to send me are marked "safe to share" below.

---

## The short version

| # | Thing | Who | How long | Site is broken without it |
|---|-------|-----|----------|---------------------------|
| 1 | Twilio A2P 10DLC registration | You | **Days to weeks.** Start first. | No confirmation or reminder texts |
| 2 | Stripe account and keys | You | 30 min | Nobody can pay. The booking flow stops at the last step |
| 3 | Google Cloud project and keys | You | 30 min | No real drive times, no address autocomplete, no live calendar |
| 4 | The two Google Calendars | You | 10 min | Times shown are guesses with a warning on them |
| 5 | Google Place ID | You | 2 min | Reviews come from a snapshot I update by hand |
| 5b | Personal calendar URL into Netlify | You | 2 min | Bookings can land on top of your own commitments |
| 6 | Neon Postgres | You | 10 min | Bookings are not stored, so double-booking is possible |
| 7 | Resend | You | 10 min | No confirmation emails. **Do this before Twilio**: it is one DNS record and it makes confirmations automatic weeks before A2P clears |
| 8 | PayPal business account | You | 20 min | No PayPal or Venmo at checkout |
| 9 | Netlify environment variables | You | 10 min | None of the above reaches the live site |
| 10 | Six add-on prices | You | 0 min | **Done.** All fifteen add-ons are priced |
| 11 | Terms and Privacy Policy | Done, generated and versioned | 0 min | Nothing. Read them once |
| 12 | Legal review of both pages | A lawyer, $300 to $800 | 1 to 2 weeks | Chargeback exposure on the cancellation fee |
| 13 | Daily quota caps on the Google APIs | You | 5 min | A scraper can run up the Maps bill |
| 14 | Cloudflare Turnstile keys | You | 10 min | Nothing until the first bot books ten times a minute |
| 15 | CPA: vendor's license, KY and IN, travel taxability | You and a CPA | 1 hour | You are collecting tax you may not be registered to remit |

---

## 1. Twilio A2P 10DLC. Start this today.

**Why first:** carriers silently filter unregistered business texting. Not
bounce, not error. It looks like it is working while every message vanishes.
Approval takes days to weeks and it needs a live privacy policy URL, which you
already have at `513autoclean.com/privacy.html`.

**Do:** register the brand and campaign per `SETUP.md` section 1.

**Send me (safe to share):** that the campaign is submitted, and its status.

**Note:** you are on Google Voice for (513) 279-2915 today. Google Voice cannot
forward an unanswered call to an outside number, so the AI phone answering you
wanted cannot be built on it. Porting the number to Twilio is the fix, and it
is a 1 to 2 week window where the number is fragile. **Do that in a slow
season, not before launch.**

---

## 2. Stripe. This is the next thing to do.

**The card step is already written and waiting for a key.** The Payment
Element, Apple Pay, Google Pay and Link all appear the moment one exists.
Nothing else has to change.

### Get a test key, today, in about twenty minutes

1. dashboard.stripe.com, sign up. You do not need business verification to
   get test keys.
2. Developers, API keys, copy the **Publishable key**. It starts `pk_test_`.
3. Paste it into `js/config.js` as `stripePublishableKey`.
4. Copy the **Secret key** (`sk_test_`) into Netlify as `STRIPE_SECRET_KEY`.
   That one never goes in the page, ever.

That is it. The card field appears on the confirm screen with a banner
saying it is test mode, and **4242 4242 4242 4242** with any future date and
any CVC will go through. Book yourself three times end to end and watch what
lands in the Stripe dashboard.

### Then go live

1. Finish Stripe's business verification.
2. Swap both keys for the `pk_live_` and `sk_live_` versions.
3. Set `cardOnFile: true` in `web/lib/site/capabilities.ts` and rebuild, so
   the terms and the privacy policy start naming Stripe.

**The site reads the key prefix itself**, so a test key can never switch on
"pay now and save 5%": now would mean a test card that moves nothing, and
the discount would come off a bill nobody paid. That needs a live key AND
the capability switch, which is the one place the two have to agree.

**Never paste the secret key into a chat, a commit, or the HTML.**

**Send me (safe to share):** the publishable key, or just say it is in.

## 3. Google Cloud

One project covers four separate things. Enable all of these APIs:

| API | What it powers | Without it |
|-----|----------------|------------|
| **Routes API** | The real drive time at booking AND on the service area map | Travel is estimated from ZIP bands and distance |
| **Places API (New)** | Address autocomplete, and the live reviews feed | Typed addresses, snapshot reviews |
| **Google Calendar API** | Reading your real availability | Standard time slots with a "may need adjusting" warning |
| **Maps JavaScript API** | Not needed. The map uses OpenStreetMap, which is free | Nothing |

**The Calendar API is free and needs no billing account.** It is a Workspace
API, not Maps Platform, so it can be switched on with a card nowhere near it.
The other three all require billing before Google will issue a key. Do the
calendar first: it costs nothing and it is the one that changes the booking
flow the most.

**Make three keys.** A Calendar browser key and a Places browser key, both
restricted to `513autoclean.com/*` and each to its own API, and a server key
for Routes and Place Details.

**The server key cannot be restricted by IP.** Netlify Functions run on Lambda
with no stable outbound address, so an IP allowlist blocks your own site. Give
it API restrictions only. What actually protects it is that it never reaches a
browser, plus the quotas below. **Set a $25/month budget alert.**

**Then cap each API's daily quota** (APIs and Services, the API, Quotas):
Routes at 500 requests a day and Places Details at 200. The functions have a
per-client rate limit and a per-booking amount ceiling, but the only cap
nobody can route around is the one Google enforces. 500 Routes calls is about
170 travel quotes a day, which is far more than the site will see for a long
time, and raising it is one click.

**Send me (safe to share):** the two browser keys. Not the server key.

---

## 4. The availability calendar

**One calendar, and now a service account too.** The funnel reads your OPEN
blocks from it with the browser key, and `send-confirmation` writes each
booking onto it with a service account. Full walkthrough, including what to do
when a step is blocked and how to read the failure codes, is SETUP.md 4a.

`513 Availability` is the one you manage from your phone. In its settings,
tick **Make available to public** and choose **See all event details**, which
is what lets a visitor's browser read it with the restricted API key alone.

Day to day you create recurring events titled `OPEN`. Only events whose title
starts with `OPEN` count as bookable, so your personal events can live on the
same calendar safely.

**Send me (safe to share):** both Calendar IDs.

**Until this is live:** the funnel shows standard slots with a visible note
that times may need confirming. There is a `TEMPORARY` marker in
`js/funnel.js` on that branch. Tell me when the calendar is connected and I
delete it.

**One thing to fix now:** you pasted a secret iCal URL into our conversation a
while back. Rotate it. Calendar settings, "Reset" next to the private address.

---

## 5. Google Place ID, for live reviews

**Right now:** the 32 reviews on the site are a snapshot I took by hand from
your Google profile on 2026-09-10, stored in `data/reviews.json` with real
calendar dates. The page computes "2 months ago" from those dates at load
time, so **the wording stays correct forever without anyone touching it.**
When you get new reviews, either send me the new ones or paste them in with
their date and the site keeps up.

**To make it automatic:** get your Place ID from
<https://developers.google.com/maps/documentation/places/web-service/place-id>
and enable Places API (New).

**Send me (safe to share):** the Place ID. It is public.

Once it is set, `/api/reviews` takes over and the snapshot becomes the
fallback. Nothing about the page changes visually.

---

## 5b. Your personal calendar

**Built and tested against your real feed.** 597 events parsed, recurrence,
exceptions, single-instance overrides and both timezones handled, 49 busy
blocks found in the next 30 days. It just needs the URL in an environment
variable named `PERSONAL_CALENDAR_ICS`.

**Rotate the link.** You pasted it into a chat, which means it exists in a
transcript. It is effectively a password: anyone with it can read every title,
location and attendee on your calendar. In iCloud Calendar, turn Public
Calendar off and back on, then put the NEW link into Netlify. Thirty seconds,
and the old one dies instantly.

Two behaviours worth knowing:

- **All-day events do not block.** Birthdays and holidays would otherwise
  close whole days. On your calendar that is the difference between 230 and
  618 blocked hours over four months. Timed events are the reliable signal.
- **iCloud publishes on a delay**, up to about fifteen minutes. For something
  urgent, block it on `513 Availability` instead, which is read live.

---

## 6. Neon Postgres

**Blocks:** storing bookings at all. Until this exists, two people can pay for
the same slot. The schema has a database-level exclusion constraint that makes
double-booking impossible, but only once there is a database.

**Send me:** nothing. The connection string is a secret.

---

## 7. Resend

Confirmation and reminder emails. Free under 3,000/month. Needs a DNS record
on `513autoclean.com` to verify the sending domain.

---

## 8. PayPal

For PayPal and Venmo at checkout. Stripe covers cards, Apple Pay, Google Pay
and Link, but **Stripe cannot do Venmo**, which is why this is separate.

**Send me (safe to share):** the client ID. It is public, and it goes in
`window.AC_CONFIG` alongside the Stripe publishable key.

---

## 9. Netlify environment variables

Every secret from `.env.local` has to be added again in Netlify's dashboard.
Local files do not deploy. This is the step people forget, and the symptom is
"it worked on my machine".

`SHOP_ORIGIN_ADDRESS` and `SHOP_ORIGIN_PLACE_ID` go here too. They are
server-only: the browser sends a destination and gets back a drive time and a
fee, never your home address.

---

## 10. Prices. Done.

All fifteen add-ons are priced. Nothing outstanding.

---

## 11 and 12. The legal pages

Both exist, both are generated, both are versioned. `terms.html` carries the
cancellation ladder, the change rules, the on-arrival price adjustment, the
card-on-file authorisation, what happens when a card declines, a
liability cap, and a contact-us-before-disputing clause. `privacy.html`
names every company that touches customer data and only the ones in use.

The version date in `web/lib/site/legal.ts` is recorded against every
booking (in the email and in Stripe's metadata), together with the exact
card-on-file sentence the customer ticked, so a card network asking "what did
they agree to" gets a date that points at one document. If the wording ever
changes without that date changing, the test suite fails.

**Two things only you can do:**

1. **Read both pages once** and correct anything that is wrong about your
   business. Section 8 of the terms says you carry general liability
   insurance. If that is not true today, say so and it comes out until it is.
2. **Get the flat-fee review.** $300 to $800, one to two weeks, before the
   first live charge. Send the lawyer both pages and
   `docs/STRESS-TEST-2026-09-11.md` section H8, which lists what was added and
   why.

## 13. Cloudflare Turnstile

Free. Stops a script from creating a Stripe customer a thousand times a
minute. Sign up at dash.cloudflare.com, add a Turnstile widget for
`513autoclean.com`, and you get a site key and a secret key. The site key goes
in `js/config.js` as `turnstileSiteKey`; the secret goes in Netlify as
`TURNSTILE_SECRET_KEY`. Then flip `botCheck` in `capabilities.ts`. Until both
exist the payment step simply does not show the check.

## 14. Before the first live charge: the CPA hour

The site charges sales tax by destination: Ohio counties, 6% in Kentucky, 7%
in Indiana, with travel in the taxable base. Three questions, each of which
changes what the code should do, and none of which I can answer for you:

1. **Ohio vendor's license.** You need one before collecting Ohio sales tax.
   Number goes on the invoice.
2. **Kentucky and Indiana.** Working there creates nexus. Either register in
   both, or stop taking bookings there, or stop charging their tax. Charging
   tax you are not registered to remit is the worst of the four options.
3. **Travel.** In Ohio, a delivery or service-call charge that is part of a
   taxable service is generally taxable. Confirm, and if not, one line in
   `lib/pricing/quote.ts` takes it out of the base.

The tax table also carries the year it was verified. A test fails on 1
January 2027 until the rates are checked again, which is the alarm.

---

## Decisions I need from you, not accounts

1. **Live or test payments at launch?** I would launch in test mode, book three
   real jobs yourself end to end, then flip.
2. **Should "Most popular" be the default sort** on the browse screen? It is
   built and seeded to Full Interior then Basic Exterior. Today the default is
   still price, low first.
3. **The map dot positions** are approximate, placed from coordinates rather
   than measured. Compass directions are verified by tests. Look at it once and
   tell me if anything sits obviously wrong to someone who drives it daily.
4. **Do you want an "Express Interior" back?** It was removed. Express Exterior
   survives at $75.

---

## What is genuinely finished

Worth knowing what you are *not* waiting on:

- The full booking funnel: vehicle size, service, package, add-ons, location,
  second vehicle, time, contact, payment step
- All pricing maths, server-recomputed from IDs so a tampered browser cannot
  pay $1 for a $400 detail, skip the priority surcharge, claim the pay-in-full
  discount without paying, skip tax, or book a service that is coming soon.
  300 tests, including one that imports every function with a fake key
- Only `dist/` is published, so nothing that is not the site can become a URL
- Every asset URL is content-hashed and cached for a year; a price change
  reaches every browser on the next page load
- Travel fee ladder, shown identically in the funnel and charged by the
  payment function
- Sales tax by county, verified for 2026
- The service area map, search, and fee bands
- Reviews, ticker and grid, with dates that stay correct
- The whole catalog as one source of truth, so a price change lands on the
  front page, the funnel and the payment function at once
- SEO: 74 named cities in structured data, sitemap, FAQ schema, offer catalog
