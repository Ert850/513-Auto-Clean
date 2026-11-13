# Deliverables due Friday, November 13, 2026

Taken from two voice notes. Each item is checked against what is in the repo
on branch `eNov6`. Items marked **OPEN** are waiting on an answer to a
question at the end.

**The deadline (Part 2 replaces Part 1).** By **Friday, November 13**, every
item in sections 1 to 5 has to be at least *attempted and implemented*. If
something hits a real roadblock, it is fine to leave it unfinished, but the
roadblock has to be written down. Part 1 said "next Friday" and allowed
"at least one of these". Part 2 raised that to "every item attempted, this
Friday". The owner estimates the website changes plus GoHighLevel at about
six hours of work.

**Phase order (set by the owner, November 9):**
1. Interface cleanup, plus sub-pages and the magazine landing pages.
2. Analytics, plus validating the landing pages.
3. Rigorous testing and review of every change.

GoHighLevel runs as a **parallel** feed: the current booking flow (Google
Calendar, Resend, Web3Forms) stays exactly as it is. Whether booking moves to
GoHighLevel is a later decision. Before anything touches the calendar, check
what the live site does first. See `docs/SESSION-CHANGES.md` for that check.

Priority, in the speaker's words: GoHighLevel is "huge" and
"life-changing". The magazine tracking is the stated minimum.

---

## 1. Website: a slimmer home page, with the rest moved to sub-pages

| # | Deliverable | What the repo has now |
|---|---|---|
| 1.1 | **Optimized home page with less on it.** **Decided (Nov 9):** these move off the home page: FAQ to `/faq`; About plus the full reviews grid to `/about` (the review ticker under the hero stays); service area and travel estimator to `/service-area`; the full add-ons catalog to `/services` (the package cards stay). The home page keeps the hero, review ticker, gallery, package cards, schedule, booking and question form | `index.html` is 94 KB with 11 sections: hero, review ticker, gallery, services, about, reviews, service area and travel estimate, FAQ, schedule, booking, question form. There are only 4 HTML pages: index, terms, privacy, 404 |
| 1.2 | **Sub-pages** for the sections taken off the home page | None exist. Each new page has to be added to `FILES` in `web/scripts/build-dist.mjs:24`, or it will never be published. It also has to go into `sitemap.xml` and, if wanted, the Lighthouse audits in `netlify.toml` |
| 1.3 | Check that nothing breaks when content moves | `render-site.mjs` writes the catalog, the FAQ price sentence and the rating into `CATALOG:*` markers in `index.html`, and the FAQ and offer JSON-LD also live in `index.html`. If the services or the FAQ move to another page, those scripts and the structured data have to move with them |

## 2. Magazine landing pages and QR tracking

| # | Deliverable | What the repo has now |
|---|---|---|
| 2.0 | **Decided (Nov 9): full landing pages** for both magazines by Friday, not only the redirect. Each is a short page written for that magazine's readers, tagged with its source, and ends in booking | |
| 2.1 | **Prestige Living landing page**, with its own URL (for example `/prestige`) | Missing |
| 2.2 | **Golf magazine landing page**, with its own URL (for example `/golf`) | Missing |
| 2.3 | **New QR codes**, one per magazine, pointing at those URLs | Missing. **OPEN:** print deadline, and who produces the artwork |
| 2.4 | **Minimum fallback, required:** each magazine URL redirects to the home page but records that the visitor came from that magazine (UTM tags: `utm_source=golf` or `prestige`, `utm_medium=print`, `utm_campaign=qr`) | No redirects of this kind in `netlify.toml`. No UTM handling anywhere in the site |
| 2.5 | **ROI per magazine:** scans, then visits, then bookings, for each one | Not possible today: the booking funnel (`js/funnel.js`) does not record where a visitor came from. The source has to be carried into the booking, the confirmation email and GoHighLevel |

## 3. Analytics

| # | Deliverable | What the repo has now |
|---|---|---|
| 3.0 | **Decided (Nov 9):** it must be free, and a short banner says cookies and analytics are used to see how the site works, not for advertising. The tool is still being chosen; GA4 + Microsoft Clarity is the lead option. Comparison: `docs/ANALYTICS-OPTIONS.md` | |
| 3.1 | **Enable analytics:** page views, traffic sources, which pages people visit, and where they leave the site | Only Netlify Real User Monitoring, which measures page speed and nothing else (`capabilities.ts`, `performanceMonitoring`). `ROADMAP.md:190` says "there is currently no measurement at all" |
| 3.2 | **Tracking within a visit** (the transcript says "in election tracking"; read here as in-session or interaction tracking): roughly where people go and when they click off. Heatmaps or session recordings | None |
| 3.3 | **Turn on the host's settings.** The speaker expects this to be "just something that needs to be enabled". The host is Netlify (the transcript says "website poster"; read as "website host") | Netlify Analytics, the paid server-side option, is off. RUM is on |
| 3.4 | **Conversion events:** booking completed, call tapped, text tapped, form sent, by source | None |
| 3.5 | **Consent banner**, if the tool chosen identifies visitors or follows them between sites | Required by the site's own wording: `privacy.html:125` promises to ask for consent before any such analytics loads. `ROADMAP.md:190` already plans "a cookie banner that genuinely blocks" |
| 3.6 | **Allow the analytics and GoHighLevel domains** in the Content Security Policy | `netlify.toml` CSP (report-only) lists neither. It will report violations until they are added |

## 4. Terms and conditions, and privacy policy

