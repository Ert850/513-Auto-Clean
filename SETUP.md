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

One project covers drive time, address autocomplete, and calendar access.

1. <https://console.cloud.google.com/> and create a project, "513 Auto Clean".
2. Link a billing account. Required even for free tier usage.
3. APIs and Services, Library. Enable:
   - **Routes API** (drive time)
   - **Places API (New)** (address autocomplete)
   - **Google Calendar API**
4. Credentials, Create credentials, API key. Make **two**:

   | Key | Restriction | Used by |
   |-----|-------------|---------|
   | Browser key | HTTP referrers: `513autoclean.com/*` and your Netlify preview domain | Address autocomplete |
   | Server key | IP addresses, or leave unrestricted only until deploy | Routes API |

   **Restrict both.** An unrestricted key scraped out of the page bundle is how
   people wake up to a $3,000 bill.

5. Billing, Budgets and alerts. Set an alert at **$25/month**. Expected real
   spend is $0 to $10, so an alert firing means something is wrong.

6. Service account for the calendars: IAM and Admin, Service Accounts, Create.
   Name it `513-calendar`. Skip role assignment. Open it, Keys, Add key, JSON.
   Download it and keep it out of the repo.

```
GOOGLE_MAPS_SERVER_KEY=...
NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY=...
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}   # the whole file, one line
```

---

## 4. The two calendars

In Google Calendar on a desktop browser:

1. Create **513 Availability**. This is the one you manage from your phone.
2. Create **513 Booked Jobs**. The system writes to this one; you never edit it
   by hand.
3. For each, Settings, Share with specific people, add the service account
   email (it looks like `513-calendar@your-project.iam.gserviceaccount.com`):

   | Calendar | Permission |
   |----------|------------|
   | 513 Availability | **See all event details** |
   | 513 Booked Jobs | **Make changes to events** |

4. From each calendar's settings page, copy the **Calendar ID** near the bottom.

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
2. Add the DNS records it gives you at your registrar.
3. Create an API key.

Free up to 3,000 emails a month, which you will not exceed.

```
RESEND_API_KEY=re_...
```

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

- The two **Calendar IDs** (safe to share)
- That the **personal calendar URL** is set in Netlify. Do not paste the URL itself
- The **service account email address** (safe, it is not the key)
- Which **Stripe mode** you are in
- Confirmation that the **A2P campaign** is submitted, and its status

Keep every key and the service account JSON in `.env.local` only.
