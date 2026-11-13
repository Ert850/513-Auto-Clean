# GoHighLevel setup: the 15-minute part

**Who:** someone logged in to the 513 Auto Clean sub-account (Elijah's login, or Imperion), plus someone with Netlify access.

**What it does:** it gives the website permission to send each booking into GoHighLevel. Nothing changes on the live site until the feed is built and merged. The website keeps writing to Google Calendar exactly as today; GoHighLevel runs alongside it.

**Rules:**
- The token goes straight from GoHighLevel into Netlify. Never paste it into chat, email or a document.
- GoHighLevel shows the token **once**. If it's lost, delete the integration and make a new one.

## 1. Make the Private Integration (5 minutes)

1. In GoHighLevel, open the **513 Auto Clean** sub-account (not the agency view).
2. Go to **Settings → Private Integrations → Create new integration**.
   - **If "Private Integrations" isn't in Settings:** Imperion has to switch it on at the agency level. Ask them, and skip to step 3 meanwhile.
3. **Name:** `513autoclean.com website`. **Description:** `Website bookings into contacts and the bookings pipeline`.
4. **Tick these permissions (scopes)**, and nothing else:
   - **Contacts:** View Contacts, Edit Contacts
   - **Opportunities:** View Opportunities, Edit Opportunities
   - **Calendars:** View Calendars, View Calendar Events, Edit Calendar Events
   - **Locations:** View Locations, View Custom Fields, Edit Custom Fields, View Tags, Edit Tags
   - **Conversations:** View Conversations, Edit Conversations, View Conversation Messages, Edit Conversation Messages. These are for texts once A2P is approved; ticking them now saves making a new token later.
5. Click **Create**. **Leave the window open with the token showing** and go straight to step 3 below.

## 2. Copy the Location ID (1 minute)

In the same sub-account, open **Settings → Business Profile**. The **Location ID** is near the top, with a copy button.
It's also the code in the address bar after `/location/`, for example `app.gohighlevel.com/v2/location/`**`AbC123xyz`**`/dashboard`.

The Location ID isn't secret; it's fine to send it in chat.

## 3. Put both into Netlify (4 minutes)

1. Netlify → site **513-auto-clean** → **Site configuration → Environment variables → Add a variable → Add a single variable**.
2. **First variable:**
   - **Key:** `GHL_PRIVATE_TOKEN`
   - **Value:** paste the token.
   - Tick **"Contains secret values"**.
   - **Scopes:** Functions. **Deploy contexts:** all (Production and Deploy Previews), so the feed can be tested on a preview before it goes live.
   - **Create variable.**
3. **Second variable:**
   - **Key:** `GHL_LOCATION_ID`
   - **Value:** the Location ID.
   - **Scopes:** All. **Deploy contexts:** all.
   - **Create variable.**
4. Close the GoHighLevel token window.

Nothing redeploys and nothing on the site changes from this.

## 4. Make the bookings pipeline (4 minutes)

In GoHighLevel: **Opportunities → Pipelines → Create new pipeline**.
- **Name:** `Website bookings`
- **Stages, in this order:**
  1. Booked
  2. Confirmed
  3. In Progress
  4. Completed
  5. Paid
  6. Cancelled
- These are Elijah's statuses (November 13). Completed and Paid are separate, because a finished job may not be paid yet. Only **Paid** counts as revenue.
- Save.

The website finds the pipeline and its stages by name. No IDs need copying.

## 5. Send Emmett's Claude one line

> "GHL done: token and location ID are in Netlify for all contexts, pipeline 'Website bookings' made with the 6 stages."

Also mention anything that didn't match these steps, such as a missing menu or a scope with a different name.

## What happens next (Claude, no one else's time needed)

1. **Build the feed** on a branch:
   - each booking creates or updates the GoHighLevel contact (name, phone, email, address, SMS consent answer, source);
   - it adds an opportunity in "Website bookings" at **Booked**, with the total, the package, the date and time, and the detailer.
2. **Test it on a deploy preview** with a test booking, then delete the test contact and opportunity.
3. **Ship it with a PR**, with your approval as usual.
4. **Later:**
   - a deleted calendar event moves the opportunity to **Cancelled**;
   - texts start once A2P is approved.
