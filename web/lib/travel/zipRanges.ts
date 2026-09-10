/**
 * Typical one-way drive times from base, per ZIP, for the front-page estimator.
 *
 * THESE ARE ESTIMATES, not measurements. Each entry is a rough band from the
 * near edge of that ZIP to the far edge, because a single ZIP can easily span
 * ten minutes of driving. The estimator shows the resulting fee as a RANGE for
 * exactly that reason, and the booking flow replaces it with a real Routes API
 * lookup from the customer's actual address.
 *
 * Ordered roughly by distance from 45220.
 */

export interface ZipRange {
  zip: string;
  area: string;
  /** One-way minutes, near edge to far edge. */
  minMin: number;
  maxMin: number;
}

export const ZIP_RANGES: ZipRange[] = [
  // Cincinnati core
  { zip: "45220", area: "Clifton", minMin: 2, maxMin: 8 },
  { zip: "45219", area: "Corryville, UC", minMin: 3, maxMin: 9 },
  { zip: "45216", area: "Elmwood Place", minMin: 6, maxMin: 12 },
  { zip: "45217", area: "St Bernard", minMin: 6, maxMin: 12 },
  { zip: "45223", area: "Northside", minMin: 5, maxMin: 11 },
  { zip: "45225", area: "Camp Washington", minMin: 5, maxMin: 11 },
  { zip: "45232", area: "Winton Place", minMin: 7, maxMin: 13 },
  { zip: "45229", area: "Avondale", minMin: 5, maxMin: 11 },
  { zip: "45206", area: "Walnut Hills", minMin: 7, maxMin: 13 },
  { zip: "45207", area: "Evanston", minMin: 8, maxMin: 14 },
  { zip: "45212", area: "Norwood", minMin: 8, maxMin: 15 },
  { zip: "45202", area: "Downtown, OTR", minMin: 9, maxMin: 16 },
  { zip: "45214", area: "West End", minMin: 8, maxMin: 15 },
  { zip: "45224", area: "College Hill", minMin: 9, maxMin: 16 },
  { zip: "45237", area: "Bond Hill, Roselawn", minMin: 9, maxMin: 16 },
  { zip: "45208", area: "Hyde Park", minMin: 11, maxMin: 18 },
  { zip: "45209", area: "Oakley", minMin: 10, maxMin: 17 },
  { zip: "45213", area: "Pleasant Ridge", minMin: 12, maxMin: 18 },
  { zip: "45226", area: "Mount Lookout", minMin: 13, maxMin: 20 },
  { zip: "45227", area: "Madeira, Mariemont", minMin: 15, maxMin: 23 },
  { zip: "45215", area: "Reading, Wyoming", minMin: 12, maxMin: 19 },
  { zip: "45211", area: "Westwood", minMin: 12, maxMin: 20 },
  { zip: "45238", area: "Delhi, Price Hill", minMin: 14, maxMin: 23 },
  { zip: "45239", area: "Monfort Heights", minMin: 13, maxMin: 21 },
  { zip: "45231", area: "Mount Healthy", minMin: 13, maxMin: 21 },
  { zip: "45230", area: "Anderson", minMin: 17, maxMin: 26 },
  { zip: "45233", area: "Sayler Park", minMin: 18, maxMin: 27 },
  { zip: "45236", area: "Kenwood, Deer Park", minMin: 14, maxMin: 21 },
  { zip: "45243", area: "Indian Hill", minMin: 17, maxMin: 25 },
  { zip: "45244", area: "Newtown", minMin: 18, maxMin: 27 },
  { zip: "45245", area: "Batavia", minMin: 25, maxMin: 35 },
  { zip: "45255", area: "Cherry Grove", minMin: 20, maxMin: 29 },
  { zip: "45240", area: "Forest Park", minMin: 16, maxMin: 24 },
  { zip: "45246", area: "Springdale", minMin: 16, maxMin: 24 },
  { zip: "45241", area: "Sharonville", minMin: 17, maxMin: 26 },
  { zip: "45242", area: "Blue Ash", minMin: 17, maxMin: 26 },
  { zip: "45249", area: "Symmes", minMin: 21, maxMin: 30 },
  { zip: "45247", area: "Bridgetown", minMin: 16, maxMin: 25 },
  { zip: "45248", area: "Dent", minMin: 17, maxMin: 26 },
  { zip: "45251", area: "Colerain", minMin: 15, maxMin: 24 },
  { zip: "45252", area: "Groesbeck", minMin: 16, maxMin: 25 },
  { zip: "45150", area: "Milford", minMin: 22, maxMin: 32 },
  { zip: "45140", area: "Loveland", minMin: 24, maxMin: 34 },
  { zip: "45069", area: "West Chester", minMin: 25, maxMin: 35 },
  { zip: "45011", area: "Hamilton", minMin: 28, maxMin: 40 },
  { zip: "45013", area: "Hamilton west", minMin: 30, maxMin: 42 },
  { zip: "45014", area: "Fairfield", minMin: 24, maxMin: 34 },
  { zip: "45015", area: "Fairfield north", minMin: 26, maxMin: 36 },
  { zip: "45040", area: "Mason", minMin: 28, maxMin: 39 },
  { zip: "45036", area: "Lebanon", minMin: 34, maxMin: 46 },
  { zip: "45066", area: "Springboro", minMin: 38, maxMin: 50 },
  { zip: "45044", area: "Middletown", minMin: 40, maxMin: 52 },
  { zip: "45005", area: "Franklin", minMin: 40, maxMin: 52 },
  { zip: "45056", area: "Oxford", minMin: 42, maxMin: 55 },
  { zip: "45030", area: "Harrison", minMin: 26, maxMin: 36 },
  { zip: "45103", area: "Batavia east", minMin: 28, maxMin: 38 },

  // Northern Kentucky
  { zip: "41011", area: "Covington", minMin: 12, maxMin: 20 },
  { zip: "41014", area: "Covington south", minMin: 14, maxMin: 22 },
  { zip: "41016", area: "Covington west", minMin: 14, maxMin: 22 },
  { zip: "41017", area: "Fort Mitchell", minMin: 17, maxMin: 26 },
  { zip: "41071", area: "Newport", minMin: 13, maxMin: 21 },
  { zip: "41073", area: "Bellevue", minMin: 15, maxMin: 23 },
  { zip: "41075", area: "Fort Thomas", minMin: 17, maxMin: 25 },
  { zip: "41076", area: "Cold Spring", minMin: 20, maxMin: 29 },
  { zip: "41018", area: "Erlanger", minMin: 20, maxMin: 29 },
  { zip: "41042", area: "Florence", minMin: 23, maxMin: 33 },
  { zip: "41048", area: "Hebron", minMin: 25, maxMin: 35 },
  { zip: "41005", area: "Burlington", minMin: 26, maxMin: 36 },
  { zip: "41051", area: "Independence", minMin: 25, maxMin: 35 },
  { zip: "41091", area: "Union", minMin: 28, maxMin: 38 },
  { zip: "41001", area: "Alexandria", minMin: 25, maxMin: 35 },
  { zip: "41094", area: "Walton", minMin: 30, maxMin: 41 },

  // Southeast Indiana
  { zip: "47025", area: "Lawrenceburg", minMin: 27, maxMin: 37 },
  { zip: "47001", area: "Aurora", minMin: 31, maxMin: 42 },
  { zip: "47060", area: "West Harrison", minMin: 26, maxMin: 36 },
  { zip: "47012", area: "Brookville", minMin: 40, maxMin: 52 },
  { zip: "47006", area: "Batesville", minMin: 45, maxMin: 58 },
];

