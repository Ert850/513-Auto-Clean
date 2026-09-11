import type { PricingRules } from "../pricing/rules.js";

/**
 * Changing a booking that already exists.
 *
 * A customer decides on the day before that they also want the outside done,
 * or that they need to shift from the morning to the evening. This decides
 * what, if anything, that costs.
 *
 * THE RULE, and it is not the obvious one:
 *
 *   The short notice charge is about TAKING SOMEBODY ELSE'S SLOT, not about
 *   spending more money.
 *
 * So adding a second vehicle to a day that is otherwise empty is free, even
 * an hour beforehand, because nobody loses anything. Moving from 10am to 4pm
 * inside the short notice window is not, because the 10am they are giving
 * back is no use to anyone at that notice and the 4pm they are taking was
 * available to somebody else.
 *
 * The test for "did they take a new slot" is OVERLAP. If the new window still
 * touches the old one, the booking grew or shifted around a time that was
 * already theirs. If it does not, it is a different slot.
 *
 * WE WANT PEOPLE TO ADD SERVICES. A rule that charged 20% for deciding to add
 * an exterior would teach customers not to ask, which costs far more than the
 * occasional awkward reshuffle. Every branch here is built so that growing a
 * booking in place is free.
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
  /** Service total of the new booking, in cents, before any change fee. */
  newServiceCents: number;
  /** Elijah suggested the move rather than the customer asking. */
  ownerInitiated?: boolean;
  waived?: boolean;
}

export type ChangeKind =
  | "no_change"
  | "grew_in_place"
  | "moved_overlapping"
  | "moved_away_free"
  | "moved_away_short_notice"
  | "owner_moved"
  | "waived";

export interface ChangeResult {
  kind: ChangeKind;
  /** True when the new window still touches the old one. */
  overlaps: boolean;
  /** Basis points added for taking a different slot at short notice. */
  changeFeeBp: number;
  changeFeeCents: number;
  /** Minutes the booking grew by. Negative when it shrank. */
  growthMin: number;
  /** One line for the customer. */
  explanation: string;
}

const MIN = 60_000;

/** Do two windows touch at all? Sharing only an endpoint does not count. */
export function overlaps(a: Window, b: Window): boolean {
  return a.startMs < b.endMs && b.startMs < a.endMs;
}

export function assessChange(input: ChangeInput, r: PricingRules): ChangeResult {
  const { original, proposed } = input;
  const growthMin = Math.round((proposed.endMs - proposed.startMs - (original.endMs - original.startMs)) / MIN);
  const touching = overlaps(original, proposed);

  const free = (kind: ChangeKind, explanation: string): ChangeResult => ({
    kind,
    overlaps: touching,
    changeFeeBp: 0,
    changeFeeCents: 0,
    growthMin,
    explanation,
  });

  if (input.ownerInitiated) {
    return free("owner_moved", "We suggested this, so there is no charge for the change.");
  }
  if (input.waived) return free("waived", "Change fee waived.");

  const sameTime = proposed.startMs === original.startMs;
  const sameLength = growthMin === 0;

  if (sameTime && sameLength) {
    return free("no_change", "No change to your time.");
  }

  // Still starts when it always did, just runs longer or shorter. This is the
  // case we most want to be free: it is somebody buying more from us.
  if (sameTime) {
    return free(
      "grew_in_place",
      growthMin > 0
        ? `Same start time, running about ${formatMinutes(growthMin)} longer. No charge for the change.`
        : `Same start time, finishing about ${formatMinutes(-growthMin)} earlier.`,
    );
  }

  // Moved, but the new window still covers part of the old one, so the slot
  // was already theirs and nobody else lost anything.
  if (touching) {
    return free(
      "moved_overlapping",
      "Shifted around the time you already had, so there is no charge for the change.",
    );
  }

  // A genuinely different slot. Only chargeable at short notice, because with
  // plenty of warning the old time can be filled.
  if (input.hoursUntilStart >= r.refundFullWindowHours) {
    return free(
      "moved_away_free",
      `Moved to a different time with more than ${r.refundFullWindowHours} hours notice, so there is no charge.`,
    );
  }

  const bp = r.shortNoticeChangeBp;
  const fee = Math.round((Math.max(0, input.newServiceCents) * bp) / 10_000);

  return {
    kind: "moved_away_short_notice",
    overlaps: false,
    changeFeeBp: bp,
    changeFeeCents: fee,
    growthMin,
    explanation:
      `This is a different time rather than a change to the one you had, and it is inside ` +
      `${r.refundFullWindowHours} hours, so the same ${bp / 100}% short notice rate applies as if you ` +
      `were booking it today. Keeping any part of your original time avoids it.`,
  };
}

function formatMinutes(min: number): string {
  if (min < 60) return `${min} minutes`;
  const h = min / 60;
  return Number.isInteger(h) ? `${h} hour${h === 1 ? "" : "s"}` : `${h.toFixed(1)} hours`;
}

/**
 * The cheapest way to fit a longer booking, preferring not to move at all.
 *
 * Tries keeping the start and running later first, because that is free and
 * is what most people actually want. Only then does it look at other starts,
 * and it reports whether each candidate would cost anything so the funnel can
 * say so before the customer commits.
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
    return { startMs, endMs: proposed.endMs, result: assessChange({ ...input, original, proposed }, r) };
  });

  // Free first, then nearest to where they already were. Cost beats
  // convenience here: a customer would rather move two hours for nothing than
  // twenty minutes for twenty percent.
  return options.sort((a, b) => {
    if (a.result.changeFeeCents !== b.result.changeFeeCents) {
      return a.result.changeFeeCents - b.result.changeFeeCents;
    }
    return Math.abs(a.startMs - original.startMs) - Math.abs(b.startMs - original.startMs);
  });
}
