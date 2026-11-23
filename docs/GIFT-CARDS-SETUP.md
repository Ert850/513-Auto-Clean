# Gift cards: switching on the Stripe checkout

The code is on branch `eNov16`. It takes no money until these steps are done. Each step needs Elijah's (or Emmett's) own login, so none of them were done for you.

## 1. Stripe (dashboard.stripe.com, the business's account)

1. **Payment methods:** make sure Cards, Link and **Amazon Pay** are on (Settings, Payments, Payment methods), in test mode and in live mode. Apple Pay and Google Pay come with Cards.
   - The checkout offers what `config/gift-cards.json` `checkout.methods` lists. If one isn't switched on, Stripe refuses it and the checkout falls back to card and Link (the function log says so), so a sale is never lost; Amazon Pay just won't show.
   - Affirm can be added later (Elijah to decide): add `"affirm"` to `checkout.methods` and switch it on. About 6% a sale, $50 minimum, and gift cards must stay under 25% of yearly sales.
   - Not offered, by the providers' own rules: Klarna (restricts gift cards), Afterpay and Cash App Pay (ban them). PayPal through Stripe is only for businesses in Europe.
2. **Webhook:** Developers, Webhooks, Add endpoint.
   - Test site, in test mode: `https://deploy-preview-13--513-auto-clean.netlify.app/api/gift-webhook`. Deploy Preview 13 builds whatever its PR's branch holds, which is `eNov14` today. The checkout is on `eNov16`: first push `eNov16` and fast-forward `eNov14` to it, or open a new draft PR for `eNov16` and use its preview number instead.
   - Live, at the merge: `https://513autoclean.com/api/gift-webhook`
   - Events:
     - `checkout.session.completed`
     - `checkout.session.async_payment_succeeded`
     - `charge.refunded`
     - `charge.dispute.created`
     - `charge.dispute.closed`
   - Copy the endpoint's **Signing secret** (`whsec_...`).
3. **Receipts (optional):** Settings, Customer emails, "Successful payments". Stripe then also sends its own receipt. Our email already says what was paid.

## 2. Netlify (Site configuration, Environment variables)

| Variable | What | Where |
|---|---|---|
| `STRIPE_SECRET_KEY` | already used by the booking form's payment code | test key (`sk_test_`) for Deploy Previews, live key for Production |
| `STRIPE_WEBHOOK_SECRET` | the endpoint's signing secret from step 1 | one per endpoint: the test one for Deploy Previews, the live one for Production |
| `GIFT_CODE_SECRET` | makes every card code. At least 32 random characters. **Never change it once a card is sold**: every code would change | the same value in every context that shares cards (Production). A different one for previews is fine |
| `GIFT_ADMIN_KEY` | Elijah's key for `/gift-admin`. At least 16 characters | Production (and previews to test) |
| `RESEND_API_KEY`, `RESEND_FROM`, `OWNER_EMAIL` | already set for the booking emails | unchanged |
| `GIFT_REBUILD_HOOK` (optional) | a Netlify build hook (Site configuration, Build &amp; deploy, Build hooks). The site rebuilds itself on the sale's first day and the day after it ends, so the page's HTML matches the checkout. Without it the page still corrects itself in the browser | Production |

Make a random secret on a Mac:

```bash
openssl rand -base64 36
```

Without `STRIPE_WEBHOOK_SECRET` or `GIFT_CODE_SECRET`, the checkout refuses to open, so nobody pays for a card that can't be issued.

**Two checks that matter:**
- **A wrong `STRIPE_WEBHOOK_SECRET`** (say the test one in Production) isn't caught at checkout. The card is still recorded when the buyer lands on the certificate page. Within the hour, the hourly run sends the missing emails and tells Elijah to check the webhook. After going live, open the webhook in Stripe and check that its deliveries show 200.
- **`TEST_SITE_PASSWORD` must be set for Deploy Previews only.** The password gate ships with this merge. With a Production value, every page of 513autoclean.com would ask for the password.

## 3. Test on the test site, in Stripe test mode

1. Open `/gift-cards` on the test site. The prices show 20% off only between the sale's dates (November 27 to December 25, Cincinnati time); before that they show full price.
2. Buy the $50 card with the test card `4242 4242 4242 4242`, any future date and any CVC. Put your own second email as "Their email".
3. Expect:
   - the certificate page with the code;
   - an email to you, one to the second address, and one to `OWNER_EMAIL`;
   - in Stripe's test dashboard, the payment's metadata shows `gift_status: active`.
4. Try "On a date" with tomorrow's date: no email to them today. Scheduled sending runs only on the live site, at 8 AM Cincinnati time.
5. On `/gift-admin`, with `GIFT_ADMIN_KEY`, look up the code, take $10 off, then check the history.
6. Refund the test payment in Stripe: the card shows "Cancelled" on `/gift-admin`.

## 4. At the merge

- `config/gift-cards.json` has `checkout.enabled: true` on `eNov16`. A production build fails if gift cards are on while the checkout is off.
- The terms (section 4, Gift cards) and the privacy policy (Stripe for gift cards) are dated November 23, 2026 and appear only while gift cards are sold.
- After the sale: with `GIFT_REBUILD_HOOK` set, the site rebuilds itself on December 26 at full prices. Set `mode` to `"regular"` (keep selling at face value) or `"off"` whenever you like after that.
- **Keep `checkout.enabled` true once a card has been sold.** It keeps the gift card terms and the privacy entry for Stripe on the site while cards are out, even with `mode` "off". Cards already sold keep working either way: the certificate and `/gift-admin` stay.
