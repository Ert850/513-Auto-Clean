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
- **Still open:** the originals are in git history. Purging them rewrites history and needs Emmett's yes (with runbook step 4).
- **Test:** `cd web && TZ=America/New_York npx vitest run lib/site/photo-gps.test.ts`.

## November 26: FAQ add-on price line

- `faq.html` said pet hair, steam and ozone are "billed at $50/hr". The $50 was stamped from `addonRateCents`, the hourly rate for extra hands-on time beyond the listed work, not the add-ons' price: they are fixed prices, and steam is $80 or $115 (root cause: the stamp tied the sentence to the wrong setting). The stamp entry is removed with the number. Now "as add-ons for tougher jobs, each priced on the Services page", in the answer and its structured data.

## November 26: the live check after the go-live (merge 1c6dbe4)

- **"The deploy is STALE, 10 assets behind" was a false alarm.** *Root cause:* `check-live.mjs` read the stamps from the repo's own `index.html`, which the build writes with the repo's phone number, while the live build folds its published number (`BUSINESS_PHONE`, the toll-free line) into every `?v=` stamp. So every deploy with `BUSINESS_PHONE` set looked stale, and a real stale deploy would have looked the same. *Fix:* the stamp is one function, `web/scripts/asset-hash.mjs`, used by the build (`stamp-assets.mjs`) and by the check, which works the stamps out with the number the live page shows. `js/config.js` is left out: the build writes it from Netlify's own settings. Checked: the live site now matches on 9 files; a changed `js/gallery.js` is still reported stale; a rebuild changes no stamp.
- **"create-payment: unexpected HTTP 503 off" was the payments switch doing its job.** Since November 23 (P7) the function refuses before any Stripe call while card on file is off in `capabilities.ts`; the check predates that. It now reports it as switched off, not as a failure.
- **Stripe's `unsupported_publishable_key_tokenization_surface` (November 22) was not us.** A bot (`mine-skeleton/1.0`, a Hong Kong cloud server) sent the 4242 test card number straight to `/v1/tokens` with the live publishable key, which every page carries. Stripe refuses raw card numbers on that key, so nothing happened. Our pages use Stripe's Payment Element and our functions use the secret key; nothing of ours calls `/v1/tokens`.
- **The test card declined in live mode (November 25, 7:58 PM) was the PR #13 preview** while its `STRIPE_SECRET_KEY` was the live key. Elijah set the preview's own key that evening; Production and Deploy Previews now hold different keys.
- **To test:** `node web/scripts/check-live.mjs` (0 failed; the notes are PayPal, Turnstile and card payments, all off on purpose).
