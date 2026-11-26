# The home page's hidden business data (JSON-LD): audit, November 14

**What it is:** a block in `index.html` that tells Google who the business is: name, type, area served, hours, phone, rating, price list. People never see it; Google uses it to understand the business and sometimes to show extra details in search.

## What's in it today

- **One business entity, `"@type": "AutoDetailing"`,** with: name, image, description, url, telephone, priceRange, foundingDate, areaServed (74 towns), address (town and state only), aggregateRating, openingHoursSpecification, geo, hasMap, paymentAccepted, a ReserveAction (the booking link) and more.
- **An OfferCatalog** of the package prices, stamped from the catalog, so it's correct.

## Problem 1: `AutoDetailing` isn't a real type (fix)

- **The evidence:** `https://schema.org/AutoDetailing` returns 404. `AutoWash`, `AutoRepair` and `AutomotiveBusiness` all exist.
- **Google's local business guide:** "Define each local business location as a `https://schema.org/LocalBusiness` type" and "Use the most specific `LocalBusiness` sub-type possible."
- **What that means for us:** with an unknown type, Google most likely can't treat the block as a local business at all. Everything in it then counts for little or nothing: area served, hours, phone, geo.
- **Fix:** `"@type": "AutoWash"`. It's the closest real subtype (AutomotiveBusiness, then LocalBusiness), and the research in `SEO-COMPLIANCE.md` section 4 recommends it. `AutoRepair` would be wrong; we don't repair. The city pages already use AutoWash with the same `@id`, so they all point at one business.

## Problem 2: the review rating (aggregateRating) on our own site (remove)

- **Google's review snippet guide:** LocalBusiness rating markup is "only for sites that capture reviews about other local businesses". A rating "about entity A placed on the website of entity A" is self-serving and not eligible for stars. It also says "Don't aggregate reviews or ratings from other websites", and ours copies the Google rating.
- **The consequence today:** the stars never show, so there's no gain.
- **The risk:** the same guide says a site that breaks these guidelines "may" get a manual action, after which "the structured data on the page will be ignored". It's unlikely for a small, honest site, but it's a cost with no upside.
- **Fix:** remove `aggregateRating` from the JSON-LD only. The visible "Rated 5.0 from 32 reviews on Google" pill, the trust badge and the review ticker all stay; they're page text, not markup.
- **Code to change with it:** `render-site.mjs` stamps the review count into the JSON-LD (`"reviewCount"`), and its expected count changes when the block goes. `js/reviews.js` `syncBadges()` only touches page text.

## Fine as it is

- **The address with town and state only:** right for a business that comes to the customer (no storefront to show). Google's guide requires `address`; a partial one is accepted.
- **The OfferCatalog prices** come from the catalog (`CATALOG:OFFERS`), so they never drift.

## How to check after the change

- Paste the built `index.html` into Google's Rich Results Test and the Schema Markup Validator (validator.schema.org). Both should read a LocalBusiness (AutoWash) with no errors.
- After the unfreeze, Search Console's "Enhancements" shows how Google reads it.

Sources: [Google: local business structured data](https://developers.google.com/search/docs/appearance/structured-data/local-business), [Google: review snippet guidelines](https://developers.google.com/search/docs/appearance/structured-data/review-snippet), [schema.org/AutoWash](https://schema.org/AutoWash).
