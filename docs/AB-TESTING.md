# A/B testing on 513autoclean.com

Built November 11, 2026, after the owner asked to test whether showing GOLF10 on the golf page changes bookings. Everything is set in `config/experiments.json`. A change goes live on the next deploy.

## How it works

- **Who's in a test:** a visitor in a running test is given one version at random on their first view. It's stored in their browser, so they see the same page on every visit. With `sources: ["golf"]` only people who arrived through 513autoclean.com/golf join. Once in, they stay in, even when they come back another way.
- **Everyone else:** they see the **first** version listed, the control, and nothing is stored for them.
- **Showing a version on a page:** an element shown for one version only carries `data-exp="test-id:version"`, for example `<p data-exp="golf-code:code">Use GOLF10 for 10% off</p>`. It's hidden until the version is chosen, so the wrong one never flashes up. In code: `window.AC_EXP("golf-code")`.
- **Where the results go:**
  - **Every booking:** the booking email (an "A/B TESTS" line) and the calendar event name the version. This works even when the visitor declined analytics, so **count bookings per version from these**.
  - **Google Analytics, after Accept only:**
    - an `experience_impression` event with `exp_variant_string`, for example `ac-golf-code-code` (Google's own pattern for outside testing tools);
    - every other event carries the same parameter.
  - **Clarity, after Accept only:** a tag, `exp_golf-code = code`. Filter recordings and heatmaps by it.
- **Privacy:** the privacy policy says all of this. The stored version identifies nobody.

## Running a test

1. Build what the versions show (elements with `data-exp`), and any code they need. For the golf code test: switch GOLF10 on in `config/promo-codes.json`.
2. **Before starting, in Google Analytics:** Admin → Custom definitions → Create custom dimension: name `Test version`, scope **Event**, parameter `exp_variant_string`. GA4 only collects it from the day it's registered.
3. **Decide the stop date and the question in advance**, and write them in the test's `note`. For example: "Run until 2027-08-31. Question: does showing GOLF10 raise bookings per golf visitor?"
4. Set `"status": "running"` and deploy.
5. **When it ends:** set `"status": "ended"` and `"winner": "<version>"`, so everyone gets the winner and nothing more is recorded. Later, make the winner the plain page and remove the test.

**Never rename a running test or its versions.** The names are what the results are counted by.

## Reading the result

- **Bookings per version:** count the "A/B TESTS" lines in the booking emails. This is the number that matters.
- **Visitors per version:** GA4 → Explore → Free form, with the dimension `Test version`, the metric Active users, and the event filter `experience_impression`. Visitors who declined analytics aren't in it, so use it for rates, not totals.
- **Check the split first.** At 50/50, the visitor counts should be close. A lopsided split (for example 70 against 30 out of 100) means something's broken; fix that before believing any result.
- **Expect a directional answer.** Spotting a booking rate that doubles from 5% to 10% takes about 430 visitors per version. A print QR code won't get there in one season. Treat a small test as a lean, not proof. Report plain counts: "B: 9 bookings from 120 visitors, A: 5 from 115."

## Why a random split, not two weeks on and two weeks off

The owner suggested alternating periods. A split per visitor is the industry standard here (research, November 11), because each period would be mixed up with things that change on their own:
- **The calendar:** when the booklet and the magazine land;
- **The weather,** which drives detailing demand;
- **The season:** the end of golf season.

Two-week blocks over a season give only a handful of periods to compare.

The one thing periods do better is crediting phone bookings by date. For those, the checkout question "Where did you hear about us?" and asking callers "did you have a code?" fill the gap.

Netlify's own Split Testing can't be added to new sites since August 2026, splits whole branches only, and turns off Edge Functions. Hosted tools (GrowthBook, PostHog, Statsig) would add a script, an account and more consent wording, and their statistics can't fix a small sample. At this traffic, about 100 lines of our own are enough.
