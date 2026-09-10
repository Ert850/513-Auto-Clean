/**
 * Browser entry point.
 *
 * Bundled by `npm run build:funnel` into ../js/pricing.bundle.js and loaded by
 * the booking funnel on the static site. Everything it exposes is the SAME
 * code the unit tests cover, the funnel never reimplements pricing in ad-hoc
 * browser JS, which is exactly how the old site ended up with prices in three
 * places that drifted apart.
 */
import {
  findPackage,
  packagesFor,
  SEED_CATALOG,
  VEHICLE_SIZES,
  vehicleSize,
} from "./catalog/seed.js";
import {
  ADDONS,
  addonBlockedReason,
  addonsFor,
  findAddon,
  isUnpriced,
  isSelectable,
  unavailableReason,
  COATING_COVERAGE,
  COATING_TERMS,
  CORRECTION_RULES,
  CORRECTION_TIERS,
  findCoatingTerm,
  findCorrectionTier,
  MAINTENANCE_PLAN,
  SERVICE_LEVELS,
} from "./catalog/addons.js";
import { SEED_TAX_TABLE, computeTax, lookupRate } from "./pricing/tax.js";
import {
  DEFAULT_HOURS,
  businessHoursWindows,
  isConfigured as calendarConfigured,
  loadWindow,
  resolveWindow,
  unconfiguredWindow,
} from "./google/publicCalendar.js";
import {
  DEFAULT_BOOKING_WINDOW,
  IGNORE_RETURN_AFTER_MIN,
  PREFERRED_STARTS,
  TIME_WINDOWS,
  computeSlots,
  computeSlotsTiered,
  localMinutesOfDay,
  matchWindows,
  mergeIntervals,
  subtractIntervals,
} from "./availability/slots.js";
import {
  addableComponents,
  componentsOf,
  removableComponents,
  unpricedComponents,
} from "./catalog/types.js";
import { averageOneWayMinutes, mileageFeeCents, travelCommitmentMinutes } from "./pricing/mileage.js";
import { computeRefund, rescheduleFeeCents } from "./pricing/refund.js";
import { DEFAULT_RULES } from "./pricing/rules.js";
import {
  computeSurcharge,
  earliestBookableDate,
  minutesOfDay,
  requiresPriorityBooking,
} from "./pricing/surcharge.js";
import { quote } from "./pricing/quote.js";
import { ZIP_RANGES, estimateOneWayMinutes, lookupZip } from "./travel/zipRanges.js";

/** Format integer cents as $1,234.50, or $1,234 when it lands on the dollar. */
export function formatCents(cents: number): string {
  const whole = Math.abs(cents) % 100 === 0;
  const s = (Math.abs(cents) / 100).toLocaleString("en-US", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return (cents < 0 ? "-$" : "$") + s;
}

const api = {
  RULES: DEFAULT_RULES,
  CATALOG: SEED_CATALOG,
  ADDONS,
  VEHICLE_SIZES,
  vehicleSize,
  packagesFor,
  findPackage,
  addonsFor,
  findAddon,
  isUnpriced,
  isSelectable,
  unavailableReason,
  addonBlockedReason,
  CORRECTION_TIERS,
  COATING_COVERAGE,
  COATING_TERMS,
  CORRECTION_RULES,
  findCorrectionTier,
  findCoatingTerm,
  MAINTENANCE_PLAN,
  SERVICE_LEVELS,
  TAX_TABLE: SEED_TAX_TABLE,
  computeTax,
  lookupRate,
  DEFAULT_HOURS,
  businessHoursWindows,
  calendarConfigured,
  loadWindow,
  resolveWindow,
  unconfiguredWindow,
  DEFAULT_BOOKING_WINDOW,
  IGNORE_RETURN_AFTER_MIN,
  PREFERRED_STARTS,
  TIME_WINDOWS,
  computeSlots,
  computeSlotsTiered,
  localMinutesOfDay,
  matchWindows,
  mergeIntervals,
  subtractIntervals,
  quote,
  ZIP_RANGES,
  estimateOneWayMinutes,
  lookupZip,
  mileageFeeCents,
  averageOneWayMinutes,
  travelCommitmentMinutes,
  computeSurcharge,
  minutesOfDay,
  earliestBookableDate,
  requiresPriorityBooking,
  computeRefund,
  rescheduleFeeCents,
  componentsOf,
  removableComponents,
  addableComponents,
  unpricedComponents,
  formatCents,
};

declare global {
  interface Window {
    ACPricing: typeof api;
  }
}

if (typeof window !== "undefined") window.ACPricing = api;

export default api;
