# The private test site: setup

**What it is:** a second Netlify site, separate from the live one, that builds the `eNov14` test branch. Every page, script, image and function call needs a password. Every response also says `noindex`. Nobody without the password can see anything, including Google and a toll-free reviewer. The live site is untouched.

**How the password works:** `netlify/edge-functions/test-gate.js` runs on every request, but only acts where the variable `TEST_SITE_PASSWORD` is set. Only the test site sets it. On the live site the function returns at once and changes nothing (tested: `web/lib/site/test-gate.test.ts`). It's a Netlify edge function, so it works on the free plan.

## Steps (Netlify and Google; each one is an account change, so Emmett says yes first)

**Decided (Emmett, November 14):** test calendars, owner emails to Emmett, and the calendar session does the setup.

1. **Create the site.** In Netlify: Add new site, then Import an existing project, then GitHub `Ert850/513-Auto-Clean`.
   - Site name: `513-auto-clean-test`, so the address is `https://513-auto-clean-test.netlify.app`.
   - Branch to deploy: **`eNov14`**. Build command and publish folder come from `netlify.toml`.
2. **On the new site only, under Site configuration and Build & deploy:**
   - Deploy Previews: **off**;
   - Branch deploys: **only the production branch**.

   That way pull requests never make extra public copies.
3. **Environment variables on the new site:**
   - **`TEST_SITE_PASSWORD`:** a password Emmett chooses, marked secret, scope Functions (edge functions read it). **Typed by Emmett, never in chat.**
   - **Copy from the live site** the variables the build and functions need: the Google calendar and Maps settings, `DETAILERS`, `DETAILER_HOMES`, `SHOP_ORIGIN_ADDRESS`, the Resend key, the analytics IDs (optional), and `BUSINESS_PHONE`.
     - **Secret values can't be read back out of Netlify,** so Emmett pastes those from his own copy.
     - The Netlify CLI command `netlify env:clone` may copy the rest.
   - **Bookings go to test calendars** (Emmett, November 14). Create two calendars in the business Google account, "513 TEST Bookings" and "513 TEST Kris Bookings", shared with the same account that writes the real ones (the service account or OAuth user). Then, on the test site only:
     - `GOOGLE_BOOKED_CALENDAR_ID` = the ID of "513 TEST Bookings". Owner jobs are written here (`_gcal.mjs` `bookedCalendarId()`). `GOOGLE_CALENDAR_ID` stays the real one, because it's only read, for real availability.
     - `DETAILERS` = the live value with Kris's `bookings` changed to the ID of "513 TEST Kris Bookings". His availability calendar stays real, because it's only read.
   - **Owner emails go to Emmett** (November 14): `OWNER_EMAIL` = emmett.looman@gmail.com on the test site. Elijah gets nothing from testing.
4. **Google Cloud:** add `https://513-auto-clean-test.netlify.app/*` to the browser key's allowed websites, so address suggestions and the map work there.
5. **Deploy and check:**
   - The address asks for the password, and every page works after it.
   - `curl -I` without the password returns 401 with `X-Robots-Tag: noindex`.
   - A test booking writes only to "513 TEST Bookings" (or Kris's test calendar) and the owner email reaches only emmett.looman@gmail.com.

## Decisions (all made November 14)

1. Test bookings go to test calendars.
2. Owner emails go to Emmett.
3. The calendar session does the setup.

## What the test site can't do

- **The Contact form:** Web3Forms only accepts the live domain, so it can't submit there.
- **Real customer texts or payments:** none are set up anyway.
