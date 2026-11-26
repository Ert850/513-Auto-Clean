# Going live with gift cards on (November 26, 2026)

Emmett, November 26: the merge goes live with gift cards **on**. Everything in part A is harmless before the merge (the live site doesn't read these settings yet), so it's done first, while the merge waits for its last checks. No secret value is ever written in this file or in chat: each one goes from the clipboard straight into the dashboard.

Claude opens each form with everything but the secret filled in; Emmett pastes and saves.

## A. Before the merge: live settings

### Stripe, in **live** mode (the test-mode toggle off)

1. **Payment methods** (Settings, Payments, Payment methods): Cards, Link and **Amazon Pay** on. Apple Pay and Google Pay come with Cards. If Amazon Pay isn't on, the checkout falls back to card and Link and logs it, so no sale is lost.
2. **Webhook** (Workbench, Webhooks, Create an event destination):
   - Events from: Your account. Payload style: **Snapshot**. API version: the one offered.
   - Events (5): `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`, `charge.dispute.created`, `charge.dispute.closed`.
   - Endpoint URL: `https://513autoclean.com/api/gift-webhook`
   - Destination name: `Gift cards – live site`
   - Create it, then reveal the **Signing secret** (`whsec_…`) and copy it.

### Netlify (Project configuration, Environment variables): Production values only

| Variable | Production value | Notes |
| --- | --- | --- |
| `STRIPE_WEBHOOK_SECRET` | the live `whsec_…` from step 2 | Edit; Deploy Previews keeps the test one. |
| `GIFT_CODE_SECRET` | `openssl rand -base64 36 \| tr -d '\n' \| pbcopy` | **Also save it in the password manager ("513 gift code secret, live: never change").** Every card's code is made from it: changing or losing it changes every code sold. |
| `GIFT_ADMIN_KEY` | `openssl rand -hex 16 \| tr -d '\n' \| pbcopy` | Save it in the password manager, then share it with Elijah through the password manager (not by text). It opens `/gift-admin`. |
| `GIFT_REBUILD_HOOK` | a build hook URL | Optional, recommended: Build and deploy, Build hooks, Add build hook, name "gift card sale dates", branch `main`. Rebuilds the site the morning after the sale ends (December 26) so the page's own HTML shows full prices. Without it the page still corrects itself in the browser. |

Already checked on November 26 (nothing to do):
- `STRIPE_SECRET_KEY` Production is the live key; Deploy Previews and branch deploys have the test key.
- `STRIPE_PUBLISHABLE_KEY` Production is `pk_live_`; Deploy Previews and branch deploys have `pk_test_`.
- `TEST_SITE_PASSWORD` has a Deploy Previews value only. **A Production value would lock the whole live site behind the password.**
- `RESEND_API_KEY`, `RESEND_FROM`: set for all contexts. `OWNER_EMAIL` is Deploy Previews only, so the live site emails Elijah's default inbox.

## B. The merge

Follow `docs/AFTER-TOLL-FREE-APPROVAL.md` step 3: the photo pairs are done (the 5 candidates were held back for Elijah's better photos; the live build passes), the final validation pass, the test site checks, then PR #13 is marked ready and squash-merged with Emmett's yes.

## C. Right after the deploy

1. The webhook is configured:
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" -X POST https://513autoclean.com/api/gift-webhook
   ```
   `400` (it refuses an unsigned call) means it's set up. `503` means a secret is missing in Production.
2. `/gift-cards` loads, shows 20% off, and a Buy click opens Stripe's page **without** the test-mode badge. Close it there unless doing step 3.
3. Optional, recommended: one real purchase of the smallest card with a real card, to prove the whole live chain (Stripe page, return to `513autoclean.com/gift-certificate`, the buyer and owner emails, Stripe's webhook delivery shows 200, the card on `/gift-admin`). Then refund it in Stripe: the card shows Cancelled. Stripe keeps its fee on a refund (about 30 cents plus 2.9%).
4. In Stripe, the live webhook's deliveries show 200.
5. **513 All Jobs** (the master calendar for GoHighLevel, on with this merge: `ALL_JOBS_CALENDAR_ID` is set for Production): within about 10 minutes of the deploy, Netlify's function log for `jobs-mirror` shows a `[master-cal]` `run` line with no `abort`, and 513 All Jobs holds a copy of each upcoming job (title starting with the detailer's name, Busy). Personal and Free events on the bookings calendars are not copied. If anything looks wrong, empty `ALL_JOBS_CALENDAR_ID` in Production and redeploy: the export stops and bookings are unaffected. Setup and GHL linking: `docs/MASTER-CALENDAR-SETUP.md`.
6. Tell Elijah: the admin key is in the shared password manager entry; scanning a card's QR opens `/gift-admin` with the code filled in.
