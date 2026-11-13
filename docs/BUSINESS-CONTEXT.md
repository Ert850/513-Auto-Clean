# Business context for website work

Written 2026-11-11 by the owner's agent, for Emmett and any agent changing the site. It's distilled from the business line's full text and call history (March to November 2026), the Google Business Profile export, the booking calendar and the accounting records.

This repo is public, so this file has **no customer names, phone numbers, addresses or dollar figures**. The full version, with the customer list, is Elijah's private "Data Pack" Google Doc. Ask him for access.

## 1. What we sell and to whom

- **Lead offer:** Full Interior and Full Interior + Steam Clean, as the default package (currently Full Interior plus the steam extra, which costs less with Full Interior than with other packages; see `web/lib/catalog/`).
- **Heavy-soil work:** welcome, and it's our biggest tickets: pet hair, kids, vomit, urine, smoke, mold, stains. Vans and minivans with heavy soil are the largest jobs.
- **Not pushing:** exterior in winter, paint correction or coating as a lead offer, or discounts.
- **Customer:** busy homeowners who want it done right the first time, value trust, and like supporting a local UC student-owned business.
- **Target areas:** the West side and the Northeast pay about **2x** what Uptown and Downtown jobs do. Uptown sends many jobs at the lowest ticket.

| Area | Ticket | ZIPs |
|---|---|---|
| West side | highest | 45211 45238 45233 45247 45248 45239 45251 45252 45204 45205 45002 45030 45052 |
| Northeast | high | 45241 45242 45243 45249 |
| East / Clermont, NKY | mid | 45230 45244 45245 45255 45150 45140 45103 45157 45174, 410xx |
| East-central, North | lower | 45207 45208 45209 45212 45213 45226 45227 45236 / 45224 45231 45240 45246 45215 45218 45216 45237 45040 45069 45014 45011 |
| Uptown / Central, Downtown | lowest | 45219 45220 45229 45217 45232 45223 45206 45225 / 45202 45203 45214 |

The same ZIP lists drive Elijah's Google Sheet (`implementation/sheets/JobsSync.gs` in his workspace) and the GHL area tags. Keep any site-side area logic consistent with them.

## 2. What the data says that matters for the site

- **Reply speed wins.** Leads that booked got a median first reply of about 9 minutes; lost leads about an hour. Make "text us" as prominent as Book Now, and missed-call text-back (GHL) is a priority.
- **About 60% of real inquiries book.** Referrals and UC events convert best, the website about 55%, and calls with no known source about 40%.
- **Most leads have no recorded source.** Keep `source` and "Where did you hear about us?" in every booking, and keep UTM tags on GBP, ad and QR links.
- **The total surprises people.** The top reason leads didn't book was price, often surprise at travel plus tax on top. Show the full total, with travel and tax, as early as possible, and explain travel in one line ("the first 10 minutes of driving are free").
- **Timing is the second reason.** People want same-day or weekend service. Show the soonest real opening, and offer "Choose a day, we confirm the time".
- **Services we don't offer** (polish, dents, boats, HVAC) cause a few lost leads. Say clearly what each service does not do.
- **Vehicles:** Honda and Toyota lead. Pet hair shows up in many inquiries.
- **When leads come in:** inbound calls peak weekdays 10 AM to 1 PM, and texts 9 AM to noon. Weekends are quiet. That's when we're on jobs, so the site has to book without us.
- **Calls:** only about 20% of inbound calls are answered, and many are spam. The site plus GHL text-back has to carry lead capture.

## 3. Customers' own words (for headlines, service pages and alt text)

From 20 Google reviews (all 5 stars):

- **Transformation:** "looks better than when I bought it", "brought new life to my 23-year-old car", "went from eyesore and embarrassing to like new", "cleaner now than when I purchased it".
- **Care:** "attention to detail is unmatched", "incredibly thorough and meticulous", "items in the trunk were folded".
- **Convenience:** "worked on my car while I was working at my office building", "not having to worry about dropping off and picking up".
- **Trust:** "very prompt and professional", "showed up on time", "Communication was great with quick responses".
- **Value:** "fairly priced", "the price was well worth it".
- **Missing from reviews, so add them to site copy:** pet hair, odor, steam, stain treatment, "Full Interior", SUV and minivan, and neighborhood names (Westwood, Green Township, Blue Ash, Montgomery and so on).

## 4. Questions customers ask (FAQ material)

1. Do you come to me? Yes, mobile, at home or work.
2. Do you need my water or power? No, we bring everything. An outlet helps.
3. How long does it take? Basic about 2 hours, Full about 4. Heavy pet hair or stains add time.
4. When do I pay? After the detail, once you're happy with it. No deposit.
5. Is tax included? Sales tax is added at the county rate.
6. Why is there a travel charge? The first 10 minutes of drive are free, then it's priced on the drive.
7. Do I need to be home? No, as long as we have the keys and access.
8. Is pet hair extra? It depends on the amount. Heavy hair is priced by time.
9. Will the stain or smell come out? We treat it and it usually improves a lot, but some stains and odors don't fully come out. Never promise removal.
10. Basic vs Full? Basic is a touch-up. Full goes into crevices, includes shampoo and stain treatment, and gets far more attention.
11. Apartment, busy street or no driveway? We can meet at a nearby lot.
12. Rain? It only affects exterior work.
13. Headliners? Usually not, because they can sag when treated.

## 5. Wording rules (site-wide)

- **No promises of stain or odor removal.** Use "treat", "lift", "reduce", "deep clean" or "restore".
  - The Stain Treatment and paint correction tiers used to give removal percentages. That was fixed in 61c976b; keep it that way.
- **No em-dashes** in anything customers read. US spelling.
- Say **"UC student-owned"**, never "college kid".
- **Prices** live only in `web/lib/catalog/`. Every price in the old texts is stale.
- **"Ceramic Wax Sealant" is not "ceramic coating".**
- **No review incentives or gating.** The review link goes to everyone, with no discount or code attached.
- **Voice** (from about 1,400 of Elijah's texts):
  - Warm and plain: "Perfect", "Sounds good", "Of course".
  - Concrete times with a one-hour arrival window, and itemized totals.
  - When something goes wrong, own it and offer a specific fix.
  - Emoji, if any, are 😊 and 💙 only.

## 6. Google Business Profile issues that touch the site

- The GBP website link is `http://` to the home page. Give Insperion an https booking URL with `utm_source=gbp&utm_medium=organic`.
- GBP lists the hours as 7 AM to 10 PM every day, which doesn't match real capacity. Keep site hours consistent with whatever Insperion sets.
- 10 old GBP posts are still live, with old prices, expired discounts and removal claims. Insperion is clearing them. Don't copy text from them.

## 7. Other traffic sources to keep separate

- **Prestige Living:** a print ad to country clubs. QR code to `/prestige`; it goes to print late Nov to early Dec.
- **Golf course guide:** QR code to `/golf`.
- **Insperion:** Google Ads plus GBP.
- **Emmett:** Meta ads.
- Yelp ads are off.

## 8. Photos

The current site photos need replacing. New before/afters go to the shared Drive folder "513 Auto Clean Photos" (01 Inbox, 02 Selects, 03 Website, 04 GBP and Social). The plan is for the gallery to pull from "03 Website" at build time (team brief section 5.1).
