# Analytics setup: your 10 minutes, then the rest runs without you

**What's already built.**
- **The loader and the consent banner** (`js/analytics.js`): nothing loads until a visitor accepts. Google's advertising features and signals are off.
- **The events the site sends:**
  - **booking:** `booking_complete` (with its value), `booking_request`, `booking_open`, `booking_step`;
  - **checkout:** `checkout_section`, `checkout_left`;
  - **times:** `time_pick`, `time_recs_shown`;
  - **extras and calls:** `addon_add`, `contact_click` (call, text, email), `heard_about`, `booking_followup`.
- **Magazine source** (`utm_source`): kept for the whole visit and carried into the booking email.
- **The privacy policy wording** for both tools, waiting on one switch.

**What it needs from you:** two accounts and two IDs. Both are free.

---

## Your part (about 10 minutes, in Chrome, signed in as elijahthackerllc@gmail.com)

### 1. Google Analytics 4 (about 5 minutes)
1. Open **analytics.google.com**. If it asks, click **Start measuring**.
2. **Account name:** `513 Auto Clean`. Leave the data-sharing boxes **unticked**, then click **Next**.
3. **Property name:** `513autoclean.com`. **Time zone:** United States, Eastern Time. **Currency:** US Dollar. Click **Next**.
4. **Business details:** Small, Automotive (or "Other business activity"). **Objectives:** "Generate leads" and "Understand web traffic". Click **Create** and accept the terms. *Accepting Google's terms is yours to do.*
5. **Choose a platform:** **Web**. **Website URL:** `https://513autoclean.com`. **Stream name:** `513autoclean.com`. Leave **Enhanced measurement** on, then click **Create stream**.
6. Copy the **Measurement ID**. It starts with **G-**, like `G-AB12CD34EF`. This is not a secret: it appears in the page's code.
7. Close the "installation instructions" panel. The site already has the code.

### 2. Microsoft Clarity (about 3 minutes)
1. Open **clarity.microsoft.com** and sign in **with Google** (elijahthackerllc@gmail.com).
2. Click **New project**. **Name:** `513 Auto Clean`. **Website URL:** `https://513autoclean.com`. Click **Add new project**.
3. On "How would you like to install Clarity?", click **Install manually**, then just **close** it. The site already has the code.
4. Open **Settings → Overview** and copy the **Project ID**, a short code like `abcd1234ef`. It's also not a secret.

### 3. Hand over (1 minute)
1. Paste both IDs in this chat: `G-…` and the Clarity Project ID. Both are public.
2. Leave **Chrome open**, with the Claude extension connected, in your elijahthackerllc profile.
3. When the extension asks, **allow** it on analytics.google.com, clarity.microsoft.com and app.netlify.com.

That's all. Everything below runs on its own.

---

## What happens next, without you (about an hour)

1. **Netlify.** Add `GA4_MEASUREMENT_ID` and `CLARITY_PROJECT_ID` (all deploy contexts, *not* marked secret, because the build writes them into the page).
2. **Privacy policy.** Switch the `siteAnalytics` capability to live in `web/lib/site/capabilities.ts` and bump the policy date (`web/lib/site/legal.ts`, then `npm run lock:legal`). Check that the policy names Google Analytics and Microsoft Clarity, says nothing loads before Accept, and that the banner wording matches. Run the legal tests.
3. **GA4 settings:**
   - **Admin → Data retention:** 14 months. **Done November 11** (it was 2 months).
   - **Google signals:** off. **Checked November 11:** it was never turned on.
   - **Data collection for ads personalization:** off. **Done November 11:** it was allowed in all 307 regions; now it's allowed in 0.
   - **Key events** (Admin → Events → the star beside the event): `booking_complete`, `booking_request`, `contact_click`. **Still to do:** Analytics only lists an event after it has arrived once, so this happens after the deploy, from the first real visits.
   - **Custom dimensions** (Admin → Custom definitions), event-scoped. **Done November 11:** `method` (call/text/email), `detailer`, `reason` (which recommended time), `via` (how a time or extra was picked), `step` (booking step), `section` (checkout section), `answer` (where they heard about us), `exp_variant_string` (A/B test version). There's no `kind` dimension: no event sends that parameter; `booking_complete` and `booking_request` are separate events.
   - Filter out your own visits: add your home IP under **Data streams → Configure tag settings → Define internal traffic**, if you want that, and turn the filter on.
4. **Clarity settings:**
   - **Masking mode: Balanced** (Clarity's default, confirmed in settings). It hides what people type into form boxes, which our privacy policy promises. Strict would also hide every word on the page, which would make the recordings much less useful.
   - **Setup → Google Analytics integration:** connect to the new GA4 property, so recordings can be filtered by GA4 events. **Done November 11:** connected to `513autoclean.com` and active (the owner approved Google's sign-in; Clarity has read and edit access, which its integration needs for its playback-link dimension). Masking is on Balanced.
5. **Checks on a deploy preview,** before anything goes live:
   - Decline: nothing from Google or Clarity loads, and the network shows no requests to them.
   - Accept: GA4 **Realtime** shows the visit, and Clarity shows a live session within a few minutes.
   - A test booking with `?utm_source=golf&utm_medium=print&utm_campaign=qr` shows `booking_complete`, with the source, in GA4 DebugView.
   - The Content Security Policy reports nothing for Google or Clarity (both are already allowed in `netlify.toml`).
6. **Logs:** record every change in `docs/SESSION-CHANGES-pipeline.md`, plus a short "how to read your reports" note: visits by source, bookings by source, and where people leave the booking form.

**What still needs you after that:** nothing for analytics. The magazine pages need the owner's answers (`docs/OWNER-QUESTIONS-MAGAZINES.md`). Going live needs the pipeline merged into `main` with your approval. The minute that merge goes live, the 513 Auto Clean jobs calendar must be switched to free/busy only (not before; see `docs/DETAILERS-GUIDE.md`).
