# Imperion's site audit, November 18, 2026: causes and fixes

Imperion's "Website Fixes" (Semrush site audit of the live site, 513autoclean.com) flagged five things. All five are dealt with on `eNov14`.
- **When it reaches the live site:** with the eNov14 merge, after toll-free approval (`AFTER-TOLL-FREE-APPROVAL.md`, step 3). The live site doesn't change before then.
- **Seen on the deploy preview:** https://deploy-preview-13--513-auto-clean.netlify.app.
- **Owner decision (Emmett, November 18):** one clean address per page, `/about` rather than `/about.html`, after research and a test on Netlify.

| # | Semrush said | Severity | Real cause | Fix on eNov14 |
|---|---|---|---|---|
| 1 | 7 pages with one incoming internal link | Notice | Each page had two addresses (below) | One address per page |
| 2 | 10 pages without an h1 | Warning | Sub-page titles were h2 | Exactly one h1 on every page, checked at build |
| 3 | 9 pages blocked from crawling | Notice | Not a mistake | None (`/book` stays out of search) |
| 4 | Contact (both addresses): low text-to-HTML ratio | Warning | Developer comments and indentation shipped to visitors | Removed from the published pages |
| 5 | llms.txt not found | Notice | Never made | Generated at build |

## 1. Few incoming links, and every page listed twice

**What was happening:**
- Every internal link on the live site pointed to `/about`.
- The page's canonical tag and the sitemap said `/about.html`.
- Both addresses loaded.

So Semrush, and any search engine, saw two addresses for each page. The links went to one and the page's own declarations to the other. That's why the `.html` addresses showed "one incoming link", and why the crawl listed `/about` and `/about.html` side by side.

**Five whys:**
1. **Why one incoming link?** The audit counted links to `/about.html`, the address the page declares. Hardly anything links there.
2. **Why do links say `/about`?** The source writes `about.html`, but Netlify's "Pretty URLs" setting rewrote every link at deploy.
3. **Why did no one see it?** The setting lived only in the Netlify dashboard. The rewrite happened after our build, so no file in the repo and no test ever showed the published links.
4. **Why does that matter?** Google's guidance is that redirects, canonical tags, the sitemap and internal links should all name the same address, and should never send mixed signals. They didn't.
5. **Root cause:** the address of a page was decided in two places (our files, and a dashboard setting), with nothing checking that they agreed.

**Fix:**
- **One address per page, chosen by the owner:** `/about`, `/services`, `/faq`, `/contact`, `/service-area`, `/terms`, `/privacy`, and the city and service pages when published. It's the industry default, and partly what Imperion proposed (clean addresses, but no trailing slash). Live links have used it since launch, so the link credit is already there.
- **The build writes it** (`web/scripts/site-urls.mjs`):
  - every link, canonical tag, `og:url`, JSON-LD address and sitemap entry for those pages uses the clean form;
  - each old `.html` address gets a 301 to the clean one, written to `dist/_redirects` from the pages themselves, so a new page needs nothing extra.
- **Tested on Netlify first:** a temporary redirect on the deploy preview, in both directions, gave one hop and no loop (November 18).
- **The build fails** if any published page disagrees:
  - a link or address still in `.html` form;
  - a canonical that isn't the page's address;
  - a published page missing from the sitemap, or a draft in it;
  - a missing redirect.
- **Netlify's setting is now in `netlify.toml`** (`pretty_urls = true`), so the dashboard can't change it unseen. The build already writes clean links, so it rewrites nothing.
- **Found by the validation pass and fixed:**
  - **The hero's Contact Us button showed on phones again.** It was hidden by matching `a[href="contact.html"]`, which a clean link no longer matches. The same rule had already stopped working on the deploy preview, because of Netlify's rewrite. It's a class now (`.hero-contact`).
  - **The card payment's return address** is now `/#book` instead of `/index.html#book`, so it never depends on a redirect.
- **Second validation pass, also fixed:**
  - **Links in the scripts:** the booking form's and cookie banner's Terms, Privacy and Contact links are rewritten to clean addresses and checked like the pages.
  - **Structured data:** the offers now point at `/book?package=...`, not `book.html` (a 301, then a script hop).
  - **Phone stamp:** it runs after every file the build writes, including `llms.txt`.
- **Left on purpose:** `script.js`'s map of old home-page sections (`/#faq` goes to the FAQ page) still says `.html` and takes one 301. Only old bookmarks and links reach it.

**Links to the new pages:** options are mocked up in `CITY-SERVICE-LINKS.md`. They include a fix for the City guides list, which would land at the bottom of Range & Travel.

