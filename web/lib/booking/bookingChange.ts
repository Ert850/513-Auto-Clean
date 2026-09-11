import type { PricingRules } from "../pricing/rules.js";

/**
 * Changing a booking that already exists.
 *
 * A customer decides the day before that they also want the outside done, or
 * that they need to shift from the morning to the evening. This works out
 * what, if anything, that costs.
 *
 * OUTSIDE 72 HOURS, NOTHING. There is time to refill whatever they hand back,
 * so change as much as you like.
 *
 * INSIDE 72 HOURS the question is what they took, and the test is whether
 * they kept every minute they already had.
 *
 *   KEPT IT ALL AND ADDED MORE. Say 10am to 2pm becomes 8am to 2pm. The
 *   original four hours were already theirs, so those are untouched. Only the
 *   new 8am to 10am is time somebody else could have booked, so the short
 *   notice rate applies to THAT and nothing else. Same for running later.
 *
 *   GAVE SOME BACK AND TOOK OTHER TIME. Say 10am to 2pm becomes 8am to 12pm.
 *   They have handed back 12pm to 2pm, which is no use to anyone at this
 *   notice, and taken 8am to 10am, which was. That is a different booking
 *   rather than a bigger one, so the rate applies to the whole thing.
 *
 *   TOOK A COMPLETELY DIFFERENT SLOT. Same as above: the whole thing.
 *
 * The reason the first case is treated so much more gently is that WE WANT
 * PEOPLE TO ADD SERVICES. Someone deciding on the morning that they also want
 * the exterior done is a good day for everyone, and a rule that charged 20%
 * on the entire booking for it would teach customers not to ask.
 */

export interface Window {
  /** Epoch ms. */
  startMs: number;
  endMs: number;
}

export interface ChangeInput {
  /** What they booked. */
  original: Window;
  /** What they want now, including any extra time the new services need. */
  proposed: Window;
  /** Hours between now and the ORIGINAL appointment. */
  hoursUntilStart: number;
  /** Service total of the NEW booking, in cents, before any change fee. */
  newServiceCents: number;
  /** Service total of the booking as it stands. Used to value what they added. */
  originalServiceCents?: number;
  /** Elijah suggested the move rather than the customer asking. */
  ownerInitiated?: boolean;
  waived?: boolean;
}

export type ChangeKind =
  | "no_change"
  | "added_free"
  | "added_short_notice"
  | "shifted_short_notice"
  | "moved_away_free"
  | "moved_away_short_notice"
  | "shrank"
  | "owner_moved"
  | "waived"
  | "needs_review";

export interface ChangeResult {
  kind: ChangeKind;
  /** True when the new window still touches the old one. */
  overlaps: boolean;
  /** True when every minute they already had is still theirs. */
  keptOriginal: boolean;
  changeFeeBp: number;
  changeFeeCents: number;
  /** What the fee was charged on: nothing, the added services, or the lot. */
  chargedOn: "nothing" | "added" | "whole_booking";
  /** Minutes the booking grew by. Negative when it shrank. */
  growthMin: number;
  /** Value of the services they added, in cents. */
  addedServiceCents: number;
  explanation: string;
}

const MIN = 60_000;

/** Do two windows genuinely intersect? Sharing only an endpoint does not. */
export function overlaps(a: Window, b: Window): boolean {
  return a.startMs < b.endMs && b.startMs < a.endMs;
}

/** Does the proposed window still cover every minute of the original? */
export function keepsAllOf(original: Window, proposed: Window): boolean {
  return proposed.startMs <= original.startMs && proposed.endMs >= original.endMs;
}

/**
 * Did they take no time that was not already theirs?
 *
 * Shrinking, or finishing earlier, or starting later inside their own slot.
 * Nobody else's time is involved, so nothing is ever charged for it however
 * short the notice.
 */
export function takesNoNewTime(original: Window, proposed: Window): boolean {
  return proposed.startMs >= original.startMs && proposed.endMs <= original.endMs;
}

