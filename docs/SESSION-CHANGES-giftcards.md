# Gift cards: session changes (branch `eNov14`)

The plan and the questions are in `GIFT-CARDS-PLAN-2026-11-23.md` (and its PDF, for Elijah). The build waits for the answers.

## November 23

### Fix: a browser could mark a booking "PAID IN FULL online"
- **What happened:** `send-confirmation` read `mode: "pay_now"` from the request and passed it to the booking check (`wire.ts`), which made it a paid-in-full booking. The calendar event and Elijah's email then said "PAID IN FULL online", and the price took the pay-now discount. Nothing checked a payment. Anyone editing the request in developer tools could book that way. Live on `main` too; it ships with the eNov14 merge (freeze rule: no hotfix).
- **Root cause:** paying in full was switched off only in the browser (`capabilities.ts` `payInFull`), and the server has no webhook or payment id to check, so it believed the browser's word. The browser-side guard named in the switch's comment protects only the honest form.
- **Fix:** `send-confirmation.mjs` counts "pay_now" only while `payInFull` is live. A new test keeps `payInFull` off until the server verifies payments itself, so switching it on can't bring the bug back silently. A rule in CLAUDE.md covers gift cards too.
- **Changed tests:** `still-free.test.ts` used "pay_now" as the example of a paid booking on a taken time. With paying in full off, that request is now refused like any booking on a taken time (409). The paid-booking case returns when payments are verified.
- **Test:** `functions.smoke.test.ts` "a browser saying it paid books a detail still to collect" (fails without the fix, checked), and the full suite: 801 pass.
- **What to test by hand:** none needed. Nothing a customer sees changes: the form never sends "pay_now" while paying in full is off.
- **Until the merge:** Elijah should treat any "PAID IN FULL online" booking as unpaid.

### Mockups: gift card page layouts
- `docs/mockups/eNov23-gift-card-layouts.png`: A, the calculator beside the tiers; B, the calculator below them; and the phone view, the same for both. Real screenshots of the eNov14 build with the page injected. Nothing built.
