# Booking system setup

Everything the booking flow needs, in the order that unblocks the most work.
Items marked **LEAD TIME** involve someone else approving you, so start those
first and do the instant ones while you wait.

When you finish a step, paste the values into `web/.env.local`. That file is
gitignored, so nothing you put in it reaches GitHub. Never paste a secret key
into a chat, a commit, or the HTML.

---

## Order to do these in

| # | Service | Time | Blocks |
|---|---------|------|--------|
| 1 | **Twilio A2P 10DLC** | **LEAD TIME: days to weeks** | All automated texting |
| 2 | **Stripe** | ~30 min, instant test keys | Deposits, cards on file |
| 3 | **Google Cloud** | ~30 min | Drive time, address autocomplete, calendar |
| 4 | **Two Google Calendars** | ~10 min | Availability and booked jobs |
| 5 | **Neon Postgres** | ~10 min | Storing bookings |
| 6 | **Resend** | ~10 min | Confirmation emails |
| 7 | **Netlify env vars** | ~10 min | Deploying any of it |

---

## 1. Twilio and A2P 10DLC (start today)

Carriers require every business that sends automated SMS to register a brand
and a campaign. Unregistered traffic gets **silently filtered**, which is the
worst failure mode available: everything looks like it is working while your
customers receive nothing.

1. Create an account at <https://www.twilio.com/try-twilio>.
2. Buy a local number with SMS capability in the 513 area code.
   Console, Phone Numbers, Buy a number.
3. Go to Messaging, Regulatory Compliance, and register:
   - **Brand**: 513 Auto Clean, sole proprietor. You will need your EIN or SSN,
     legal business name, and address.
   - **Campaign**: use case "Customer Care" plus "Mixed". Sample messages must
     match what we actually send.
4. Create a **Messaging Service** and attach the number to it.

**What the reviewer checks, and where people get rejected:**
- Your privacy policy URL must be live and must state that mobile numbers are
  not shared for marketing. Ours already does, at
  <https://513autoclean.com/privacy.html> section 4.
- Your opt-in wording must appear where consent is collected. The funnel's
  consent step already carries it.

Cost: about $4 one time, plus $1.50 to $10 per month, plus per-message fees.

```
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_MESSAGING_SERVICE_SID=MG...
```

---

## 2. Stripe

1. Create an account at <https://dashboard.stripe.com/register>.
2. Stay in **Test mode** (toggle, top right) until we have run a full test
   booking end to end.
3. Developers, API keys. Copy both.
4. Settings, Payments, enable **Apple Pay** and **Google Pay**. Apple Pay needs
   domain verification; Stripe walks you through it once the site is live.
5. Set the statement descriptor to `513AUTOCLEAN` under Settings, Business.
   This matters: an unrecognisable descriptor is a common chargeback trigger.

The webhook comes later, once the site is deployed. I will tell you the URL.

```
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...      # after the endpoint exists
```

Fees: 2.9% + 30 cents. Refunds do **not** return the fee, which is exactly why
the cancellation policy keeps a $25 booking fee.

---

## 3. Google Cloud

One project, but **two halves that cost different amounts**. Do the free half
first: it is also the one that changes the site the most.

### 3a. Calendar, free, no card

The Calendar API is a Workspace API, not Maps Platform. It needs a project and
nothing else: no billing account, no card, no trial that expires.

1. <https://console.cloud.google.com/> and create a project, "513 Auto Clean".
2. APIs and Services, Library, enable **Google Calendar API**.
3. Credentials, **Create credentials**, **API key**. Take this menu item
   directly.
4. Restrict it: Websites, `513autoclean.com/*`; API restrictions, Calendar API.

**Do not create a service account, and do not create an OAuth client.** If the
console pushes you into a "what data will you be accessing" wizard, the answer
is **Public data**, which produces an API key. The funnel reads a *public*
calendar from the visitor's browser: OAuth would ask every customer to sign in
to Google, and a service account needs a private JSON key, which can never be
put in a browser. Nothing in this repo writes to Google Calendar, so there is
no second credential to create.

### 3b. Maps Platform, needs a card

Routes (drive time), Places Autocomplete, and Place Details (live reviews) all
sit here, and Google will not issue a key until a card is on file. There is a
free monthly allowance far larger than this site's traffic; check the current
figures in the console rather than trusting a number written down here.

