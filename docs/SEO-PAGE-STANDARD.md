# The SEO page standard (service, add-on and area pages)

Written November 26, 2026, for the hub of 30 to 40 pages Imperion asked for. Elijah's method: build one good master page, write down what makes it good, then generate every other page and grade each one against this list.

- **Master page:** `interior-car-detailing-cincinnati` (`config/services/interior-car-detailing-cincinnati.json`, rendered by `web/scripts/render-services.mjs` into `web/templates/service.html`). It's a draft: noindex, out of the sitemap, and left out of production builds.
- **Elijah's brief:** "Simple, 2-3 good examples/photos, main title to tell them what to do, etc. (Hormozi it)". In other words, make the offer obvious, prove it, remove the effort, and give one thing to do.
- **Read with:** `SEO-COMPLIANCE.md` (Google's rules on doorway and scaled pages, and the R1 to R7 bar for city pages) and `CITY-SERVICE-LINKS.md` (where the links come from). This file doesn't repeat them.

## How to grade

- Every item is pass or fail. ★ marks a **gate**: a page doesn't publish until every ★ passes.
- **Score** = items passed ÷ items that apply. A page publishes at **90% or more with every ★ passing**.
- **(build)** means `npm run build` already fails when the item fails. Everything else is checked by a person: on the Deploy Preview, at 1440×790 and 375×812, with nothing scrolled.
- Grade from what the visitor sees, not from the config.

## A. The offer (the first screen)

| # | Item |
|---|---|
| A1 ★ | **The H1 says what to do and what they get,** naming the service and the place: "Book interior detailing in Cincinnati. We come to your driveway." There's one H1 (build). |
| A2 | **The subtitle says what gets done, where, and that the full total shows before booking.** It's at most 3 lines at 1440. |
| A3 ★ | **One offer:** one package, with its name, its "from" price and its time, all from the catalog (`offer` in the config). |
| A4 ★ | **One solid Book button above the fold** at 1440×790 and at 375×812. It reads "Book Now" (build test). The header's Book Now doesn't count. |
| A5 | **The Google rating and the trust pills are in the first screen** (rating from `data/reviews.json`). |
| A6 | **Proof starts in the first screen:** the before/after card at 1440, and its top edge at 375. |

## B. Proof

| # | Item |
|---|---|
| B1 ★ | **2 or 3 before/after pairs of this service,** not a gallery (build: at least 2 to publish, at most 3 shown). Each is a reviewed pair from `data/gallery.json` and tagged with the page's service. The first one never loads lazily. |
| B2 ★ | **2 or 3 reviews about this service** (build: at least 2 to publish). Each review's text names the work, or its job was this service. Quoted unedited from `data/reviews.json`, signed with a first name and "on Google", and linked to the profile. No `Review` or `AggregateRating` markup (`SEO-COMPLIANCE.md` §4). |
| B3 | **Captions and alt text say what was done,** with no removal word in a caption and no place that nobody checked. A town appears only through section G. |

## C. What helps them decide

| # | Item |
|---|---|
| C1 ★ | **What each level includes and leaves out,** from the catalog (`componentsOf`, `notIncluded`). Never typed into the page. |
| C2 ★ | **Prices from the catalog only:** "from" prices, the size upcharges, and the line that the exact total, with travel and tax, shows before booking. A typed number fails the build (R6). |
| C3 | **How it works in 3 to 5 steps** (build: at least 3). |
| C4 | **A straight answer on the limits:** what it won't do, said before they book. |
| C5 ★ | **5 to 8 questions in the customer's words** (build: at least 5 to publish). The first sentence of each answer answers it ("Yes.", "No.", a price, a time). Numbers come in through `{price:}`, `{time:}` and `{addon:}`. The answers come from Elijah (`QUESTIONS-FOR-ELIJAH-SEO.md`). |
| C6 | **Where we come:** a link to Range & Travel, plus the published city pages that cover it. |

## D. Links into the hub

| # | Item |
|---|---|
| D1 | **Breadcrumb Home › Services › page,** visible and in the markup. |
| D2 | **Links out:** Services (all packages), the add-ons, Range & Travel, FAQ, Reviews, and the published pages next to this one (sibling services, cities). |
| D3 ★ | **Linked from at least 2 other pages once published,** and never linking to a draft (build: `checkDist`, `page-links.mjs`). |

## E. Technical SEO, GEO and AEO

| # | Item |
|---|---|
| E1 ★ | **Title at most 60 characters** with the service and the city, unique (build). |
| E2 ★ | **Meta description at most 155 characters,** unique, with the price from the catalog (build checks the length). |
| E3 ★ | **One clean address and canonical** (`/slug`, never `.html`), no heading skips, in the sitemap once published (build). |
| E4 ★ | **Structured data:** `BreadcrumbList`, plus a `Service` whose `provider` is the home page's business (`@id …/#business`), with catalog `offers` and `areaServed`. The business entity (`AutoWash`, phone, hours) is defined once, on the home page. No FAQPage (decision 4 below). |
| E5 | **The og:image is the page's own after photo,** not the site-wide hero. |
| E6 ★ | **Unique text:** at most 0.30 overlap with every other page, and never over half of one page inside another (build, R2). |
| E7 | **Fast and light:** weight within about 10% of the Services page; CLS at most 0.1; PageSpeed mobile LCP at most 2.5 s on the Deploy Preview; images WebP, under 150 KB, with width and height set. |
| E8 | **Answer-engine ready (GEO/AEO):** the plain facts a model would quote sit in visible text, not only in markup: what it is, who it's for, the price from, the time, the area, how to book. The business's name, phone and area match the home page and the Google profile word for word. `llms.txt` lists the page once it's published (automatic). |

## F. Wording (all ★)

| # | Item |
|---|---|
| F1 ★ | **No em dashes, and nothing that sounds generic or AI-written.** Plain and specific, in Elijah's voice (`BUSINESS-CONTEXT.md` §5). |
| F2 ★ | **No removal promises** ("removes", "100%", "gone"). Say treat, lift, reduce or deep clean. A catalog name such as "Pet Hair Removal" is a name, not a promise. |
| F3 ★ | **Every claim is true today:** "UC student-owned", what we bring, how payment works. A claim marked Unconfirmed in `SEO-COMPLIANCE.md` §5 stays off the page. |

## G. Photos tied to places

A photo's town makes a local page honest ("a Full Interior in Delhi Township"), but only when it's proven. The process:

1. **Every pair records its job.** `source` in `data/gallery.json` names the job folder and the photo files (`_howToAdd` A). The folder gives the service and the date.
2. **The date comes from the original** (the job folder, or the original photo's capture date read on Emmett's machine). Never from a file in this repo: published files are saved fresh, with no EXIF.
3. **Match the date to the job calendar, reading only.** Look for the booking event that day for the same vehicle. The town comes from the event's ZIP (the last thing in the location, by the JobsSync contract). Never create, move or edit an event: the live site reads these calendars.
4. **Store the town and ZIP only:** `"town": "Delhi Township", "zip": "45238"` on the pair. Never the street, the customer's name, the event's id or any coordinates. The repo is public.
5. **No clean match, no town.** If there were two jobs that day, or no event, or the vehicle doesn't match, the pair stays unplaced.
6. **Where a town shows:** a pair with a checked town can be a city page's `localJobs` (its ZIP must be among the page's ZIPs, R1) and can name the town in its caption.

