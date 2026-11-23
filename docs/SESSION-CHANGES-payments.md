# Payment code fixes (November 23, branch eNov16)

The payment issues P2 to P11 from the November 23 review (`docs/GIFT-CARDS-PLAN-2026-11-23.md`, section 1). P1 was fixed before this session. Payments stay off: no switch was turned on, and the booking form still says "Nothing to pay today". These fixes make the code right for the day `cardOnFile`, `payInFull` or `digitalWallets` is switched on.

Tests: `web/lib/payments.test.ts` (13 tests). Each was checked by putting the old line back: every one of them fails without its fix. Stripe is replaced by a recorder and fetch is stubbed, so nothing reaches Stripe, PayPal or anyone else. `functions.smoke.test.ts` switches the payment switches on only around the calls that test code past the new switch check.

## P2: the card form could stay on "Loading payment options..."

- **Root cause:** `mountPayment()` returned whenever `root._stripe` existed. A full `render()` draws a new `#bkPayMount`, and the Stripe element left the page with the old one, but `root._stripe` still pointed at it. Choosing "pay now" after "pay later" is a render, so the screen sat on "Loading payment options..." for good, and Confirm used the old card-only form that was no longer on screen. Likely the September "form never appeared on phones" bug. A second way in: an answer from `create-payment` arriving after a redraw (or after the box was unticked) became the form Confirm used.
- **Fix:** `root._stripe` remembers its mount, and only a form in the current mount counts (`js/funnel.js` `mountPayment`). Each `create-payment` request has a number (`payMountSeq`); a late answer, or one for a mount no longer on the page, is dropped.
- **Test:** "a full redraw gets a new card form", "an answer that arrives after a redraw never becomes the form Confirm uses".
- **By hand, when switched on:** on a phone and on a laptop, pick pay later, tick the authorization, wait for the card form, switch to pay now, add an add-on: the form reloads every time, and Confirm charges the pay-now amount.

## P3: the same Stripe idempotency key for different requests

- **Root cause:** the browser's one key per booking (`bookingKey()`) went to Stripe as it was, for every `create-payment` call. Stripe refuses a key it has seen with other parameters or on another endpoint, so after pay later (a SetupIntent) the pay-now PaymentIntent, or any changed cart, could never get a form in that booking.
- **Fix:** `netlify/functions/_requestkey.mjs` `requestKey()`: the booking's key, what is being created (`customer`, `payment`, `setup`, `order`) and a hash of the exact parameters. A retry of the same request keeps its key; a changed cart or mode gets a new one.
- **Test:** "a retry keeps its key; a new mode or cart gets a new one".
- **By hand:** switch pay later to pay now and back in one booking: no `idempotency_error` in the function log.

## P4: Cash App, Klarna and Affirm lose the booking on return

