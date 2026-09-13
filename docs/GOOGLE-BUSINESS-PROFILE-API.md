# Google Business Profile API: getting access

**Why:** the Places API returns **at most five reviews**, however many you have.
That is a hard cap, documented, with no parameter to raise it. The Business
Profile API returns all of them, paginated, and is the only supported way to do
it without scraping.

**What it changes:** all 32 reviews (and the 33rd, and the 300th) refresh on
their own. Today the five newest come from Places and the rest come from
`data/reviews.json`, a snapshot taken by hand on 10 September. That snapshot
works and the merge keeps it invisible, but reviews 6 and beyond freeze until
somebody retakes it.

**The long pole is approval, not code.** Google reviews every application by
hand. Start it early for the same reason the Twilio registration goes first:
nothing about it gets faster by waiting.

---

## 1. Apply for access

The API is off by default for every project, and enabling it in the console is
not enough. There is a separate application form.

1. Sign in as **the Google account that owns the 513 Auto Clean Business
   Profile**. Not a second account you later grant access to: the application
   asks about the business you manage, and a mismatch is the most common
   rejection.
2. Go to the Business Profile APIs **access request form**, linked from
   <https://developers.google.com/my-business/content/prereqs>. The URL of the
   form itself changes; the prerequisites page is the stable entry point.
3. It asks for:
   - **GCP project number.** Your existing "513 Auto Clean" project. The
     *number*, not the id: console home page, Project info card.
   - **Project ID**, from the same card.
   - **Business/company name**, and the website: `https://513autoclean.com`
   - **What you are building.** Be specific and boring. Something like:
     *"Displaying our own Google reviews on our own website,
     513autoclean.com. Read only, no posting, no data resold, no access to
     any business but ours."* Vague answers asking for broad access get
     rejected; a narrow read-only use case for your own listing is the
     easiest kind to approve.
   - **Estimated daily quota.** Ask for something small and honest. One
     refresh a day is one call. Say 100.

Expect days to weeks. Google emails the account that applied.

## 2. Enable the APIs, once approved

In the same project, APIs and Services, Library. Approval unhides them:

- **My Business Account Management API** (finds your account and location ids)
- **My Business Business Information API**
- **Google My Business API** (the one carrying `reviews.list`)

## 3. Credentials: OAuth, not an API key, not a service account

This is the part that surprises people, so it is worth being blunt.

**An API key will not work.** Review data is private to the business, so the
request has to be authenticated as somebody who can see it.

**A plain service account will not work either.** Service accounts cannot be
granted access to a personal Google account's Business Profile. Domain-wide
delegation is the exception and it needs Google Workspace, which is not what is
running here.

So: **OAuth 2.0, once, by hand, to mint a refresh token** that the server then
uses forever without a human present.

1. APIs and Services, OAuth consent screen. **External**, since the owning
   account is a normal Gmail account. Add that same address as a **test user**.
   The app can stay in "Testing" mode: it never faces a customer, and only the
   test users can authorize it, which is exactly what we want.
2. Credentials, Create credentials, **OAuth client ID**, type **Web
   application**. Add `http://localhost:8976/callback` as an authorized
   redirect URI. It only has to work on your laptop, once.
3. Scope: `https://www.googleapis.com/auth/business.manage`
4. Run the one-off consent flow on your laptop, approve as the owning account,
   and keep the **refresh token** it prints.

> A refresh token minted by an app in Testing mode expires after **7 days**.
> For a long-lived token the consent screen has to be **Published**, which for
> a sensitive scope like `business.manage` normally means verification. The
> practical route is to publish the app and keep it restricted to the owning
> account, and to expect that this is the step most likely to need a second
> attempt. Plan for it rather than being surprised by it.

## 4. Into Netlify

| Variable | Secret | What it is |
|---|---|---|
| `GBP_CLIENT_ID` | no | OAuth client id |
| `GBP_CLIENT_SECRET` | **yes** | OAuth client secret |
| `GBP_REFRESH_TOKEN` | **yes** | from the one-off consent flow |
| `GBP_ACCOUNT_ID` | no | `accounts/123...`, from Account Management |
| `GBP_LOCATION_ID` | no | `locations/456...` |

Send me the two that are not secret. The other three go straight into Netlify.

---

## What I build once those exist

**A scheduled function, nightly.** Netlify Scheduled Functions take a cron
expression in `netlify.toml`. Midnight Eastern is `0 5 * * *` in UTC during
daylight time; the job is idempotent, so the hour drifting by one over winter
costs nothing.

It exchanges the refresh token for an access token, pages through
`accounts/*/locations/*/reviews` until the pages run out, and writes the result
where the site can read it.

**Where it writes** is the one real decision, and it is worth making
deliberately:

| | How | Trade |
|---|---|---|
| **A** | Job POSTs a Netlify **build hook**; a build-time script fetches and writes `dist/data/reviews.json` | No extra service. Reviews are baked into the deploy, so they are instant and free per visitor. Costs one build a day. |
| **B** | Job writes to **Netlify Blobs**; `/api/reviews` reads from there | No daily build. One more moving part, and a runtime read per visitor (cached). |

**A is the better fit.** This site is static, the deploy takes fifteen seconds,
and a daily build also picks up anything else that has been merged. It is also
the option that keeps working if the job fails: the last good file stays
deployed rather than the endpoint going dark.

**The merge stays either way.** `js/reviews.js` already combines sources and
de-duplicates on author plus the opening of the text, so the switch from five
reviews to all of them changes a number and nothing else.

---

## If approval is refused or takes too long

The site is not waiting on this. Today it shows all 32 with a live rating and
count. The only cost of never doing it is that somebody has to hand me the new
reviews every few months and I refresh `data/reviews.json`. That is a ten
minute job a few times a year, and it is the honest fallback rather than a
degraded one.
