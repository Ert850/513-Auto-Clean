# eNov14: the test branch while the live site is frozen

**What eNov14 is:** a branch cut from `main` as of November 14 (PR #12). Everything queued, and the first SEO pass, is built and tested here while Imperion's toll-free verification is pending. Nothing reaches the live site until the freeze ends and Emmett approves a PR.

**Rules for every item:**
- **A mockup first** (current vs proposed, at 1440 and 375, on real pages), approved by Emmett before anything is built. CLAUDE.md design rules apply.
- **Booking and calendar code:** read the code it touches before changing it, with a test for each behaviour, and a booking walked end to end on the test site.
- **Settings, not typed numbers;** temporary things go behind a switch; phones and desktop agree.
- **At the end of each round:** a review agent, a validation agent and a dropped-task agent, then a summary for Emmett.
- **Test site:** a password-gated Deploy Preview of draft PR #13 (changed November 14, Emmett: "we should do a preview"; see `docs/TEST-SITE-SETUP.md`). Bookings go to the TEST calendars, which are emptied after each check.

## Round A: queued changes (in order of safety and value)

| # | Item | Needs first | Mockup |
|---|---|---|---|
| A1 | **(First, with A2; Emmett, November 14.) Home hero:** "Mobile detailing in Cincinnati" (or "Professional…"), Elijah's sub-lines, rating pill + Book Now only. View Services, Contact Us and the hours move below. Hormozi rules (`QUEUE` item 1). | Emmett picks the headline | yes, 2 options |
| A2 | **Four service buttons under the hero:** Interior, Exterior, Spills and Stains, Paint Correction + Ceramic Coatings. Static photos first; the 1-second animations later. Each links to its service page (B4) or to `/book` with that service. | Photos from Drive "03 Website" (the stain button needs a split before/after; correction needs a polisher shot) | yes |
| A3 | **NOT COMPLETE, needs careful human review (Emmett, November 14).** On eNov14 now: Elijah's 5 "03 Website" pairs, with known problems: a bag and papers in two "before" photos, and one landscape against portrait. **Don't ship them as they are.** An agent's ranked, aligned candidates (7 pairs from "02 Selects" and "05": civic-front-mat, civic-rear-floor, soul-cargo-floor, van-driver-floor, civic-door-pocket, van-front-floor, soul-front-floor) and its review sheet are kept outside the repo in `~/Documents/513-scratch-backup-2026-11-12/photo-curation-2026-11-14/`. There's no pet-hair job in the folders, and van-driver-floor has a door-jamb sticker to check (VIN?). **Photo pipeline:** the gallery and service photos from "03 Website". WebP/AVIF under 150 KB, alt text naming the service and town. Every photo checked for plates, faces, house numbers and personal items before use. | The photos finished uploading | gallery swap shown before/after |
| A4 | **/book video:** the 9:16 montage in the slot (one value in `config/booking-page.json`). | The video from Elijah or his editor | no (the slot exists) |
| A5 | **Contact form compact on phones.** Imperion's wording and boxes stay word for word; Send stays visible at 1440×790. | none | yes |
| A6 | **The logo inside the booking emails.** The inbox sender logo (BIMI) is a separate DNS and cost decision for Elijah. | none | yes (email render) |
| A7 | **FAQ:** update to the current packages and policies; then the FAQ program (Elijah's answers in his words). | Elijah's question list | yes |
| A8 | **Booking form quirks:** Package → Continue skips Extras; the week picker opens on past days; the browse list shows steam at $115 before a package. | none | yes (small) |
| A9 | **The booking form with fewer page changes** (Imperion "very interested"; Elijah's notes: sections on one page, one Confirm, the terms visible, less jumping). | Emmett's notes from the Imperion call | yes, several options |
| A10 | **One-calendar design spec** for Imperion and Elijah: 2 to 4 concepts, each with a sample Google calendar week and pros/cons. A document, no code. | none | n/a |
| A11 | **Booking and calendar fixes from the November 13 review:** a server-side free/busy check at booking, Turnstile before its key is set, the multi-day plan sent to the server, local dates, a Web3Forms failure after a saved booking. Each with a test and an end-to-end booking. | none | no |
| A12 | **At unfreeze:** swap the phone number back if Imperion says so, then ship eNov14 in reviewed PRs. | Imperion's approval | n/a |

## Round B: SEO (Imperion's section B), after Round A's mockups are underway

| # | Item |
|---|---|
| B0 | **SEO and Google-compliance research agent.** Google's spam policies (doorway pages, scaled content abuse), helpful-content guidance, local SEO and schema (LocalBusiness/Service, areaServed). It sets the bar each page must clear: how much unique content, which claims are allowed. |
| B1 | **A page pipeline, so a new city or service page is one config file.** `config/locations/<city>.json` and `config/services/<service>.json`, rendered by the build from one template. Each is added automatically to the sitemap, `FILES`, `PAGES`, the chrome markers and the hub (the CLAUDE.md new-page checklist becomes code). **The build fails if two city pages share more than half their text** (measured, not guessed), or if a page lacks its local section, ZIP grid, reviews or photos. |
| B2 | **The `/service-areas/` hub**, in the nav (with the Priority+ sweep at 700 to 1500 px). |
| B3 | **City pages, first two (Emmett, November 14): Delhi / Price Hill (West side) and Indian Hill / Madeira (Northeast).** Learn from building these before Green Township / Westwood and Blue Ash / Montgomery. Each page has its ZIPs and neighbourhoods, local jobs and photos, local reviews, and a 120 to 150 word local paragraph. One mockup per page. |
| B4 | **Service pages:** interior detailing; stains, spills and odor; paint correction and coating (only once offered); fleet (if Elijah wants it). Linked both ways with the city pages and the four home buttons (A2). |
| B5 | **Check before anything ships:** the compliance agent re-checks uniqueness and claims. Then Lighthouse (mobile), the schema validator, and the Search Console URL inspection once live. |

**Claims to confirm with Elijah before any page uses them:** water and power onboard ("deionized water tanks and quiet generators"), "Licensed & Insured in Ohio", durations ("2.5 to 4.5 hours"), and any removal promise (never).

## What to watch

- **Prestige Living** prints late November to early December (Elijah, November 14). The QR code points at `/prestige`, which is live and frozen. Its page is right as it stands; any change waits for the unfreeze.
- **Travel tax:** whether travel is taxable is still a question for an accountant. Nothing changes until it's answered.
