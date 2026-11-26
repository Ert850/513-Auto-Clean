# Session changes: gallery pairs (November 26)

## Elijah's five pairs replaced, and a checklist before any pair goes in

- **What was wrong (Emmett's review):** none of the five pairs from commit 4e0279f met the bar.
  - `third-row-seat-stains`: a portrait before against a landscape after from another angle, and papers and a booster seat in the before.
  - `soul-cargo`: the before was already clean, so the pair showed nothing.
  - `captain-chair`: misaligned. It was worse than that: the before (IMG_9213) is one second-row chair and the after (IMG_9237) is the other one, shot from the opposite door.
  - `civic-front-floor`: the before is the passenger's floor, the after the driver's.
  - `forester-front-floor`: the before is the driver's floor, the after the passenger's.
- **Root cause:**
  - The pairs were taken from Drive "03 Website" and trusted because of the folder's name. Its pairs were made by name and job, and nobody checked that a before and its after showed the same spot. Three of the five did not.
  - There was nothing written to check against: `_howToAdd` said "roughly the same angle and crop", and the `reviewed` flag (added November 16) listed privacy items and "matching crops" only.
  - The problems that were seen (the bag, the papers, portrait against landscape) were logged as "to confirm with Elijah" while the pairs went first in the carousel.
  - Every pair was exported 3:4 for a 4:3 card (`.ba-stage`, `object-fit: cover`), so the site showed a middle strip nobody had reviewed.
- **Class fix:**
  - `data/gallery.json` `_howToAdd` is now a pass/fail list, A to G: source from the job's own folder (Drive 05); the same car, spot and side, proved by the car's fixed parts; aligned and cut to the card's frame; a visibly dirty before and a visibly clean after at card size; nothing personal (door-jamb labels included: they carry the VIN); tags and captions true to the job; judged as the site cuts it. A pair that fails one is fixed or left out, never added with a question.
  - `web/lib/funnel.smoke.test.mjs`, "every before/after pair is cut to the card's frame": for each pair and width, the before and after WebP are the same size, the width matches the file name, and the shape is the `.ba-stage` aspect ratio read from `styles.css`. It fails on all five old pairs and on `console`.
  - One line in `CLAUDE.md` under "Results carousel".
- **The new pairs, round 2** (all `"reviewed": false`; the owner approves them on `docs/GALLERY-PAIRS-V2.png`). Elijah raised the bar the same day: the contrast has to be obvious (his example: a light seat cushion soaked in brown and orange staining, clean after). `_howToAdd` D now says so. Every job photo in Drive 05 (about 1,700 after duplicates, every folder including Basic Interior and _Unmatched) was looked at as a thumbnail first; full files were downloaded only to judge or cut a pair.
  - `suv-third-row-stains` (new): light cloth third-row cushion soaked in brown and orange staining, Stain, Spill and Odor job of June 29 (IMG_8811, IMG_8814). The same job as the old `third-row-seat-stains`, now a matched landscape pair cut tight to the cushion, clear of the papers, bottle and candy box beside it. Tags `full-interior` (Elijah's caption for the job) and `stain` (the job folder). Day before, flash after.
  - `civic-seat-stains` (kept, round 1): roughly the minimum contrast.
  - `wheel-brake-dust` (new): five-spoke alloy wheel with heavy brake dust, _Unmatched job of September 16 (IMG_1193, IMG_1195). Aligned on the hub and lug nuts; the after was shot a little more square-on, so the rim edge sits about 2% off. No tag: the package isn't known.
  - `rear-floor-grit` (new): rear footwell carpet under a layer of sand and grit, _Unmatched job of February 28 (IMG_6809, IMG_6810, four minutes apart). Aligned on the seat rail and floor pad; the after was taken from a little higher, so the near edge of the footwell differs. The source is only 2048 px wide, so it ships at 420 and 760 only. No tag.
  - `wheel-road-grime` (new): alloy wheel dulled with road grime and brake dust, _Unmatched job of April 11 (IMG_7617, IMG_7618). Near the minimum contrast, like `civic-seat-stains`. No tag.
  - Dropped from round 1: `captain-chair` (subtle crumbs, day against night, armrest moved) and `minivan-driver-floor` (a dusty before, now below the bar).
  - Images: 1400x1050 masters, 420/760/1120 WebP and a 760 JPEG, each under 150 KB, re-saved so no EXIF or GPS goes with them.
- **Elijah's example job (the light seat with the grey quilted back) is not in Drive.** Not in 01 Inbox, 02 Selects, 03 Website, 04 or 05; the newest job folder in 05 is September 20 (the NAS export ran November 14, nothing added since). It needs uploading before it can be cut.
- **Where the old slugs were used, now:**
  - home "Interior" button: `suv-third-row-stains` (after); home "Spills and Stains" button: `civic-seat-stains`;
  - Delhi hero: `suv-third-row-stains`, `civic-seat-stains`, `pethair`, `rear-floor-grit`;
  - Indian Hill hero: `rear-floor-grit`;
  - stain page hero: `civic-seat-stains`; its proof now has two stain pairs;
  - interior page proof: `suv-third-row-stains`, `crv-interior`, `sonic-interior`.
- **`console` re-cut** to 4:3 (420 and 760, centre crop of its own masters, which is what the card already showed), so the new check passes. Its 3:4 masters are unchanged.
- **To test:** `cd web && TZ=America/New_York npx vitest run` (893 pass); a preview build passes; a production build still fails until each new pair is `reviewed: true` or removed (by design). On the preview: the home carousel's first five cards, the Interior and Spills and Stains buttons, the Delhi, Indian Hill, interior and stain pages' photos.

## November 26, before the merge: candidates held back

Emmett: no new pairs until Elijah's better photos replace them. The 5 candidates are removed from `data/gallery.json` and `images/` (recoverable from e9336d3; sheet `docs/GALLERY-PAIRS-V2.png`), and their usages point at the earlier checked pairs again (as before 4e0279f on the home buttons). The checklist (`_howToAdd` A to G) and the frame test stay. The stain draft page has no hero carousel until a checked stain pair exists; `locations.test.ts` allows that only for a noindex draft.

**Where the newer photos are:** the NAS's Cloud Sync was also linked to Elijah's business Google account on September 20; our Drive connector sees only his personal one, where "05" stops at September 20. He shares the photo and pairs folders from the business Drive with the personal account, then the pairs are cut the same way.

- **To test:** `cd web && TZ=America/New_York npx vitest run` (914 pass); a production build passes. On the test site: the home Interior button shows the CR-V interior and Spills and Stains the Sonic pair; the home carousel shows the 6 earlier pairs; the stain draft page has no photo carousel.

## November 26: GPS taken out of seven source photos (Emmett's yes)

- **Found by** the SEO master page session: `images/detail-closeup.jpg`, `escape-dashboard-after.jpg`, `minivan-cargo-after.jpg`, `rear-seats-after.jpg`, `sedan-rear-seats-after.jpg`, `suv-cargo-before.jpg` and `truck-interior-after.jpg` carried GPS coordinates (15 tags each) in the public repo since June. The images the site serves were already clean.
- **Root cause:** phone photos were committed as they came off the phone, and nothing checked their metadata. The build's re-encoding hid it on the site, not in the repo.
- **Fix:** the GPS block removed from each file's EXIF without re-encoding (pixels checked identical by hash; orientation kept). `web/lib/site/photo-gps.test.ts` scans every tracked JPEG, PNG and WebP and fails on GPS (proved against an original file).
- **History purged the same evening (Emmett's yes):** see "GPS purged from git history" below.
- **Test:** `cd web && TZ=America/New_York npx vitest run lib/site/photo-gps.test.ts`.

## November 26: FAQ add-on price line

- `faq.html` said pet hair, steam and ozone are "billed at $50/hr". The $50 was stamped from `addonRateCents`, the hourly rate for extra hands-on time beyond the listed work, not the add-ons' price: they are fixed prices, and steam is $80 or $115 (root cause: the stamp tied the sentence to the wrong setting). The stamp entry is removed with the number. Now "as add-ons for tougher jobs, each priced on the Services page", in the answer and its structured data.

## November 26: the live check after the go-live (merge 1c6dbe4)

- **"The deploy is STALE, 10 assets behind" was a false alarm.** *Root cause:* `check-live.mjs` read the stamps from the repo's own `index.html`, which the build writes with the repo's phone number, while the live build folds its published number (`BUSINESS_PHONE`, the toll-free line) into every `?v=` stamp. So every deploy with `BUSINESS_PHONE` set looked stale, and a real stale deploy would have looked the same. *Fix:* the stamp is one function, `web/scripts/asset-hash.mjs`, used by the build (`stamp-assets.mjs`) and by the check, which works the stamps out with the number the live page shows. `js/config.js` is left out: the build writes it from Netlify's own settings. Checked: the live site now matches on 9 files; a changed `js/gallery.js` is still reported stale; a rebuild changes no stamp.
- **"create-payment: unexpected HTTP 503 off" was the payments switch doing its job.** Since November 23 (P7) the function refuses before any Stripe call while card on file is off in `capabilities.ts`; the check predates that. It now reports it as switched off, not as a failure.
- **Stripe's `unsupported_publishable_key_tokenization_surface` (November 22) was not us.** A bot (`mine-skeleton/1.0`, a Hong Kong cloud server) sent the 4242 test card number straight to `/v1/tokens` with the live publishable key, which every page carries. Stripe refuses raw card numbers on that key, so nothing happened. Our pages use Stripe's Payment Element and our functions use the secret key; nothing of ours calls `/v1/tokens`.
- **The test card declined in live mode (November 25, 7:58 PM) was the PR #13 preview** while its `STRIPE_SECRET_KEY` was the live key. Elijah set the preview's own key that evening; Production and Deploy Previews now hold different keys.
- **To test:** `node web/scripts/check-live.mjs` (0 failed; the notes are PayPal, Turnstile and card payments, all off on purpose).

## November 26: GPS purged from git history (Emmett's yes)

- **What was in history:** 19 photo versions with GPS: the 7 cleaned today, plus 12 older before/after photos (`images/ba-*`) that had been replaced since.
- **How:** `git filter-repo` on a fresh mirror, with a blob callback that removes only the EXIF GPS block from any JPEG that has it (`exif.pop(0x8825)`, the APP1 segment swapped, no re-encoding). Each changed photo was checked to decode to the same pixels with the same orientation, or the run stopped.
- **Checked before pushing:** a scan of every image in the 7 rewritten branches found 0 with GPS (313 versions); `main`, `eNov14` and `eNov16` keep identical files, the other 4 branches differ only in the 7 photos; every branch keeps its commit count.
- **Pushed:** all 7 branches in one atomic push, each with `--force-with-lease` on the commit it replaced. New tips: `main` 74da829, `eNov14` and `eNov16` b9b86c2, `eNov6` 1b651a4, `eNov10PipelineBranch` 505cd7f, `fix/blank-booking-form` 7896fdb, `claude/seo-master-page-7e23ad` 5b0faf6. Netlify redeployed `main` (8:06 PM, same files); `check-live.mjs` passes.
- **Not done:** GitHub keeps every pull request's commits (`refs/pull/1` to `13`), which only GitHub Support can clear, so the old photos are reachable there by commit ID. Emmett: not now; later the same night, not at all (no GitHub Support request). Emmett's email in f9a0f6b was not part of this pass.
- **Every old clone is stale:** fetch, then reset each branch to `origin/<branch>` (or clone again). Pushing from an old clone would bring the GPS photos back. The local-only commits checked (for example "Elijah's clarifications", "Help me choose a time") are already in the new history under new IDs.

## Live Stripe key removed from Preview Server & Agent Runners (Netlify, November 26)

- **What:** `STRIPE_SECRET_KEY` held the live key in Netlify's "Preview Server & Agent Runners" context (Netlify's agents and `netlify dev` previews). It's now empty there. Production keeps the live key, and Deploy Previews and branch deploys keep the test key. Nothing redeploys and the live site doesn't change.
- **Root cause:** each deploy context of a Netlify variable is set separately, and the live key was copied into every context that wasn't a preview. It's the same class as November 25, when a Deploy Preview held the live key and a test card was declined as `live_mode_test_card`. That one was fixed in Deploy Previews only.
- **Sweep of the class:** every Stripe and gift card variable checked across every context. `STRIPE_WEBHOOK_SECRET`, `GIFT_CODE_SECRET` and `GIFT_ADMIN_KEY` are set for Production and Deploy Previews only, each with its own value. `STRIPE_PUBLISHABLE_KEY` is public by design. Not money, but worth knowing: `GOOGLE_OAUTH_*` (writes calendars), `RESEND_API_KEY` (sends email), Maps and Places (paid calls) have the same value in every context, including Agent Runners. Previews depend on them, so they're left as they are.
- **Test:** the Netlify variables page shows `STRIPE_SECRET_KEY` as 3 values in 3 contexts, with Preview Server & Agent Runners "Empty".

## Emmett's email removed from git history (pushed November 26, about 10:50 PM Eastern)

- **Where it was:** Emmett's personal email in one old version of `docs/TEST-SITE-SETUP.md` (fixed since), and his university email as the author of 761 commits on every branch. (Neither address is written here: this file is public.) A scan of every file version on every branch found no other copy, and no commit message has either address.
- **Root cause:** git signs each commit with the address in `~/.gitconfig`, and GitHub shows it publicly on every commit. This repo now commits as Emmett's GitHub private address (`git config --local user.email`), so new commits don't carry it.
- **Prepared:** `git filter-repo --replace-text` (the Gmail becomes "Emmett's own address") and `--mailmap` (the UC address becomes the GitHub private address) on a fresh mirror. All 7 branches keep identical files and commit counts, and 0 hits are left in any file or commit (488 commits scanned). Force-pushed with Emmett's yes, atomically and only if each branch was still at the commit copied (`--force-with-lease`); `fix/blank-booking-form` had nothing to change. New main tip 29116dc, published by Netlify; `check-live.mjs` 0 failed. Local checkouts reset (eNov6, main, eNov14, eNov16, eNov10PipelineBranch at eNov6's tip, the SEO branch); the older local-only work branches still carry the old history and must never be pushed.
- **Test:** on GitHub, a commit's author shows the private address; `git log --format=%ae origin/main | sort -u` lists no personal address.
- **Not covered:** GitHub's pull request copies (`refs/pull/*`) keep the old commits until GitHub Support clears them (same request as the GPS photos). Emmett's GitHub profile also shows the UC address as its public email, and only Emmett can change that.
- **Decided (Emmett, November 26, after the push):** no GitHub Support request, for the photos or the email. He is fine with his address on his profile and commits; the repo-local `noreply` setting stays as a default only.

## Contact form fine print matches the form again (November 26, PR #14)

- **What:** "No spam, ever. We only use your info to answer your question" became "We use your info to answer your question the way you pick, and send anything else, like texts or offers, only if you tick those boxes." The unused quote wording got the same change. Source: `config/contact-form.json`; the home page's copy of the section follows at build.
- **Root cause:** the texts and offers boxes were added to every Contact wording on November 26, and the fine print under the button wasn't re-read against them. "Only if you tick" can't say texts alone: Text is the default answer to "Best way to reach you", so someone who asks for a text reply gets one without ticking.
- **Test:** `/contact` and the home page's question form show the new line under Send My Question; `a2p.test.ts` T2 (fixture updated).

## Gift card lookup after a scan no longer needs a second tap (November 26, PR #14)

- **What:** after a QR scan with no key in the box, `js/giftadmin.js` watches the key box for 5 seconds and looks the card up once it fills.
- **Root cause:** the scan handler checked the key once, on page load, and the phone's password manager fills it a moment later.
- **Why not on every input:** typing fires one per keystroke; each would send a wrong key and run into the server's "too many tries". Any keydown ends the wait, so a typed key still uses Look up.
- **Test (done in Chrome with the request stubbed):** a key filled 0.7 s after the scan sends one lookup with the scanned code; typed keys send none; after 5 s a late fill sends none. On a phone: scan a certificate's QR code, let the password manager fill the key, and the card shows without tapping Look up.

## Home page cleanup after the verification work (November 27, review agent)

- **What:** the copy of the whole Contact section on the home page (added November 13 for the number verification) is off: `config/contact-form.json` `"onHomePage": false`, markers kept, `a2p.test.ts` checks it, and turning it on brings the section back byte for byte. The home page is back to hero, four buttons, trust bar and reviews, photos, packages, booking. On a phone the photos start at 1766 px instead of 3471.
- **Also fixed:** in "Ready to book?", the "Explore our detailing packages" bullet split into two columns (`.bc-points li` is a flex row, so the link and the text were separate items; the text is now one span). "We'll get back to you with pricing and a time that works" dated from the June quote form and contradicted "See your exact price before you commit"; it now says you pick a package and time online and see the price as you go. Straight apostrophes there are now curly. The email tile broke "gmail.co / m" at 375 px; it now breaks before the @ (`<wbr>`).
- **Root cause:** verification additions were never on a switch, so when the site stopped being part of the verification nothing said what to undo. Same rule as CLAUDE.md "temporary changes behind a setting".
- **Not done, needs the owner:** what the "Let's get your car booked" section is for now that nothing links to it (it repeats call, text and email); the hours line under the four buttons and where the scroll arrow points; the four buttons' Exterior photo and the coating button (Elijah, `config/home-services.json`); `/book` versus booking in place; the terms line on the question form; the phone bar's Book icon.
- **Test:** home page at 1440 and 375: no Contact form between the reviews and the photos, the bullet reads as one line, the email wraps at the @.

## Privacy policy, November 27 version (pending Emmett's yes)

- The Google Calendar row adds "and into our job records (Google Sheets)" and says only we and the listed providers can see them. A new row, "Our customer management provider", can see our booked jobs and job records to help us run bookings (Imperion supplies the GoHighLevel account, so one row covers both; Emmett asked for the short version, November 27). The job copies go as they are, payment details included (Emmett). Needed before Imperion and GoHighLevel get the calendars and the sheet (`IMPERION-CALENDAR-ACCESS-PLAN.md`).

