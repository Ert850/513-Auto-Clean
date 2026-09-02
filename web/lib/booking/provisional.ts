/**
 * Provisional slots.
 *
 * A deposit is what actually reserves a time. Without one the booking is
 * PROVISIONAL: the customer is on the calendar, but anyone who pays a deposit
 * for that slot can take it from them. Once the appointment is close enough
 * that nobody realistically will, the provisional booking firms up on its own.
 *
 * The reason we ask for a deposit at all, and the reason this is worth
 * explaining plainly to customers: a cancellation still costs the drive time
 * out and back, and the crew gets paid for that either way.
 *
 * Pure. No clock, no database.
 */

export const PROVISIONAL_FIRMS_UP_HOURS = 48;

export type SlotStanding =
  | "confirmed_by_deposit"
  | "confirmed_by_time"
  | "provisional"
  | "displaced";

export interface SlotState {
  depositPaidCents: number;
  /** Hours from now until the appointment starts. */
  hoursUntilStart: number;
  /** Another customer has paid a deposit for an overlapping window. */
  displacedByDeposit: boolean;
}

export interface SlotVerdict {
  standing: SlotStanding;
  /** True once the time is genuinely theirs and cannot be taken. */
  locked: boolean;
  /** Can a deposit-paying customer still take this slot? */
  displaceable: boolean;
  /** Plain-English line for the confirmation screen, email, and admin. */
  message: string;
}

export function evaluateSlot(
  s: SlotState,
  firmsUpHours: number = PROVISIONAL_FIRMS_UP_HOURS,
): SlotVerdict {
  if (s.depositPaidCents > 0) {
    return {
      standing: "confirmed_by_deposit",
      locked: true,
      displaceable: false,
      message: "Your time is confirmed and reserved.",
    };
  }

  if (s.displacedByDeposit) {
    return {
      standing: "displaced",
      locked: false,
      displaceable: false,
      message:
        "Someone reserved this time with a deposit before you did. Pick another time, or place a deposit to lock the next one in.",
    };
  }

  // Close enough in that nobody is realistically going to take it.
  if (s.hoursUntilStart <= firmsUpHours) {
    return {
      standing: "confirmed_by_time",
      locked: true,
      displaceable: false,
      message: `Your time is now confirmed. It was held without a deposit, and nobody reserved it within ${firmsUpHours} hours of the appointment.`,
    };
  }

  return {
    standing: "provisional",
    locked: false,
    displaceable: true,
    message: `You are on the schedule, but this time is not reserved yet. Anyone who places a deposit can take it until ${firmsUpHours} hours before the appointment. A deposit locks it in now.`,
  };
}

/**
 * Which existing bookings a new deposit-paying customer is allowed to bump.
 * Only ever provisional, undeposited, not-yet-firmed bookings, and never a
 * booking that is already locked.
 */
export function displaceableBookings<T extends SlotState & { id: string }>(
  overlapping: T[],
  firmsUpHours: number = PROVISIONAL_FIRMS_UP_HOURS,
): T[] {
  return overlapping.filter((b) => evaluateSlot(b, firmsUpHours).displaceable);
}

/**
 * Does a new booking with this payment intent get the slot, given what is
 * already there? Returns null when it does, or the reason it does not.
 */
export function blockedReason(
  incomingDepositCents: number,
  overlapping: SlotState[],
  firmsUpHours: number = PROVISIONAL_FIRMS_UP_HOURS,
): string | null {
  const locked = overlapping.filter((b) => evaluateSlot(b, firmsUpHours).locked);
  if (locked.length > 0) return "That time has already been reserved.";

  if (incomingDepositCents <= 0) {
    const provisional = overlapping.filter(
      (b) => evaluateSlot(b, firmsUpHours).standing === "provisional",
    );
    if (provisional.length > 0) {
      return "Someone is already holding that time. Place a deposit to take it, or choose another slot.";
    }
  }
  return null;
}
