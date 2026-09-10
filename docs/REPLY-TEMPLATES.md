# Reply templates

Canned answers for texts, Google messages, Thumbtack and Facebook. Prices
checked against the live catalog on 2026-09-10.

**When a price changes, change it in `web/lib/catalog/seed.ts` and then here.**
The website generates itself from that file, so it can never be stale. This
page cannot, so it is the one to check.

---

## Prices

**Interior**

| | | |
|---|---|---|
| Basic Interior | $125 | 2 hrs |
| Full Interior | $215 | 4 hrs |
| Showroom Ready | $395 | 7 hrs |

**Exterior**

| | | |
|---|---|---|
| Express Exterior | $75 | 1.25 hrs |
| Basic Exterior | $125 | 2 hrs |
| Full Exterior | $245 | 4 hrs |

**Discounts:** interior and exterior together takes **$25 off**. Two or more
vehicles booked together takes **10% off everything**. Paying in full takes
another **5% off**.

**Travel:** the first 10 minutes of drive time are free, then it is priced on
the real drive rather than a flat call-out fee.

Add-ons, paint correction, ceramic coating tiers and everything else are on
the site. Send the link rather than retyping them.

---

## The main reply

> Hi! We'd be happy to help.
>
> We offer a 100% satisfaction guarantee. If anything is not to your liking,
> we will make it right. We are also fully insured.
>
> **Interior:** Basic Interior ($125), Full Interior ($215), or Showroom Ready
> ($395).
>
> Basic: vacuum, clean mats, clean surfaces, remove interior grime.
>
> Full: thorough vacuum, shampoo and scrub upholstery, treat stains, wash and
> dress mats, condition leather, clean glass, brush detail every crevice.
>
> Showroom Ready: everything in Full, then the cabin steamed and sanitized,
> engrained fibers lifted out individually, and a ceramic coating on the trim
> and interior metal.
>
> **Exterior:** Express Exterior ($75), Basic Exterior ($125), or Full
> Exterior ($245).
>
> Express: rinse, scrub hubcaps, gentle hand wash, towel dry, clean windows.
>
> Basic: pre-wash, bug removal, hand wash, blow and towel dry, wheels and
> wheel wells scrubbed, tires dressed.
>
> Full: everything in Basic, plus paint decontamination, clay towel, hard
> water spot removal, engine bay cleaned and protected, and a ceramic wax
> sealant.
>
> **Booking interior and exterior together saves you $25.**
>
> Full pricing, add-ons, paint correction and instant online booking:
> **513autoclean.com/#services**
>
> We are flexible on time (feel free to suggest one) and come to your home or
> work. Call or text 513-279-2915.
>
> Our 32 five star reviews: https://share.google/gKiBFJyu2SoY8czTg

---

## Short reply, one service

> Hi! We'd be happy to help.
>
> We can do a Full Interior detail for $215: thorough vacuum, shampoo and
> scrub upholstery, treat stains, wash and dress mats, condition leather,
> clean glass, brush detail every crevice. About 4 hours.
>
> Everything we offer, with pricing: **513autoclean.com/#services**
>
> We are flexible on time, come to your home or work, and take pride in the
> work. Call or text 513-279-2915.
>
> Our 32 five star reviews: https://share.google/gKiBFJyu2SoY8czTg

---

## Interior and exterior together

> Hi, we'd be happy to help.
>
> Booked together, a Basic Interior and Basic Exterior is $250, less the $25
> combo discount, so **$225**. Full Interior and Full Exterior together is
> $460, less $25, so **$435**.
>
> Pick any combination and see the price instantly:
> **513autoclean.com/#services**
>
> We are flexible on time, come to your home or work. Call or text
> 513-279-2915.
>
> Our 32 five star reviews: https://share.google/gKiBFJyu2SoY8czTg

---

## Not enough information yet

> Hi, we'd be happy to help.
>
> Tell me the make and model of your vehicle and roughly what you are after,
> and I will get you scheduled.
>
> You can also pick a package, see the exact price with travel, and book a
> time yourself here: **513autoclean.com/#services**
>
> We are flexible on time (feel free to suggest one) and come to your home or
> work. Call or text 513-279-2915.
>
> Our 32 five star reviews: https://share.google/gKiBFJyu2SoY8czTg

---

## Promo code

There is a promo code field at the payment step. Currently live:

| Code | Discount | Notes |
|---|---|---|
| `LIKENEW` | 10% off the service | Travel is not discounted |

Codes are case and space insensitive, so `likenew` and `Like New` both work.
To add, change or retire one, edit `web/lib/pricing/promos.ts`. The server
looks every code up in that same file, so nobody can invent their own.

---

## Notes on the old versions of this text

Everything below was in circulation and is now wrong. Kept only so an old
message can be recognised, not to be sent.

- **$15 combo discount.** It is **$25** now.
- **Express Interior $65.** Discontinued. The cheapest interior is Basic at
  $125.
- **Basic Interior $100 or $115, Full Interior $189 or $195.** Now $125 and
  $215.
- **Basic Exterior $100 or $115, Full Exterior $189, $200 or $210.** Now $125
  and $245.
- **"$50/hour add-ons".** Add-ons are flat priced by tier now, not hourly.
- **"Headlight restoration $70", "clay bar $80".** Now $75 and $45.
- **"6 month ceramic sealant".** Called a **ceramic wax sealant** now, so
  nobody reads it as a ceramic coating.
- **"22+ reviews", "19+ reviews", "30+ reviews".** It is **32**.
- **"$165 interior and exterior full package".** Never a real price.

Rather than keeping updated copies of the service lists here, send
**513autoclean.com/#services**. That page is generated from the catalog and
cannot go stale.

> **On that link:** `#services` scrolls to the services section, which lists
> every package with prices, durations, what is included and a Book button.
> The in-page "View Services" browser (search and filter across everything,
> including add-ons) has no shareable URL of its own yet. Say the word and I
> will add one, something like `513autoclean.com/#browse`.
