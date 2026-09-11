/**
 * Approximate centre point of each ZIP we quote, for the travel map.
 *
 * THESE ARE APPROXIMATE and exist only to place a dot in roughly the right
 * spot on a schematic map. They are never used for pricing: the fee comes from
 * the drive-time bands in ./zipRanges.ts, and the booking flow replaces even
 * those with a real Routes API lookup from the customer's address.
 *
 * Rounded to three decimals on purpose. More precision would imply the numbers
 * mean something they do not, and a ZIP does not have a single location in the
 * first place.
 */

export interface ZipPoint {
  zip: string;
  lat: number;
  lon: number;
}

export const ZIP_GEO: ZipPoint[] = [
  // Cincinnati core
  { zip: "45220", lat: 39.135, lon: -84.517 },
  { zip: "45219", lat: 39.128, lon: -84.512 },
  { zip: "45216", lat: 39.185, lon: -84.492 },
  { zip: "45217", lat: 39.166, lon: -84.497 },
  { zip: "45223", lat: 39.163, lon: -84.541 },
  { zip: "45225", lat: 39.135, lon: -84.545 },
  { zip: "45232", lat: 39.183, lon: -84.523 },
  { zip: "45229", lat: 39.148, lon: -84.494 },
  { zip: "45206", lat: 39.125, lon: -84.487 },
  { zip: "45207", lat: 39.14, lon: -84.47 },
  { zip: "45212", lat: 39.157, lon: -84.451 },
  { zip: "45202", lat: 39.109, lon: -84.507 },
  { zip: "45214", lat: 39.117, lon: -84.541 },
  { zip: "45224", lat: 39.203, lon: -84.541 },
  { zip: "45237", lat: 39.187, lon: -84.457 },
  { zip: "45208", lat: 39.135, lon: -84.435 },
  { zip: "45209", lat: 39.155, lon: -84.425 },
  { zip: "45213", lat: 39.178, lon: -84.42 },
  { zip: "45226", lat: 39.113, lon: -84.428 },
  { zip: "45227", lat: 39.145, lon: -84.375 },
  { zip: "45215", lat: 39.226, lon: -84.452 },
  { zip: "45211", lat: 39.155, lon: -84.605 },
  { zip: "45238", lat: 39.1, lon: -84.61 },
  { zip: "45239", lat: 39.208, lon: -84.59 },
  { zip: "45231", lat: 39.246, lon: -84.539 },
  { zip: "45230", lat: 39.079, lon: -84.375 },
  { zip: "45233", lat: 39.108, lon: -84.69 },
  { zip: "45236", lat: 39.196, lon: -84.386 },
  { zip: "45243", lat: 39.18, lon: -84.343 },
  { zip: "45244", lat: 39.117, lon: -84.335 },
  { zip: "45245", lat: 39.083, lon: -84.253 },
  { zip: "45255", lat: 39.058, lon: -84.32 },
  { zip: "45240", lat: 39.283, lon: -84.52 },
  { zip: "45246", lat: 39.288, lon: -84.48 },
  { zip: "45241", lat: 39.283, lon: -84.4 },
  { zip: "45242", lat: 39.25, lon: -84.365 },
  { zip: "45249", lat: 39.283, lon: -84.325 },
  { zip: "45247", lat: 39.18, lon: -84.65 },
  { zip: "45248", lat: 39.155, lon: -84.665 },
  { zip: "45251", lat: 39.26, lon: -84.61 },
  { zip: "45252", lat: 39.29, lon: -84.585 },
  { zip: "45150", lat: 39.17, lon: -84.29 },
  { zip: "45140", lat: 39.27, lon: -84.265 },
  { zip: "45069", lat: 39.34, lon: -84.4 },
  { zip: "45011", lat: 39.4, lon: -84.52 },
  { zip: "45013", lat: 39.41, lon: -84.6 },
  { zip: "45014", lat: 39.335, lon: -84.545 },
  { zip: "45015", lat: 39.37, lon: -84.545 },
  { zip: "45040", lat: 39.36, lon: -84.31 },
  { zip: "45036", lat: 39.435, lon: -84.205 },
  { zip: "45066", lat: 39.55, lon: -84.23 },
  { zip: "45044", lat: 39.51, lon: -84.4 },
  { zip: "45005", lat: 39.56, lon: -84.3 },
  { zip: "45056", lat: 39.505, lon: -84.745 },
  { zip: "45030", lat: 39.26, lon: -84.79 },
  { zip: "45103", lat: 39.08, lon: -84.17 },

  // Northern Kentucky
  { zip: "41011", lat: 39.075, lon: -84.52 },
  { zip: "41014", lat: 39.06, lon: -84.505 },
  { zip: "41016", lat: 39.085, lon: -84.545 },
  { zip: "41017", lat: 39.04, lon: -84.545 },
  { zip: "41071", lat: 39.085, lon: -84.487 },
  { zip: "41073", lat: 39.1, lon: -84.475 },
  { zip: "41075", lat: 39.075, lon: -84.45 },
  { zip: "41076", lat: 39.02, lon: -84.44 },
  { zip: "41018", lat: 39.01, lon: -84.6 },
  { zip: "41042", lat: 38.99, lon: -84.635 },
  { zip: "41048", lat: 39.03, lon: -84.7 },
  { zip: "41005", lat: 39.02, lon: -84.73 },
  { zip: "41051", lat: 38.94, lon: -84.545 },
  { zip: "41091", lat: 38.94, lon: -84.68 },
  { zip: "41001", lat: 38.955, lon: -84.39 },
  { zip: "41094", lat: 38.875, lon: -84.61 },

  // Southeast Indiana
  { zip: "47025", lat: 39.1, lon: -84.86 },
  { zip: "47001", lat: 39.06, lon: -84.9 },
  { zip: "47060", lat: 39.25, lon: -84.815 },
  { zip: "47012", lat: 39.42, lon: -85.01 },
  { zip: "47006", lat: 39.3, lon: -85.22 },
];

const BY_ZIP: Record<string, ZipPoint> = Object.fromEntries(
  ZIP_GEO.map((p) => [p.zip, p]),
);

export function zipGeo(zip: string): ZipPoint | null {
  return BY_ZIP[(zip || "").trim().slice(0, 5)] ?? null;
}