export function assessChange(input: ChangeInput, r: PricingRules): ChangeResult {
  const { original, proposed } = input;
  const growthMin = Math.round(
    (proposed.endMs - proposed.startMs - (original.endMs - original.startMs)) / MIN,
  );
  const touching = overlaps(original, proposed);
  const keptAll = keepsAllOf(original, proposed);
  const addedServiceCents = Math.max(
    0,
    Math.round(input.newServiceCents - (input.originalServiceCents ?? input.newServiceCents)),
  );

  const base = {
    overlaps: touching,
    keptOriginal: keptAll,
    growthMin,
    addedServiceCents,
  };

  const free = (kind: ChangeKind, explanation: string): ChangeResult => ({
    ...base,
    kind,
    changeFeeBp: 0,
    changeFeeCents: 0,
    chargedOn: "nothing",
    explanation,
  });

  if (input.ownerInitiated) {
    return free("owner_moved", "We suggested this, so there is nothing extra to pay.");
  }
  if (input.waived) return free("waived", "Change fee waived.");
  // Unreadable notice: neither free nor charged, a person decides.
  if (!Number.isFinite(input.hoursUntilStart)) {
    return free("needs_review", "We could not work out the notice on this change. Someone will check it by hand.");
  }

  const sameWindow =
    proposed.startMs === original.startMs && proposed.endMs === original.endMs;
  if (sameWindow) return free("no_change", "No change to your time.");

  // Plenty of notice. Whatever they hand back, we can fill.
  const shortNotice = input.hoursUntilStart < r.refundFullWindowHours;
  if (!shortNotice) {
    return free(
      keptAll ? "added_free" : "moved_away_free",
      `Changed with more than ${r.refundFullWindowHours} hours notice, so there is nothing extra to pay.`,
    );
  }

  const bp = r.shortNoticeChangeBp;

  // Gave time back and took none. Handing a slot back is doing us a favour,
  // so it is free at any notice.
  if (takesNoNewTime(original, proposed)) {
    return free(
      "shrank",
      "This only gives time back rather than taking any, so there is nothing extra to pay.",
    );
  }

  // Kept everything and only took MORE time. The old slot was theirs already,
  // so only the new stretch is chargeable.
  if (keptAll) {
    if (addedServiceCents <= 0) {
      return free(
        "added_free",
        "Kept the time you had, so there is nothing extra to pay for the change.",
      );
    }
    const fee = Math.round((addedServiceCents * bp) / 10_000);
    return {
      ...base,
      kind: "added_short_notice",
      changeFeeBp: bp,
      changeFeeCents: fee,
      chargedOn: "added",
      explanation:
        `You kept the time you already had, so the short notice rate only applies to what you added, ` +
        `not the whole booking. That is ${bp / 100}% on the extra work.`,
    };
  }

  // They gave part of their slot back and took time that was not theirs. That
  // is a different booking rather than a longer one.
  const fee = Math.round((Math.max(0, input.newServiceCents) * bp) / 10_000);
  return {
    ...base,
    kind: touching ? "shifted_short_notice" : "moved_away_short_notice",
    changeFeeBp: bp,
    changeFeeCents: fee,
    chargedOn: "whole_booking",
    explanation: touching
      ? `This moves off part of the time you had and onto time that was not yours, inside ` +
        `${r.refundFullWindowHours} hours, so the ${bp / 100}% short notice rate applies to the whole ` +
        `booking. Keeping all of your original time and simply adding to it would only charge the extra.`
      : `This is a different slot rather than a change to the one you had, inside ` +
        `${r.refundFullWindowHours} hours, so the ${bp / 100}% short notice rate applies to the whole ` +
        `booking, as if you were booking it today.`,
  };
}

/**
 * The cheapest way to fit a longer booking, preferring not to move at all.
 *
 * Keeping the existing start and running later comes first, because that is
 * the option that charges least, and each candidate reports what it would
 * cost so the funnel can say so before anyone commits.
 */
export interface FitOption {
  startMs: number;
  endMs: number;
  result: ChangeResult;
}

export function bestFit(
  original: Window,
  candidateStarts: number[],
  newDurationMs: number,
  input: Omit<ChangeInput, "original" | "proposed">,
  r: PricingRules,
): FitOption[] {
  const options = candidateStarts.map((startMs) => {
    const proposed = { startMs, endMs: startMs + newDurationMs };
    return {
      startMs,
      endMs: proposed.endMs,
      result: assessChange({ ...input, original, proposed }, r),
    };
  });

  // Cost first, then nearest to where they already were. A customer would
  // rather move two hours for nothing than twenty minutes for twenty percent.
  return options.sort((a, b) => {
    if (a.result.changeFeeCents !== b.result.changeFeeCents) {
      return a.result.changeFeeCents - b.result.changeFeeCents;
    }
    return Math.abs(a.startMs - original.startMs) - Math.abs(b.startMs - original.startMs);
  });
}
