# 513 Auto Clean — Website

A fast, mobile-first, conversion-focused static site for **513 Auto Clean**, UC student-owned mobile car detailing in Cincinnati. Built to mirror the proven structure of the Archer Detailing reference site, with a bold red-and-black identity matching the 513 Auto Clean logo.

Plain **HTML + CSS + JS** — no build step. Deploys free anywhere (Netlify, Vercel, GitHub Pages, Cloudflare Pages) or onto your current host.

```
513-autoclean/
├─ index.html        ← the whole page (all sections)
├─ styles.css        ← design system
├─ script.js         ← nav, tabs, scroll reveals, form handling
├─ images/           ← curated gallery photos (real details)
│  └─ pool/          ← 40 extra high-res photos to swap in
└─ README.md
```

---

## ✅ Do these 2 things before going live

### 1. Make the quote form deliver to your inbox (Web3Forms — free, ~30 sec)

The form is wired to **Web3Forms**, which emails submissions straight to your Gmail. Until you add a key, the form gracefully falls back to opening a pre-filled **text message** to you — so you never lose a lead.

To turn on email delivery:

1. Go to **https://web3forms.com** → enter `513autoclean@gmail.com` → you'll get an **Access Key** by email.
2. Open `index.html`, find this line (in the quote form):
   ```html
   <input type="hidden" name="access_key" value="YOUR_WEB3FORMS_ACCESS_KEY" />
   ```
3. Replace `YOUR_WEB3FORMS_ACCESS_KEY` with the key you got. Save. Done.

Submissions now arrive in your Gmail with the subject "New quote request from 513autoclean.com." Free and unlimited.

> The **Call / Text (513) 279-2915** buttons work everywhere with zero setup. Those are the guaranteed contact paths and appear in the header, hero, contact section, footer, and the sticky mobile bar.

### 2. Connect the live Google reviews widget

The reviews section (`#reviews`) and the hero badge are built to show **real reviews pulled live from your Google profile**, so nothing on the page is fabricated. Right now they show a clean fallback (your 5.0 rating, "21+ reviews", and a "Read all reviews on Google" button). To make the full review feed live:

1. Pick a free Google reviews widget. Good options: **Featurable** (free, no branding), **Trustindex**, or **Elfsight**. Sign in, connect your 513 Auto Clean Google Business profile, and choose a layout.
2. Copy the embed snippet they give you.
3. In `index.html`, find `<div class="reviews-widget" id="reviews-widget">` and replace the inner `.rev-fallback` block with your embed snippet.

The "Read all reviews on Google" and "See us on Yelp" buttons already link to your real profiles, so they work immediately.

### 3. The availability calendar (View Our Schedule)

The `#schedule` section shows your Google Calendar so customers can see open times (7 AM to 10 PM) and where you're already booked. It has two modes:

- **Out of the box (no setup):** it embeds your public calendar in week view. This works immediately, but Google's own embed will show event titles.
- **Clean "Unavailable-only" view (recommended):** to hide every event title and show booked times only as red **"Unavailable"** blocks, add a free Google API key:
  1. In the [Google Cloud Console](https://console.cloud.google.com/), create a project, enable the **Google Calendar API**, and create an **API key** (restrict it to your domain).
  2. Make sure the calendar is **public** (Calendar settings → Access permissions → "Make available to public" → *See only free/busy* is enough).
  3. In `script.js`, find `var API_KEY = 'YOUR_GOOGLE_API_KEY';` (in the availability-calendar block) and paste your key.

  The page then renders a styled week grid where everything is open except real bookings, which appear as red "Unavailable" blocks with no titles. The calendar ID is already wired in.

### 4. Curate your photos

The gallery is built from **6 interactive before/after sliders** (drag to reveal), using your sorted pairs:
`images/ba-pethair-*`, `ba-headlight-*`, `ba-sonic-interior-*`, `ba-jeep-cargo-*`, `ba-crv-interior-*`, `ba-console-*` (each has a `-before.jpg` and `-after.jpg`).

- **Add or swap a pair:** drop in a new `ba-<name>-before.jpg` / `ba-<name>-after.jpg`, then copy one `<figure class="ba-slider">…</figure>` block in the `#gallery` section of `index.html` and point it at your files. Rule from your folder: the **lower-numbered photo is the before.** Pairs shot from the same angle and distance slide the best. Only real before/after pairs are used, no stock or filler.
- The hero background is `images/hero-exterior.jpg` (the white VW). Swap if you have a stronger "wow" shot.
- 40 of your highest-resolution photos are in `images/pool/` for any other swaps.

---

## 📝 Things you'll likely want to update

- **Review count** — shown as `21+ reviews` and `5.0` (hero badge, reviews section, and the SEO `aggregateRating` in `index.html`). Update as your count grows, or let the live widget handle it.
- **Prices** — set per your latest: Interior $75 / $115 / $195, Exterior $65 / $115 / $210, combo saves $15, add-ons $50/hr. Change them in the `#services` cards and the form's `<select>` if they shift.
- **Service areas** — listed by region with area codes (513/937, 859, 812/765) covering ~1 hr / ~50 mi of downtown Cincinnati. Edit the `#areas` section to add or remove towns.

---

## 🎨 Branding

- **Logo:** `images/logo-mark.png` (red spray-bottle mark) is used in the header, mobile menu, and footer. The full lockup with text is at `images/logo-full.png`.
- **Colors:** bold red (`--red: #e01a1a`) and black, on warm white, matching your logo. All defined as CSS variables at the top of `styles.css`.
- **Fonts:** Bricolage Grotesque (headings) + Hanken Grotesk (body).

---

## ▶️ Preview locally

From this folder (Node is already installed on your machine):

```bash
npx serve .
# then open the URL it prints (e.g. http://localhost:3000)
```

or just double-click `index.html` to open it straight in your browser.

---

## 🚀 Deploy

**Easiest (free):** drag this folder onto **https://app.netlify.com/drop** — live in seconds with HTTPS.

**Replace your current WordPress site:** point your `513autoclean.com` domain at the new host (Netlify/Vercel/Cloudflare Pages all give free SSL + custom-domain instructions). The old WordPress export in your Downloads is not needed — this is a clean rebuild.

---

## Design notes

- **Type:** Bricolage Grotesque (display) + Hanken Grotesk (body), distinctive, not generic.
- **Palette:** bold red and black on warm white, matching the logo.
- **Performance/SEO:** full-bleed hero image, optimized assets, lazy-loaded gallery, `AutoDetailing` LocalBusiness schema, Open Graph tags, `prefers-reduced-motion` support, sticky tap-to-call on mobile.
- Everything is in three files, easy to hand-edit. No framework, no dependencies.
