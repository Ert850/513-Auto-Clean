/**
 * Sales tax.
 *
 * Ohio taxes "washing, cleaning, waxing, polishing or painting a motor
 * vehicle" as a service under ORC 5739.01, so detailing IS taxable here. The
 * only carve-out is coin-operated self-service equipment, which does not
 * apply to us.
 *
 * Rates are keyed by county and carry the year they were verified, because
 * county piggyback rates change and a stale rate is a liability in both
 * directions. `ratesStaleAfter` drives an admin warning rather than silently
 * charging last year's number.
 *
 * THIS IS NOT TAX ADVICE. Elijah should confirm nexus, taxability of travel
 * fees, and these rates with a CPA before the first live charge.
 */

export interface CountyTaxRate {
  /** Lowercase county name, no "County" suffix. */
  county: string;
  state: "OH" | "KY" | "IN";
  /** Combined state + county rate in basis points. 780 = 7.80%. */
  rateBp: number;
  /** Calendar year this rate was last verified. */
  verifiedYear: number;
}

export interface TaxTable {
  rates: CountyTaxRate[];
  /** ZIP prefix to county, for the common cases in the service area. */
  zipToCounty: Record<string, { county: string; state: "OH" | "KY" | "IN" }>;
  /** Rate used when a ZIP is not in the table. */
  fallbackRateBp: number;
  ratesStaleAfter: number;
}

/**
 * Seed table for the service area. Verified for 2026.
 * Kentucky and Indiana are flat statewide with no local add-on.
 */
export const SEED_TAX_TABLE: TaxTable = {
  ratesStaleAfter: 2026,
  fallbackRateBp: 780, // Hamilton County, the busiest by far
  rates: [
    { county: "hamilton", state: "OH", rateBp: 780, verifiedYear: 2026 },
    { county: "butler", state: "OH", rateBp: 650, verifiedYear: 2026 },
    { county: "warren", state: "OH", rateBp: 675, verifiedYear: 2026 },
    { county: "clermont", state: "OH", rateBp: 675, verifiedYear: 2026 },
    { county: "montgomery", state: "OH", rateBp: 750, verifiedYear: 2026 },
    // KY: 6% statewide, no local sales tax.
    { county: "kenton", state: "KY", rateBp: 600, verifiedYear: 2026 },
    { county: "campbell", state: "KY", rateBp: 600, verifiedYear: 2026 },
    { county: "boone", state: "KY", rateBp: 600, verifiedYear: 2026 },
    // IN: 7% statewide, no local sales tax.
    { county: "dearborn", state: "IN", rateBp: 700, verifiedYear: 2026 },
    { county: "franklin", state: "IN", rateBp: 700, verifiedYear: 2026 },
    { county: "ripley", state: "IN", rateBp: 700, verifiedYear: 2026 },
  ],
  zipToCounty: {
    // Hamilton County, OH
    "451": { county: "hamilton", state: "OH" },
    "452": { county: "hamilton", state: "OH" },
    // Butler / Warren / Clermont, OH
    "450": { county: "butler", state: "OH" },
    "raw-45036": { county: "warren", state: "OH" },
    "raw-45103": { county: "clermont", state: "OH" },
    // Montgomery, OH
    "454": { county: "montgomery", state: "OH" },
    // N. Kentucky
    "410": { county: "kenton", state: "KY" },
    "she-41011": { county: "kenton", state: "KY" },
    "raw-41071": { county: "campbell", state: "KY" },
    "raw-41042": { county: "boone", state: "KY" },
    // SE Indiana
    "470": { county: "dearborn", state: "IN" },
  },
};

export interface TaxResult {
  rateBp: number;
  county: string | null;
  state: string | null;
  taxCents: number;
  /** True when we fell back rather than matching the ZIP. Show a note in admin. */
  usedFallback: boolean;
  /** True when the table has not been reviewed for the current year. */
  stale: boolean;
}

/**
 * Resolve a ZIP to a county rate. Exact 5-digit entries win over 3-digit
 * prefixes, so a one-off ZIP can override a whole prefix without restructuring
 * the table.
 */
export function lookupRate(zip: string, table: TaxTable, currentYear: number): {
  rateBp: number;
  county: string | null;
  state: string | null;
  usedFallback: boolean;
  stale: boolean;
} {
  const clean = (zip || "").trim().slice(0, 5);
  const exact = table.zipToCounty["raw-" + clean];
  const prefix = table.zipToCounty[clean.slice(0, 3)];
  const hit = exact ?? prefix;

  const stale = currentYear > table.ratesStaleAfter;

  if (!hit) {
    return { rateBp: table.fallbackRateBp, county: null, state: null, usedFallback: true, stale };
  }
  const row = table.rates.find((r) => r.county === hit.county && r.state === hit.state);
  if (!row) {
    return { rateBp: table.fallbackRateBp, county: hit.county, state: hit.state, usedFallback: true, stale };
  }
  return { rateBp: row.rateBp, county: row.county, state: row.state, usedFallback: false, stale };
}

/**
 * Tax on a taxable base.
 *
 * The base deliberately EXCLUDES nothing by default: in Ohio, charges that are
 * part of the price of a taxable service (including travel billed to the
 * customer) are generally part of the taxable price. Flagged for CPA review
 * rather than quietly excluded, because guessing low creates a liability.
 */
export function computeTax(
  taxableBaseCents: number,
  zip: string,
  table: TaxTable,
  currentYear: number,
): TaxResult {
  const r = lookupRate(zip, table, currentYear);
  return {
    ...r,
    taxCents: Math.round((taxableBaseCents * r.rateBp) / 10_000),
  };
}
