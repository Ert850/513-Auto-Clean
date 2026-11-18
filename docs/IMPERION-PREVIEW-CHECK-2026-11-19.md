# Imperion's audit items, checked on the test site, November 19, 2026

**Test site:** https://deploy-preview-13--513-auto-clean.netlify.app
- It always shows the newest version of the work (branch `eNov14`). The live site is unchanged until the merge.
- **Login:** a browser login box appears. Any user name works; Emmett sends the password separately.

**How it was checked:** a crawl starting from the home page, following every internal link and the sitemap, as Semrush does. Then each item below was checked on every page found.

| # | Imperion's item | On the test site | Status |
|---|---|---|---|
| 1 | llms.txt not found | `/llms.txt` loads, in the llmstxt.org format: summary, phone, hours, packages with starting prices, and every page | Fixed |
| 2 | 7 pages with one incoming internal link | Each page has one address. Services, About, Contact, FAQ, Range & Travel, Privacy and Terms are each linked from 16 to 18 pages. The old `.html` addresses 301 to the clean ones in one step | Fixed |
| 3 | 9 pages blocked from crawling | The booking page `/book` and its package links are blocked on purpose: it's the booking tool, and its content is on Services. Nothing else is blocked | As intended |
| 4 | Contact: low text-to-HTML ratio | Contact is about 12% text (Semrush flags 10% or less). Every page is above 10% | Fixed |
| 5 | 10 pages without an h1 | Every page has exactly one h1, and headings below it no longer skip levels | Fixed |

**If you run Semrush on the test site, three things are expected there and won't be on the live site:**
- **The login:** Semrush's Site Audit needs the login in its crawler settings, if your plan offers that. Otherwise the pages can be checked in a browser.
- **Every page reports "blocked", noindex and nofollow:** the test site's login gate sends `X-Robots-Tag: noindex, nofollow` on purpose, so a test site never ends up in Google. Because of the nofollow, Semrush may not follow links there, so the incoming-link counts (item 2) are best read on the live site after the merge.
- **Canonical tags point to 513autoclean.com:** each page names its live address (for example `https://513autoclean.com/about`), as it should.

**Also on the test site, not linked and marked noindex:** four draft pages (two city pages, two service pages) awaiting photos and reviews.

Causes and fixes in detail: `IMPERION-AUDIT-2026-11-18.md`.