- **Root cause:** `automatic_payment_methods` offered whatever the Stripe dashboard had on. Methods that leave the page come back to `/#book?payment_intent=...`, and nothing there finishes the booking: money taken, no booking, no email.
- **Fix, the simpler one of the two:** the intents list their methods, `card` and `link` (`PAYMENT_METHODS` in `create-payment.mjs`). Card carries Apple Pay and Google Pay; Link pays inside the form. Neither ever redirects with `redirect: 'if_required'`. The other option (save the pending booking and finish it on return) means new storage, a return handler and a way to recover a booking whose return never comes; it is worth building only if a redirect method is wanted.
- **Cost:** a new method in the dashboard no longer appears by itself; it is a code change. Klarna can't be used for gift cards anyway (plan, item 5).
- **Test:** "offers only methods that finish on the page".
- **By hand:** Link must be on in Stripe (Settings, Payment methods), or Stripe refuses the intent (the 502 carries Stripe's code). The form shows card, Apple Pay in Safari with a Wallet card, Google Pay in Chrome, and Link; no Cash App, Klarna or Affirm tab.

## P5: a bank debit still processing was recorded as paid

- **Root cause:** Confirm treated "no error" as paid. A bank debit (ACH) comes back `processing` and can fail days later.
- **Fix:** only a `succeeded` PaymentIntent or SetupIntent counts (`submit()` in `js/funnel.js`). Anything else keeps the form open with "That payment has not gone through yet, so your booking was not sent." With P4 only card and Link are offered, so this is a backstop.
- **Test:** "a payment still processing is not recorded as paid", "a payment that succeeded is".

## P6: PayPal idempotency, and the sandbox by default

- **Root cause:** no `PayPal-Request-Id` on create or capture. A create retry made a second order (not a second charge: each order needs its own approval). A capture retried after a lost answer got `ORDER_ALREADY_CAPTURED`, so the customer was told the payment failed while the money was taken. The review's "charges twice" overstates it; this is the real effect. Separately, anything but `PAYPAL_ENV=live` meant the sandbox, so live keys with the variable forgotten talked to the sandbox, and the only sign was a PayPal button that never worked.
- **Fix:** create sends `PayPal-Request-Id` from `requestKey()` (the browser now sends its booking key); capture sends `capture-<order id>`. `PAYPAL_ENV` must be `live` or `sandbox`: otherwise nothing is sent, the function answers 502 and logs "PAYPAL_ENV must be live or sandbox". A 401 from PayPal logs a hint that the environment may not match the keys.
- **Test:** "creates and captures with PayPal-Request-Id, stable on a retry", "without PAYPAL_ENV it runs nowhere".
- **By hand:** set `PAYPAL_ENV` in Netlify along with the keys. A sandbox purchase, then the same with the network cut during capture and retried: one capture.

## P7: the payment functions ran with their switches off

- **Root cause:** `create-payment` and `paypal-order` checked only for their keys. With a key set and the switches off (today's state on the test site), anyone could create Stripe customers and intents, or PayPal orders, while the site said no card is taken.
- **Fix:** each answers 503 `off` unless its switches are on, by the same test as the booking form: a card needs `cardOnFile`; paying in full needs `payInFull` too; PayPal needs `cardOnFile`, `payInFull` and `digitalWallets` (it is only shown inside the pay-now card box).
- **Test:** the three "refuse while their switches are off" tests.
- **Recorded, not changed:**
  - Turnstile lets a request through when Cloudflare can't be reached (`_turnstile.mjs`). That's a choice so a Cloudflare outage doesn't stop bookings; the rate limit and the amount ceiling still apply.
  - `botCheck` is off (no Turnstile keys).
  - The rate limit lives in one function instance's memory, so it's a speed bump, as its own comment says.

## P8: Stripe customer matched by phone, and created without a key

- **Root cause:** `customers.search` by the phone typed into the form reused the first match. Nobody checks that phone, so a booking could attach its card and payment to someone else's customer. The create that followed had no idempotency key, so retries made duplicates.
- **Fix:** a new customer per booking, created with `requestKey(..., "customer", ...)`: a retry of the same booking gets the same customer.
- **Cost (owner):** a returning customer has one Stripe customer per booking. Search by name or phone in the dashboard still finds them all.
- **Test:** "a new customer per booking, never one found by phone, created with a key".

## P9: the total charged and the total emailed can differ. Deferred

- **Real:** `create-payment` prices when the card form loads; `send-confirmation` prices again at Confirm (`Date.now()`). If a rush window boundary passes in between, the charge and the email disagree. Only for pay now, which is off, and which the server ignores while `payInFull` is off (P1).
- **Why deferred:** the right fix is the server-side payment check that must come before `payInFull` is switched on anyway: send-confirmation looks up the PaymentIntent or PayPal capture by id, and writes the email's total from it. Pricing the email from a time the browser sends would let a browser choose its own rush fee. The test that keeps `payInFull` off now says so.

## P10: nothing checked the publishable key

- **Root cause:** `render-config.mjs` wrote `STRIPE_PUBLISHABLE_KEY` into the public `js/config.js` as it was, and `netlify.toml` tells the secret scanner to skip that variable. A secret key pasted into that slot would have been served to every visitor.
- **Fix:** the build fails if the value doesn't start with `pk_`, saying "looks like a SECRET key, roll it" for `sk_` or `rk_`. It never prints the value, and writes nothing.
- **Test:** "fails the build without printing the key, and writes nothing" (runs the script with a fake `sk_live_` value).

## P11: dead code and stale docs

- Deleted `web/lib/stripe/client.ts`: nothing imports it (checked with `git grep`). The `stripe` package stays: `create-payment.mjs` uses it.
- Left `web/lib/db/` (and `drizzle-orm`, `drizzle-kit`): nothing imports it, but it is for the planned database (`bookingLink`).
- `docs/LAUNCH-CHECKLIST.md`: `cardOnFile` is off, not live (so four of the table's nine are live). The test-key steps said to paste the publishable key into `js/config.js`, which is generated; it goes in Netlify as `STRIPE_PUBLISHABLE_KEY`. The PayPal section names `PAYPAL_ENV`.
- `SETUP.md` and `web/.env.example`: `STRIPE_PUBLISHABLE_KEY`, not `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`. `.env.example` lists the PayPal and Turnstile variables.

## Before switching payments on (in order)

1. The server-side payment check (P1, P9), then change the test "paying in full stays off until the server checks the payment itself".
2. Link on in the Stripe dashboard (P4), and `PAYPAL_ENV` set if PayPal is used (P6).
3. Turnstile keys and `botCheck` (P7).
4. The hand tests above, on a phone first (P2).
