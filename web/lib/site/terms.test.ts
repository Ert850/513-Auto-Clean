import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CAPABILITIES, GATED_COPY, IN_PERSON, copyFor, isLive } from "./capabilities.js";
import { cancellationLadder } from "../pricing/cancellation.js";
import { DEFAULT_RULES as R } from "../pricing/rules.js";

/**
 * The terms page is generated, so this checks the generator actually ran and
 * that nothing was hand-edited back out of step.
 *
 * The important one is the LAST block: a claim that depends on a feature must
 * not appear while that feature is switched off. That is the check that would
 * have caught the self-service booking link being promised before it existed.
 */
const terms = readFileSync(fileURLToPath(new URL("../../../terms.html", import.meta.url)), "utf8");
const text = terms.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("the terms page is generated, not hand-maintained", () => {
  it("has no placeholder left unfilled", () => {
    expect(terms).not.toContain("PLACEHOLDER");
  });

  it("still carries every marker, so the next build can rewrite it", () => {
    for (const name of [
      "EFFECTIVE", "CONFIRMATION", "TRAVEL_BASIS", "PAYMENT_METHODS",
      "MESSAGES", "LADDER", "CHANGES", "LATE_MOVE", "CREDIT", "HOWTOCHANGE",
    ]) {
      expect(terms, name).toContain(`<!-- TERMS:${name}:START -->`);
      expect(terms, name).toContain(`<!-- TERMS:${name}:END -->`);
    }
  });
});

describe("every number matches the pricing rules", () => {
  it("prints the cancellation ladder exactly as the engine computes it", () => {
    for (const row of cancellationLadder(R)) {
      expect(text, row.id).toContain(row.when);
      expect(text, row.id).toContain(row.cancel);
      expect(text, row.id).toContain(row.reschedule);
    }
  });

  it("quotes the notice windows from the rules", () => {
    expect(text).toContain(`${R.refundFullWindowHours} hours or more`);
    expect(text).toContain(`${R.refundMidWindowHours} to ${R.refundFullWindowHours} hours`);
  });

  it("quotes the late move fee, and says it is flat", () => {
    const fee = `${R.lateRescheduleFeeBp / 100}%`;
    expect(text).toContain(`a flat ${fee} late move fee`);
    expect(text).toContain(`It stays ${fee} every time`);
    // The compounding misreading must not creep back in.
    expect(text).not.toMatch(/goes up by another/i);
  });

  it("quotes the credit window", () => {
    expect(text).toContain(`${R.rescheduleCreditDays} days`);
  });

  it("quotes the short notice change rate", () => {
    expect(text).toContain(`${R.shortNoticeChangeBp / 100}% short notice rate`);
  });
});

describe("no claim outruns the build", () => {
  it("uses the right half of every gated sentence", () => {
    for (const row of GATED_COPY) {
      const wanted = copyFor(row.id);
      const unwanted = isLive(row.capability) ? row.notYet : row.live;

      const strip = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      expect(text, `${row.id} should say the ${isLive(row.capability) ? "live" : "not yet"} version`)
        .toContain(strip(wanted));

      // Only meaningful when the two halves actually differ.
      if (strip(unwanted) !== strip(wanted)) {
        expect(text, `${row.id} must not still say the other version`).not.toContain(strip(unwanted));
      }
    }
  });

  it("does not mention a booking link while there is no booking link", () => {
    if (!isLive("bookingLink")) {
      expect(text.toLowerCase()).not.toContain("booking link");
    }
  });

  it("does not promise ONLINE wallet checkout we cannot take", () => {
    // Two different claims wear the same brand names, and only one of them
    // depends on a Stripe key.
    //
    //   "pay by Apple Pay on the day"  is Elijah holding a phone reader. True
    //                                  now, true with no integration at all.
    //   "pay by Apple Pay at checkout" is a wallet button on this website.
    //
    // The first version of this test banned the words outright, which was
    // right while the only mention was the checkout one, and became wrong the
    // moment the terms started listing what he can take in a driveway. So it
    // now reads the sentence around the name.
    if (isLive("digitalWallets")) return;

    for (const w of ["Apple Pay", "Google Pay", "PayPal", "Venmo"]) {
      const sentences = text.split(/(?<=[.!?])\s+/).filter((x) => x.includes(w));
      for (const sentence of sentences) {
        expect(
          sentence,
          `"${w}" is offered as online checkout, but digitalWallets is off`,
        ).not.toMatch(/at checkout|when you book|pay (?:in full )?online|on this (?:page|site|website)/i);
      }
    }
  });

  it("says in-person payment is in person", () => {
    // The list only means anything if it is pinned to the day of the detail.
    // "We take Venmo" on its own reads as a checkout button.
    expect(text).toMatch(/On the day you can pay by/);
    expect(text).toContain(IN_PERSON);
  });

  it("keeps a reason on every capability that is not live", () => {
    // So the switch is never just off with nobody knowing why.
    for (const c of CAPABILITIES.filter((x) => !x.live)) {
      expect(c.blockedBy, c.id).toBeTruthy();
    }
  });
});
