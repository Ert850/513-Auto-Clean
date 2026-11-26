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
