# Gift cards: session changes (branch `eNov14`)

The plan and the questions are in `GIFT-CARDS-PLAN-2026-11-23.md` (and its PDF, for Elijah). The build waits for the answers.

## November 23

### Fix: a browser could mark a booking "PAID IN FULL online"
- **What happened:** `send-confirmation` read `mode: "pay_now"` from the request and passed it to the booking check (`wire.ts`), which made it a paid-in-full booking. The calendar event and Elijah's email then said "PAID IN FULL online", and the price took the pay-now discount. Nothing checked a payment. Anyone editing the request in developer tools could book that way. Live on `main` too; it ships with the eNov14 merge (freeze rule: no hotfix).
- **Root cause:** paying in full was switched off only in the browser (`capabilities.ts` `payInFull`), and the server has no webhook or payment id to check, so it believed the browser's word. The browser-side guard named in the switch's comment protects only the honest form.
- **Fix:** `send-confirmation.mjs` counts "pay_now" only while `payInFull` is live. A new test keeps `payInFull` off until the server verifies payments itself, so switching it on can't bring the bug back silently. A rule in CLAUDE.md covers gift cards too.
- **Changed tests:** `still-free.test.ts` used "pay_now" as the example of a paid booking on a taken time. With paying in full off, that request is now refused like any booking on a taken time (409). The paid-booking case returns when payments are verified.
- **Test:** `functions.smoke.test.ts` "a browser saying it paid books a detail still to collect" (fails without the fix, checked), and the full suite: 801 pass.
- **What to test by hand:** none needed. Nothing a customer sees changes: the form never sends "pay_now" while paying in full is off.
- **Until the merge:** Elijah should treat any "PAID IN FULL online" booking as unpaid.

### Mockups: gift card page layouts
- `docs/mockups/eNov23-gift-card-layouts.png`: A, the calculator beside the tiers; B, the calculator below them; and the phone view, the same for both. Real screenshots of the eNov14 build with the page injected. Nothing built.

## November 23, night: the gift card page (layout A, Stripe agreed)

Emmett and Elijah picked Stripe, and layout A with a clearer price display (crossed-out prices). Built on eNov14 behind `config/gift-cards.json`. The checkout itself isn't built: the buy buttons are disabled and the page says "Buying online opens soon".

- **The page, `/gift-cards`:**
  - four tier cards, 2 by 2, beside a calculator;
  - the calculator is also where any amount from $25 to $500 is bought;
  - terms said once under the cards, then three "how it works" steps.