## The master page's grade (November 26, preview build)

Screenshots at 1440×790, 820 and 375 are in the session's scratchpad (`shots/v1/`), not the repo.

| # | Result | Evidence |
|---|---|---|
| A1 | Pass | "Book interior detailing in Cincinnati. We come to your driveway." One H1. |
| A2 | Pass | 3 lines at 1440; it says the full total, travel and tax, shows before booking. |
| A3 | Pass | "Most popular: Full Interior + Steam, from $315, about 5 hrs", from the catalog. |
| A4 | Pass | Book Now's bottom edge at 567 px of 790 (1440) and 561 of 812 (375). |
| A5 | Pass | 5.0 on Google (32 reviews), with 3 pills. |
| A6 | Pass | The card is beside the copy at 1440; its top shows at 375. |
| B1 | Pass | 3 pairs (pethair, crv-interior, sonic-interior), all interior, first one `fetchpriority="high"`. |
| B2 | Pass | 3 reviews: "transformed the interior", "fully steamed everything", "every detail on the interior". |
| B3 | **Fail** | The first pair's caption reads "Pet hair removal, Full Interior" (from `data/gallery.json`, shared with the home page). It should say what was done: decision 3. |
| C1 | Pass | 3 level cards from the catalog, each with "Not included". |
| C2 | Pass | Prices are stamped; the size line and the total line are present. |
| C3 | Pass | 4 steps. |
| C4 | Pass | The "Straight answer" box. |
| C5 | **Pending** | 8 questions with direct first sentences. The answers come from `BUSINESS-CONTEXT.md` §4 and the catalog, not yet from Elijah's own answers. |
| C6 | Pass | A link to the service area (city pages join automatically once published). |
| D1 | Pass | Visible, and in `BreadcrumbList`. |
| D2 | Pass | Home, Services, add-ons, Range & Travel, FAQ, Reviews and the Google profile. Sibling pages join once published. |
| D3 | n/a | Draft. Once published, the footer and Services tab row link it (`page-links.mjs`). |
| E1 | Pass | 53 characters. |
| E2 | Pass | 147 characters, price stamped. |
| E3 | Pass | Canonical `/interior-car-detailing-cincinnati`, headings h1 › h2 › h3 with no skips. |
| E4 | Pass | `BreadcrumbList` and `Service` (provider `#business`, 3 offers, areaServed). |
| E5 | Pass | `ba-pethair-after-760.jpg`. |
| E6 | Pass | The build's overlap check passed against Services, Home, FAQ, About and the other drafts. |
| E7 | **Pending** | 638 KB at 375 (Services: 608 KB) and CLS 0. LCP needs PageSpeed on the Deploy Preview; a local server can't measure it. |
| E8 | Pass | Price, time, area and how to book are in visible text; the business entity comes from the home page. |
| F1 | Pass | No em dash in `<main>`. |
| F2 | Pass | Page wording: "treat", "improve", "never fully come out". "Remove…" appears only in catalog checklist lines and the add-on's name. |
| F3 | Pass | Only claims already on the live site. "We bring what we need" is in `BUSINESS-CONTEXT.md` §4 but marked Unconfirmed in `SEO-COMPLIANCE.md` §5: It's one of the facts for Elijah to confirm at the end of `QUESTIONS-FOR-ELIJAH-SEO.md`. |

