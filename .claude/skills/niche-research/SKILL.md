---
name: niche-research
description: Refresh what performs in the detailing niche and what people ask, into content/research/<date>-niche-research.md with sources. Uses web search, the Meta ads MCP for our own account, and the Apify Ad Library scraper for competitors' public ads. Run before building a video-concepts session, before a paid campaign, or when planning SEO pages.
---

# Niche research for 513 Auto Clean

Output is one dated markdown file in `content/research/`, and the previous
one stays. The concept sessions cite it, so every claim carries a source.

## What is wired up, and what each one can and cannot do

Both MCP servers are in `.mcp.json` at the repo root. Run `/mcp` in a
session to authorise them the first time; both use OAuth in the browser.

**`meta-ads`, Meta's official server** (`https://mcp.facebook.com/ads`).
Our OWN account: ad accounts, campaigns, insights, and Instagram media where
the login has `instagram_basic`. No developer app needed. Use it to pull our
best-performing posts and reels with view counts, so concepts are calibrated
to what already works for us. It does not search other advertisers.

**`apify-ad-library`, Apify's Ad Library scraper.** PUBLIC ads by keyword
("car detailing", "mobile detailing Cincinnati", "ceramic coating") or by
advertiser page id. Returns creative, copy, CTA, landing link, platforms,
start date. Needs an Apify login on first connect; the free tier covers this.
Long start dates are the signal: an ad still running after months is paying
for itself.

**Neither is the Meta Ad Library API.** That returns political ads only in
the US. Do not waste a turn on it.

**Web search** for everything else: top creators and their formats, agency
write-ups on what converts, forum threads of customer questions, and Google's
own related questions.

## What to look for

1. **Outliers, not averages.** A creator whose one video did 10x their
   median. An ad that has run six months. A question with a thousand
   comments. Note the hook, the first three seconds, and the format, not the
   topic. Topics are easy; formats are what to copy.
2. **The questions people ask, verbatim.** Forums (Autopia, Reddit
   r/AutoDetailing, r/Detailing), the "people also ask" block on Google for
   price, frequency, worth-it and specific-stain queries, and anything
   customers asked us on the day. Keep the wording; it becomes the card's
   `q`.
3. **The professional process, for accuracy.** Order of operations and the
   mechanism behind each step, so how-it's-done cards are right and can
   double as training.
4. **Our own top posts**, via the Meta MCP when authorised, or pasted.
   Which formats, which hooks, which lengths. That calibrates the mix.

## Writing it up

Sections, in this order: how it was sourced and what was not available;
what performs, ranked, with the mechanism; ad format findings; the questions
grouped by intent (price, frequency, worth it, specific problems, what is
it); the professional order of work; sources as markdown links.

Every number gets a source. Every "performs well" claim names the creator or
the study. Anything I could not verify says so rather than being smoothed
over. The `2026-09-niche-research.md` file is the reference shape.

## Then

Tell the user which sources were reachable and which were not, and hand the
file path over. If the Meta or Apify MCP was not authorised, say exactly what
`/mcp` step is needed, and build the session from web research meanwhile
rather than blocking on it.
