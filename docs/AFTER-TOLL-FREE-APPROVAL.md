# After toll-free approval: the runbook

Everything that waits for Imperion to say the toll-free number is verified, in the order to do it. Nothing here starts before that message.

- **Approval:** every step marked **Emmett's yes** needs his yes typed in chat for that step. One yes doesn't cover the next.
- **What's live until then:** `main` stays frozen at c184f26 (PR #12), with no PR, no merge and no hotfix (Emmett, November 15: "WAIT FOR THE MERGE").
- **Sources:** each step links the doc it comes from, so this file adds no new decisions.

## 0. The trigger

- [ ] Imperion confirms toll-free verification is approved, in writing. Note the date here.
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
- [ ] **Contact form wording:** `config/contact-form.json` `"mode"`. It's `"quote"` today ("Request a quote", Imperion, November 12); `"question"` brings back "Got a question first?". The file itself says to switch back once texting is approved. Confirm with Imperion first.
- [ ] **Book links:** `config/booking-page.json` `"bookLinks"`. It's `"page"` today, so every Book link goes to `/book`, where the consent boxes are (Imperion, November 14); `"inline"` opens the form in place on every page, as before. Keep `"page"` unless Imperion and Emmett both say it can go.
- These are code-repo changes, so they go in through step 3's PR (or a follow-up PR) and never straight to `main`.

## 3. Merge eNov14 (Emmett's separate yes; the PR is merged by Emmett)

From `STATUS-2026-11-15.md`, "Before eNov14 can merge". eNov14 is 46+ commits ahead of `main`, open as draft PR [#13](https://github.com/Ert850/513-Auto-Clean/pull/13).
- [ ] **Elijah's 5 gallery pairs** (commit 4e0279f): a person reviews them for the bag and papers in two before photos and the landscape-against-portrait pair (`PLAN-eNov14.md` A3), or they're dropped from `data/gallery.json`. Don't ship them as they are.
- [ ] `git fetch`. Rebase eNov14 on `origin/main` if `main` moved (it shouldn't have). The build passes and every test passes (`cd web && TZ=America/New_York npx vitest run`).
- [ ] A final validation and dropped-task agent over the whole PR diff.
- [ ] The preview at https://deploy-preview-13--513-auto-clean.netlify.app:
  - one test booking (writes to the TEST calendar, emails Emmett), then delete the event;
  - check phones and desktop agree at 1440, 820 and 375.
- [ ] Mark PR #13 ready for review. It's merged only with Emmett's separate yes, as a **squash merge**, so the commit carrying Emmett's email (f9a0f6b, only on eNov14) never enters `main`'s history (step 4).
- [ ] **What ships with the merge** (tell Elijah, step 7):
  - the Confirm-freeze fix (bc0a266);
  - the booking-form fixes;
  - hover only on mouse devices;
  - the booking email logo, which shows once these emails send from the live deploy;
  - the city and service pages, which stay out of production as drafts (`publishedPages()`).
- [ ] **After the deploy:**
  - `node web/scripts/check-live.mjs` for the server variables (ignore its STALE line until it's fixed), and `curl` a page to confirm the new `?v=` stamps;
  - one real-calendar check that a booking writes to the right calendar (Emmett's yes for a real test booking, then delete it).
- [ ] **A week later:** Netlify's usage page for edge-function invocations. The preview's password gate runs on every production request and returns at once.

## 4. Remove Emmett's email from the public git history (Emmett's separate yes)

From `QUEUE-AFTER-FRIDAY.md`, "After toll-free approval: remove Emmett's email".
- **Where it is:** the address is only in commit f9a0f6b, which only `eNov14` (and `origin/eNov14`) contains; `main` doesn't have it.
- **So, recommended:** keep `main` clean rather than rewriting it later:
  - [ ] squash-merge PR #13 (step 3), so `main` gets one new commit without f9a0f6b;
  - [ ] then delete `eNov14` on GitHub (Emmett's yes; it removes the branch, not `main`);
  - [ ] ask GitHub Support to purge the PR #13 refs and cached views of f9a0f6b (a PR keeps its commits reachable by hash).
- **If `eNov14` must stay** (or the merge isn't a squash): `git filter-repo --replace-text` on `eNov14` before the merge, and a force-push of `eNov14` only, with Emmett's yes naming that branch. Never force-push `main`.
- [ ] Before either: `git log -p -S` for the address and any other personal detail (addresses, phone numbers) on every branch, including `eNov6`.
- [ ] Tell Elijah (and his agent, which pushes to `eNov6`) whether to re-clone. It's needed only if a branch they use was rewritten.

## 5. Questions parked until after the freeze (ask Emmett)

- [ ] **GOLF10 and PRESTIGE10** (`config/promo-codes.json`, both `active: false`): on for everyone on `lp-golf.html` and `lp-prestige.html`, or the A/B test of showing them (`config/experiments.json`), and any end date. They aren't printed, so the prints don't depend on it.
- [ ] **The two SEO sign-offs**, before any city page is published (`STATUS`, "Before the first city or service page is published"):
  - the flat addresses (`/mobile-detailing-delhi-price-hill-oh`) instead of `/locations/<slug>/`;
  - Range & Travel as the hub.
- [ ] **"Pet Hair Removal"** as the add-on's name, or "pet hair clean" (`SEO-COMPLIANCE.md` §7).

## 6. Things that were waiting on the freeze, not on Imperion

- [ ] **The privacy policy's "the next time you tap Book Now"** becomes device-neutral ("open Book Now"), like the form. Legal text: bump the date in `web/lib/site/legal.ts`, then `npm run lock:legal` (CLAUDE.md).
- [ ] **Automated texts and reminders** (`capabilities.ts` `automatedTexts`, held off on purpose so Done never promises reminders nobody sends; Emmett approved holding it, November 13). Turn it on only once GoHighLevel sends them, through the same legal steps, because the terms and privacy wording changes with it.

- [ ] **Turnstile:** ready in code. Before setting `TURNSTILE_SECRET_KEY` in Production, test once on a Deploy Preview with Cloudflare's always-pass test keys, then the real ones (`QUEUE`, "From the final pre-release review").
- [ ] **The one-calendar design** for Imperion's GoHighLevel work: a spec only. Nothing is built until Elijah and Imperion pick a concept (`QUEUE`, "a design spec for one Google calendar").

## 7. Tell Elijah

- [ ] What shipped (step 3's list), that the Confirm freeze is fixed, and which number is live (step 1).
- [ ] If step 4 ran, ask him to re-clone.

## Not on this list on purpose

- **BIMI (inbox logo):** closed. Elijah: not trademarked, not worth it.
- **The city pages going live:** they wait for Elijah's local jobs and reviews and a person-written paragraph, not for the freeze (`STATUS`, "Before the first city or service page is published").
- **Multi-day day plan to the server:** no effect until paint correction is bookable.
