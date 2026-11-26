# Next round: Elijah's ideas, November 16, 2026

Elijah's list:
- individual service pages;
- more photos for each service, so people can see what each one is like;
- video on the front landing page and the booking page;
- pricing for stain work and the other packages and add-ons, tuned from analytics.

**Where each stands:**
- Most of the groundwork already exists on `eNov14`.
- What's missing is mostly content (checked photos and video clips), plus three UI changes and one measurement plan.

**Mockups:** `docs/mockups/eNov16-next-round-mockups.png`, made like the last round: the eNov14 build beside the same page with the change injected in headless Chrome.

**Decision (Emmett, November 16): G to I are on hold.** "G - I requires better photos and videos and makes the website clunkier. Would wait for future input."
- Nothing here is built. G, H and I wait for better photos and videos, and for new input from Emmett. Don't re-propose them before that.
- P (pricing) is a plan for Emmett to review before any code.

## What's already done

| Idea | Done on eNov14 | Missing |
|---|---|---|
| **Individual service pages** | A page generator (`web/scripts/render-services.mjs`, `config/services/*.json`). Two drafts are on the preview site: Interior Car Detailing, and Stain, Spill & Odor Treatment. Prices come from the catalog; no removal promises. | **Publishing.** Each page needs 2 or more checked before/after pairs of its service, plus the two SEO sign-offs (`AFTER-TOLL-FREE-APPROVAL.md` step 5). **More pages** (Exterior, Pet Hair, Headlight Restoration) are one JSON file each once their photos exist. Exterior has no pairs at all. |
| **A photo per service** | The four home service buttons have photos (`config/home-services.json`). Every gallery pair is tagged with its services (`data/gallery.json`), and the service pages show tagged pairs as proof. | Package cards on Services and in the booking form have no photos (G, H). **Coverage gaps:** Full Interior + Steam, Maintenance, Stain (1 pair, unchecked) and every exterior package. |
| **Video, booking page** | `/book` has a 9:16 video slot beside the booking card (`config/booking-page.json` `video.src` and `video.poster`). It shows the hero photo until a clip is set. | A clip from Elijah, checked for plates and faces. No code (J on the sheet). |
| **Video, home** | Gallery pairs have a `video` field, and the package and add-on renderers have spots marked for clips. Nothing renders yet. | The hero video (I), and clips. |
| **Analytics-based pricing** | GA4 events (with consent): `extras_open`, `addon_add`, `booking_complete` and `booking_request` with the total and source (not the packages), and the time-step events. The booking email and calendar event carry package, add-ons, total, source and A/B versions. An A/B framework for wording and layout exists (`config/experiments.json`). | What was **shown but not chosen** (attach rates), a report, and a policy for price changes (P). |

## With mockups (G to I): each needs a go

| | What | Proposed | Notes | Size |
|---|---|---|---|---|
| G | **Booking form: before/after on package cards** | A before/after strip at the top of a package card when that package has a checked pair; otherwise no photo. | **Pairs and tags** are read from `data/gallery.json` at build, never typed into `funnel.js`. **Photos** are lazy-loaded at 420 px, so the form stays light. **Today only** Basic Interior and Full Interior have one. | Medium |
| H | **Services page: a photo per package** | **Option A (recommended):** a small before/after and "See a real result", which opens the comparison. **Option B:** a photo header on each card. | **Your 1440×790 test:** Option A moves the Book buttons from 698 to 744 px, still in view. Option B pushes them to 813 px, out of view. **Under either option,** the offers banner moves further below 790 px (it already ends about 11 px below). The home page keeps its cards as they are unless you say otherwise. | Small |
| I | **Home: hero video** | A short muted loop behind the headline, with today's photo as its first frame and its fallback. **Controls:** a pause button (WCAG 2.2.2, for anything that moves for more than 5 s). **Stays still** under reduced motion and Data Saver. **Loads after the page,** so the photo stays the first big paint. | **Waits for:** a clip, and the end of the `hero-headline` A/B test, which runs on this hero (4 weeks from the merge). Changing the hero mid-test would mix two changes in one result. | Medium |

**J needs no code:** a 9:16 clip for `/book`, put in `images/` and named in `config/booking-page.json`.

## P. Pricing from analytics: a plan for your review (no code yet)

**The constraint:** CLAUDE.md says new prices wait until bookings show the current ones convert. So this starts with measuring, not with changing prices.

1. **Measure what's shown, not just what's chosen.** Add two GA4 events, under the existing analytics consent:
   - `package_view`: the packages shown and their order;
   - `addon_view`: the add-ons shown on Extras, recommended or not.

   With `addon_add`, these give an attach rate for each add-on and each stain tier (surface against deep). Small change, `funnel.js` only.
   - Check with you: whether the privacy policy's analytics wording covers it. It names analytics in general; no legal change is expected.
2. **A monthly report from data we already have.**
   - **Source:** the booking calendar events, which hold every booking's package, add-ons, total, source and A/B versions. JobsSync copies only the service, total, pre-tax amount and lead source into Elijah's Accounting sheet, so the report reads the events themselves.
   - **Content:** package mix, attach rates, stain tier mix and average ticket, by month and source.
   - **How:** a script in `web/scripts/` that reads the calendar read-only. No new service, no customer data in the repo.
   - **Back end:** this is the significant part, so it's yours to approve.
3. **Change prices one at a time, as before-and-after periods, not as price A/B tests.**
   - Showing two prices for the same job at the same time risks customers comparing notes, the terms, the price list and Elijah's accounting all disagreeing, and a slow result.
   - At tens of bookings a month, a split price test would take months to mean anything.
   - Each change is one edit in the catalog, dated in `SESSION-CHANGES`, and read in the next monthly report.
4. **A/B test the presentation, which is safe today.** Same prices, different presentation, through `config/experiments.json`:
   - stain work as its own entry ("Spills and Stains") against an add-on;
   - which stain tier is suggested first;
   - the "Most popular" label.
   - Each counts bookings per version from the booking emails, as `AB-TESTING.md` says.

**Questions for you:**
- Do 1 and 2 go ahead?
- Does Elijah want a report, or just the numbers in his sheet?
- Is "one change at a time, no price splits" the rule?

## Needs from Elijah (content, not code)

- **Check the 5 unchecked pairs.** `third-row-seat-stains`: re-crop or drop.
- **New pairs:**
  - **exterior** (any package): none today;
  - **Full Interior + Steam;**
  - **stain:** a second pair, so the stain page can publish;
  - **pet hair:** a second pair, for a pet hair page.
- **Clips:**
  - **for `/book`:** one 9:16 clip, about 15 to 30 s, of the work, with no plates or faces;
  - **for the home hero (I):** one short loop.
- **Where to put them:** the shared Drive "03 Website" folder, as agreed. The photo pipeline (`QUEUE-AFTER-FRIDAY.md`) would later pull them in automatically.
