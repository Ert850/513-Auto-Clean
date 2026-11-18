# SEO compliance for city pages (Imperion B3 to B6)

Written 2026-11-14 for Emmett and any agent building `/service-areas/` and `/locations/<city>-oh/`. Research only: nothing here is built yet. Read with `IMPERION-RECOMMENDATIONS.md` (section B), `BUSINESS-CONTEXT.md` and `CLAUDE.md`. Quotes are short extracts from Google's own pages, linked.

**Built November 15** (`render-locations.mjs`, `render-services.mjs`, `locations.mjs`; tests in `web/lib/site/locations.test.ts`):
- **Always checked:** R2 on the rendered `<main>` text, against every other city page plus Range & Travel and the home page, and service pages against each other plus Services and the home page; R4 ZIPs within one area of `config/areas.json` (the Accounting sheet's table), 3 to 12 neighborhoods; R6 no typed numbers in page configs; R3's 120 to 180 words; R7 nearby pages exist, at most 4.
- **Checked on publish:** R1 (2+ local jobs, each with its `zip` among the page's ZIPs and `reviewed: true`; 1+ review with its `area`); R3 `writtenBy` (Elijah or Emmett); R7 no link to a draft.
- **Drafts never reach the live site:** a production build publishes only published pages (`publishedPages()`); Deploy Previews keep drafts for review.
- **Not built, owner's call:** the flat addresses (`/mobile-detailing-delhi-price-hill-oh`) instead of `/locations/<slug>/`, and Range & Travel as the hub instead of `/service-areas/`. R7's "3 or 4 nearby" can't apply until there are more city pages: Delhi and Indian Hill are on opposite sides, so they no longer list each other.

## 1. What Google says

**Doorways.** Google's [spam policies](https://developers.google.com/search/docs/essentials/spam-policies) define doorway abuse as "when sites or pages are created to rank for specific, similar search queries" and list, among the examples:
- "Having multiple domain names or pages targeted at specific regions or cities that funnel users to one page"
- "Creating substantially similar pages that are closer to search results than a clearly defined, browseable hierarchy"

Google's [2015 doorway update](https://developers.google.com/search/blog/2015/03/an-update-on-doorway-pages) gives the test questions still worth applying to every city page: is the page "an integral part of your site's user experience"? Does it "duplicate useful aggregations of items (locations, products, etc.) that already exist on the site"? Is it an "island", hard to reach from the rest of the site?

**Scaled content.** Same [policy page](https://developers.google.com/search/docs/essentials/spam-policies): "many pages are generated for the primary purpose of manipulating search rankings and not helping users", "no matter how it's created". Examples include generating pages with AI "without adding value for users" and "automated transformations like synonymizing". Swapping a city name into a template, or having a model reword one page per town, is exactly this.

**Keyword stuffing with places.** Same page, keyword-stuffing examples: "Blocks of text that list cities and regions that a web page is trying to rank for". The ZIP and neighborhood grid must list only that page's own area, as a short factual list, not the metro.

**Site reputation abuse** is about third-party content hosted for the host's ranking signals. It does not apply to our own city pages; ignore it here.

**Helpful content.** Google's [helpful content guide](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) asks: "Are you using extensive automation to produce content on many topics?" and "Are you writing to a particular word count because you've heard or read that Google has a preferred word count? (No, we don't.)" It calls "Why is it being created in the first place?" "perhaps the most important question".

**Is there an official "% unique" threshold? No.** No Google document gives a uniqueness percentage or a minimum word count for location pages, and the helpful content guide says outright there is no preferred word count. Imperion's "at least 40 to 50% unique" is an agency rule of thumb, not a Google rule. It is a sensible floor, but a page can be 60% unique and still a doorway if the unique part is reworded filler. The practical bar is: **would the page still be worth reading to someone in that area if search engines didn't exist?** That means facts only that area has: jobs done there with photos, reviews from customers there, the ZIPs and neighborhoods we actually drive to, travel and timing for that area, and answers to that area's questions.

**What makes a location page helpful rather than a doorway (our reading of the above):**
- It is reachable in the normal navigation, never an island. As built: the footer on every page, its state's card on Range & Travel, and nearby-city links (R7).
- It answers that area's real questions (is my ZIP covered, what does travel add from here, do you come to a long private drive, what jobs have you done near me).
- Its unique content is evidence (photos, reviews, jobs), not prose about the town's history.
- It lets the visitor act on the page (Book opens in place, as on every page), not only funnel them to the home page.
- There are only as many city pages as we have real evidence for. Two good pages beat twelve thin ones.

**Google Business Profile.** The [GBP guidelines](https://support.google.com/business/answer/3038177) say a service-area business "should hide your business address", the service area "shouldn't extend farther than about 2 hours of driving time", and you can't list a "virtual" office unless it's staffed. One profile only; city pages must never imply a storefront or office in each town. Google's [local ranking page](https://support.google.com/business/answer/7091) names relevance, distance and prominence, and "There's no way to request or pay for a better local ranking". City pages help relevance and organic results; they cannot move the map pack's distance factor.

## 2. Our bar (checkable by the build)

Proposed data: one `config/cities/<slug>.json` per page (settings live in config, per `CLAUDE.md`), rendered by a generator into `locations/<slug>/index.html`. The build fails if any rule below fails.

**R1. Evidence first: a page does not publish without at least 5 items that exist only on it,** made of:
- at least 2 real local jobs with before and after photos, each tagged with a job ZIP inside that page's ZIP list (from the reviewed Drive "03 Website" pipeline; Imperion asks for 3 to 4, which is the target, 2 is the floor);
- at least 1 real Google review from a customer in that area, quoted unedited with first name and town, linked to the profile (if none yet, the page waits);
- the local paragraph (R3);
- the ZIP and neighborhood list (R4);
- 3 FAQ answers that only make sense for that area (R5).
A missing photo, review or answer keeps `"status": "draft"`, which also keeps the page out of production, the sitemap and every link to it (`page-links.mjs`).

**R2. Similarity limit between any two city pages: Jaccard of word 5-gram shingles above 0.30 fails the build, above 0.20 warns.**
- *Text measured:* the visible text inside `<main>` only (the `CHROME:*` header and footer are shared on every page by design and would swamp the score). Lowercase, strip punctuation, collapse spaces.
- *Normalize place words first:* replace every city, neighborhood, road and ZIP from either page's config with one token (`PLACE`, `ZIP`). Otherwise a page that only swaps "Delhi" for "Madeira" scores as different.
- *Shingles:* every run of 5 consecutive words. Jaccard = shared shingles / all distinct shingles across both pages. This is the resemblance measure from [Broder 1997](https://www.cs.princeton.edu/courses/archive/spring13/cos598C/broder97resemblance.pdf), the standard for near-duplicate pages.
- *Why 0.30:* if a fraction s of each page is the same template and the rest is unique, Jaccard = s / (2 - s). Imperion's "no two share more than half" (s = 0.5) is J = 0.33. J = 0.30 means about 46% shared; the 0.20 warning means about 33% shared. A name-swap template scores above 0.6 after normalization, so it fails by a wide margin. The shared parts we want (trust bar, how a visit works, Book button) are short and mostly not repeated prose, so 0.30 leaves room for them.
- *Also fail* if more than 50% of one page's shingles appear in any one other city page (containment, also Broder). This catches a short page that is mostly a copy of a long one, which Jaccard can understate.
- Run it in `npm run build` over all pairs of city pages, and over each city page against `service-area.html` and `index.html`.

**R3. Local paragraph:** 120 to 180 words, written for that area by a person (Elijah or Emmett, from what the jobs there were actually like), never generated per town. The build checks length and R2; it can't check authorship, so the config records `writtenBy`.

**R4. ZIP and neighborhood list:** only ZIPs from that area's row in `BUSINESS-CONTEXT.md` section 1 (the same lists as JobsSync and the GHL tags; the build reads one source, never a copy), and at most about 12 neighborhood names, each one we serve. No metro-wide town lists on city pages.

**R5. City FAQ:** 3 questions, each naming something specific to that area (its roads, drive length, parking, travel cost from the setting). Answers that would read the same on another city page fail R2 anyway.

**R6. Numbers from settings only:** travel cost, durations, prices and hours come from `config/*.json` and the catalog through the existing stamps, as everywhere on the site. A city page is the most tempting place to type "travel is free to Delhi"; the build must fail on it like any other page.

**R7. Links (as built, November 18: `web/scripts/page-links.mjs`, `CITY-SERVICE-LINKS.md`):** every published city page is linked from the footer of every page and from its state's card on Range & Travel; every published service page from the footer and from the Services page. The build fails if a published page is linked from fewer than 2 other pages. The original spec: each city page links to the hub, to 3 or 4 nearby city pages that are published (a link to an unpublished page fails the build), to every relevant service page, and Book (`book.html`, opens in place). The hub links to every published city page.

## 3. Page structure checklist

| Item | Practical guidance | Source |
|---|---|---|
| Title | Google sets no limit and truncates "as needed, typically to fit the device width" (roughly 600 px on desktop, about 50 to 60 characters). Keep under 60 characters with the city early; avoid repeated boilerplate. Examples (counted): "Mobile Detailing in Delhi & Price Hill, OH \| 513 Auto Clean" (59); "Mobile Auto Detailing in Indian Hill, OH \| 513 Auto Clean" (57). "...Indian Hill & Madeira, OH \| 513 Auto Clean" is 62: shorten. | [Title links](https://developers.google.com/search/docs/appearance/title-link) |
| Meta description | "There's no limit on how long a meta description can be"; snippets are cut to fit. Under 155 characters is a fine target, with the important part in the first ~120 (phones show less). Must differ per page: "Identical or similar descriptions on every page of a site aren't helpful". | [Snippets](https://developers.google.com/search/docs/appearance/snippet) |
| H1 | One, naming the service and the area, e.g. "Mobile car detailing in Delhi and Price Hill". | |
| H2s | One per section: local jobs, reviews, ZIPs and neighborhoods, FAQ, nearby areas. Use the existing compact sub-page title size (`CLAUDE.md`, sub-page fold). | |
| Canonical | Self-referencing absolute URL, with the trailing slash the server actually serves (Netlify pretty URLs). Never canonicalize city pages to the hub. | [Canonicals](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls) |
| Breadcrumbs | Visible: Home > Service areas > Delhi & Price Hill, plus BreadcrumbList markup (section 4). | [Breadcrumb](https://developers.google.com/search/docs/appearance/structured-data/breadcrumb) |
| Images | WebP or AVIF under 150 KB (B6); `width`/`height` set to avoid layout shift; alt text says what the photo shows and where, e.g. "Minivan back seat before and after a pet hair clean, Delhi Township". No keyword lists in alt. | [Image SEO](https://developers.google.com/search/docs/appearance/google-images) |
| Core Web Vitals | Good at the 75th percentile: LCP 2.5 s or less, INP 200 ms or less, CLS 0.1 or less. The first before/after photo is likely the LCP element: don't lazy-load it. | [web.dev vitals](https://web.dev/articles/vitals) |
| New-page steps | `FILES` in `build-dist.mjs`, `PAGES` in `stamp-assets.mjs`, `sitemap.xml`, all four `CHROME:*` marker pairs, `CHROME_PAGES` (see `CLAUDE.md`). | `CLAUDE.md` |

## 4. Structured data

**Type.** Google says to "Use the most specific `LocalBusiness` sub-type possible" ([local business](https://developers.google.com/search/docs/appearance/structured-data/local-business)). Schema.org has no detailing type; under [AutomotiveBusiness](https://schema.org/AutomotiveBusiness) the subtypes are AutoBodyShop, AutoDealer, AutoPartsStore, AutoRental, AutoRepair, AutoWash, GasStation and motorcycle types. **Use `AutoWash`** (the closest valid subtype), or `AutomotiveBusiness` if the owner feels "car wash" misdescribes the business.

**Found while checking: `index.html` uses `"@type": "AutoDetailing"`, which is not a schema.org type,** so the business block on the home page is likely being read as an unknown type. Separate fix, owner's call; flagged, not changed.

**One business, defined once.** Put the business entity on the home page with `"@id": "https://513autoclean.com/#business"`. City pages don't repeat a LocalBusiness with a different address (that would describe a location we don't have); they add a `Service` whose `provider` points at that `@id` and whose `areaServed` is the page's area. `areaServed` takes AdministrativeArea, GeoShape, Place or Text and is valid on Service and Organization ([schema.org](https://schema.org/areaServed)).

**Address.** Google lists `address` as required for local business rich results ("Include as many properties as possible"). A service-area business that hides its address in GBP should give only locality, region and country (as the home page does now), never a street.

**Reviews and stars: none on our own pages.** Google's [review snippet guidelines](https://developers.google.com/search/docs/appearance/structured-data/review-snippet): "If the entity that's being reviewed controls the reviews about itself, their pages that use `LocalBusiness` or any other type of `Organization` structured data are ineligible for star review feature" (background: [2019 post](https://developers.google.com/search/blog/2019/09/making-review-rich-results-more-helpful)). City pages show reviews as visible text only, with no `Review` or `AggregateRating` markup. The home page's `aggregateRating` can't earn stars either; flag to the owner.

**FAQPage: skip the markup.** Google's [FAQ page](https://developers.google.com/search/docs/appearance/structured-data/faqpage) changelog says the FAQ rich result "will no longer appear in Google Search starting May 7, 2026", and in June 2026 that it "is no longer shown". Keep the visible FAQ; the markup now buys nothing and is one more thing to keep in sync.

**Example for the Delhi / Price Hill page** (`priceRange`, phone and hours stay on the home page entity, stamped from config):

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Service",
      "@id": "https://513autoclean.com/locations/delhi-price-hill-oh/#service",
      "name": "Mobile car detailing in Delhi Township and Price Hill",
      "serviceType": "Mobile auto detailing",
      "provider": { "@id": "https://513autoclean.com/#business" },
      "areaServed": [
        { "@type": "AdministrativeArea", "name": "Delhi Township, Hamilton County, Ohio" },
        { "@type": "Place", "name": "East Price Hill, Cincinnati, Ohio" },
        { "@type": "Place", "name": "West Price Hill, Cincinnati, Ohio" },
        { "@type": "Place", "name": "Lower Price Hill, Cincinnati, Ohio" }
      ],
      "url": "https://513autoclean.com/locations/delhi-price-hill-oh/"
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://513autoclean.com/" },
        { "@type": "ListItem", "position": 2, "name": "Service areas", "item": "https://513autoclean.com/service-areas/" },
        { "@type": "ListItem", "position": 3, "name": "Delhi & Price Hill" }
      ]
    }
  ]
}
```

Validate with the [Rich Results Test](https://search.google.com/test/rich-results) and the [Schema Markup Validator](https://validator.schema.org/) before publishing.

## 5. Claims policy

Rules come from `BUSINESS-CONTEXT.md` section 5 and `CLAUDE.md`. Factual claims about the business need proof on file: the FTC requires a "reasonable basis" for objective ad claims ([substantiation policy](https://www.ftc.gov/legal-library/browse/ftc-policy-statement-regarding-advertising-substantiation)) and its 2024 [reviews rule](https://www.ftc.gov/legal-library/browse/rules/rule-use-consumer-reviews-testimonials) bans fake or misrepresented reviews.

| Claim (from Imperion's samples or likely on city pages) | Status | Needed before use |
|---|---|---|
| "Licensed & Insured in Ohio" | Unconfirmed | Elijah confirms the insurance (policy on file) and names the license. If no specific license applies, say "insured" only. |
| "Best in Cincinnati", "#1" | Avoid | Only as an attributed quote from a real review. |
| Water and power onboard ("deionized water tanks and quiet generators") | Unconfirmed | Elijah confirms what the van carries; otherwise say what we need at the home (outlet, spigot), if anything. |
| Durations ("2.5 to 4.5 hours") | Unconfirmed | Read from the catalog or rules settings, never typed (`CLAUDE.md` numbers rule). |
| "Removes", "removal", "100%", "90%" (salt, stains, odor, swirls, iron fallout) | Banned | Use "treat", "lift", "reduce", "deep clean", "restore". |
| "Ceramic coating" | Not offered | Don't headline it; "Ceramic Wax Sealant" is not a coating. Paint correction is not a lead offer. |
| "We've done N jobs in Delhi", "your neighbors trust us" | Data only | Count from booking records by job ZIP at build time, or don't say it. |
| Local before/after photos | Proof needed | Each photo's job ZIP is in that page's list and the photo passed human review (gallery pipeline). Never a photo from another area labeled local. |
| Local reviews | Proof needed | Real Google reviews, unedited, with the reviewer's town as they gave it. Never imply a curated set is all reviews. No incentives or gating. |
| "UC student-owned" | True | Use these words, never "college kid". |
| "Free travel to <city>" or any travel amount | Setting only | Read from the travel rules; it depends on the address, not the town. |

## 6. Local facts for the first two pages

Facts only, each with its source. Wikipedia is a pointer; its underlying source is named where it gives one. **Verify** marks a fact we could not confirm from a primary source in this pass.

### Delhi Township and Price Hill (West side)

- **ZIPs.** Delhi Township: 45238 and 45233 ([Wikipedia](https://en.wikipedia.org/wiki/Delhi_Township,_Hamilton_County,_Ohio), citing USPS/Census; township site [delhi.oh.us](https://www.delhi.oh.us) was down on 2026-11-14). Price Hill: parts of 45205, 45238 and 45204 ([Wikipedia](https://en.wikipedia.org/wiki/Price_Hill,_Cincinnati), citing a ZIP map). Note: 45204 (Lower Price Hill, Sedamsville area) is also a West side ZIP in `BUSINESS-CONTEXT.md`; the brief listed 45233, 45238, 45205.
- **What Delhi is.** One of Hamilton County's townships, 10.1 sq mi, along the Ohio River in the southwest of the county; borders Green Township (north), Cincinnati's Price Hill (east), Sayler Park and Riverside (south and west), Miami Township (northwest). Communities inside it: Delhi Hills, Delshire, Mount Saint Joseph ([Wikipedia](https://en.wikipedia.org/wiki/Delhi_Township,_Hamilton_County,_Ohio), citing the township's Welcome Booklet and USGS GNIS).
- **Terrain.** The township covers the slopes down to the Ohio River floodplain, with many hills and ravines (same source; the ravine claim is marked "citation needed").
- **Price Hill.** A region of Cincinnati made of three neighborhoods: East, West and Lower Price Hill. East and West sit on top of the hill; Lower Price Hill is in the river valley, bounded by the Mill Creek, the Ohio River and very steep ground. The Incline District is a sub-area of East Price Hill (Price Ave, W. Eighth St, Grand Ave) ([Wikipedia](https://en.wikipedia.org/wiki/Price_Hill,_Cincinnati), citing City of Cincinnati statistical neighborhood data and the Price Hill Historical Society; [city census profile, Lower Price Hill](https://www.cincinnati-oh.gov/sites/planning/assets/Census/2010/Lower-Price-Hill.pdf)).
- **Former Delhi land now in Cincinnati:** Price Hill, Sayler Park, Sedamsville, Riverside (Wikipedia, "citation needed"; the [Delhi Historical Society](https://www.delhihistoricalsociety.org) is the primary source to check). Verify.
- **Roads.**
  - Delhi Road: Mount St. Joseph University is at 5701 Delhi Road, Cincinnati 45233 ([msj.edu](https://www.msj.edu/contact/contact-the-university/index.html)).
  - River Road is U.S. 50 through Riverside, a heavy truck route with rail alongside ([city Riverside plan, 2002](https://cincinnati-oh.gov/sites/planning/assets/Neighborhood%20Plans/Riverside/2002%20Riverside%20Strategic%20Community%20Plan.pdf)); the city rebuilt about four miles of River Road/U.S. 50 from Anderson Ferry Road in Delhi to Dart Street in Sayler Park starting 2023 ([Cincinnati DOTE](https://www.cincinnati-oh.gov/dote/news/river-road-street-rehabilitation-from-anderson-ferry-in-delhi-to-dart-street-in-sayler-park-under-way)).
  - Glenway Avenue (Price Hill's commercial district and the base of the old incline), Warsaw Avenue, Eighth Street and the Eighth Street Viaduct ([Wikipedia](https://en.wikipedia.org/wiki/Price_Hill,_Cincinnati)).
  - Rapid Run Road: Rapid Run Park is at 4450 Rapid Run Road, 45238 ([Cincinnati Parks](https://www.cincinnatiparks.com/parkgames-2016/); [park page](https://cincinnatiparks.com/west/rapid-run-park)).
  - Delhi Pike and Anderson Ferry Road as through routes: Verify on the township site when it's back up.
- **Landmarks.**
  - Mount St. Joseph University, in Delhi Township ([msj.edu/about](https://www.msj.edu/about/)).
  - Anderson Ferry: crosses the Ohio River to Constance, Kentucky, operating since 1817, on the National Register since 1982; a shortcut toward CVG airport ([operator](https://andersonferry.com); [Kentucky Historical Society marker](https://explorekyhistory.ky.gov/items/show/289)).
  - Delhi Park (the township's oldest, opened 1954), Story Woods Park, Embshoff Woods (Great Parks, 331 acres) (Wikipedia, citing the township booklet). Verify on delhi.oh.us / greatparks.org.
  - Price Hill: Rapid Run Park, Mount Echo Park, Dunham (Arts Center and Recreation Center), Elder and Seton high schools, Holy Family Church, the site of the Price Hill Incline ([Wikipedia](https://en.wikipedia.org/wiki/Price_Hill,_Cincinnati)).
  - Glenway Crossing is a 1991 retail center at 5100 Glencrossing Way, 45238, in the Western Hills area, west of Price Hill and not in Delhi ([commercial listing](https://www.commercialcafe.com/commercial-property/us/oh/cincinnati/glenway-crossing-3)). Use it as "near", not "in".
- **Car-relevant.** Steep hills between the ridge neighborhoods and the river valley (above); U.S. 50 along the river carries heavy truck traffic (city plan above). We found no area-specific source on road-salt use; don't claim any.

### Indian Hill and Madeira (Northeast)

- **ZIPs.** Madeira: 45243 ([Wikipedia](https://en.wikipedia.org/wiki/Madeira,_Ohio), city site [madeiracity.com](https://www.madeiracity.com)). Indian Hill: mostly 45243, with edges in other ZIPs per third-party ZIP tables ([city-stats](https://city-stats.com/ohio/the-village-of-indian-hill/zip-codes)); verify with USPS. 45249 is mainly Symmes Township and Montgomery (USPS aliases "Montgomery, Symmes", per [postcodebase](https://OH.postcodebase.com/zipcode5/45249)); 45241 and 45242 (Sharonville, Blue Ash, Montgomery, Kenwood area) are the other Northeast ZIPs in `BUSINESS-CONTEXT.md`. Consider whether the second page should be "Indian Hill, Madeira and Montgomery", or keep 45249 for a later Montgomery page.
- **Indian Hill.** A city (styled "the City of the Village of Indian Hill"), about 18.7 sq mi ([Wikipedia](https://en.wikipedia.org/wiki/Indian_Hill,_Ohio), citing the Census gazetteer). Zoned entirely single-family residential or agricultural (Wikipedia, "citation needed"; the [village zoning documents](https://indianhill.gov/planning-zoning-documents) are the primary source). Verify before saying it has no commercial district or giving a lot size: no primary figure found this pass.
- **Bridle trails.** Public Works maintains about 75 miles of bridle trails; riding needs an annual license; donated land is held in the Green Areas Trust ([indianhill.gov bridle trails](https://indianhill.gov/departments/bridle-trails/), [Green Areas](https://indianhill.gov/council/green-areas/), [new residents](https://indianhill.gov/welcome-new-residents/)).
- **History.** The Camargo Realty Company (1924) assembled about 12,000 acres, sold some as 25-acre plots and supported the Camargo Hunt kennels; the village administration building is at Drake and Shawnee Run roads; Cincinnati Country Day School is there (Wikipedia, citing the Indian Hill Historical Society).
- **Long private drives and wooded lots:** consistent with the zoning and trail system above, but no source states it; describe from our own jobs, not as a fact about the town.
- **Madeira.** A residential suburb with a small downtown, 9,487 people (2020), about 3.4 sq mi; borders Indian Hill (east), Columbia Township (south), Madisonville (south and west), Silverton (west), Sycamore Township (north); fire service from the Madeira-Indian Hill Joint Fire District; South Kenwood annexed 1970 ([Wikipedia](https://en.wikipedia.org/wiki/Madeira,_Ohio), citing Census and the city).
- **Madeira roads and downtown.** Miami Avenue is the main north-south road (built 1832, concrete 1928); Camargo Road began as a trail and became a turnpike; the downtown DORA runs along Miami Avenue from Camargo to Euclid; the city building is the old St. Paul church at Miami and Euclid ([Madeira Historical Society](https://madeirahs.org/history-1787-1939/), [history 1940 to present](https://madeirahs.org/history-1940-present/)).
- **Nearby.** Kenwood (Sycamore Township), Montgomery, Symmes Township, Terrace Park, Milford and Camp Dennison are listed as nearby Hamilton County places ([Wikipedia](https://en.wikipedia.org/wiki/Indian_Hill,_Ohio)). Which ones touch Indian Hill: verify on the county map. I-71 through Kenwood: map check, not sourced here.

## 7. Keyword notes

No volumes here: we have no keyword tool access and won't guess. After launch, Search Console's queries per page are the real data; Imperion can pull Keyword Planner figures from the Ads account.

**Likely phrases (hypotheses to check in Search Console):**
- West side: "mobile detailing Delhi OH", "car detailing Delhi Township", "mobile car detailing Price Hill", "car detailing west side Cincinnati", "car detailing Western Hills", "interior detailing near 45238".
- Northeast: "mobile detailing Indian Hill", "car detailing Madeira OH", "auto detailing Kenwood", "mobile detailing Montgomery OH", "interior car cleaning near 45243".
- Across both: "mobile car detailing near me", "pet hair removal car" (we say "pet hair clean"; never promise removal), "car interior steam clean Cincinnati". "Near me" searches are answered mostly by the map pack, which runs on GBP distance and prominence, not city pages.

**What ranks today (non-Google web search, 2026-11-14; Google's own results and map pack were not visible):**
- Neither "mobile car detailing Delhi Township OH" nor "mobile detailing Indian Hill Madeira OH" returned a detailer with a page for that town. Results were general Cincinnati detailers, booking-platform pages (Goldie, Square, Thumbtack), and a Google Business listing (Slick Ride Auto Detailing) whose service area names Madeira and Indian Hill.
- A Northeast Ohio detailer (nathansdetailing.com) fills results with one templated page per suburb ("Mobile Car Detailing in Solon, Ohio" and so on): the pattern R2 is meant to keep us out of.
- Reading: the town-level phrases look thinly contested, so one genuinely local page per area has a real chance. That is an inference from a small sample, not a measurement.
