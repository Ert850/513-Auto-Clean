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
