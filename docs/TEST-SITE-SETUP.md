# The private test copy: a password-gated Deploy Preview

**What it is (Emmett, November 14: "we aren't doing a netlify test site we should do a preview"):** no second Netlify site. A draft pull request from `eNov14` makes Netlify build a Deploy Preview on the existing site, at `https://deploy-preview-<N>--513-auto-clean.netlify.app`. Every page, script, image and function call there needs a password, and every response says `noindex`. Nobody without the password can see anything, including Google and a toll-free reviewer. The live site is untouched.

**How the password works:** `netlify/edge-functions/test-gate.js` runs on every request, but only acts where the variable `TEST_SITE_PASSWORD` is set. It is set for the **Deploy Previews** context only. In Production the function returns at once and changes nothing (tested: `web/lib/site/test-gate.test.ts`). It's an edge function, so it works on the free plan.

## Steps (each is an account change or a GitHub action, so Emmett says yes first)

1. **TEST calendars** in the business Google account: "513 TEST Bookings" and "513 TEST Kris Bookings". The site writes as that account, so no extra sharing is needed.
2. **Deploy-Previews-only values on the existing site** (Site configuration, Environment variables). For each one, choose "different value for each deploy context". Re-enter the Production value exactly as it was, and change only the Deploy Previews value.
   - `TEST_SITE_PASSWORD`: chosen and typed by Emmett, marked secret. No Production value.
   - `GOOGLE_BOOKED_CALENDAR_ID`: the "513 TEST Bookings" ID. Owner jobs are written here (`_gcal.mjs` `bookedCalendarId()`). `GOOGLE_CALENDAR_ID` stays the real one: it's only read, for real availability.
   - `DETAILERS`: the Production value with Kris's `bookings` set to the "513 TEST Kris Bookings" ID. His availability calendar stays real, because it's only read.
   - `OWNER_EMAIL`: Emmett's own address (given in the session, kept out of this public repo). Elijah gets nothing from testing.
3. **Open a draft PR from `eNov14` to `main`** (Emmett's approval; never merged without a separate yes). Netlify builds the preview from it.
4. **Check:**
   - Without the password, `curl -I` returns 401 with `X-Robots-Tag: noindex`; with it, every page works.
   - A test booking writes only to a TEST calendar, and the owner email reaches only Emmett.
   - Production's variables are unchanged and production was not redeployed.

## What the preview can't do

- **The Contact form:** Web3Forms only accepts the live domain, so it can't submit there.
- **Real customer texts or payments:** none are set up anyway.
- **Address suggestions and the map** use the browser Maps key. If its allowed websites don't cover `*--513-auto-clean.netlify.app`, those two fail on the preview; booking still works by typing the address.