| # | Deliverable | What the repo has now |
|---|---|---|
| 4.1 | **Privacy policy update** naming the analytics tool and GoHighLevel as processors | Generated. Add a `Processor` and a `Capability` in `web/lib/site/capabilities.ts`, change the wording in `web/scripts/render-legal.mjs` (around lines 122 to 192, the "no analytics" sentences), rebuild. Hand edits to `privacy.html` are overwritten by the next build |
| 4.2 | **Terms update** for automatic texts and reminders | The `messages` and `confirmation` sentences are gated on `automatedTexts` and `automatedEmail` |
| 4.3 | **Version bump** | Bump the date in `web/lib/site/legal.ts`, then `npm run lock:legal`. `legal.test.ts`, `privacy.test.ts` and `terms.test.ts` fail if the pages and the switches disagree |

## 5. GoHighLevel connections (top priority)

| # | Deliverable | What the repo has now |
|---|---|---|
| 5.1 | **Bookings go through GoHighLevel properly:** a booking creates the contact and the appointment there. **Decided (Nov 9): the site feeds GoHighLevel.** The site's funnel stays, with its pricing and travel fees. Each booking is sent to GoHighLevel (contact plus appointment, with the magazine source attached), and GoHighLevel sends the reminders and texts | Nothing about GoHighLevel is in the repo. Bookings run on the site's own stack: Google Calendar, Resend, Netlify Functions |
| 5.2 | **The booking lands on the owner's calendar** | The site can already write bookings to Google Calendar (`netlify/functions/_gcal.mjs`), but only if the service account or OAuth token is set. Whether it is set in production is unknown. If GoHighLevel also syncs to Google, one booking could create **two events** |
| 5.3 | **Reminders sent automatically** | None. Resend sends one confirmation email and nothing on a schedule. `ROADMAP.md:112` (reminders at 48h, 24h and 2h) is unchecked |
| 5.4 | **Customers get texts** (confirmation and reminders) | Off. `automatedTexts` waits on Twilio A2P 10DLC registration. GoHighLevel texting (LC Phone) needs its own A2P registration too, and until that clears, texts look sent but never arrive. **This is the most likely roadblock for Friday** |
| 5.5 | **End-to-end test:** a test booking produces a GoHighLevel contact, a calendar event, a confirmation text and email, then a reminder | Not done |

## 6. Google Business Profile: not ours

| # | Item | Status |
|---|---|---|
| 6.1 | Update the Business Profile | **Handled by the contractor who was added as a manager.** No work for us. Optional: point the profile's website link at a UTM-tagged URL so Google traffic shows up as its own source |

## 7. Business context, not website work

Kept for context. These are not deliverables for Friday.

- **Chris (detailer) is joining.** The equipment-financing arrangement is left out because it is not website work.
- **Marketing spend has to go up a lot within about two weeks** (by roughly November 23), or Chris will have no jobs. That is the owner's action. The tracking in sections 2 and 3 is what will show whether the spend pays off.
- **Capacity: about 11 jobs a week** (3 on Sunday, 3 on Monday, then 1 a day Tuesday to Saturday) at an **average of $150**.
  - **Math check:** 11 × $150 = $1,650 a week, which is about **$7,150 a month** (4.33 weeks), not $8,000.
  - $8,000 a month needs about $168 a job, or about 12.3 jobs a week at $150.
- **Implied by Chris joining:** the scheduler assumes one operator. Second-technician scheduling is unbuilt (`ROADMAP.md:237`), so the site cannot offer Chris's slots as well as the owner's. **OPEN:** does the booking system need to book Chris before the marketing push?

---

## Check: every instruction in the transcript, mapped to an item

| Transcript (paraphrased) | Item |
|---|---|
| Updated website with analytics | 3.1 |
| Optimized landing page with less on it, other items moved to sub-pages | 1.1, 1.2 |
| Prestige Living and golf landing pages for the printed magazines | 2.1, 2.2 |
| Updated QR code to redirect to those pages | 2.3 |
| At minimum, `/redirect` to the home page but track that someone went there | 2.4 |
| Track ROI on those magazine purchases | 2.5 |
| Tracking of roughly where people go and when they click off | 3.2 |
| Enable settings with the website host | 3.3 |
| Update terms and conditions and privacy policy | 4.1, 4.2, 4.3 |
| Google Business Profile: the contractor handles it | 6.1 |
| GoHighLevel books things properly | 5.1 |
| Sends reminders | 5.3 |
| Texts the customer | 5.4 |
| Books my calendar when it goes through | 5.2 |
| Chris and equipment purchase | 7 (context only) |
| Increase marketing spend in the next two weeks | 7 (owner action) |
| 11 jobs a week, $150 average, about $8,000 a month | 7 (math flagged) |
| Friday: every item attempted and implemented; roadblocks allowed | Deadline line at the top |

## Open questions

Answered on November 9: GoHighLevel (the site feeds it), home page sections,
magazines (full landing pages), and the analytics constraints (free, with a
banner).

Still open:

1. Analytics: pick an option from `docs/ANALYTICS-OPTIONS.md`.
2. GoHighLevel: is the account's A2P texting registration approved? Which
   GoHighLevel calendar should bookings go to? Is there an API key or a
   webhook URL for the site to send bookings to?
3. Magazines: URL slugs, any offer or code for each, and the print deadline
   for the QR codes.
4. Is the deadline Friday, November 13?
5. Does the booking system need to book Chris's time as well?
6. Calendar: once GoHighLevel syncs to Google Calendar, should the site stop
   writing its own event (`_gcal.mjs`), so a booking doesn't appear twice?
