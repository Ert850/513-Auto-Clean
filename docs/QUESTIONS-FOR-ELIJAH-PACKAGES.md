# Questions for Elijah (or his agent): packages, business hours and the FAQ

From Emmett's agent, November 11 and 12, 2026, on branch `eNov6`. Sixteen questions, each with a recommended answer: 1 to 10 are the interior package change, 11 and 12 come from the team brief, 13 is a print date, 14 is business hours, 15 is an FAQ answer and 16 is Kris's evening drive.

**Answered by Elijah in a voice recording, November 12 (transcribed by Emmett's agent).** Open after his answers: the Full + Steam arithmetic (2), one Showroom Ready Restoration price (8) and question 16. Also new from the recording: drop Showroom Ready *exterior* and offer Paint Correction as its own choice; the interior prices on the site were wrong ($135 and $225, not $125 and $215, before the new prices).

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

**Answer:** Basic Interior, Full Interior, Full Interior + Steam at first, then revised in the same recording ("Let's do this"): **Maintenance at the top ($115, interior only, only for customers who had a detail in the last 3 months, said clearly), Basic Interior ($145), Full Interior ($235)**, with steam as an always-shown button at the bottom of the Full Interior card that makes it "Full Interior + Steam" (question 6). He thinks that converts better than a 3rd (now 4th) package.

**2. Full Interior + Steam: price.** Full plus the steam extra comes to $290. Recommended: **$290, no bundle discount** (the business context says not to push discounts). Alternative: a round bundle price, for example $279.

**Answer:** **$295 total for Full Interior + Steam.** The steam extra is presented as normally $115, "$80 for you today" so it feels like a deal. *Doesn't add up yet:* Full at $235 plus $80 is $315, not $295 (and $115 minus $80 is $35 off, not the $45 he says). Earlier in the recording: Full $225 + steam $80 = $295 doesn't add up either. **Needs one confirmation:** with Full at $235, is it $295 total (steam +$60, shown as $55 off $115), or $315 (steam +$80)?

**3. Full Interior + Steam: time.** Recommended: **5 h 30 min** (4 h plus 1 h 30 min), the same as today's Full plus the steam extra.

**Answer:** **5 hours flat** for Full Interior + Steam (not 5.5). Keep the "1 h 30 min" wording for steam on the website, but count it as 1 hour internally.

**4. Which one carries the "Most popular" badge?** Today it's on Full Interior. Recommended: **Full Interior + Steam**, since it's the lead offer.

**Answer:** **Yes: Full Interior + Steam carries "Most popular"** as the lead offer.

**5. The steam extra once Full + Steam is a package.** Recommended:
- **Basic Interior:** keep it as an extra;
- **Full Interior:** hide it there and point to the Full + Steam package, so the same thing isn't sold two ways at two places on the page.

**Answer:** **Yes.** Basic Interior: steam stays an extra. Full Interior: steam shown as the button that makes it Full Interior + Steam; however someone adds steam to a Full Interior, they get the Full + Steam price. "We want them converted whatever way."

**6. Your "button directly under Add Steam Cleaning" idea.** You said to try a separate package first. Recommended: **separate package now.** The settings file makes it a small change to switch to a toggle on the Full Interior card later, if the numbers say so.

**Answer:** **Changed: a button directly under Full Interior, not a separate package** ("lowest friction", they don't read a second package). Always shown, the total updates to the Full + Steam price.

## Showroom Ready becomes an add-on

**7. Name.** Recommended: **"Showroom Ready Restoration"**. It's the deep work Showroom Ready adds over Full Interior: individual fiber lifting from the carpet backing, deeper seam and crevice work, and the rest of what Showroom Ready lists today.

**Answer:** **Yes: "Showroom Ready Restoration"** ("showroom ready interior restoration works well"). Most people don't need it, which is why it's an add-on.

**8. Price and time.** Showroom Ready minus Full Interior is $180 and about 3 h. Recommended: **+$180, +3 h.**

**Answer:** **Higher than $180: priced around $445 to $495** ("they're paying for the expertise"), high margin, for very special jobs. Earlier in the recording he said $395 is fine; the later answer is $445 to $495. **Needs one figure.** Time not given (keep +3 h). **Only Elijah can be scheduled for it.** Don't spend much time on it: "play something down and if it goes through, great".

**9. Which packages can take it?** Recommended: **Full Interior and Full Interior + Steam only**, since it builds on Full.

**Answer:** **Yes: Full Interior and Full Interior + Steam only.**

**10. Old links and bookings that name Showroom Ready (interior).** Recommended: a saved quote link that names it opens as **Full Interior + Showroom Ready Restoration**, at the same total. Bookings already on the calendar are untouched.

**Answer:** **Yes**: an old link opens as Full Interior + Showroom Ready Restoration at the same total.

## From the team brief (7.1)

**11. The $100 minimum for one-off restoration jobs** (one seat extraction, a vomit or urine spot). The booking form doesn't sell an extra on its own today; every booking has a package. Recommended: **don't book these online.** Say "One-off restoration jobs start at $100, and some need a photo or a call first" on the Services page and in the FAQ, with Text us and Call buttons.

**Answer:** **A bigger idea instead: restoration jobs get their own workflow.** The first screen offers Interior, Exterior, Paint Correction and Protection, and **Stain, Spill and Odor Removal** (or similar); each opens its own page. One-off jobs (one stain, a spill, vomit, pet urine) hook people with the specific fix, and can then be upsold to a package ("a basic for not too much more"). No price minimum stated here (the team brief's $100 minimum stands for now).

**12. "Fill Kris first."** The site offers whichever detailer's calendar description says `Priority: 1` first. Recommended: put **`Priority: 1` in the description of Kris's availability calendar** and **`Priority: 2` in yours**, in Google Calendar, Settings and sharing, Calendar description. No code change. Who sets it?

**Answer:** **Kris first (1), Elijah second (2).** Already set in both calendars' descriptions and checked November 12. He asked whether it can be coded: it is configured, and Emmett can change it.

## One date to confirm

**13. When does Prestige Living print?** `BUSINESS-CONTEXT.md` says late November to early December. In his recording the owner said 2027. The QR code points at `513autoclean.com/prestige`, which works once `eNov6` goes live (being merged now), so either date is covered. The date only decides when the offer and page need to be final.

**Answer:** **Prestige Living prints around 2028** (he isn't sure). Both landing pages (Prestige Living and golf) should be final by **the beginning of January**. He thinks the emails to the print companies went out and will check.

## Business hours (added November 12)

**14. What hours should Google and the website show?**
- **Today:**
  - The Google Business Profile and the website both say "7 days a week, 7 AM to 10 PM". On the website that's the footer of every page, the home page's contact block and the Contact page.
  - The website's hidden business data for Google says 6 AM to 10 PM, so it doesn't even agree with itself.
- **Your `BUSINESS-CONTEXT.md` (section 6):** those hours don't match real capacity. The booking form already ignores them: it only offers times inside each detailer's OPEN blocks.
- **Recommended:** show the hours when someone answers texts and calls and takes bookings, which is the usual choice for a mobile business. Leave the real job times to the booking form.
- **Once you give the hours:** Imperion sets them on Google, and Emmett makes all the website's copies match, the hidden data included.

Please give the days and times.

**Answer:** **6 AM to midnight, 7 days a week**, as the hours for texts, calls and bookings; the booking form shows real job times. Say "midnight" rather than "12 AM". Imperion sets the same on Google. (He also says to ignore the capacity notes in `BUSINESS-CONTEXT.md`: OPEN blocks decide, and adapt as capacity grows.)

**15. The FAQ's "How long does a detail take?"** It opens with "Express details run about 1.25 hours". Express Exterior does exist ($75, 1 h 15 min, corrected November 13), so the figure is true, but it's typed into the page rather than read from the catalog. Maintenance (returning customers) is 1 h 45 min. The basic and full hours in the same answer now come from the catalog. Recommended: drop the Express clause, or name the packages new customers can book, once the interior package change (questions 1 to 10) is settled. Which?

**Answer:** **The FAQ needs a rewrite.** Draft 50 to 100 questions (what people actually search about detailing, from Google) for him to answer in his own words. Lightly polish his answers. Show about 5 top questions on the FAQ page, with an expanded FAQ or blog index behind them for search. The FAQ page must not feel overwhelming.

## Kris's evenings (added November 12)

**16. Does Kris drive to his first evening job before 6pm?**
- **Today the site assumes he doesn't.** His drive has to fit inside his 6pm block, so a 6pm start is planned as arriving up to 7pm (still inside the "arrive 6 to 7pm" window the customer is shown). On a long drive, where his travel buffer passes an hour, the 6pm start isn't offered at all, only 6:30 and 7pm. Jobs over about 5 hours never fit an evening.
- **Elijah's mornings work the other way:** before 10am his first drive is assumed to happen before the day starts.
- **Recommended:** treat the start of any working stretch as the start of the day for the drive, so Kris's 6pm means arriving at 6pm, as his BEST time intends. That's a small change once you confirm he leaves home in time.

**Answer:** **Not answered in this recording.** Still open.

## Follow-up answers (Elijah, text message, November 13)

- **2. Full Interior + Steam:** **$315** at the later prices (Full $235 + steam $80). Steam on **any other package** is an add-on at **$115**.
- **8. Showroom Ready Restoration:** **starts at $445**, estimate **+3 hours**, worded "starts at $445".
- **16. Kris's evening drive:** **yes, Kris can arrive at 6pm** (his day job ends around 5pm). The site should plan his 6pm as a 6pm arrival.
- **New prices** (Maintenance $115, Basic $145, Full $235, Full + Steam $315): **later**. Raise them if bookings convert well at today's prices ($135 and $225).
- **Prestige Living:** assume it prints **January 1** (annual). The landing page must be final by then. He'll check the printer emails; assume they go out.
- **JobsSync:** he'll install the updated script himself.
- **Accounting:** in future it should run through GoHighLevel, not the website. He wants payments through a business account and card, and all the accounting sources compiled in one place.
- **New ask:** cancelling a booking should also remove it from accounting. Perhaps a job reaches accounting only after the detailer confirms it was done.

**Clarified (November 13):**
- **Steam now, at today's prices:** $80 when added to Full Interior (Full + Steam $305 today), and $115 on any other package.
- **Deleting a booking's event on the calendar = a cancellation,** and Elijah or Kris must be able to do it.
- **A job reaches accounting only once it's marked done and payment is collected.**
- **GoHighLevel takes over the bookkeeping.**

