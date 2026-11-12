# Questions for Elijah (or his agent): packages, business hours and the FAQ

From Emmett's agent, November 11 and 12, 2026, on branch `eNov6`. Fifteen questions, each with a recommended answer: 1 to 10 are the interior package change, 11 and 12 come from the team brief, 13 is a print date, 14 is business hours and 15 is an FAQ answer.

**To Elijah's agent:**
- Please put these to Elijah.
- Write his answer on each **Answer:** line. "Yes" means the recommendation stands.
- Push to `eNov6`, as you did with `BUSINESS-CONTEXT.md`.
- Nothing here is built yet. The change waits on these answers (`docs/QUEUE-AFTER-FRIDAY.md`).

**What Elijah has already decided** (his messages to Emmett, November 11; `BUSINESS-CONTEXT.md`):
- interior has **three** packages, not four ("4 is too complicated");
- **Full Interior + Steam** is its own package and the lead offer;
- **Showroom Ready (interior)** leaves the package list and can become an add-on, "Showroom Ready restoration or something";
- **exterior stays as it is**;
- the packages are **driven from a JSON settings file**, not hard-coded.

**Today's interior catalog** (`web/lib/catalog/seed.ts`):

| Package | Price | Time |
|---|---|---|
| Maintenance | $95 | 1 h 45 min, returning customers only |
| Basic Interior | $125 | 2 h |
| Full Interior | $215 | 4 h |
| Showroom Ready | $395 | about 7 h |
| Full Vehicle Steam Treatment (extra) | $75 | 1 h 30 min |

---

## The three packages

**1. Which three?** Recommended: **Basic Interior, Full Interior, Full Interior + Steam.** Maintenance stays as it is today: returning customers only, not one of the three on the page.

**Answer:**

**2. Full Interior + Steam: price.** Full plus the steam extra comes to $290. Recommended: **$290, no bundle discount** (the business context says not to push discounts). Alternative: a round bundle price, for example $279.

**Answer:**

**3. Full Interior + Steam: time.** Recommended: **5 h 30 min** (4 h plus 1 h 30 min), the same as today's Full plus the steam extra.

**Answer:**

**4. Which one carries the "Most popular" badge?** Today it's on Full Interior. Recommended: **Full Interior + Steam**, since it's the lead offer.

**Answer:**

**5. The steam extra once Full + Steam is a package.** Recommended:
- **Basic Interior:** keep it as an extra;
- **Full Interior:** hide it there and point to the Full + Steam package, so the same thing isn't sold two ways at two places on the page.

**Answer:**

**6. Your "button directly under Add Steam Cleaning" idea.** You said to try a separate package first. Recommended: **separate package now.** The settings file makes it a small change to switch to a toggle on the Full Interior card later, if the numbers say so.

**Answer:**

## Showroom Ready becomes an add-on

**7. Name.** Recommended: **"Showroom Ready Restoration"**. It's the deep work Showroom Ready adds over Full Interior: individual fiber lifting from the carpet backing, deeper seam and crevice work, and the rest of what Showroom Ready lists today.

**Answer:**

**8. Price and time.** Showroom Ready minus Full Interior is $180 and about 3 h. Recommended: **+$180, +3 h.**

**Answer:**

**9. Which packages can take it?** Recommended: **Full Interior and Full Interior + Steam only**, since it builds on Full.

**Answer:**

**10. Old links and bookings that name Showroom Ready (interior).** Recommended: a saved quote link that names it opens as **Full Interior + Showroom Ready Restoration**, at the same total. Bookings already on the calendar are untouched.

**Answer:**

## From the team brief (7.1)

**11. The $100 minimum for one-off restoration jobs** (one seat extraction, a vomit or urine spot). The booking form doesn't sell an extra on its own today; every booking has a package. Recommended: **don't book these online.** Say "One-off restoration jobs start at $100, and some need a photo or a call first" on the Services page and in the FAQ, with Text us and Call buttons.

**Answer:**

**12. "Fill Kris first."** The site offers whichever detailer's calendar description says `Priority: 1` first. Recommended: put **`Priority: 1` in the description of Kris's availability calendar** and **`Priority: 2` in yours**, in Google Calendar, Settings and sharing, Calendar description. No code change. Who sets it?

**Answer:**

## One date to confirm

**13. When does Prestige Living print?** `BUSINESS-CONTEXT.md` says late November to early December. In his recording the owner said 2027. The QR code points at `513autoclean.com/prestige`, which works once `eNov6` goes live (being merged now), so either date is covered. The date only decides when the offer and page need to be final.

**Answer:**

## Business hours (added November 12)

**14. What hours should Google and the website show?**
- **Today:**
  - The Google Business Profile and the website both say "7 days a week, 7 AM to 10 PM". On the website that's the footer of every page, the home page's contact block and the Contact page.
  - The website's hidden business data for Google says 6 AM to 10 PM, so it doesn't even agree with itself.
- **Your `BUSINESS-CONTEXT.md` (section 6):** those hours don't match real capacity. The booking form already ignores them: it only offers times inside each detailer's OPEN blocks.
- **Recommended:** show the hours when someone answers texts and calls and takes bookings, which is the usual choice for a mobile business. Leave the real job times to the booking form.
- **Once you give the hours:** Imperion sets them on Google, and Emmett makes all the website's copies match, the hidden data included.

Please give the days and times.

**Answer:**

**15. The FAQ's "How long does a detail take?"** It opens with "Express details run about 1.25 hours", but there's no Express package. Maintenance (returning customers) is 1 h 45 min. The basic and full hours in the same answer now come from the catalog. Recommended: drop the Express clause, or name the packages new customers can book, once the interior package change (questions 1 to 10) is settled. Which?

**Answer:**
