# Round 15: the change list (from the owner's two transcripts and your notes, November 10)

Each item says how it will be checked. Status is updated as work lands.

## A. Recommended times, driven by the calendars
| # | Change | Verified by |
|---|---|---|
| A1 | The site reads **BEST** events (best start times) and the calendar's **Priority: N** line from every availability calendar. BEST events never block time. Setup: `docs/CALENDAR-SETUP.md`. | Unit tests; the preview against your real calendars |
| A2 | Who's offered first comes from Priority (Kris 1, Elijah 2). If it's missing, the `DETAILERS` order decides. | Unit tests; preview |
| A3 | Three day cards: **Soonest**, then the [3 days] card (see question 1), then **Weekend**. Each shows the first-priority detailer's best time(s) that day (for example, Kris 6pm). | Tests; screenshots at 1440 and 375 |
| A4 | **"More times on Friday"** shows only the other detailers' best times that day (for example, Elijah 10am, 4pm, 6pm; no 6pm at weekends), not every half hour. A small "30 min earlier / later" adjusts a time without listing every option. | Tests; screenshots |
| A5 | Fees are quieter on the recommended times: no rush labels in the headlines, and the fee as one plain line. | Screenshot review |
| A6 | Fewest clicks: one tap on a time books it (as now), with no extra screens on the way. | Click count recorded |

## B. Calendar view ("See additional times")
| # | Change | Verified by |
|---|---|---|
| B1 | Opens scrolled to the regular hours (10am onward). Early hours are above and late hours below, inside the calendar. | Measured scroll position |
| B2 | A "Scroll for earlier times" / "Scroll for later times" marker, shown while there's more in that direction. | Screenshots |

## C. Checkout: Where, Time, Accept and Confirm on one page
| # | Change | Verified by |
|---|---|---|
| C1 | One checkout page that scrolls down, laid out like a product checkout. From top to bottom: **Your details** (name, phone, email) → **Where** → **When** → **Agree** → optional setup questions → summary and **Confirm**. | Full booking flow in headless Chrome |
| C2 | Short, plain agreements: "I agree to the terms" (Yes), **"Can we record during the detail?"** (Yes / No), **"Where did you hear about us?"** (optional dropdown). The cancellation terms stay one line, with a link. | Copy review; tests |
| C3 | An unfinished checkout follows up by email ("You didn't finish your booking") (see question 3). This needs a privacy-policy update through the legal process. | Depends on the answer |
| C4 | Nothing that works today breaks: the fee check, the calendar check before booking, requests, short notice, "Help me decide", the payment rules. | The existing 470 tests plus new ones |

## D. Extras
| # | Change | Verified by |
|---|---|---|
| D1 | Add-ons stay hidden until **"View additional options for your detail"** is tapped. | Tests |
| D2 | Smaller add-on cards, with "How it works" beside each card rather than under it. | Screenshots; less height |

## E. Packages
| # | Change | Verified by |
|---|---|---|
| E1 | "How it works" moves inside each card. Descriptions become one line ("A solid clean that gets the everyday grime out." / "A deep top to bottom detail that makes it feel new again."), and the rest moves into "How it works". | Copy check |
| E2 | Simple words, at an 8-year-old reading level. | Readability score |
| E3 | At least 3 packages fully visible on a laptop (1440×790). | Fold measurement |

## F. Service step
| # | Change | Verified by |
|---|---|---|
| F1 | A row of three picture cards, left to right: **Interior, Both, Exterior**. | Screenshots |
| F2 | "Help me decide" kept as a row of its own, with fewer words. | Screenshots |

## G. Vehicle step
| # | Change | Verified by |
|---|---|---|
| G1 | A row of three picture cards, left to right: **Small, Medium, Large**. The extra price for each size is clearly marked, at the current text size. | Screenshots; tests |

## H. Results carousel (on `eNov6`, then merged into the pipeline branch, like "Ready to book?")
| # | Change | Verified by |
|---|---|---|
| H1 | One shared timeline for every card: 1s still → 1s wipe right → 1s wipe left (ending on the after) → 2s hold on the after → 1s move to the next cards, with the handles going back to the middle. Less time on the before. | Timing measured from recorded frames |
| H2 | `CLAUDE.md` updated: the owner now wants the cards in sync (this reverses an earlier rule). | Diff |

## I. Throughout
- `CLAUDE.md` rules: no em-dashes for customers, existing look, nothing breaks, log in `docs/SESSION-CHANGES-pipeline.md`.
- Checked at 1440×790, 1440×900, 820 and 375. No sideways scroll.

## Tonight, after this round
| # | Change |
|---|---|
| K1 | A PDF for the owner: the questions about the landing pages and offers. |
| K2 | Overnight, once you send the logins: analytics (GA4 and Clarity) switched on, and the magazine landing pages built. |

## Status (end of round 15)
All of A to H are built and checked in headless Chrome. The details, and what's left to verify, are in `docs/SESSION-CHANGES-pipeline.md`, Round 15:
- **A (best times):** waiting on the real BEST events in the calendars, so the fallback suggestions ran.
- **C3 (unfinished checkout):** emails the owner now; GoHighLevel takes it over once its keys are in.
- **K1 (landing-page and offer questions PDF):** next.
- **K2 (analytics and landing pages):** overnight, once the keys are in.
