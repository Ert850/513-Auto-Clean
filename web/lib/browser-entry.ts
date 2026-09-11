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
  COATING_EXPLAINER,
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
  TIME_BANDS,
  bandOf,
  groupIntoBands,
  travelBufferMin,
  computeSlots,
  localMinutesOfDay,
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
import { LEGAL } from "./site/legal.js";
import { CAPABILITIES, IN_PERSON, isLive } from "./site/capabilities.js";
import {
  cancellationLadder,
  computeCancellation,
  computeReschedule,
} from "./pricing/cancellation.js";
import { DEFAULT_RULES } from "./pricing/rules.js";
import {
  computeSurcharge,
  earliestBookableDate,
  minutesOfDay,
  requiresPriorityBooking,
  slotNeedsPriority,
} from "./pricing/surcharge.js";
import { quote } from "./pricing/quote.js";
import {
  QUOTE_TTL_HOURS,
  decodeQuote,
  encodeQuote,
  hoursRemaining,
  quoteUrl,
} from "./booking/quoteLink.js";
import {
  LONGEST_DAY,
  LONG_JOB_STARTS,
  dayCapacityMin,
  describePlan,
  findMultiDayStarts,
  fitsOneDay,
  planDays,
} from "./availability/multiDay.js";
import { PROMOS, findPromo, normalisePromo, promoDiscountCents, promoMessage } from "./pricing/promos.js";
import { ADDON_ICONS, addonIcon } from "./catalog/icons.js";
import { popularityOf } from "./catalog/popularity.js";
import { ZIP_GEO, zipGeo } from "./travel/zipGeo.js";
import {
  MAX_ONE_WAY_MINUTES,
  ZIP_RANGES,
  estimateOneWayMinutes,
  lookupZip,
} from "./travel/zipRanges.js";

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
  COATING_EXPLAINER,
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
  TIME_BANDS,
  bandOf,
  groupIntoBands,
  travelBufferMin,
  computeSlots,
  LONGEST_DAY,
  LONG_JOB_STARTS,
  dayCapacityMin,
  describePlan,
  findMultiDayStarts,
  fitsOneDay,
  planDays,
  localMinutesOfDay,
  mergeIntervals,
  subtractIntervals,
  quote,
  QUOTE_TTL_HOURS,
  decodeQuote,
  encodeQuote,
  hoursRemaining,
  quoteUrl,
  PROMOS,
  findPromo,
  normalisePromo,
  promoDiscountCents,
  promoMessage,
  ZIP_RANGES,
  ZIP_GEO,
  MAX_ONE_WAY_MINUTES,
  zipGeo,
  estimateOneWayMinutes,
  lookupZip,
  popularityOf,
  ADDON_ICONS,
  addonIcon,
  mileageFeeCents,
  averageOneWayMinutes,
  travelCommitmentMinutes,
  computeSurcharge,
  minutesOfDay,
  earliestBookableDate,
  requiresPriorityBooking,
  slotNeedsPriority,
  LEGAL,
  CAPABILITIES,
  IN_PERSON,
  isLive,
  computeCancellation,
  computeReschedule,
  cancellationLadder,
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
