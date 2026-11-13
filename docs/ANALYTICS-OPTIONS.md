# Analytics: three free options

Decision needed for deliverables 3.1 to 3.6. Requirements: **free**. Shows
where visitors come from (including the Golf and Prestige Living QR codes),
which pages they visit, and where they leave. A short consent banner saying
analytics is used to see how the site works, not for advertising.

Prices checked November 9, 2026. Free tiers change, so confirm on each
vendor's own page before signing up.

---

## Option 1: GA4 + Microsoft Clarity (recommended)

| | |
|---|---|
| **Cost** | $0 for both. GA4's standard tier is free. Microsoft says Clarity is "free forever", with no traffic limit and no sampling |
| **GA4 gives you** | Traffic sources and UTM campaigns (one per magazine), pages, exit pages, booking conversions, and the funnel step where people drop off |
| **Clarity gives you** | Heatmaps (where people click and how far they scroll), session recordings (watching a visit), and rage-click and dead-click detection. It can link to GA4 |
| **Pros** | Industry standard, and both tools are free with no cap. Between them they cover the transcript's "where people go and when they click off". GA4 can feed Google Ads conversions later if the marketing spend goes there |
| **Cons** | Two scripts to load, which costs a little page speed. Lighthouse runs on every build, so we'll see the effect. Two dashboards. Visitors who decline the banner are not counted (see the note at the end) |
| **Advertising caveat** | To keep the banner's "not used for advertising" true: turn off Google Signals and ads personalization in GA4, and don't link GA4 to Google Ads for remarketing. Linking Google Ads later, even only to measure ad ROI, means changing the banner text and the privacy policy first |

## Option 2: PostHog Cloud (free tier)

| | |
|---|---|
| **Cost** | $0 up to roughly 1 million events and 5,000 session recordings a month. This site would use a small fraction of that |
| **Gives you** | Everything in Option 1, in one tool: traffic, UTMs, funnels, heatmaps and recordings |
| **Pros** | One script and one dashboard. Funnel analysis is the strongest of the three. The data can be hosted in the US or the EU |
| **Cons** | Less familiar, and fewer tutorials for small businesses. No direct link to Google Ads. Charges start if you go over the free tier. You can set a billing limit of $0 |

## Option 3: Microsoft Clarity alone

| | |
|---|---|
| **Cost** | $0 |
| **Gives you** | Recordings and heatmaps, plus a basic dashboard of traffic, referrers and UTM filters |
| **Pros** | One free script with the lightest setup. It covers "where they go and when they click off" directly |
| **Cons** | Weak on attribution and conversion reports, so magazine ROI would rely on the booking-side tracking below. Not suited to measuring a bigger ad budget |

**Left out because they are not free:** Netlify Analytics, the host's
toggle, is paid per site and shows server-side page views only. Plausible is
paid. **Cloudflare Web Analytics** is free and needs no banner, but it shows
page counts only. It could be added later as a baseline that also counts the
visitors who decline the banner.

---

## Setup for Option 1

**Your part, about 20 minutes, needs your Google and Microsoft logins:**

1. analytics.google.com: create the account, then a property named
   "513 Auto Clean" (US/Eastern, USD), then a **Web data stream** for
   `513autoclean.com`. Copy the **Measurement ID** (`G-XXXXXXX`).
2. In GA4 Admin: **Data collection: Google Signals off**. **Ads
   personalization off**. **Data retention: 14 months**.
3. clarity.microsoft.com: sign in, then **New project** for
   `513autoclean.com`. Copy the **Project ID**. In Settings, keep **Masking:
   Strict** so form fields such as names, phone numbers and addresses never
   appear in recordings. Under Integrations, connect GA4.
4. Send me both IDs. They are public by design, like the other browser keys,
   and go into Netlify environment variables the same way.

**My part, about 3 hours:**

1. **Consent banner** with Accept and Decline buttons. Nothing loads until
   Accept, as `privacy.html` promises. Google Consent Mode v2 in **basic**
   mode (everything off until consent), plus Clarity's consent call.
2. Load GA4 and Clarity from `js/` with their IDs from the generated
   config, and add both domains to the Content Security Policy.
3. Track events: booking completed, call tapped, text tapped, question sent,
   and each funnel step.
4. **Record the magazine source with each booking itself**, from the UTM on
   the arrival URL. That way ROI counts bookings even from people who decline
   the banner. It goes into the confirmation email and into GoHighLevel.
5. Privacy policy: add a `Processor` and a `Capability` for each tool,
   rewrite the "no analytics" sentences, bump the legal version, run
   `npm run lock:legal`. The tests enforce all of it.

## Draft banner text (no em dashes, per house style)

> We use cookies and analytics (Google Analytics and Microsoft Clarity) only
> to see how the 513 Auto Clean website is working, like which pages help and
> where the booking form gets confusing. They are never used for advertising.
> **Accept** · **Decline** · Privacy policy

**Tradeoff to accept:** anyone who declines is invisible to GA4 and Clarity.
Magazine ROI still counts their *bookings* (step 4 of my part), but not their
visits.

---

Sources: [Microsoft Clarity FAQ](https://learn.microsoft.com/en/clarity/faq) ·
[PostHog pricing](https://posthog.com/pricing) ·
[Consent Mode basic vs advanced (CookieYes)](https://www.cookieyes.com/documentation/basic-vs-advanced-consent-mode/)