**Score: 25 of the 28 items that apply (89%), just under the 90% bar.** One fail: B3, a caption shared with the home page (decision 3). Two items are pending: C5 waits for Elijah's answers, and E7 waits for PageSpeed on a Deploy Preview. With those two closed the score is 27 of 28 (96%), and every ★ item passes.

## Decisions before the other pages are generated

1. **The H1 pattern.** "Book <service> in Cincinnati. We come to your driveway." is action first. Other options: "<Service> in Cincinnati, done in your driveway" (the old one, descriptive), or outcome first: "Your car's interior, clean like new, without leaving home" (keyword only in the title).
2. **The hero's Book button.** It opens the form on Interior (unchanged behavior), not on the offered package. Preselecting Full Interior + Steam would match the offer line, but it changes what the form opens with.
3. **The pet hair pair's caption,** "Pet hair removal, Full Interior". It shows on the home page carousel too. Proposed: "Pet hair cleaned out, Full Interior".
4. **FAQPage markup.** `SEO-COMPLIANCE.md` decided against it: Google stopped showing FAQ results in 2026. Bing and AI answer engines may still read it, and it costs one generated block. The master page leaves it out.
5. **The page list.** One page per package, or one per side (interior, exterior) plus one per add-on? With 6 reviewed pairs (all interior, one headlight), most exterior and add-on pages can't meet B1 yet. Pages without their own photos and reviews would be thin, which is the doorway risk in `SEO-COMPLIANCE.md` §1.
6. **Soonest opening on the page.** Timing is the second reason leads don't book (`BUSINESS-CONTEXT.md` §2). A live "next opening" line in the first screen is likely the next conversion win, but it's new work and touches the booking flow.
7. **An automatic grader.** A script that checks the build's items in `dist/` and prints this table per page would make grading 40 pages mechanical. It isn't built.