Skipping this half is a real option. Travel stays a ZIP band estimate, people
type their address, and reviews stay the stored snapshot with true dates. All
three already work.

1. Billing, link a billing account.
2. Library, enable **Routes API** and **Places API (New)**.
3. Two more API keys:

   | Key | Restriction | Used by |
   |-----|-------------|---------|
   | Places browser key | Websites: `513autoclean.com/*`; API: Places API (New) | Address autocomplete, in the page |
   | Server key | **API restrictions only** | Routes and Place Details, server side |

   The server key **cannot be restricted by IP**. Netlify Functions run on
   Lambda with no stable outbound address, so an IP allowlist would block the
   site itself. What protects it instead is that it never reaches a browser,
   plus the quota caps below.

4. APIs and Services, each API, Quotas and System Limits. Per day:
   Routes **500**, Place Details **200**, Autocomplete **1,000**. A quota is
   the only cap nobody can route around.
5. Billing, Budgets and alerts, **$25/month**. Expected real spend is $0 to
   $10, so an alert firing means something is wrong.

```
GOOGLE_MAPS_SERVER_KEY=...        # Netlify, secret
```

The two browser keys go in `js/config.js` as `googleCalendarApiKey` and
`googlePlacesApiKey`. They are public by design; the restrictions are what
make them yours.

---

## 4. The availability calendar

**One calendar today, not two.** `513 Booked Jobs` was for a writer that has
not been built: nothing in this repo writes to Google Calendar. Create it when
that ships, not before.

In Google Calendar on a desktop browser:

1. Create **513 Availability**. This is the one you manage from your phone.
2. Settings for that calendar, **Access permissions**, tick
   **Make available to public**, and set the dropdown to **See all event
   details**. That is what lets a visitor's browser read it with nothing but
   the restricted API key.

   The dropdown matters because the reader works two ways. With
   **See all event details** it can see titles, so events titled `OPEN` become
   your bookable hours and everything else on that calendar is ignored: the
   whitelist. With **See only free/busy** it sees times and no titles, so it
   falls back to standard business hours minus every event on the calendar:
   the blacklist. Both work. The whitelist is the one worth having, because it
   lets you keep unrelated events on the same calendar without closing off
   those hours.
3. Copy the **Calendar ID** near the bottom of the same page into
   `js/config.js` as `googleCalendarId`.

**How you actually use it day to day:** on the Availability calendar, create
recurring events titled `OPEN`. For example `OPEN` Mon to Sat, 9am to 6pm. Only
events whose title starts with `OPEN` count as bookable time, so you can keep
personal events on that calendar without breaking anything. Drag or delete a
single occurrence to change one day.

```
GOOGLE_CALENDAR_AVAILABILITY_ID=...@group.calendar.google.com
GOOGLE_CALENDAR_BOOKED_ID=...@group.calendar.google.com
```

---

## 4b. Your personal calendar, as a conflict source

The booking funnel reads TWO calendars. `513 Availability` says when you are
open for work. Your personal iCloud calendar says when you are not available
at all, and a slot you cannot make is not a slot regardless of which calendar
the conflict is in.

In iCloud Calendar, right click the calendar, **Share Calendar**, tick
**Public Calendar**, and copy the link. It starts `webcal://`.

```
PERSONAL_CALENDAR_ICS=webcal://p138-caldav.icloud.com/published/2/...
```

**Treat that link as a password.** Anyone holding it can read the entire
calendar: every title, location, attendee and note. It goes in `.env.local`
and in Netlify, and nowhere else. It is never sent to a browser, and the
function that reads it returns only start and end times, never a title. If
the link is ever pasted anywhere it should not be, turn Public Calendar off
and back on to mint a new one; the old link dies immediately.

**All-day events are ignored on purpose.** A personal calendar is full of
birthdays and holidays, and treating those as busy would quietly close whole
days of bookings. On your real calendar the difference is 618 blocked hours
against 230 over four months. Put genuine conflicts in as timed events.

**Freshness.** iCloud regenerates a published feed on its own schedule, so a
change can take up to about fifteen minutes to appear. Do not add something
half an hour out and expect the site to know. For anything urgent, block the
time on `513 Availability` instead, which is read live.

---

## 5. Neon Postgres