**Also guarded:** a page with only one linking page would get the same Semrush notice. The main pages are in every page's header and footer.
- **The new city and service pages** are only linked from what their generator links them from: the Range & Travel city list, nearby cities, and each other.
- **Today:** all four are drafts, so nothing links to them yet.
- **From now on,** the build fails if a published page is linked from fewer than two other pages.
- **Built (owner's pick C, November 18; `CITY-SERVICE-LINKS.md`):** every published city and service page is linked from the footer of every page, its state's card on Range & Travel, and (service pages) the Services page. Checked with all four drafts published in a local build: each is linked from 12 pages.

## 2. Pages without an h1

**Cause:** the sub-pages (Services, About, FAQ, Range & Travel, Contact) were cut out of the old one-page home page. Each page's title was a section heading (h2) under the home page's h1, and stayed one when it became its own page. The two print landing pages had the same gap.

**Fix:**
- **Not changed:** the h3s under each title (package cards, state cards) now follow an h1 directly. Lighthouse's accessibility audit may note the skipped level; Semrush doesn't check it.
- **Each page's title is now its h1,** with the same look: the stylesheet rules match both h1 and h2, and no size, margin or position changed at 1440, 820, 375 or 320 px.
- **Contact:** its title is an h1 on the Contact page. The copy of that section on the home page keeps an h2, since the home page's headline is its h1.
- **The build fails** unless every published page has exactly one h1.

## 3. Pages blocked from crawling

These are `/book` and the same page with a package in the address (`/book?package=full-interior`). They're blocked on purpose:
- **What `/book` is:** the booking page Google Business Profile links to. It's a tool, not content.
- **Why it's noindex:** it repeats what Services says, so it carries `noindex` (CLAUDE.md, "the booking page").
- **The package versions** are the Book buttons on the package cards.

**Nothing else is blocked by mistake.** The build now checks that every page either has its own address or is noindex. The noindex pages are:
- `/book`;
- the print landing pages (`/golf`, `/prestige`);
- the 404 page;
- the draft city and service pages.

## 4. Low text-to-HTML ratio on Contact

**Cause:**
- **The source pages carry comments for whoever edits them,** explaining owner decisions. These, plus deep indentation, are about a fifth of each page.
- **They were copied to visitors unchanged,** although the scripts were already minified.
- **Contact has little text,** so it fell to 10.0%, exactly Semrush's line.

**Fix:**
- **The build now drops comments and indentation from the published pages** (`web/scripts/slim-html.mjs`). Script, style, pre and textarea contents are left exactly as written.
- **Contact rose from 10.0% to about 12% text,** and every other page also improved. Pages are 15 to 20% smaller.
- **Checked:** every page was compared element by element before and after, at three widths. Nothing moved. The only differences were the home headline A/B test, which picks a version per visitor.
- **What's left:**
  - The rest of Contact's weight is the form itself and the shared header and footer.
  - More would take more words on the page, which is a content decision.
  - Google doesn't use this ratio.

## 5. llms.txt

**Fix:**
- **Generated at build** (`web/scripts/llms-txt.mjs`), in the llmstxt.org format, at https://513autoclean.com/llms.txt.
- **Where its content comes from:**
  - the home page's description;
  - phone and hours;
  - each sitemap page with its own title and description, at its one address;
  - the bookable packages with their starting prices, from the same catalog as the price cards.
- **It can't drift from the site,** and no price is typed into it.
- **Honest status:** Google says its search ignores llms.txt, and that having one is fine. It's for the AI assistants that read it.

## Known and left as they are (validation, November 18)

- **Heading levels skip under the new page titles** (h1 straight to h3 on Services, Range & Travel and Contact; h1 to h4 on FAQ). The footer column titles have always been h4s. Lighthouse's accessibility audit can note it; Semrush doesn't. Fixing it means re-levelling headings across the site with the same look: a separate change.
- **The review count is copied at build time** into the home page's description, the structured data and `llms.txt` (32 today, while the live badge shows 33 after loading). It's refreshed on every deploy.
- **The booking page's own Book links stay `book.html`:** on that page the form opens in place (CLAUDE.md, the booking page).
- **`/404` answers 200** (it is the 404 page itself, noindex). A missing page like `/nope` correctly answers 404.
- **The source `sitemap.xml` mixes forms** (main pages `.html`, new pages clean). The published one is all clean.
- **Card payments, unrelated to the audit:** `create-payment.mjs` turns on Stripe's automatic payment methods. If a method that leaves the page (Cash App, Klarna, Affirm, Amazon Pay) is ever switched on in Stripe's dashboard, a payment could complete with no booking recorded. It needs a look at the Stripe dashboard (owner).

## After the merge (in `AFTER-TOLL-FREE-APPROVAL.md`, step 3)

- **Check on the live site:**
  - `/about.html` 301s to `/about`;
  - `/llms.txt` loads;
  - the sitemap lists clean addresses.
- **Resubmit the sitemap** in Google Search Console, and check "Google-selected canonical" for a page or two.
- **Expect some movement:** Google expects a few weeks of fluctuation after an address change. The redirects stay for at least a year (in practice, permanently).
- **Ask Imperion to re-run the Semrush audit.**
