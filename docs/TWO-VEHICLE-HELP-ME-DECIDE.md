# Help me decide with two vehicles: options, November 16, 2026

**Mockups:** `docs/mockups/eNov16-two-vehicle-help-me-decide.png` (375 px, the eNov14 build with each option injected). Nothing is built.

**Today (eNov14):** Help me decide is offered only while there is one vehicle (validation passes 1 to 3). With it on vehicle 2, vehicle 1's package went out as an advice request held for the wrong length, while the vehicle that needed advice was left out. With two vehicles there is no way to ask for advice in the form. The notes box and "I have a question" remain, and nothing on vehicle 2 says so.

| | What the customer sees | Browser | Server | Size |
|---|---|---|---|---|
| **A. For the whole visit** | Asked once, on vehicle 1: "We look at your vehicles and recommend for each", then "How many vehicles? 1 2 3", then each one's size. Nothing is priced until we see them. | The count makes that many vehicles, each a Help me decide; one size question each. | **Small.** Help me decide already keeps every vehicle (`validateWire`). It needs a hold length for 2 or 3 vehicles: a setting Elijah sets, never typed in. The event and owner email list each vehicle's size. | Medium |
| **B. This vehicle only, priced on the day** | On vehicle 2: "Not sure what this one needs? We recommend and price it on the day. Vehicle 1 stays as booked." The bar reads "$145 + vehicle 2, vehicle 2 priced on the day". | A per-vehicle "advise" flag instead of the global Help me decide; every check that reads all vehicles has to know it. | **Significant, needs your review of a plan first:** see the list below the table. | Large |
| **C. No new option** | One line under vehicle 2's choices: "Not sure what this one needs? Pick the closest, and tell us about it in the notes at checkout. We confirm the price before we start." | One sentence. | None. | Small |

**What option B needs on the server:**
- a booking that can carry a vehicle marked "advise";
- a hold of vehicle 1's length plus an advice block;
- a decision on whether the multi-vehicle discount applies to vehicle 1 before vehicle 2 is priced;
- the calendar event, both emails, and the `TOTAL:` line JobsSync copies into Elijah's Accounting sheet, which covers vehicle 1 only until he updates it.

**Recommendation:** C now, because it is honest, costs one sentence and needs no server change. Revisit A or B if Elijah's booking emails show two-vehicle customers asking for advice in the notes. B is the closest match to "one car I know, one I don't", but it changes the booking, the hold, the price and the accounting together, so it needs Elijah's view on the discount and the hold first.
