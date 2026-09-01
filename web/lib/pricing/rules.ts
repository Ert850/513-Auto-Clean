/**
 * Tunable pricing rules.
 *
 * These are the seed values. At runtime they come from the `pricing_rules`
 * table so Elijah can change them in the admin panel without a deploy — but
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
   * Minutes past local midnight. A start STRICTLY AFTER this is premium,
   * so 6:00 PM itself is not and 6:01 PM is. 1080 = 18:00.
   *
   * Stored in minutes rather than hours precisely because 18:00 and 18:01
   * are the same hour but land on opposite sides of this rule.
   */
  lateAfterMinutes: number;
  /** Added for an early/late start. */
  timeOfDayBp: number;
  /** Added when the customer opts into Priority Booking. */
  priorityBp: number;
  /** Hard ceiling once the above are added together. */
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
   * Off each vehicle after the first. The 2nd, 3rd, 4th ... each get this,
   * applied to that vehicle's own subtotal (packages + add-ons - combo).
   */
  additionalVehicleDiscountBp: number;
  /** Applied per vehicle rather than once per booking. See quote.ts. */
  comboPerVehicle: boolean;
  /** Hourly rate for add-ons. */
  addonRateCents: number;
  /** Add-ons are quoted at a minimum of this many hours. */
  addonMinHours: number;
  /** Deposit as a share of the total. */
  depositBp: number;
  /** "Pay after service" is offered only when the TOTAL is at or below this. */
  payAfterMaxCents: number;
  /** Non-refundable booking fee kept from the deposit on a >=72hr cancellation. */
  cancellationFlatFeeCents: number;
  /** Share of the deposit returned when cancelling 24-72hr out. */
  refundMidWindowBp: number;
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
    lateAfterMinutes: 18 * 60, // after 18:00 (6:00 PM is not, 6:01 PM is)
    timeOfDayBp: 2000, // +20%
    priorityBp: 2000, // +20%
    maxTotalBp: 3000, // capped at +30%
  },
  window: {
    minLeadDays: 3,
  },
  comboDiscountCents: 1500, // $15
  comboPerVehicle: true,
  additionalVehicleDiscountBp: 1000, // 10% off the 2nd vehicle onward
  addonRateCents: 5000, // $50/hr
  addonMinHours: 1,
  depositBp: 5000, // 50%
  payAfterMaxCents: 19500, // $195
  cancellationFlatFeeCents: 2500, // $25
  refundMidWindowBp: 5000, // 50% of deposit
  refundFullWindowHours: 72,
  refundMidWindowHours: 24,
};
