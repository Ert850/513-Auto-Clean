# Holiday gift cards: review, research and build plan (November 23, 2026)

**For:** Emmett and Elijah, before the build starts. Only one change has been made: the "paid in full" fix (item 6, on the test branch). This plan merges two reviews:
1. a read-only review of the payment code already on the site;
2. research on gift card platforms, tax, gift card law, the backend, and page design.

I checked the main claims in the code myself (prices, tax rates, the freeze, the "paid" bug). This is not legal or tax advice: items marked **[accountant]** need a professional's answer.

## The short version

1. **The live site is frozen** (toll-free verification, `PLAN-eNov14.md`). A gift card page built today can't reach 513autoclean.com by Black Friday (Friday, November 27) unless the freeze ends first. So launch day has to run on a **checkout page hosted by the payment provider**, linked from the past-customer email and the Meta ad. The site's own page ships with the eNov14 merge.
2. **The main decision is the platform: our own Stripe build (Emmett's lean) or Gift Up,** a gift card service on the business's Stripe account. Section 6 compares them side by side.
   - **Stripe build:** about 3% in fees and records we own. It takes 4 to 6 days, can't take orders through our site until the freeze ends (so Black Friday runs on Stripe Payment Links), and wallet passes come weeks later.
   - **Gift Up:** ready in about a day, works during the freeze, and includes wallet passes. It costs about 6.5 to 7%, roughly $35 more per $1,000 sold, and the records live with Gift Up.
   - **Third option, not recommended:** GoHighLevel's own gift cards. They're cheap, but have no wallet passes, and selling a $50 card for $40 isn't documented.
3. **Elijah's "covers" lines are wrong at the site's prices.** The site charges $145 for Basic Interior and $235 for Full Interior, on live and on eNov14. With tax:
   - $150 doesn't cover a Basic Interior: $156.31 for a car in Hamilton County.
   - $250 doesn't cover a Full Interior: $253.33.

   His numbers fit $135 and $225, which is what he said today's prices are (November 12 answers). **Which prices are real decides the tiers.** See question E1.
4. **Tax is charged once.** Selling a gift card isn't taxed in Ohio (Adm. Code 5703-9-15) or Kentucky. Tax is added when the card is used, on the full service price. The code must treat a gift card as **a payment after tax, never as a promo code**: promo codes lower the taxable amount in `quote.ts`.
5. **Klarna can't be offered.** Its rules prohibit gift card purchases, and it costs 5.99%. Card, Apple Pay, Google Pay, Link and Cash App Pay work through Stripe. PayPal works through Gift Up.
6. **Found in the existing payment code, live today:** the booking server believes the browser when it says "paid in full". Anyone who edits the request in the browser's developer tools can book a detail that the calendar and Elijah's email show as **PAID IN FULL online**, with the pay-now 5% off.
   - I confirmed it: `send-confirmation.mjs:654` and `web/lib/pricing/wire.ts:377`.
   - No money moves. The risk is that Elijah trusts the label and doesn't collect.
   - **Fixed on the test branch (eNov14), November 23,** with tests. It reaches the live site with the merge. **Until then:** treat any "PAID IN FULL online" booking as unpaid, because no online payment is switched on.

## 1. The payment code already on the site

**The conclusion: online payment is off, on live and on eNov14 alike.** Customers pay after the detail. The Stripe and PayPal code is still in the repo, but the browser never loads it. That code is tied to booking a detail, so a gift card sale can't reuse it.

**What happened before ("it kinda worked"):**
- **September 10:** built.
- **September 13:** Stripe never loaded on the page. Then Stripe refused the secret key.
- **September 14:** a new key worked. The same day, pay-now was switched off: on phones the payment form sometimes never appeared, yet the booking was recorded as paid in full. Card-on-file followed.

**Issues found:**

| # | Severity | What | Where |
|---|---|---|---|
| P1 | High, live | The server takes "paid in full" from the browser, with no webhook and no payment id to check | `send-confirmation.mjs:654`, `wire.ts:377` |
| P2 | High | The payment form can get stuck after the screen redraws (likely the September "never appeared" bug) | `funnel.js:6170` |
| P3 | High | The same Stripe idempotency key is reused for different requests: switching pay later to pay now fails | `funnel.js:6292`, `create-payment.mjs:111-150` |
| P4 | High | A payment that leaves the page (Cash App, Klarna, Affirm) is lost on return: money taken, no booking | `funnel.js:7240` |
| P5 | Medium | A bank payment that hasn't cleared is recorded as paid | `funnel.js:7247` |
| P6 | Medium | PayPal has no idempotency id, so a retry can charge twice. It also uses the sandbox unless `PAYPAL_ENV=live` | `paypal-order.mjs:33,107,135` |
| P7 | Medium | The payment functions run whenever their keys are set, even with the switches off. Turnstile is off, and the rate limit is in memory only | `create-payment.mjs:51`, `_ratelimit.mjs` |
| P8 | Low | The Stripe customer is matched by phone number, and retries make duplicate customers | `create-payment.mjs:121` |
| P9 | Low | The total charged and the total emailed can differ if a rush window passes in between | `send-confirmation.mjs:672` |
| P10 | Low | Nothing checks that the "publishable" key really starts with `pk_`, and the secret scanner skips that variable | `render-config.mjs`, `netlify.toml:48` |
| P11 | Low | Dead code (`web/lib/stripe/client.ts`, `web/lib/db/`) and stale docs (`LAUNCH-CHECKLIST.md:34`, `.env.example:29`, `SETUP.md:76`) | |

P2 and P3 were found by reading the code, not reproduced in a browser. P2 to P6 only matter if booking payments are switched back on, so they aren't part of the gift card work. They're recorded here for that day.

**For gift cards:**
- **Reuse:** the Resend email sender and its HTML escaping, the rate limit (as a speed bump), Turnstile, the config pattern (keys in Netlify; empty means off), and the switches that keep the terms and privacy policy in step with what the site does.
- **Don't reuse:** the booking payment flow, or the "pay_now" flag as proof of payment.

## 2. Tax and the law

**Sales tax:**
- Ohio taxes detailing (ORC 5739.01, as `tax.ts` already applies).
- **The gift card's sale isn't taxed. When the card is used, tax is on the service price before the card is applied** (Ohio Adm. Code 5703-9-15; Kentucky DOR, Sales Tax Facts, December 2011). That's the "you won't pay tax twice" promise. Wording: "No tax when you buy the card. Sales tax is added to the service when the card is used, like any payment."

**[accountant] questions:**
1. Ohio has taxed vouchers sold below face value on their full value. The simple choice is to tax the full service price at redemption, as the site does today.
2. Gift card money is owed service until it's used (a liability), not revenue. Booked as revenue on the sale *and* in the job's `TOTAL:`, it's counted twice in Elijah's Accounting sheet. A gift-card job keeps `TOTAL:` as the job's price and gets a separate "Gift card" payment line (agreed with Elijah: the JobsSync rule).
3. **Not gift cards, but found on the way:**
   - The site charges 7% on Indiana jobs, though Indiana generally doesn't tax services (IN DOR bulletin #89). This may be over-collection.
   - Kentucky's tax on mobile detailing after HB 8 (2022) is unconfirmed.

**Gift card law:**
- **Ohio, ORC 1349.61:** a card must be valid at least 2 years, with no fees for 2 years.
- **Federal, Reg E 1005.20:** the paid funds can't expire within 5 years, and the card must state its expiry or say it has none.
- **Recommendation: the whole card (bonus included) never expires and has no fees.** Splitting it into $40 paid plus a $10 "promotional" part that expires is legal, but it means two balances, two disclosures and confused customers.
- **Unclaimed property:** Ohio's ORC 169.01 leaves out cards that can only buy services, so keep it **not redeemable for cash**. Kentucky's rule is unconfirmed [accountant].
- **"Won't come back":** write "This holiday only, through December 25", not "never again". The second becomes a false claim if the offer returns next year. No countdown tricks and no invented limits.

## 3. Platforms compared

| | Fees on a $40 card | Wallet, PDF, scheduled send | Balance and use on the day | Setup | Catch |
|---|---|---|---|---|---|
| **Gift Up** on our Stripe | about $2.86 (7%) | all three | phone app, partial use | half a day | Balances live in Gift Up |
| **GoHighLevel** gift cards | about $1.46 (3.7%) + any GHL fee | PDF and schedule, **no wallet** | GHL app | half to one day | $50 for $40 undocumented; Imperion runs the account |
| **Square eGift** | about $2.87 (7%) | Apple Wallet; Google unclear | Square app | half a day | Only worth it if Elijah already takes cards with Square |
| **Our own Stripe build** | $1.46 (3.7%) | PDF and email; wallet needs Apple and Google accounts and reviews | ours to build | 4 to 6 days | Can't go live during the freeze |

Fees and features are from each provider's own pages (sources at the end). Gift Up's hosted link with no site code, and its CSV export, are unconfirmed until the account exists.

**Breakage:** published estimates of unused cards run about 3 to 10% (Milliman: about 10%). That won't pay for a 20% discount on its own. The real gains are cash now and new customers (the recipients).

## 4. The build plan

### Phase 0: before Black Friday, no site change

Elijah creates the accounts himself. Each needs his login, his bank details and his acceptance of the terms, so none of these are steps I take.

**If Stripe (our own build):**
1. Check the Stripe account is verified for live payments and pays out to the business bank account.
2. In Stripe, make four Payment Links, one per tier, at the sale price:
   - Klarna off; card, Apple Pay and Google Pay on;
   - collect the buyer's email, plus custom fields for the recipient's name and a message;
   - after payment, show "Your gift card arrives by email within 24 hours".
3. Cards are sent by hand from a template, or issued by our code once it ships (A2).
4. I write the past-customer email and the ad copy, pointing at the Payment Links with `utm_source=email` or `meta`. Mass texts wait for A2P; emails need an unsubscribe link.

**If Gift Up:**
1. A Gift Up account, connected to the business's Stripe account.
2. Set up in Gift Up:
   - the tiers (E1) and a custom amount, $25 to $500;
   - the 20% as "extra credit" (25% of the price paid), Nov 27 to Dec 25, 11:59 PM Eastern;
   - no expiry and no fees; Klarna off;
   - our terms wording (section 5).
3. The same email and ad copy, pointing at Gift Up's checkout.

**Redemption until the merge, either way:** the customer types the code in the booking notes or shows the card. On the day, Elijah marks it used (Gift Up's app, or our sheet or page) and collects the rest.

### Phase 1: on eNov14 today, behind `config/gift-cards.json`

| Step | What | Check |
|---|---|---|
| 0 | **Done, November 23. Fix P1:** the server ignores "pay_now" while `payInFull` is off, and a test keeps `payInFull` off until the server checks payments itself | `functions.smoke.test.ts`, `still-free.test.ts`: a hand-made pay_now request books as "TO COLLECT" (801 tests pass) |
| 1 | `config/gift-cards.json`: `mode` (`sale`, `regular` or `off`), `saleStarts`, `saleEnds`, `tiers` (face value, sale price, popular), custom min and max, checkout links | Flipping `mode` to `off` restores every page byte for byte (temporary-campaign rule) |
| 2 | **"Covers" lines computed at build** from the catalog, the size upcharges and the highest tax rate. Never typed. The build fails if a tier's line stops being true | A test that changes a price and watches the line change or the build fail |
| 3 | **`gift-cards.html` at `/gift-cards`:** the CHROME markers, `CHROME_PAGES`, `FILES`, `PAGES`, the sitemap while it sells (otherwise noindex), and a clean address | `seo-audit.test.ts`, `chrome.test.ts`; one h1 |
| 4 | **Page content** in the site's own components (`.svc-card` tiers; `gc-` class names checked against EasyList). See section 5 | Mockups first (UI rule), then 1440×790, 820, 375 and 320 |
| 5 | **Calculator,** "What would a card cover?": amount plus vehicle size. It reads the pricing bundle already on every page, so the numbers match the booking form | Same answer as the booking form for every package and size |
| 6 | **Links, during the sale only:** the dark top bar, the home offers banner, footer Explore, the booking confirmation email. Not the nav, not the hero | Nav width sweep 700 to 1500 px |
| 7 | **Booking form:** a folded "Have a gift card?" box that stores the code and leaves the quote alone. The email and calendar get a `GIFT CARD:` line with the last 4 characters; `TOTAL:` is unchanged | `jobs-sync-contract.test.ts` still passes; Elijah agrees the line |
| 8 | **Terms and privacy:** gift card terms; the privacy policy names Gift Up and Stripe. New legal date, `npm run lock:legal` | `terms.test.ts`, `privacy.test.ts` |
| 9 | Log in `SESSION-CHANGES-giftcards.md`; validation pass and dropped-task check | |

**Later, optional:** a `gift-check` function that reads the balance from Gift Up's API and shows "due on the day" in the booking form (API scope unconfirmed).

**If you choose our own Stripe build instead (option B),** Phase 1 adds:
- a Stripe Checkout session function (the price set by the server from the config, payment methods listed so Klarna never shows);
- a signed webhook, checked against the raw body and idempotent on the session id;
- card records in Netlify Blobs (strong consistency, never written from previews), with only an HMAC of each code stored;
- codes like `513-XXXX-XXXX-XXXX`;
- a pdf-lib certificate, and emails through Resend;
- a `/gift-admin` page for Elijah (secret link plus PIN) to look up, redeem and void cards;
- fraud limits: Radar, Turnstile, $500 per order, about 3 orders per email a day.

Wallet passes would come weeks later, after Apple Developer ($99 a year) and Google issuer reviews. That's 4 to 6 days of work against about half a day for Phase 1 with Gift Up.

## 5. The page (mockups come before the build)

**Order of the page:**
1. A compact head:
   - eyebrow "Holiday gift cards";
   - the title (draft: "Give a car that feels new again");
   - one line: "20% off every gift card, through December 25", stamped from config.
2. **The tier cards:**
   - face value large, "You pay $X", one computed "covers" line, and a button to that tier's checkout;
   - "Most popular" on the interior tier;
   - plus a custom amount card;
   - four across from 1000 px, two on tablets, stacked on phones.
3. A small preview of the card: logo, value, To and From.
4. **The calculator,** beside the tiers on wide screens and below them on phones:
   - it lists what an amount covers (tax included, before any travel fee beyond the free minutes, stamped from `freeMinutes`);
   - it shows the nearest package just out of reach: "$X more covers a Full Interior".
5. How it works, in 3 steps: buy; it's emailed now or on a date you pick; they book and enter the code.
6. A short FAQ:
   - it never expires;
   - no tax when you buy it, tax on the service when it's used;
   - it works on any service, add-ons, travel and tax, over several bookings;
   - lost cards are resent;
   - not cash.
7. The Google score, stamped from `data/reviews.json`.

**Terms draft (no em-dashes):** "You pay $40 and get a $50 gift card. The whole $50 never expires and has no fees. Use it on any 513 Auto Clean service, add-ons, travel and sales tax, over as many bookings as you like. No sales tax when you buy the card; tax is added to the service when the card is used. Not redeemable for cash. Unused cards can be refunded within 30 days for the amount paid. 20% off ends December 25, 2026." Every amount and date in it is stamped from config.

**No physical cards** (Elijah cut them). No new photos (on hold).

## 6. Questions

### The main decision: Gift Up or our own Stripe build

**Emmett leans toward our own Stripe build.** Both take payment through the business's own Stripe account; the difference is who issues and tracks the cards.

| | **Gift Up** (a gift card service on our Stripe) | **Our own Stripe build** |
|---|---|---|
| What the buyer sees | Gift Up's checkout, in our page or on its own page | Stripe's own checkout page, then our emails and certificate |
| Fees | About 6.5 to 7% (Gift Up 3.49% plus Stripe) | About 3 to 3.7% (Stripe only) |
| On $10,000 of cards | About $650 to $700 | About $300 to $370 |
| Ready | About a day | 4 to 6 days of building and testing |
| Black Friday during the freeze | Works: it's hosted by Gift Up, so the frozen site doesn't matter | Our code can't go live until the freeze ends. Until then: Stripe Payment Links, with cards issued by hand or once the code ships (below) |
| Email, PDF certificate, recipient and date | Included | We build them (Resend and a PDF made in the function) |
| Apple and Google Wallet | Included | Weeks later: an Apple Developer account ($99 a year) and Google's issuer review |
| Marking cards used, balances | Gift Up's phone app | A small page we build for Elijah (look up, redeem, void) |
| Booking form "Have a gift card?" | Reads Gift Up's records (API, unconfirmed) | Reads our own records directly; can show "due on the day" |
| Who owns the records | Gift Up; moving later means carrying open balances over | We do (Stripe plus our store); nothing to migrate |
| Risks we carry | Gift Up's terms and pricing | Our code: payment checks, fraud limits, keeping the records safe |

**What the Stripe build means for Black Friday:**
- The site is frozen until toll-free verification (still pending, November 23). So the Stripe build can't take orders through our page on November 27.
- **Bridge:** four Stripe Payment Links (one per tier) work today with no site change. They're hosted by Stripe, take card, Apple Pay and Google Pay, and email a Stripe receipt.
- Our code issues no card until it's live. The bridge page says "your gift card arrives by email within 24 hours". Then either:
  - Elijah sends each card by hand from a template; or
  - when our code ships, it reads every Payment Link sale from Stripe and issues and emails those cards automatically.
- If the freeze ends before Black Friday, the bridge isn't needed.
- **Wallet passes come later** with the Stripe build. The email and PDF cover Christmas; a card can be shown from the email or the PDF on the phone.

**Recommendation, given Emmett's lean:**
- Stripe, if Elijah accepts no wallet passes this season and a by-hand or "within 24 hours" bridge until the freeze ends.
- Gift Up, if launching on Black Friday with wallet passes and instant delivery matters more than about 3.5 points of fees.

### For you (Emmett), before the build
- **A1. Platform:** Gift Up or our own Stripe build (above)? It decides Phase 1.
- **A2. The freeze:** toll-free verification is still pending (November 23). With Stripe, which bridge until it ends: cards sent by hand, or issued automatically once our code ships?
- **A3. Done:** the "paid in full" fix (P1) is on eNov14 with tests (November 23). It reaches the live site with the merge. Until then, Elijah should treat "PAID IN FULL online" as unpaid.
- **A4. Layout:** A (the calculator beside the tiers, pinned as you scroll) or B (four tiers across, the calculator as a wide band below)? `docs/mockups/eNov23-gift-card-layouts.png`. On phones both stack the same way.

### For Elijah
- **E1. Prices:** the site charges Basic Interior $145 and Full Interior $235 (live too). His November 12 answer said today's prices are $135 and $225, with the new prices "later". Which is right?
  - **At $145 and $235:** tiers $50, $100, **$175** (pay $140, covers a Basic Interior for a car, SUV or truck: $167.09 at most) and **$275** (pay $220, covers a Full Interior for a car, SUV or truck: $264.11 at most). A 3-row SUV or van costs $25 more and isn't covered by either ($183.26 and $280.28). Optionally $350 (pay $280, Full + Steam for a car: $339.57).
  - **At $135 and $225:** his $150 and $250 cover a car's Basic and Full Interior in Ohio, but not an SUV or truck. Either way the line is computed, never typed.
- **E2. Platform accounts:** does he take cards on the day with Square, GoHighLevel or something else? Is the Stripe account verified for live payments, and whose bank does it pay out to? Does a PayPal Business account exist?
- **E3. The sale's dates:** Black Friday (November 27) to December 25, 11:59 PM Eastern? Or start sooner, for the past-customer email?
- **E4. After the sale:** keep selling at face value, or stop selling?
- **E5. Expiry:** none on the whole card, bonus included (recommended)?
- **E6. Custom amount:** $25 to $500, also 20% off during the sale?
- **E7. Promo codes:** can a gift card be used together with a code? A sale card plus FRIANDFAM comes to about 40% off.
- **E8. Refunds:** unused cards within 30 days for the amount paid, no cash after that?
- **E9. Klarna:** OK that it isn't offered (its rules prohibit gift cards)? Card, Apple Pay, Google Pay, Link, Cash App Pay and PayPal remain.
- **E10. Wording:** "This holiday only" instead of "won't come back"?
- **E11. Redemption on the day:** he redeems the code in the Gift Up app when he takes payment. The calendar gets a `GIFT CARD:` line; is that OK for his Accounting sheet?
- **E12. Outreach:** email to past customers (GoHighLevel, with unsubscribe), and texts only to people who agreed to texts?

### For the accountant
- **T1.** Tax on cards sold at 20% off: on the full service price at redemption?
- **T2.** Booking gift card sales as a liability; how the Accounting sheet should count a gift-card job.
- **T3.** The 7% charged on Indiana jobs; Kentucky detailing tax.
- **T4.** Kentucky unclaimed property for cards bought by Kentucky residents.

## Sources
- Ohio ORC 1349.61 ([official](https://codes.ohio.gov/ohio-revised-code/section-1349.61), [FindLaw](https://codes.findlaw.com/oh/title-xiii-commercial-transactions/oh-rev-code-sect-1349-61/)); [Ohio Adm. Code 5703-9-15](https://codes.ohio.gov/ohio-administrative-code/rule-5703-9-15); [ORC 169.01](https://codes.ohio.gov/ohio-revised-code/section-169.01)
- [Promotional cards and Ohio tax](https://bdblaw.com/gift-cards-distributed-as-part-of-an-award-loyalty-or-promotional-program-are-not-subject-to-ohio-sales-and-use-tax/); [discounted vouchers taxed on full value](https://bdblaw.com/ohio-sales-tax-applies-to-full-value-of-deal-of-the-day-vouchers/)
- [Kentucky Sales Tax Facts, December 2011](https://revenue.ky.gov/News/Publications/Sales%20Tax%20Newsletters/Sales%20Tax%20Facts%202011%20-%20Dec.pdf); [Kentucky HB 8](https://revenue.ky.gov/News/Pages/House-Bill-8-FAQs-Available-on-TaxAnswers.ky.gov.aspx); [Indiana SIB 89](https://www.in.gov/dor/files/sib89.pdf)
- Reg E 1005.20: [rule](https://www.consumerfinance.gov/rules-policy/regulations/1005/20/), [interpretation](https://www.consumerfinance.gov/rules-policy/regulations/1005/interp-20/)
- Gift Up: [pricing](https://www.giftup.com/pricing), [FAQ](https://giftup.com/faq), [promotions](https://help.giftup.com/article/24-running-a-promotion), [wallet](https://help.giftup.com/article/167-saving-to-apple-walletgoogle-pay)
- GoHighLevel: [gift cards](https://help.gohighlevel.com/support/solutions/articles/155000006980-getting-started-with-gift-cards), [redeeming in the app](https://help.gohighlevel.com/support/solutions/articles/155000009785-how-to-redeem-gift-cards-in-the-highlevel-mobile-app)
- Square: [fees](https://squareup.com/help/us/en/article/5068-what-are-square-s-fees), [eGift cards](https://squareup.com/help/us/en/article/6000)
- Stripe: [pricing](https://stripe.com/pricing), [card testing](https://docs.stripe.com/card-testing); [Klarna prohibited businesses](https://docs.klarna.com/resources/legal-and-compliance/policies-and-term-of-service/ethical-instructions)
- Netlify Blobs: [docs](https://docs.netlify.com/build/data-and-storage/netlify-blobs/), [previews and Blobs data](https://www.netlify.com/knowledge-base/why-your-deploy-preview-can-delete-netlify-blobs-data/)
- [Milliman on breakage](https://us.milliman.com/en/insight/gift-card-liability-overlooked-risk); gift card UX: [Voucherify](https://www.voucherify.io/blog/gift-cards-ux-and-ui-best-practices), [Baymard](https://baymard.com/research-articles/gifting-flow)
