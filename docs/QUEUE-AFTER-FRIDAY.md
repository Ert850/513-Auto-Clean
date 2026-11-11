# Queued for after the Friday, November 13 deliverables

Work that's agreed but deliberately not started before Friday. Newest first.

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

**Touches:**
- `web/lib/catalog/` (prices live only there);
- the package cards rendered into `index.html` and `services.html`;
- the booking form's package step and level meter (`pkgLevel()`, which is catalog order);
- the recommendations;
- the extras-step wording;
- tests.
