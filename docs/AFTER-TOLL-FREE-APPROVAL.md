# After toll-free approval: the runbook

Everything that waits for Imperion to say the toll-free number is verified, in the order to do it. Nothing here starts before that message.

- **Approval:** every step marked **Emmett's yes** needs his yes typed in chat for that step. One yes doesn't cover the next.
- **What's live until then:** `main` stays frozen at c184f26 (PR #12), with no PR, no merge and no hotfix (Emmett, November 15: "WAIT FOR THE MERGE").
- **Sources:** each step links the doc it comes from, so this file adds no new decisions.

## 0. The trigger

- [ ] Imperion confirms toll-free verification is approved, in writing. Note the date here.
- **When to expect it (estimate, November 16):**
  - **Reference points:** the site went live for review on Saturday, November 14 (PR #12). Imperion's exact submission date isn't recorded here; ask them for it and for the status shown in GoHighLevel.
  - **Published review times:** HighLevel and Twilio say about 3 business days is usual, and 3 to 5 is common. HighLevel's guide allows up to 4 to 6 weeks.
  - **So, if they submitted November 14 to 16:**
    - most likely Thursday, November 19 to Tuesday, November 24;
    - if slow, early December (Thanksgiving is November 26);
    - at the outside, late December.
  - **A rejection restarts the clock.** The known risks are in `TOLL-FREE-VERIFICATION.md`: the first consent box mixes alerts and marketing, and the email is Gmail.
- [ ] Ask Imperion two things before any change:
  - Can the number go back now, and to which number?
  - Do the Contact form's quote wording and the `/book` consent page still need to stay? Texting (A2P) approval may come at a different time from the toll-free approval.

## 1. Phone number (Emmett's yes; Netlify, no code)

From `QUEUE-AFTER-FRIDAY.md`, "Swap the phone number back".
- [ ] In Netlify, Site configuration, Environment variables: delete `BUSINESS_PHONE`, or set it to the permanent number Imperion names, in every context.
- [ ] Deploys, Trigger deploy, Deploy site.
- [ ] Check:
  - no page, script or email carries `371-5948` (`curl` the 12 pages; `check-live.mjs` still calls every deploy STALE, see `QUEUE`, "From the long-session audit");
  - the `tel:` and `sms:` links and the structured data carry the right number.

## 2. Settings that were switched for verification (Emmett's yes, after Imperion's answer in step 0)

Both are one word in a config file, and a test proves each switch restores the old page exactly (CLAUDE.md, "Temporary or campaign changes").
- [x] **Done November 26, in the merge (Emmett):** Imperion said in a voice note that it is re-verifying the toll-free number under its own LLC, after three rejections over the LLC address, and that the website is no longer part of the verification. The Contact form is back to `mode: "question"`. `bookLinks` went to `"inline"` the same day and back to `"page"` on Emmett's word ("turn back on the /book"): every Book link goes to /book. The two tick boxes (texts, offers) and the terms line stay on the Contact form and the `/book` page in every mode (Emmett: "standard on everything"); they're `consent` in the config, outside the switch. Each can flip back with its one word.
- [x] **Contact form wording:** `config/contact-form.json` `"mode"`. It's `"quote"` today ("Request a quote", Imperion, November 12); `"question"` brings back "Got a question first?". The file itself says to switch back once texting is approved. Confirm with Imperion first.
- [ ] **Book links:** `config/booking-page.json` `"bookLinks"`, `"page"` again by Emmett's choice (November 26). It's `"page"` today, so every Book link goes to `/book`, where the consent boxes are (Imperion, November 14); `"inline"` opens the form in place on every page, as before. Keep `"page"` unless Imperion and Emmett both say it can go.
- These are code-repo changes, so they go in through step 3's PR (or a follow-up PR) and never straight to `main`.

## 3. Merge eNov14 (Emmett's separate yes; the PR is merged by Emmett)

**Done November 26:** PR #13 squash-merged (1c6dbe4) and live. The boxes below are kept as the record; the after-deploy items are ticked where they were checked.

From `STATUS-2026-11-15.md`, "Before eNov14 can merge". eNov14 is about 105 commits ahead of `main` (November 26), open as draft PR [#13](https://github.com/Ert850/513-Auto-Clean/pull/13).
- [x] **The gallery pairs (November 26):** the 5 candidate pairs are held back (Emmett: not until Elijah's better photos replace them). They're out of `data/gallery.json` and their images are deleted (still in git history at e9336d3, review sheet `docs/GALLERY-PAIRS-V2.png`). Their places use the earlier checked pairs again: the home Interior button `crv-interior`, Spills and Stains `sonic-interior`, the Delhi and Indian Hill heroes and the interior page's proof from `pethair`, `sonic-interior`, `crv-interior`, `jeep-cargo`, `console`. The stain page (a draft) has no carousel until a checked stain pair exists. The production build passes. Elijah's photos are a follow-up after the merge: he shares the folder from his business Google account (`SESSION-CHANGES-gallery.md`).
- [ ] `git fetch`. If `main` moved (it shouldn't have), merge `origin/main` into eNov14; never rebase it, which would need a force-push. The squash merge makes the history shape irrelevant. The build passes and every test passes (`cd web && TZ=America/New_York npx vitest run`).
- [ ] A final validation and dropped-task agent over the whole PR diff.
- [ ] The preview at https://deploy-preview-13--513-auto-clean.netlify.app:
  - one test booking (writes to the TEST calendar, emails Emmett), then delete the event;
  - check phones and desktop agree at 1440, 820 and 375.
- [ ] Mark PR #13 ready for review. It's merged only with Emmett's separate yes, as a **squash merge**, so the commit carrying Emmett's email (f9a0f6b, only on eNov14) never enters `main`'s history (step 4).
- [ ] **What ships with the merge** (tell Elijah, step 7):
  - **gift cards go live, on** (Emmett, November 26): the live Stripe and Netlify settings first, `docs/GO-LIVE-GIFT-CARDS-2026-11-26.md` part A, then its part C right after the deploy;
  - the Confirm-freeze fix (bc0a266);
  - the booking-form fixes;
  - hover only on mouse devices;
  - the booking email logo, which shows once these emails send from the live deploy;
  - the city and service pages, which stay out of production as drafts (`publishedPages()`);
  - the home headline A/B test `hero-headline` starts: about two thirds of home visitors see "Cincinnati." or "across the 513." instead of "Greater Cincinnati.".
- [ ] **After the deploy:**
  - `node web/scripts/check-live.mjs` for the server variables (ignore its STALE line until it's fixed), and `curl` a page to confirm the new `?v=` stamps;
  - **Addresses (Imperion's audit, `IMPERION-AUDIT-2026-11-18.md`):**
    - `curl -sI https://513autoclean.com/about.html` is a 301 to `/about`, and `/about` is 200;
    - `/llms.txt` loads, and `sitemap.xml` lists clean addresses;
    - Checked November 26 after the deploy: `/about.html` is a 301 to `/about` (200), `/llms.txt` is 200, `sitemap.xml` has no `.html` address, `/golf` and `/prestige` are still 302s.
    - resubmit the sitemap in Google Search Console and check "Google-selected canonical" for two pages. **Blocked (November 26):** the business Google account in Chrome has no Search Console property, the site has no verification tag and the domain no Google TXT record. Find out who owns it (Imperion?) or create a URL-prefix property verified through Google Analytics (Emmett's yes);
    - ask Imperion to re-run the Semrush audit;
  - one real-calendar check that a booking writes to the right calendar (Emmett's yes for a real test booking). **Warn Elijah first** (CLAUDE.md): JobsSync can copy its TOTAL into his Accounting sheet before the event is deleted. Delete the event, and the sheet row if one was made.
- [x] **The headline test's dates** (November 26: the note says November 26 to December 24, on `eNov14` until it reaches `main`; GA4's "Test version" dimension has been registered since November 11): write the real start date and the stop date (4 weeks on) into the `hero-headline` `note` in `config/experiments.json` (`AB-TESTING.md`, "Running a test", step 3), and register the `exp_variant_string` custom dimension in GA4 if it isn't yet (step 2). On the deploy, open the home page in a private window a few times: each visit keeps its own headline on reload.
- [ ] **A week later:** Netlify's usage page for edge-function invocations. The preview's password gate runs on every production request and returns at once.

## 4. Remove Emmett's email from the public git history (Emmett's separate yes)

**Done another way, November 26:** every branch was rewritten with `git filter-repo` and force-pushed with Emmett's yes (`SESSION-CHANGES-gallery.md`). Deleting `eNov14` and the GitHub Support request are no longer needed (Emmett: no Support request).

From `QUEUE-AFTER-FRIDAY.md`, "After toll-free approval: remove Emmett's email".
- **Where it is:** the address is only in commit f9a0f6b, which only `eNov14` (and `origin/eNov14`) contains; `main` doesn't have it.
- **So, recommended:** keep `main` clean rather than rewriting it later:
  - [ ] squash-merge PR #13 (step 3), so `main` gets one new commit without f9a0f6b;
  - [ ] then delete `eNov14` on GitHub (Emmett's yes; it removes the branch, not `main`);
  - [x] ~~ask GitHub Support to purge the PR #13 refs and cached views of f9a0f6b~~ Not doing (Emmett, November 26): history was rewritten instead, and the PR copies are accepted.
- **If `eNov14` must stay** (or the merge isn't a squash): `git filter-repo --replace-text` on `eNov14` before the merge, and a force-push of `eNov14` only, with Emmett's yes naming that branch. Never force-push `main`.
- [ ] Before either: `git log -p -S` for the address and any other personal detail (addresses, phone numbers) on every branch, including `eNov6`.
- [ ] **`context_outline.txt` (on `main` since 77636b4) holds Elijah's personal phone, full legal name and payment handles** (validation cycle 5). Ask Emmett and Elijah whether to remove it from the repo, and from history with the step above. It's on `main`, so removing it is a PR to `main`, after the freeze. **Emmett, November 26: keep it for now.** Don't raise it again unless something changes.
- [ ] Tell Elijah (and his agent, which pushes to `eNov6`) whether to re-clone. It's needed only if a branch they use was rewritten.

## 5. Questions parked until after the freeze (ask Emmett)

- [ ] **GOLF10 and PRESTIGE10** (`config/promo-codes.json`, both `active: false`): on for everyone on `lp-golf.html` and `lp-prestige.html`, or the A/B test of showing them (`config/experiments.json`), and any end date. They aren't printed, so the prints don't depend on it.
- [ ] **The two SEO sign-offs**, before any city page is published (`STATUS`, "Before the first city or service page is published"):
  - the flat addresses (`/mobile-detailing-delhi-price-hill-oh`) instead of `/locations/<slug>/`;
  - Range & Travel as the hub.
- [ ] **"Pet Hair Removal"** as the add-on's name, or "pet hair clean" (`SEO-COMPLIANCE.md` §7).

## 6. Things that were waiting on the freeze, not on Imperion

- [ ] **Legal wording, in one update** (bump the date in `web/lib/site/legal.ts`, then `npm run lock:legal`, CLAUDE.md):
  - the privacy policy's "the next time you tap Book Now" becomes device-neutral ("open Book Now"), like the form;
  - **the terms' travel charge:** "measured at the time you picked" no longer matches the price, which averages the drive out and the drive back, with the drive back timed at the job's end (calendar fix 3). Say "the drive out and back, in the traffic of those hours" (validation cycle 5);
  - the privacy policy's "we try two versions of a page": `hero-headline` has three, so say "different versions";
  - US spelling: "kilometre" becomes "kilometer", and "outdoor tap" becomes "outdoor faucet" (together with the booking form's question, `funnel.js`, and the event line, so they keep matching).
- [ ] **Automated texts and reminders** (`capabilities.ts` `automatedTexts`, held off on purpose so Done never promises reminders nobody sends; Emmett approved holding it, November 13). Turn it on only once GoHighLevel sends them, through the same legal steps, because the terms and privacy wording changes with it.

- [ ] **Turnstile:** ready in code. Before setting `TURNSTILE_SECRET_KEY` in Production, test once on a Deploy Preview with Cloudflare's always-pass test keys, then the real ones (`QUEUE`, "From the final pre-release review").
- [ ] **The one-calendar design** for Imperion's GoHighLevel work: a spec only. Nothing is built until Elijah and Imperion pick a concept (`QUEUE`, "a design spec for one Google calendar").

## 7. Tell Elijah

- [ ] What shipped (step 3's list), that the Confirm freeze is fixed, which number is live (step 1), and that the headline test has started and when it ends.
- [ ] If step 4 ran, ask him to re-clone.

## Not on this list on purpose

- **BIMI (inbox logo):** closed. Elijah: not trademarked, not worth it.
- **The city pages going live:** they wait for Elijah's local jobs and reviews and a person-written paragraph, not for the freeze (`STATUS`, "Before the first city or service page is published").
- **Multi-day day plan to the server:** no effect until paint correction is bookable.
