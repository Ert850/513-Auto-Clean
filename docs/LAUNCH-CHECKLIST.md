# What is blocking a fully working site

Last updated 2026-09-10.

Everything on the site works today except the parts that need an account in
your name. This is that list: what you have to do, what you have to send me,
and exactly what breaks until you do.

`SETUP.md` has the click-by-click steps for each service. This page is the
tracker: what is blocked, by whom, and how bad it is.

**When you finish one of these, flip its switch.** `web/lib/site/capabilities.ts`
has one line per feature. Set `live: true`, run `npm run build`, and the terms
page rewrites itself to describe what the site now actually does. A test fails
the build if the two ever disagree, so the page cannot promise something that
is not working.

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
| 7 | Resend | You | 10 min | No confirmation emails |
| 8 | PayPal business account | You | 20 min | No PayPal or Venmo at checkout |
| 9 | Netlify environment variables | You | 10 min | None of the above reaches the live site |
| 10 | Six add-on prices | You | 0 min | **Done.** All fifteen add-ons are priced |
| 11 | Terms and Cancellation Policy | Me, then a lawyer | I draft in a day | You are taking cards with no written policy behind it |
| 12 | Legal review of the Terms | A lawyer, $300 to $800 | 1 to 2 weeks | Chargeback exposure on the cancellation fee |

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

## 2. Stripe

**Blocks:** all payment. This is the single biggest blocker to taking money.

**Do:** create the account, get the test keys, then the live keys once the
business details are verified.

**Send me (safe to share):** which mode you are in, test or live. Nothing else.

**Put in `.env.local` and Netlify:** `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`. The publishable key goes in `window.AC_CONFIG` in
`index.html`, which is fine, publishable keys are designed to be public.

---

## 3. Google Cloud

One project covers four separate things. Enable all of these APIs:

| API | What it powers | Without it |
|-----|----------------|------------|
| **Routes API** | The real drive time at booking AND on the service area map | Travel is estimated from ZIP bands and distance |
| **Places API (New)** | Address autocomplete, and the live reviews feed | Typed addresses, snapshot reviews |
| **Google Calendar API** | Reading your real availability | Standard time slots with a "may need adjusting" warning |
| **Maps JavaScript API** | Not needed. The map uses OpenStreetMap, which is free | Nothing |

**Make two keys, restrict both.** Browser key restricted to
`513autoclean.com/*`, server key restricted by IP. **Set a $25/month budget
alert.** An unrestricted key scraped out of the page bundle is how people wake
up to a $3,000 bill.

**Send me (safe to share):** the service account's email address. Not the JSON.

---

## 4. The two calendars

`513 Availability` (you manage from your phone) and `513 Booked Jobs` (the
system writes, you never touch).

Share both with the service account email: **See all event details** on
Availability, **Make changes to events** on Booked Jobs.

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

You have a privacy policy. You do **not** have Terms or a Cancellation Policy,
and you are about to hold cards on file with a cancellation fee and a clause
letting you adjust the price on arrival after inspection.

That is the highest legal exposure in this project. Card networks side with
cardholders when a service was not rendered, unless you can prove the customer
affirmatively accepted clear terms.

**I will draft both.** A flat-fee small business review runs $300 to $800 and
is the cheapest insurance here. Get it before you take live payments.

What is already built to support this: the exact sentence shown at the
checkbox is snapshotted into the consent record, the policy is repeated in the
confirmation, and the checkbox is not pre-ticked.

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
  pay $1 for a $400 detail. 106 tests
- Travel fee ladder, shown identically in the funnel and charged by the
  payment function
- Sales tax by county, verified for 2026
- The service area map, search, and fee bands
- Reviews, ticker and grid, with dates that stay correct
- The whole catalog as one source of truth, so a price change lands on the
  front page, the funnel and the payment function at once
- SEO: 74 named cities in structured data, sitemap, FAQ schema, offer catalog