1. <https://console.neon.tech/> and create a project in **AWS us-east-2 (Ohio)**,
   closest to both you and Netlify's default region.
2. Copy both connection strings from the dashboard.
   The **pooled** one is the default; the direct one is under "Direct connection".

Serverless functions exhaust direct connections quickly, so the pooled string
is what the app uses. Migrations need the direct one.

```
DATABASE_URL=postgresql://...-pooler...
DATABASE_URL_UNPOOLED=postgresql://...
```

Cost: $0 to $19/month. Realistically $0 at your volume.

---

## 6. Resend (email)

1. <https://resend.com/signup>, add the domain `513autoclean.com`.
2. Add the DNS records it gives you at your registrar. They are the DKIM
   record and a `send.` subdomain carrying SPF and the bounce return path.
   **Accept those.** The separate *click and open tracking* subdomain is
   optional and should be skipped: these are booking confirmations, not
   marketing, and a tracking pixel would have to be disclosed in the privacy
   policy for no benefit to anybody.
3. Create an API key.

It has to be the domain, not a Gmail address. You cannot send "from" a
gmail.com address through Resend: you do not own the domain, so it will not
verify, and Gmail's own DMARC policy would reject the mail anyway.
`OWNER_EMAIL` is a *recipient*, so a Gmail address there is fine.

Free up to 3,000 emails a month, which you will not exceed.

```
RESEND_API_KEY=re_...                              # Netlify, secret
RESEND_FROM=513 Auto Clean <bookings@513autoclean.com>
OWNER_EMAIL=elijahthackerllc@gmail.com             # optional, this is the default
```

**Until the domain verifies, customers get nothing.** The unverified fallback
sender `onboarding@resend.dev` only delivers to the address the Resend account
was opened with, so the owner copy arrives and the customer copy is refused.
`send-confirmation` reports that as `sent:false` and the booking is unaffected.

---

## 7. Admin panel secrets

Generate these locally once the app exists. I will give you the exact command;
they are a password hash, a TOTP secret for two-factor, and a session signing
key. The plaintext password is never stored anywhere.

```
ADMIN_PASSWORD_HASH=
ADMIN_TOTP_SECRET=
SESSION_SECRET=
```

---

## 8. Netlify

Site configuration, Environment variables. Add every value from
`web/.env.local` **except** anything prefixed `NEXT_PUBLIC_`, which is safe in
the bundle, and set those too.

`SHOP_ORIGIN_ADDRESS` and `SHOP_ORIGIN_PLACE_ID` are already in your local file
and must go here as well. They are server-only: the browser sends a destination
place ID and receives back only a drive time and a fee, never your address.

---

## What to send me

Nothing secret. Once you have finished a step, just tell me which one, and paste
back only these non-sensitive values so I can wire them up:

- The **Calendar API key** and the **Calendar ID** (both safe; the key is
  restricted to your domain and sits in the page either way)
- The **Places browser key** (same reasoning)
- The **Google Place ID** (public)
- The **Stripe publishable key** (public by design)
- The **PayPal client ID** and the **Turnstile site key** (public)
- That the **personal calendar URL** is set in Netlify. Do not paste the URL itself
- That **RESEND_API_KEY**, **STRIPE_SECRET_KEY**, **GOOGLE_MAPS_SERVER_KEY**
  and **SHOP_ORIGIN_ADDRESS** are set. Do not paste any of them
- Confirmation that the **A2P campaign** is submitted, and its status

Everything secret lives in Netlify and nowhere else. Not in this repo, not in
a chat, not in a file you email yourself. Anything that has been pasted into a
conversation is burned and should be rotated.

---

## Cloudflare Turnstile (bot check before payment)

1. dash.cloudflare.com, Turnstile, Add site. Domain `513autoclean.com`, widget
   mode Managed.
2. Copy the **site key** into `js/config.js` as `turnstileSiteKey`.
3. Copy the **secret key** into Netlify as `TURNSTILE_SECRET_KEY`.
4. Set `botCheck` to `live: true` in `web/lib/site/capabilities.ts` and
   rebuild, so the privacy policy names Cloudflare.

Until both keys exist, nothing changes: the payment step shows no check and
the functions do not ask for a token.

## Where public keys go

All of them go in `js/config.js`, never inline in a page. That file is loaded
before anything else and is the only place `window.AC_CONFIG` is set.
