# Gift cards: overnight run report, November 24, 2026

**For:** Emmett, in the morning. **Branches:** `eNov16` (everything) and `eNov14` (the reworked tiles only), both pushed. Neither is `main`: **the live site is untouched.**

## What's done

1. **The tiles, reworked** (you said the discount wasn't popping and the tile was hard to read).
   - Each tile now looks like the gift card itself: the value big, "513 Auto Clean", and a red "20% OFF" badge on the corner.
   - Under it: "You pay **$40**", then the $50 crossed out in brand red, then "Save $10".
   - What every card shares ("never expires", tax, cash, refunds) is said once under the cards, not on each one.
   - On `eNov14` too.
   - Screenshot: `docs/mockups/eNov24-gift-cards-built.png`, shown on December 1 with the sale on.
2. **The Stripe checkout, built** on `eNov16` (eNov14 + the payment fixes + gift cards).
   - Buy: a short form (who it's for, their email, when to send it, your name, a message), then Stripe's own payment page. The price is always the server's.
   - After paying: a page with the card and its code, "Print or save as PDF", "Share the card" and "Book a detail".
   - Emails go to the buyer, to the person it's for (now or on a chosen day, sent hourly from 8 AM), and to Elijah.
   - `/gift-admin` for Elijah: look a card up by its code (or by the Stripe payment id if the buyer lost it), take an amount off when a detail is paid with it, cancel it, or resend it. Every change is written on the payment in Stripe.
   - Refunds cancel a card. Disputes freeze it until they close: won, it works again; lost, it's cancelled.
   - Every card lives on its own Stripe payment, so no new service or database was added.
   - The terms (section 4, "Gift cards") and the privacy policy (Stripe for gift cards) were updated. They're dated November 23 and locked.
3. **The sale's dates are respected everywhere.**
   - Before November 27 the page shows full prices and says "Every card will be 20% off from November 27 to December 25".
   - From November 27 to December 25 (Cincinnati time) it shows the sale; afterwards, full prices again.
   - The checkout charges by the same rule, so the page always shows what Stripe charges.
4. **Validation: three passes on the new features, then two pre-merge passes.**
   - Each pass was an independent reviewer. Every finding was root-caused and fixed with a test, then checked by the next pass.
   - About 60 findings in all. The ones that mattered most:
     - a card a buyer could see but Elijah couldn't find;
     - a refused redeem that showed as done;
     - Christmas-morning emails hitting Resend's rate limit;
     - sale prices showing before the sale;
     - the phone menu cutting off Contact Us once the gift link was added;
     - a wrong webhook secret going unnoticed.
   - The full list is in `docs/SESSION-CHANGES-giftcards.md`.
   - The last pre-merge pass said "no-go, but close": two blocking findings, four smaller. All six are fixed with tests.
   - **Tests: 872 pass.** The build passes, and every function bundles the way Netlify builds it.
   - The rest of the site was checked against eNov14:
     - every page at 1440, 820, 375 and 320;
     - the booking form stepped through to review (the same $264.11 for a medium Full Interior);
     - the fold checks at 1440×790;
     - every internal link.

     Nothing else changed.
   - **Not checked:** a real payment. Nothing was sent to Stripe or Resend. The test-mode run on the test site is yours (setup guide, section 3).

## What you need to do before anyone can buy

Everything is in `docs/GIFT-CARDS-SETUP.md`. In short:
1. **Push and preview.**
   - Push `eNov16`, then either fast-forward `eNov14` to it (Deploy Preview 13 then shows the checkout) or open a new draft PR.
   - Both branches are pushed as they stand. I didn't fast-forward `eNov14` to `eNov16`: that changes what Deploy Preview 13 shows, so it's your call.
2. **Stripe, test mode:**
   - Cards and Link on.
   - A webhook to the preview's `/api/gift-webhook` with 5 events.
3. **Netlify (Deploy Previews):**
   - `STRIPE_WEBHOOK_SECRET`, `GIFT_CODE_SECRET` (32+ characters) and `GIFT_ADMIN_KEY` (16+ characters).
   - Confirm `TEST_SITE_PASSWORD` is set for Deploy Previews only. The password gate ships with this merge, and with a Production value it would lock the live site.
4. **One test purchase** with card 4242 4242 4242 4242. Then check the emails, `/gift-admin` and a refund.
5. **At go-live:** the same Stripe and Netlify steps in live mode. Then one real purchase of the smallest card, refunded afterwards. Check that the webhook's deliveries in Stripe show 200.
6. **Never change `GIFT_CODE_SECRET` once a card is sold:** every code would change.

## Questions for you

1. **The freeze and the sale.** The sale runs November 27 to December 25, but the site waits for toll-free approval. If approval is late, the sale starts late. Options:
   - wait;
   - ship gift cards on their own before the rest of eNov14;
   - move the sale dates (one line in `config/gift-cards.json`).
2. **Which branch merges?** `eNov16` contains everything on `eNov14` plus the payment fixes and the checkout. I'd merge `eNov16`. Merging `eNov14` alone needs gift cards set to `"off"`: its build refuses a gift page whose buy buttons do nothing.
3. **The five unreviewed gallery photo pairs** still block a production build, by design (third-row-seat-stains, soul-cargo, civic-front-floor, captain-chair, forester-front-floor). Someone has to check them before the merge.
4. **Red for the discount.** CLAUDE.md says red is for the brand and for errors, and a price is ink. The "20% OFF" badge (brand red, like "Most Popular") and the red strike line are my reading of "make the discount pop".
   - The prices themselves stay ink.
   - OK, or an exception you want written into CLAUDE.md?
5. **The phone menu.** It now ends with "Gift cards". CLAUDE.md wants the same nav names in one order everywhere, and the desktop header doesn't have it: there it's the top-bar link. Keep it?
6. **Rebuild hook (optional).** A Netlify build hook in `GIFT_REBUILD_HOOK` makes the site rebuild itself on November 27 and December 26. Then the page's own HTML (what search engines and slow phones see first) matches the day. Without it, the page corrects itself in the browser.

## Questions for Elijah

1. **The card amounts (E1, still open).** At today's prices ($145 Basic Interior, $235 Full Interior, tax included at 7.8%):
   - his $150 card covers a Basic Exterior, not a Basic Interior;
   - his $250 card covers a Basic Interior, not a Full Interior.

   The page says exactly what each card covers, worked out from the prices, so nothing is overclaimed. Keep $50, $100, $150 and $250, or switch to $175 and $275 so the two bigger cards cover the interiors? Or are the real prices $135 and $225 (his November 12 answer)?
2. **"Our pick"** is on the $150 card instead of "Most Popular", since nothing has sold yet. Which card, or none?
3. **Policies now in the terms; please confirm:**
   - never expires, no fees;
   - unused cards refundable within 30 days for what was paid (`refundDays`);
   - not cash.
4. **After the sale:** keep selling at face value (`"regular"`) or stop (`"off"`)?
5. **Using a card:** the booking form has no gift card box yet. People type the code in "Anything else we should know?", and Elijah takes the amount off at `/gift-admin` when he's paid. Fine for this season? A proper box in the booking form is the next build.
6. **`/gift-admin`:** Elijah needs `GIFT_ADMIN_KEY` in his phone's password manager. It's one phone at a time: two people changing the same card at the same moment can clash.
7. **Accountant:** T1 to T4 in `GIFT-CARDS-PLAN-2026-11-23.md`:
   - tax on discounted cards;
   - gift card money as a liability;
   - the 7% on Indiana jobs;
   - Kentucky unclaimed property.

## Not built, on purpose

- **Apple and Google Wallet passes.** They need an Apple Developer account ($99 a year) and Google's issuer review. The certificate can be saved as a PDF or shown from the email.
- **A PDF attached to the email.** "Print or save as PDF" on the certificate page does this without a new package.
- **Changing a recipient's email address from `/gift-admin`.** Resend to the buyer, who can forward the card.
- **Fraud rules in Stripe (Radar).** Worth a look in Stripe's dashboard: gift cards are a common target for stolen cards.
- **Known and accepted:**
  - The gift card settings' notes (which name settings like `STRIPE_WEBHOOK_SECRET`, never their values) ride in the browser bundle, like every other config file's notes.
  - A checkout opened just before midnight on December 25 can be paid at the sale price within the hour.