- **Price display** (Baymard's discount research; the screenshot Emmett sent was "very busy and hard to interpret"):
  - the price you pay, big;
  - the card's value, small and struck through;
  - one "Save $X" chip in ink;
  - one "Covers ..." line per card.
  - "Never expires" and the tax note moved off every card, to one list.
  - The "Pay" prefix and the tick list are gone.
- **The "Covers" lines are computed** (`web/lib/catalog/giftCards.ts`): the dearest package a card covers for a car, the sizes it also covers, tax at the highest rate. At today's prices, Elijah's $150 card covers a Basic Exterior and his $250 covers a Basic Interior. The page says so; the tier choice is still his (question E1).
- **"Our pick"** is on the $150 card instead of "Most popular": there are no sales yet to say what's popular. Move it with `featured` in the setting.
- **Top-bar link on every page,** "Gift cards, 20% off". On phones under 420 px it says "Gift cards". It's not on the booking page: beside the location pill it wrapped.
- **Checks:**
  - 817 tests pass (16 new: maths, page, setting, "off" restores, ad-blocker names).
  - The build passes, with 13 pages at clean addresses; `/gift-cards` is in the sitemap and llms.txt.
  - Screenshots at 1440×790, 820, 375 and 320: no sideways scroll, the top bar on one line from 320 to 1440 on every page.
  - The calculator was tried at $300 for each size, $37, $20, $600 and $12.50: amounts out of range fade the results and show the error.
  - Class names, the address and the script name were checked against EasyList, EasyPrivacy, Fanboy Annoyance and uBO: no match.
- **Not done tonight, on purpose:**
  - **The Terms and Privacy wording.** It's legal text, and it ships with the checkout, when money first changes hands. A production build can't publish the page before then.
  - **The booking form's "Have a gift card?" box** (plan step 7). It needs the checkout's card records.
- **What to test by hand:** open `/gift-cards` on the test site. Change the amount and the vehicle in the calculator; try 20 and 600. Check the top-bar link on any page, on a phone too.
- **At the merge:** either the checkout is built and `checkout.enabled` is true, or set `mode` to "off". A production build fails otherwise, by design.

## November 23 to 24, overnight: the Stripe checkout (branch `eNov16`)

Emmett: "Build it", plus three validation passes on the new features and pre-merge passes. Setup: `GIFT-CARDS-SETUP.md`. The post-run report with the open questions: `GIFT-CARDS-RUN-REPORT-2026-11-24.md`.

- **Tiles reworked** (Emmett: the discount wasn't popping, the tile was hard to read). Each tile is the card itself, value big, with a red "20% OFF" badge. Under it: "You pay $40", the $50 struck through in brand red, and "Save $10". On eNov14 and eNov16.
- **Merged eNov14 into eNov16**, then built the checkout there. eNov16 = eNov14 + the payment fixes + the checkout.
- **Built:**
  - `gift-checkout`, `gift-webhook`, `gift-deliver` (hourly), `gift-card`, `gift-admin`, `gift-rebuild`;
  - the purchase form, `/gift-certificate` and `/gift-admin`;
  - terms section 4 "Gift cards" and the privacy entry, dated 2026-11-23 and locked;
  - CLAUDE.md "Gift card payments" rules.
- **Validation pass 1** (two reviewers, backend and pages, 32 findings). Root causes, with the classes fixed:
  - **Trust in one path:** cards were issued only by the webhook. The certificate page now records the card too.
  - **Replayed idempotency keys:** the issue write and admin changes used fixed keys. They're dropped, and `gift_last_req` guards repeats.
  - **Page built for a sale it didn't know the date of:** the page is now built for the build date (`viewAt`) and corrected in the browser both ways; `gift-rebuild` rebuilds on the sale's first day and the day after it ends.
  - **Tokens in addresses:** the session id rides after the `#`, the lookup is a POST, and the certificate page loads no analytics.
  - **Every failure retried forever:** delivery gives up after 3 tries with one alert, refused addresses go to the hourly run, and only Elijah's email failing makes Stripe retry.
  - **Numbers typed in code:** `scheduleDays` and `refundDays` are settings.
  - **Legal text tied to selling, not to cards existing:** it now follows `checkout.enabled`.
  - Plus the layout fixes: the top-bar wrap at 560 to 690, the badge overlap at 1000 to 1080, the phone menu link, the dialog centring, close button, hint and refund line.
- **Validation pass 2** (11 findings):
  - a refused redeem showed as done;
  - a "warning_closed" dispute cancelled the card;
  - a refused recipient email retried for days;
  - tests went red on the sale's start day;
  - the pay button sat below 790 px;
  - admin changes replayed failures;
  - an email promised a later date for a card already sent;
  - a disputed scheduled card was cancelled for good;
  - a new card link in the same tab was ignored.

  All fixed, with tests.
- **Validation pass 3** (8 findings):
  - Resend's rate limit on Christmas morning: paced sends, and "busy" doesn't count as a try;
  - a lost card couldn't be found: lookup by Stripe payment id;
  - admin changes went to whatever code was in the box;
  - errors appeared off screen;
  - resend wording;
  - a typo'd recipient went unnoticed: the address is printed, and the recipient is tried first;
  - a refunded-before-issued card came back;
  - the sale turned at midnight with the form open.

  All fixed, with tests.
- **Pre-merge pass 1** (two reviewers: site regression, and deploy readiness):
  - the phone menu cut Contact Us off once the gift link was added: it scrolls and tightens now;
  - a wrong webhook secret went unnoticed: the hourly run catches stranded cards and warns Elijah;
  - the double-tap key;
  - the eyebrow after the sale;
  - the bundled settings.

  The rest of the site matched eNov14: the same booking prices, folds and links.
- **Pre-merge pass 2** (no-go, but close; 6 findings):
  - the catch-up could stop scheduled sends: it now runs after them, in its own try;
  - the retry key broke Back then Continue: the expiry is in 5-minute steps, and the request is new after Back;
  - the catch-up had no time limit;
  - emails are marked one by one;
  - void cards are skipped and the blame is worded softly;
  - earlier history is kept;
  - the eyebrow spacing.

  All fixed, with tests.
- **Checks:** 872 tests pass, and the build passes. Every function bundles with esbuild as Netlify will build it.
- **What to test by hand:** `GIFT-CARDS-SETUP.md` section 3, on the test site in Stripe test mode.

## Elijah's answers, November 23 (branch eNov16)

What he decided, and what changed:

- **The sale starts now**, not November 27 (`sale.starts` 2026-11-23). The top bar on every page says "Gift cards, 20% off".
- **Any amount to the cent**, $25 to $500 ($119.13 works). The calculator takes cents; the checkout prices it again (`dollarsToCents`, `giftOffer`).
- **No highlighted card** ("a little salesy"): `featured` removed from the setting. The calculator now opens on the largest card.
- **Cards last 5 years, not 1.** He asked for one year; the federal CARD Act says money paid onto a gift card can't expire for at least 5 years (Ohio: 2). Emmett chose 5. Setting `expiryYears`; the build refuses less. The date is written on the card's payment when issued (`gift_expires`), printed on the card, in the emails, on the admin page and in the terms. The admin page refuses an expired card (`expired`).
- **After December 25** the page says: "Our holiday sale has ended, and you can still buy gift cards at full price. Our next sale runs from November 27 to December 25, 2027." From `sale.next`, shown until that day comes. Next year, copy those dates into `starts` and `ends`. The rebuild hook also runs on `sale.next.starts`.
- **Customers don't enter the code anywhere.** The certificate page and emails now say: book as usual, show the card when you pay, and we take it off your total after tax. (They said to type it in "Anything else we should know?" before.)
- **Scanning:** the certificate shows a QR code. Elijah's phone camera opens `/gift-admin` with that code filled in; with his key, the card comes up. Library: `js/qrcode.js` (qrcode-generator 1.4.4, MIT, vendored unchanged).
- **Amazon Pay added** to the checkout (`checkout.methods`). Needs switching on in Stripe. If Stripe refuses it, the checkout falls back to card and Link. The privacy policy names Amazon Pay while it's offered.
- **Not changed, and why:**
  - Indiana's 7% tax waits for the accountant: labor is generally untaxed there, but a job that includes products can be taxed as a bundle.
  - Apple and Google Wallet wait for their accounts.
  - Affirm: Elijah chose to skip it and Klarna (November 24). Taken out of `CHECKOUT_METHODS` and the privacy wording, so the build refuses it in `checkout.methods`.
- **Legal:** terms section 4 now says how long a card lasts. The date moved to 2026-11-25 before the merge (pre-merge review, November 25), and `npm run lock:legal` was re-run.
- **What to test:**
  1. On `/gift-cards`: type 119.13, then 119.135 (refused), then 24.99 (refused).
  2. Buy a card in test mode: Amazon Pay shows if it's on, and the card says "Good through" five years on.
  3. On a phone, scan the certificate's QR code: the admin page opens with the code filled in.
  4. Check the terms, section 4.
- **Checks:** 881 tests pass, and the build passes. The QR code decodes to the admin address (checked in Chrome's BarcodeDetector). The admin page fills the code from a scan.

## November 26: first test purchase on the test site

- **Returned to the live domain's 404 after paying.** Root cause: `siteUrl()` picked the Deploy Preview's address from `DEPLOY_PRIME_URL`, which doesn't reach a function at run time, so it fell back to `URL` (513autoclean.com), where the gift card pages don't exist yet. Fix: `siteUrl(env, host)` takes the request's Host header and uses it only when it's one of this site's Deploy Previews (`deploy-preview-N--513-auto-clean.netlify.app`); the checkout, the webhook (Stripe calls the endpoint the card was bought on) and the admin page's resend pass it. The live site is unchanged: its host isn't a preview, so links stay on `URL`. The hourly run is live-only and keeps `URL`.
- **Also found: the test site had Stripe's live keys.** The test card was declined ("live mode, known test card"), so nothing was charged. Netlify now has the test secret and publishable keys for Deploy Previews and branch deploys; Production keeps the live ones.
- **An empty form works.** Nothing in the buy form is required: with every box empty the card goes to the buyer (Stripe asks their email), Elijah gets his copy, and the certificate opens. Now a test, with exactly what the page sends.
- **404 page:** its red "Back to the site" button had red text, and the other buttons red underlined text. Root cause: the page is a `.legal` section, and `.legal a` outranked `.btn-primary`. Now `.legal a:not(.btn)`. This is on the live site today; it ships with the merge.
- **What to test:** buy a $50 card on Deploy Preview 13 with every box empty: Stripe's page shows Test mode, you come back to the test site's certificate page, and the emails' links open the test site. Open any missing page (`/nope`): three readable buttons.
- **Checks:** 895 tests pass (2 new), and the preview build passes.

## November 26, later: one-click buying, and the tiles' new look (owner approved, `docs/GIFT-TILE-OPTIONS-2.png`)

### The tiles
- The value is on the card, as big as fits (container units: 56 px at 320 wide, 70 to 78 px elsewhere); "GIFT CARD" sits top right where the red "20% off" pill was.
- The price is in the button: "Buy for ~~$250~~ $200", the price you pay the biggest thing in it; "Buy for $250" without a sale. A screen reader hears "Buy a $250 gift card for $200", and the hidden heading says "$250 gift card, you pay $200".
- The price row ("You pay $200 $250 Save $50") and the "Covers ..." line are gone from the tiles. What a card covers is in the calculator only. `coversLine()` and its two tests went with it (nothing else used it), and so did the `.gc-off` pill, its CSS and its show/hide in `js/giftcards.js`.
- `js/giftcards.js` re-prices the tiles (button, its label and the hidden heading) with the same markup as the build when the sale starts or ends after the build. A new test runs the browser script against the build's output for both directions.

### One-click buying
- A Buy click (any tile, or the calculator's) posts `{ value, requestKey }` to `/api/gift-checkout` and opens Stripe in the same tab. No dialog first: `#gcBuy`, its code and its CSS are gone.
- Kept from the dialog: a request key per click, a fresh one after Back from Stripe, one request at a time (a double tap makes one), the reload if midnight turned the sale, and every error message. The clicked button says "Opening the payment page…" and any error shows on one `role="alert"` line under that button; the button comes back as it was. Network failures now say "No connection" whatever the browser's own wording ("Load failed" on Safari used to show through).
- The checkout still accepts gift details (harmless); the page no longer sends them.

### Sending the card after paying
- The card's page (`gift-certificate.html`) has "Send it to someone" under the card and QR: their name, their email (required), right away or on a date (today to `scheduleDays`), from, message. "Email the card" sends it to the new `/api/gift-send` (`netlify/functions/gift-send.mjs`, redirect in `netlify.toml`).
- Shown only while `/api/gift-card` says `canSend` (a plain true or false): the card is active, not expired, nobody has been set for it, and it's within **`sendWindowHours` (new setting, 72)** of the purchase (the Checkout Session's `created`). A 72-hour window covers "I'll decide tonight" and a weekend, while a link forwarded weeks later can't be used to send the card somewhere else.
- `gift-send` checks the details with the checkout's own `giftDetails()` (email required), confirms the session is a paid gift card and records the card (`ensureIssued`), refuses `already_sent`, `expired`, `not_active`, `too_late`, `not_paid`, then writes who it's for onto the payment and either emails them now (the webhook's `recipientEmail`, marking `gift_mail_to` and `gift_deliver: sent`) or leaves it `pending` for the hourly run on the day. A send that fails goes to the hourly run, as the webhook does. Idempotent by the request key (`gift_send_req`); a second send with another key is refused. Rate limited (10 a minute). It takes no price or value, and never returns the buyer's email. Links use the request's host (Deploy Previews link to themselves).
- After a send the form is replaced by "Sent to sam@example.com" or "We'll email it to sam@example.com on Friday, December 25"; on reload the card shows who it's for (with a name) or the day it's going.
- The thank-you line after paying ends with "Want us to email it to someone? Send it." (only while the form is there), and Print becomes a ghost button so the form's "Email the card" is the one red button.
- **Emails:** the buyer's email for a card with no one yet says to forward or print it, or open the card and choose "Send it to someone" by a deadline (see the review fixes below). A card bought with a recipient (old flow, API) keeps the old wording. Elijah's email says "Not sent to anyone yet". Sends from the card's page don't email Elijah; they're in the card's history (`gift_log`).
- **How it works** step 2 now reads: "To you right away, with a certificate to print or forward. After you pay, you can also have us email it to them, now or on a date you pick."

### Fix: an impossible date passed the checks
- **What happened:** `giftDetails()` accepted "2026-13-01": it matches the pattern and sorts between today and the last allowed day as text.
- **Root cause:** the date was checked by its shape and string order only, never as a real day.
- **Fix:** it must be a real calendar day (`Date.parse` and back). Test in the gift-send suite.

### Legal
- No change needed. The privacy policy already lists the recipient's name and email, the message and the day "if you give them" without saying where, and that stays true. Dates not bumped.

### What to test on the test site
`docs/GIFT-CARDS-SETUP.md`, section 3, has the steps. In short: one tap on a tile goes straight to Stripe; Back from Stripe leaves a working page; after paying, send the card to a second address right away (one email, form replaced, gone on reload), and on another card pick a date (nothing today). Check the buyer's email mentions "Send it to someone" and Elijah's says "Not sent to anyone yet".

### Checks
- 909 tests pass (895 before: 14 new for gift-send and its setting, 1 for the browser markup, 1 smoke entry for `gift-send`; the 2 `coversLine` tests removed).
- Preview build passes. Headless Chrome on the preview: tiles at 1440, 820, 375 and 320 (no sideways scroll, button words fit); a Buy click posts `{ value, requestKey }` only, shows the busy state, ignores a double tap, shows each error under the clicked button and restores it, and goes to the returned URL; Back restores the button. The certificate page with a faked card shows the form, refuses an empty or bad email and a date past the range without calling the server, shows a server refusal, and replaces the form with the confirmation; with `canSend` false there's no form and Print is red again. No console errors besides the faked failures.

### Review fixes (independent review, same day)
- **Two sends could both email (race).** Root cause: once-per-card rested on writing the claim and reading the card back; two requests that both passed the check before either wrote (A checks, B checks, A writes, A reads, B writes, B reads) each saw their own claim and both emailed, and two copies of the same request both passed the "already done" check. Fix: the claim is written with a Stripe idempotency key per payment (`gift-send-claim:<payment>`) and a fresh nonce in its body, so only the first request ever writes it. Another body under the key gets Stripe's idempotency error: the card is read and the answer is `already_sent`, or the same send when the request key matches. A claim still being written answers `busy` (409) and the page asks again with the same key a moment later, without showing "Sent". The test stand-in now behaves like Stripe's idempotency (same key and body: the first answer; another body: an error; in progress: 409), and the race tests fail without the key (checked).
- **"Sent" shown when nothing went.** Root cause: a request that had claimed the card but failed after (a lost answer, a timeout) was answered on retry from the claim alone. Fix: the answer says `retrying` (with the hourly run's hours) unless the card is marked sent or set for a later day. The page then says "It's on its way to … If it can't go right now, we try again each hour from 8 AM to 6 PM, Cincinnati time." The hours come from `RUN_HOURS_UTC` in `gift-deliver.mjs`, read on that day's clock (9 AM to 7 PM in daylight time), and a test checks they match `netlify.toml`'s schedule.
- **A second email after a failed write.** Root cause: if Resend took the email but marking the card sent failed, it stayed "now" and the webhook or the hourly run would email it again. Fix: the mark is tried twice; the claim writes `gift_send_started`, and the webhook and the hourly run leave a "now" card claimed in the last `SEND_CLAIM_HOLD_MS` (10 minutes, not said to customers) to the page. After that the hourly run sends a card the page never sent.
- **A typo'd address couldn't be fixed.** The confirmation now ends "Wrong address? Contact us." (Elijah resends from `/gift-admin`).
- **The emails counted the window from the email, and could say "1 hours".** The buyer's email now gives the deadline as a Cincinnati time and date from the purchase plus the setting, rounded down to the hour: "by 12 PM on Friday, December 4".
- **Page:** after a send the card's face shows "For Sam, from Alex" and the message straight away, and Print is the red button again. On `/gift-cards`, if the browser refuses the payment page's address, the button comes back with the error.
- **What to test on the test site (adds to the steps above):** double-tap "Email the card": one email. After a send, the card face shows the name and the confirmation has "Wrong address? Contact us." The buyer's email gives a "by …" time and date about three days after buying.
- **Checks:** 916 tests pass (7 new: both races, the lost answer, the failed mark, the deadline wording, and the hourly run's hours against `netlify.toml`). Preview build passes. Headless Chrome at 1440 and 375: two `busy` answers then success sends three requests with the same key and ends on "Sent to …"; a `retrying` answer shows the hourly wording; a 502 asks to try again; the face and Print update without a reload; no sideways scroll; a refused payment address restores the tile button.

