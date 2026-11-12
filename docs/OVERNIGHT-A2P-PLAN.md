# Overnight run: A2P texting approval changes (planned November 12)

**For the overnight session.** Read `CLAUDE.md` first, then `docs/IMPERION-RECOMMENDATIONS.md` (section A).

**Branch:** work on a new branch `a2p-nov12`, cut from `eNov6`. Commit there; never push `main`, and never merge into `eNov6` yourself (Emmett reviews first).

**Approved mockups:** `docs/mockups/a2p-contact-current-vs-proposed.png` and `docs/mockups/a2p-booking-current-vs-proposed.png`. Build exactly what they show unless a task below says otherwise.

**When you're done, the morning report says, for each task:** done or not, how it was checked, and anything left.

## T1. One phone number, from Netlify

The new number isn't issued yet.
- **Today's number** `(513) 279-2915` becomes the default in one place: `config/business.json` (`"phone"`), validated at build.
- **A Netlify variable `BUSINESS_PHONE`** (10 US digits, any format) overrides it at build.
- **What it must reach:**
  - every page, including the header and footer partials, the landing pages, `tel:` and `sms:` links, and the hidden business data (`"telephone"`);
  - `js/funnel.js` and `script.js`, through `js/config.js`;
  - the legal pages;
  - `send-confirmation.mjs` and its emails, from the same variable on the server;
  - `web/scripts/price-list.mjs`.
- **Stamp the number into the published files, not the source.** Leave the number as written in the repo and swap it as the build produces `dist/`. That keeps the terms' wording fingerprint stable.
- **Done when:**
  - a build with `BUSINESS_PHONE=5555550100` leaves no trace of 279-2915, in any format, anywhere in `dist/` (check the formats `(513) 279-2915`, `513-279-2915`, `513.279.2915`, `5132792915`, `+15132792915`, `+1-513-279-2915`);
  - a build with the variable unset is byte-identical to today's;
  - a bad value stops the build with the reason;
  - tests cover all three.

## T2. Contact form: "Request a quote", switchable back

This is temporary, until texting approval.
- **One setting decides the wording:** `config/contact-form.json` with `"mode": "quote"` or `"question"`, and both sets of wording kept in that file. The build renders the form from it. Reverting is changing one word.
- **Quote mode** (as in the mockup):
  - page title and form title "Request a quote";
  - field order: Name, Phone, Email / Vehicle, City or ZIP, best way to reach you / the question and condition boxes;
  - two **optional, unticked** consent boxes, worded exactly as in `IMPERION-RECOMMENDATIONS.md` A3, with the phone number from T1;
  - the line "By continuing you agree to our Terms & Conditions and Privacy Policy", with both linked;
  - button "Request Quote";
  - the hidden subject "QUOTE REQUEST from 513autoclean.com";
  - the fine print "No spam, ever. We only use your info to send your quote."
- **The submission carries both consent answers.** The email shows "SMS consent: yes/no" and "Marketing: yes/no".
- **The fold:** the mockup puts Request Quote below a 1440×790 window, and the owner's test requires the Send button visible on Contact. Shorten the two text boxes (fewer rows) or tighten the consent boxes until the button is visible. Measure; don't guess.
- **Done when:**
  - the form matches the mockup at 1440 and 375;
  - the button is visible at 1440×790;
  - the form sends with neither box ticked;
  - switching `mode` to `"question"` brings back today's form exactly;
  - the `ac-question` hand-off from the booking form still fills the question box.

## T3. Booking form: the same SMS consent box

- **Placement:** in checkout's "Your details", under the Name, Phone and Email row, above the small Continue spot. Optional and unticked, with the same wording as the Contact form's SMS box (number from T1).
- **Where the answer goes:** the booking's existing `consent.sms` field (`wire.ts`), and the booking email shows "SMS consent: yes/no".
- **The calendar event description stays unchanged.** `jobs-sync-contract.test.ts` must still pass.
- **Done when:**
  - it matches the mockup at 1440 and 375;
  - the small Continue's 160 px rule is re-checked at the six sizes in `SESSION-CHANGES-pipeline.md`;
  - every booking path still reaches Done;
  - all tests pass.

## T4. Hours: 6 AM to midnight (Elijah, question 14)

- **What changes:** "7 days a week, 7 AM to 10 PM" becomes "7 days a week, 6 AM to midnight" in the footer partial, the home page's contact block and the Contact page. The hidden business data becomes 06:00 to 24:00, so it agrees.
- **Where it comes from:** `config/business.json` (`"hours"`), not typed text, per the `CLAUDE.md` rule on business numbers.
- **Done when:** no page says 7 AM or 10 PM, and the hidden data matches.

## T5. Calendar backend review (brief subagent)

- **Scope:** read-only review of `web/lib/google/`, `web/lib/availability/`, `netlify/functions/_detailers.mjs`, `send-confirmation.mjs` and `_gcal.mjs`. Look for correctness risks in reading OPEN, BEST, DNS and fees, assigning detailers, writing events, and free/busy reads.
- **Fixes:** only clear bugs, each with a test. Everything else goes into the morning report.

## T6. Elijah's JobsSync script, matched to the final booking format

- **Start from** `~/Downloads/JobsSync.gs` and its README. Write `tools/jobs-sync/JobsSync.gs` and a short README.
- **What it must read:**
  - the detailer from the title, as `jobs-sync-contract.test.ts` defines it (SHORT NOTICE prefix, then `Name:`), with "Elijah" for owner jobs that carry no name;
  - Kris's bookings calendar as well as 513 Auto Clean.
- **What it must skip:** `OPEN`, `OPEN +20%`, `BEST` and `DNS` blocks, and Free events.
- **Formats:** keep its TOTAL, sales tax, SOURCE, HEARD ABOUT US and ZIP parsing in step with the contract test.
- **Done when:** it's delivered as a file for Elijah to install. Nothing is deployed.

## Rules for the night

- **Nothing a customer sees beyond the approved mockups,** T4's hours, and T1 when the variable is set.
- **Tests:** 614 or more pass. Build with `npm run build`.
- **Preview:** use port 8792 only.
- **Logs:** `docs/SESSION-CHANGES-a2p.md`, with root causes, plus `CLAUDE.md` lessons for anything new.
- **Morning:** render the built result against the approved mockups (`docs/mockups/a2p-*-built.png`) for Emmett's pre-merge review.
