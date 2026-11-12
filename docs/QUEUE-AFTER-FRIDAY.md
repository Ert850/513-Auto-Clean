# Queued for after the Friday, November 13 deliverables

Work that's agreed but deliberately not started before Friday. Newest first.

## Checkout, "Your details": bring back a small Continue under the fields (Emmett, November 12)

**Ask:** on the Contact section of checkout (Name, Phone, Email), add back the small Continue that used to sit under the boxes, as a second way to move on with less mouse travel. Keep the bottom bar's red Continue as it is.

**This reverses part of an owner decision from the same day.** Round 20 (`SESSION-CHANGES-pipeline.md`; `CLAUDE.md`, "Checkout continues from the bottom bar only") removed every in-section Continue. Update that `CLAUDE.md` rule when this is built.

**Why the in-section Continues were removed:**
- **Below the fold:** under a long section (Address, Time) the button sat below a laptop's fold.
- **"Your time" off centre:** with the bar's Continue hidden, the card centred off to the right.

Contact is short, so the first doesn't apply there. The second came from hiding the bar's button, so keeping the bar's Continue avoids it.

**Possible downsides, all small:**
- **Two buttons that do the same thing** on one screen. That's acceptable when they behave identically and share the same label. It does make the page a little less tidy.
- **Inconsistent between sections:** Contact would have one, while Address, Time and "Almost done" wouldn't. Either accept that, or add it only where the section is short enough to keep it above the fold.
- **On phones the boxes stack,** so "under Name" would split the fields. Put it after Email (the last field) at every width, or show it from tablet width up only. On a phone the bottom bar is already under the thumb.
- **Screen readers hear two "Continue" buttons.** That's harmless if both work the same. The inline one comes right after the fields in tab order, which is good.
- **Keyboard already covers it:** Enter in a box moves to the next box, and from the last box it continues (the Go key on phones does the same). So the gain is for mouse users only.

**Build notes:**
- It calls the same `advance()` as the bar, which finishes the open section (`ckAdvance`). No second code path.
- Look: the small dark button from before Round 20 (in `bf608f0`'s parent).
- Check: 1440×790, 1280×720 and 375 px; the "Your time" card stays centred; every booking path still reaches Done. About 30 minutes.

## Photo pipeline: the website gallery pulls from Google Drive (Elijah, team brief section 5, November 11)

**Goal:** the results gallery is built from the shared Drive folder "513 Auto Clean Photos / 03 Website", so new photos reach the site without code changes. The current site photos get replaced.

**Plan:**
1. **A build step** (`web/scripts/`): list "03 Website" through the Google Drive API, download each photo, make the sizes the gallery uses today (420, 760 and 1120 px WebP, plus a JPEG fallback), and rewrite `data/gallery.json`. If Drive can't be reached, the build keeps the last good gallery instead of failing.
2. **Before/after pairs** from file names, for example `crv-interior-before.jpg` and `crv-interior-after.jpg`. A photo without its pair is left out, and the build log says which.
3. **Triggering it:** Drive can't call Netlify on its own. Either a small Apps Script in the folder checks for changes hourly and calls a Netlify build hook, or the site rebuilds daily.
4. **Privacy check before publishing** (team brief 8.3): license plates blurred; no faces, house numbers or papers. The pipeline can't judge that, so "03 Website" must only hold approved photos.
5. **Later, with the GHL keys:** load "02 Selects" into GoHighLevel's media storage.

**Needs from Elijah:**
- the folder ID;
- access: either "anyone with the link can view" (an API key is enough) or private (shared with a service account we create);
- the naming rule for pairs;
- daily rebuild or the build-hook script.

**Needs from Emmett:** a Google account for the folder (UC mail isn't one).

## Interior packages: three tiers, Full Interior + Steam as its own package (Elijah, messages November 11)

**What Elijah decided:**
- **Interior has three packages, not four** ("4 is too complicated").
- **Full Interior + Steam becomes its own package** ("Try as a separate package"). He also floated a "button directly under Add Steam Cleaning".
- **Showroom Ready (interior) leaves the package list** and can become an add-on, "Showroom Ready restoration or something".
- **Exterior stays the same.**
- **Driven from JSON** rather than hard-coded ("JSON would be good"), like `config/rush-fee.json`.

**Still to settle with him before building:**
- **Which three:** for example Basic, Full, and Full + Steam, with Maintenance kept for returning customers.
- **Prices:**
  - the Full + Steam package price (Full plus the $75 steam extra, or a bundle price);
  - the "Showroom Ready restoration" add-on price, and what it includes.
- **Old quote links and bookings** that name `showroom-interior` need a mapping.
- **The $100 minimum** for one-off restoration jobs (brief 7.1).
- **Fill Kris first** (brief 7.1): check the Priority order in the calendars' descriptions.

**Read first:** `docs/BUSINESS-CONTEXT.md` (Elijah, November 11: what sells, customers' words, why leads don't book). It names Full Interior + Steam as the lead offer.

**Touches:**
- `web/lib/catalog/` (prices live only there);
- the package cards rendered into `index.html` and `services.html`;
- the booking form's package step and level meter (`pkgLevel()`, which is catalog order);
- the recommendations;
- the extras-step wording;
- tests.
