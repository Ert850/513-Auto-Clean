# Going live: `eNov6` to `main`

From the production-readiness review, November 11, 2026, against `eNov6` at `6cfe5be`; later commits are covered by the tests. **Verdict: ready, with conditions.** No code blockers were found. The conditions are the Netlify settings and the order of the steps below.

- **Who does what:** **You** = Elijah, **Owner** = the owner, **Agent** = Claude.
- **Approvals:** nothing here happens without your approval. Claude opens no pull request and merges nothing on its own.

## What the review checked

- **The merge:**
  - `main` (`5fbf83a`) is exactly what 513autoclean.com serves today.
  - `main` is an ancestor of `eNov6`, so the merge has no conflicts.
- **The build:**
  - a fresh clone with **no secrets** builds cleanly;
  - the committed bundles, terms, privacy and `legal.lock.json` rebuild byte for byte;
  - every test passes in Eastern time.
- **The built site:**
  - no broken internal links;
  - every script and style is stamped (they're cached for a year);
  - the sitemap, robots file and canonicals are all right.
- **Payments:** still switched off (`cardOnFile` and `payInFull` are not live).
- **A calendar failure can't block a booking:** a failed calendar write is caught, and both emails still go out.

## The Netlify variables (Site configuration → Environment variables)

Check that each exists, with Builds and Functions scopes. Don't paste secret values anywhere.

| Variable | New? | If it's missing |
|---|---|---|
| `GOOGLE_BUSY_ONLY_CALENDAR_IDS` | New | **Must be set before the jobs calendar goes free/busy.** Without it the site reads that calendar in full, and loses sight of booked jobs once it is free/busy. |
| `GA4_MEASUREMENT_ID` = `G-P11P7V82FM` | New | No Google Analytics and no consent banner. Not secret. |
| `CLARITY_PROJECT_ID` = `zc5bvd0743` | New | No Clarity. Not secret. |
| `DETAILERS` | New | Elijah only, as today. **The owner decides whether Kris is bookable from launch.** His bookings calendar isn't shared with him yet. |
| `DETAILER_HOMES` | New | Drive time measured from the shop. |
| `GOOGLE_OWNER_AVAILABILITY_ID` | New, optional | Uses the built-in 513 Availability ID. |
| `GOOGLE_CALENDAR_SERVER_KEY` | New, optional | The functions use the browser key. Don't restrict that key until this is set. |
| `GOOGLE_CALENDAR_API_KEY` | Existing, now read by the functions too | The early and late fee falls back to the clock rule. |
| `GOOGLE_OAUTH_CLIENT_ID`, `_SECRET`, `_REFRESH_TOKEN` | Existing | No calendar write; the emails still send. |
| `RESEND_API_KEY`, `RESEND_FROM`, `OWNER_EMAIL` | Existing | No booking or follow-up emails. |

## Steps

1. **You:**
   - Check the variables above.
   - Approve the pull request.
   - **Owner:** say whether Kris takes bookings from day one.
2. **Agent:** opens the pull request `eNov6` → `main` (only with your approval). Netlify builds a **Deploy Preview** on its own.
3. **Agent, on the Deploy Preview:**
   - the build log is green;
   - `node web/scripts/check-live.mjs <preview URL>`;
   - `/js/config.js` carries the calendar and detailer settings;
   - `/golf` and `/prestige` answer 302;
   - "Pick your time" shows real openings.
4. **You or the Owner, one test booking on the preview,** at one of Elijah's times, with dummy details.
   - **It is real:** it writes to the real calendar, sends real email, and blocks that time on the live site too.
   - **Check:** the event and both emails arrive, and the "Help us get ready" answers reach the bottom of the event.
   - **Then delete the event.**
5. **You: merge** with **"Create a merge commit"**, not squash.
   - It keeps the history the docs cite by commit (for example `41cb760`).
   - It gives one clean revert point.
   - Do it in the daytime with the owner at a computer.
6. **The minute the production deploy is published:**
   - **Owner:** set the **513 Auto Clean** calendar to **"See only free/busy"** (Google Calendar → its settings → Access permissions).
   - **Agent:** reload the booking form and confirm real times still show, then run `check-live.mjs`. The "STALE" and "privacy version" warnings should be gone.
7. **Agent, Analytics:**
   - **GA4:** data retention 14 months, Google signals off, ads personalization off; key events `booking_complete`, `booking_request`, `contact_click`; custom dimensions `method`, `kind`, `detailer`, `reason`, `via` and `exp_variant_string` (`docs/ANALYTICS-SETUP.md`, `docs/AB-TESTING.md`).
   - **Clarity:** Balanced masking, and the link to GA4.
   - **Check:** declining loads nothing; accepting shows up in GA4 Realtime.
8. **Later, optional:** set `GOOGLE_CALENDAR_SERVER_KEY`, then restrict the browser calendar key to the site.

## If something goes wrong: rollback

Rollback is **not one click** once the calendar is free/busy. The old site reads that calendar in full, so after a rollback it would stop seeing booked jobs and could double-book.

1. **Netlify → Deploys:** publish the previous `main` deploy (instant).
2. **At the same moment, Owner:** set the 513 Auto Clean calendar back to **"See all event details"**.
3. **Agent, later:** revert the merge commit on `main` (`git revert -m 1 <merge>`), so the next build doesn't bring it back. Only with your approval.

## Known and accepted

- **Old home-page links:** links to old home-page sections (`/#faq`, `/#inquiry`, `/#reviews`, `/#areas`) land at the top of the home page. Those sections are their own pages now.
- **`check-live.mjs` is wrong about keys:** it reports the Stripe and calendar keys as missing on the live site, because the published `config.js` is minified with other quotes. This is a tooling bug, not a site bug.
- **No bot check (Turnstile)** on the booking form yet. The unfinished-booking capture is rate limited.
- **Terms date:** still 2026-09-14; the audit found only the date.
