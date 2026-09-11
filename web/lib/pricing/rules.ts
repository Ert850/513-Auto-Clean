/**
 * Tunable pricing rules.
 *
 * These are the seed values. At runtime they come from the `pricing_rules`
 * table so Elijah can change them in the admin panel without a deploy, but
 * the shape and the defaults live here, and every pure function takes them as
 * an argument rather than reading a global. That is what makes the money math
 * testable without a database.
 *
 * ALL MONEY IS INTEGER CENTS. Never floats. Never dollars.
 * Percentages are basis points (bp): 2000 bp = 20%.
 */

export interface MileageRules {
  /** One-way minutes that are free. At or under this, the fee is $0. */
  freeMinutes: number;
  /** Cents per minute for minutes between freeMinutes and tier2StartMin. */
  tier1RateCents: number;
  /** One-way minute at which the higher rate takes over. */
  tier2StartMin: number;
  /** Flat cents accumulated by the time you reach tier2StartMin. */
  tier2BaseCents: number;
  /** Cents per minute beyond tier2StartMin. */
  tier2RateCents: number;
  /** Rounding granularity. */
  roundToCents: number;
  /** Below this many minutes, round DOWN to roundToCents. */
  roundDownBelowMin: number;
  /** Below this many minutes (and at/above roundDownBelowMin), round to NEAREST. At/above it, round UP. */
  roundNearestBelowMin: number;
}

export interface SurchargeRules {
  /**
   * Minutes past local midnight. A start STRICTLY BEFORE this is premium,
   * so 10:00 itself is not. 600 = 10:00.
   */
  earlyBeforeMinutes: number;
  /**
   * Minutes past local midnight. A start AT OR AFTER this is premium, so a
   * 6:00 PM start does carry the surcharge. 1080 = 18:00.
   *
   * Stored in minutes rather than hours so the boundary can be moved to a
   * half hour without a schema change.
   */
  lateFromMinutes: number;
  /** Added for an early/late start. */
  timeOfDayBp: number;
  /** Added when the customer opts into Priority Booking. */
  priorityBp: number;
  /**
   * Hard ceiling once the above are added together.
   *
   * At 3000 the two surcharges DO compound: a standard-time booking inside
   * three days is +20%, an early or late slot further out is +20%, and an
   * early or late slot inside three days is +30% rather than +40%.
   */
  maxTotalBp: number;
}

export interface BookingWindowRules {
  /**
   * Minimum lead time in WHOLE CALENDAR DAYS. 3 means: on Monday the earliest
   * bookable date is Thursday; at 12:01am Tuesday it becomes Friday.
   * Deliberately date-based, not a rolling 24h clock.
   */
  minLeadDays: number;
}

export interface PricingRules {
  mileage: MileageRules;
  surcharge: SurchargeRules;
  window: BookingWindowRules;
  /** Discount when one vehicle gets both an interior and an exterior package. */
  comboDiscountCents: number;
  /**
   * Off the WHOLE booking once there are two or more vehicles, including the
   * first one.
   *
   * Deliberately not "off the extra vehicle only". A customer adding a second
   * car should watch the price they had already accepted come down, which is
   * what makes the upsell feel like a saving rather than an addition.
   */
  additionalVehicleDiscountBp: number;
  /** Applied per vehicle rather than once per booking. See quote.ts. */
  comboPerVehicle: boolean;
  /** Hourly rate for add-ons. */
  addonRateCents: number;
  /** Add-ons are quoted at a minimum of this many hours. */
  addonMinHours: number;
  /**
   * Deposit as a share of the total.
   *
   * ZERO by design. Deposits were removed to cut booking friction: a card on
   * file is what confirms the slot, not money taken up front. Kept as a rule
   * rather than deleted so it can be reintroduced without a schema change if
   * no-shows become a problem.
   */
  depositBp: number;
  /** Taken off the total when the customer chooses to pay in full now. */
  payInFullDiscountBp: number;
  /** "Pay after service" is offered only when the TOTAL is at or below this. */
  payAfterMaxCents: number;
  /** Non-refundable booking fee kept from the deposit on a >=72hr cancellation. */
  cancellationFlatFeeCents: number;
  /** Share of the deposit returned when cancelling 24-72hr out. */
  refundMidWindowBp: number;
  /**
   * Share of the booking charged for a cancellation inside each window.
   *
   * Rescheduling is always free at any notice, which is the point: the fee
   * exists to make moving a booking the obvious choice over dropping it, not
   * to earn money from cancellations.
   */
  cancelMidWindowBp: number;
  cancelLateWindowBp: number;
  /**
   * Added to the new booking for moving inside 24 hours. FLAT, and charged
   * again at the same rate on each further late move.
   *
   * Flat matters: 10% every time, never 10 then 20 then 30. Free last-minute
   * shuffling is how one customer changing their mind three times destroys a
   * day, and a charge that lands every time is enough to make the third move
   * deliberate without punishing the first.
   */
  lateRescheduleFeeBp: number;
  /** How long a prepaid amount stays usable against a new date. */
  rescheduleCreditDays: number;
  /**
   * Added when a change at short notice takes a DIFFERENT slot rather than
   * growing the one they had.
   *
   * Deliberately the same rate as the priority booking surcharge, because it
   * is the same thing: claiming a near-term slot somebody else could have
   * taken. Adding services in place is always free, and every branch in
   * bookingChange.ts is built to keep it that way.
   */
  shortNoticeChangeBp: number;
  /** Hours before the appointment that bound the refund tiers. */
  refundFullWindowHours: number;
  refundMidWindowHours: number;
}

export const DEFAULT_RULES: PricingRules = {
  mileage: {
    freeMinutes: 10,
    tier1RateCents: 100, // $1.00/min
    tier2StartMin: 30,
    tier2BaseCents: 2000, // $20 accumulated at 30 min
    tier2RateCents: 150, // $1.50/min
    roundToCents: 500, // $5
    roundDownBelowMin: 20,
    roundNearestBelowMin: 30,
  },
  surcharge: {
    earlyBeforeMinutes: 10 * 60, // before 10:00 (10:00 itself is not premium)
    lateFromMinutes: 18 * 60, // 18:00 onward, so a 6:00 PM start IS premium
    timeOfDayBp: 2000, // +20%
    priorityBp: 2000, // +20%
    maxTotalBp: 3000, // 20% each, +30% when both apply
  },
  window: {
    minLeadDays: 3,
  },
  comboDiscountCents: 2500, // $25 for interior and exterior together
  comboPerVehicle: true,
  additionalVehicleDiscountBp: 1000, // 10% off everything at 2+ vehicles
  addonRateCents: 5000, // $50/hr
  addonMinHours: 1,
  depositBp: 0, // no deposit; a card on file confirms the slot
  payInFullDiscountBp: 500, // 5% for paying in full at booking
  payAfterMaxCents: 19500, // $195
  cancellationFlatFeeCents: 2500, // $25
  refundMidWindowBp: 5000, // 50% of deposit
  cancelMidWindowBp: 5000, // 24 to 72 hrs: half the booking
  cancelLateWindowBp: 10_000, // under 24 hrs: the whole booking
  lateRescheduleFeeBp: 1000, // 10% per late move, compounding
  rescheduleCreditDays: 30,
  shortNoticeChangeBp: 2000, // 20%, same as priority booking
  refundFullWindowHours: 72,
  refundMidWindowHours: 24,
};