/** Fallback bands by three-digit prefix, for a ZIP not listed individually. */
const PREFIX_FALLBACK: Record<string, { area: string; minMin: number; maxMin: number }> = {
  "452": { area: "Cincinnati", minMin: 8, maxMin: 22 },
  "451": { area: "Greater Cincinnati", minMin: 15, maxMin: 35 },
  "450": { area: "Butler County", minMin: 24, maxMin: 42 },
  "454": { area: "Dayton area", minMin: 45, maxMin: 65 },
  "410": { area: "Northern Kentucky", minMin: 14, maxMin: 36 },
  "470": { area: "Southeast Indiana", minMin: 27, maxMin: 52 },
};

export interface ZipLookup {
  found: boolean;
  area: string;
  minMin: number;
  maxMin: number;
}

export function lookupZip(zip: string): ZipLookup | null {
  const clean = (zip || "").trim().slice(0, 5);
  if (!/^\d{5}$/.test(clean)) return null;

  const exact = ZIP_RANGES.find((z) => z.zip === clean);
  if (exact) return { found: true, area: exact.area, minMin: exact.minMin, maxMin: exact.maxMin };

  const pre = PREFIX_FALLBACK[clean.slice(0, 3)];
  if (pre) return { found: false, ...pre };

  return null;
}
