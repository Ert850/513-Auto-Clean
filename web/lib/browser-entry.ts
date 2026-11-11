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
  isSelectable,
  unavailableReason,
  COATING_COVERAGE,
  COATING_EXPLAINER,
  COATING_TERMS,
  CORRECTION_RULES,
  CORRECTION_TIERS,
  findCoatingTerm,
  findCorrectionTier,
} from "./catalog/addons.js";
import {
  isConfigured as calendarConfigured,
  blockFeeAt,
  loadWindow,
  unconfiguredWindow,
} from "./google/publicCalendar.js";
import {
  IGNORE_RETURN_AFTER_MIN,
  IGNORE_OUTBOUND_BEFORE_MIN,
  ARRIVAL_WINDOW_MIN,
  TIME_BANDS,
  bandOf,
  travelBufferMin,
  computeSlots,
  localMinutesOfDay,
} from "./availability/slots.js";
import { addWeeks, buildWeek, daySuggestions, dayOpenShare, lastRowForSlots, stretchStarts, timelineRange, recommendBestDays, TIME_RECOMMENDATION_RULES, weekStartOf } from "./availability/week.js";
import { parseGridpoint, WEATHER_RULES, weatherVerdict } from "./availability/weather.js";
import { assignStarts, canDo, parseDetailers, waivesFeeAt } from "./availability/crew.js";
import { componentsOf } from "./catalog/types.js";
import { mileageFeeCents } from "./pricing/mileage.js";
import { LEGAL } from "./site/legal.js";
import { IN_PERSON, isLive } from "./site/capabilities.js";
import { DEFAULT_RULES } from "./pricing/rules.js";
import {
  computeSurcharge,
  earliestBookableDate,
  minutesOfDay,
  slotNeedsPriority,
} from "./pricing/surcharge.js";
import { quote } from "./pricing/quote.js";
import { rushWindow } from "./pricing/rush.js";
import {
  QUOTE_TTL_HOURS,
  decodeQuote,
  quoteUrl,
} from "./booking/quoteLink.js";
import {
  LONGEST_DAY,
  LONG_JOB_STARTS,
  describePlan,
  findMultiDayStarts,
  fitsOneDay,
  planDays,
} from "./availability/multiDay.js";
import { findPromo, normalisePromo, promoDiscountCents, promoMessage } from "./pricing/promos.js";
import { addonIcon } from "./catalog/icons.js";
import { popularityOf } from "./catalog/popularity.js";
import { recommendAddons } from "./catalog/recommend.js";
import { ZIP_GEO, zipGeo } from "./travel/zipGeo.js";
// How long a "help me decide" visit holds. The funnel fits slots to it and
// the confirmation function ends the calendar event with it. One definition.
import { ADVICE_HOLD_MIN } from "./pricing/wire.js";
import {
  MAX_ONE_WAY_MINUTES,
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
  calendarConfigured,
  loadWindow,
  unconfiguredWindow,
  IGNORE_RETURN_AFTER_MIN,
  IGNORE_OUTBOUND_BEFORE_MIN,
  ARRIVAL_WINDOW_MIN,
  TIME_BANDS,
  bandOf,
  travelBufferMin,
  computeSlots,
  LONGEST_DAY,
  LONG_JOB_STARTS,
  describePlan,
  findMultiDayStarts,
  fitsOneDay,
  planDays,
  localMinutesOfDay,
  weekStartOf,
  addWeeks,
  buildWeek,
  dayOpenShare,
  stretchStarts,
  timelineRange,
  recommendBestDays,
  daySuggestions,
  TIME_RECOMMENDATION_RULES,
  lastRowForSlots,
  parseGridpoint,
  WEATHER_RULES,
  weatherVerdict,
  parseDetailers,
  canDo,
  assignStarts,
  waivesFeeAt,
  blockFeeAt,
  recommendAddons,
  quote,
  QUOTE_TTL_HOURS,
  decodeQuote,
  quoteUrl,
  findPromo,
  normalisePromo,
  promoDiscountCents,
  promoMessage,
  ZIP_GEO,
  MAX_ONE_WAY_MINUTES,
  ADVICE_HOLD_MIN,
  zipGeo,
  estimateOneWayMinutes,
  lookupZip,
  popularityOf,
  addonIcon,
  mileageFeeCents,
  computeSurcharge,
  minutesOfDay,
  earliestBookableDate,
  slotNeedsPriority,
  rushWindow,
  LEGAL,
  IN_PERSON,
  isLive,
  componentsOf,
  formatCents,
};

declare global {
  interface Window {
    ACPricing: typeof api;
  }
}

if (typeof window !== "undefined") window.ACPricing = api;

export default api;
