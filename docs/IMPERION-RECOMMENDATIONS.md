# Imperion's website recommendations (received November 12, 2026)

From Imperion's "Website Fixes" document. It was written against a site version more than a week old, so check each item against the current site before building. The original file is with Emmett.

## A. Now, for texting approval (A2P number verification)

Being done first, in their own branch. Status is tracked in `SESSION-CHANGES-a2p.md` once started.

| # | Task | Done when |
|---|---|---|
| A1 | Every phone number on the site comes from one Netlify variable (the new number isn't issued yet) | Changing one Netlify value and redeploying changes every number: pages, booking form, emails, legal pages, the hidden business data |
| A2 | The Contact form becomes **"Request a quote"**, a copy of their mockup: Name and Phone first, then Email, Vehicle, City / ZIP, the question, condition, and "best way to reach you" | The form matches the mockup field for field; the button says "Request quote" |
| A3 | Two consent tick boxes, both optional and unticked, worded exactly as below; Terms and Privacy linked | The text matches word for word, the phone number in it comes from the variable, and the form sends without them ticked |
| A4 | A booking link for Google: their mockup is a separate page with a 9:16 video on the left | Interim: `513autoclean.com/book.html` already opens the booking form directly. The full page waits for the video (Elijah or Corbin) and a mockup |

**A3 wording (exact):**
- "I consent to receive SMS notifications, alerts & occasional marketing communication from 513 Auto Clean. Message frequency varies. Message & data rates may apply. Text HELP to {phone} for assistance. You can reply STOP to unsubscribe at any time."
- "I want to receive news, feature updates, discounts & offers from 513 Auto Clean."
- Below them: "By continuing you agree to our Terms & Conditions and Privacy Policy." (both linked)

**Already in place:**
- The privacy policy has the standard texting clauses: "No mobile information will be sold or shared with third parties or affiliates for marketing or promotional purposes", consent not shared, STOP and HELP.
- The terms have their texting section, which switches on with automated texts.

## B. Later (after the number is verified; weekend or next week)

| # | Task | Done when |
|---|---|---|
| B1 | **Gallery** of real before and after photos, plus a photo per service | The gallery is fed from the Drive "03 Website" folder (the photo pipeline in `QUEUE-AFTER-FRIDAY.md`), and each service card has a photo |
| B2 | **Separate booking page** (GBP link): little text, one big red button, a 9:16 montage video beside the form (stacked on phones), area and contact in the header | It's built from an approved mockup, the video comes from Elijah or Corbin, and it fits a 1440×790 laptop with no scrolling to the button |
| B3 | **City pages** for the target areas (West side and Northeast first), at `/locations/<city>-oh/`, from a `/service-areas/` hub in the nav | One page per priority city. Each is at least 40 to 50% unique: its ZIPs and neighborhoods, local jobs, local reviews, and a 120 to 150 word local paragraph |
| B4 | **City page structure:** title under 60 characters ("Mobile Auto Detailing in {City}, OH \| 513 Auto Clean"), meta description under 155, H1, subheadline, a "Get an Instant {City} Quote" button, a trust bar, a local section, 3 to 4 local before and afters, a ZIP and neighborhood grid, links to 3 to 4 nearby cities, and a 3 question city FAQ | Each page passes this checklist, and no two city pages share more than half their text |
| B5 | **Service pages:** interior detailing, paint correction, ceramic coating, fleet and commercial, linked both ways with the city pages | One page per service, linked from Services and from each city page. Paint correction and coating only once they're offered |
| B6 | **Images:** WebP or AVIF, under 150 KB each, alt text with the city | No gallery image over 150 KB; alt text names the service and town |

**Check against the business rules before copying their sample text** (`BUSINESS-CONTEXT.md`, `CLAUDE.md`):
- No removal promises: their "Removed 3 years of winter salt…", "swirl, scratch and oxidation removal" and "iron fallout removal" need rewording.
- They assume things to check with Elijah: "deionized water tanks and quiet generators" (water and power onboard), "Licensed & Insured in Ohio", "Ceramic Coating" as a headline (it isn't offered yet), and "2.5 to 4.5 hours".
- No em-dashes.
