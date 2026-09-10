/**
 * Ranking behind the "Most popular" sort on the browse screen.
 *
 * TEMPORARY SEED. There are no bookings to count yet, so these are Elijah's
 * read on what people actually ask for, with Full Interior and Basic Exterior
 * on top because those are what he books most.
 *
 * TO REPLACE WITH REAL DATA: count confirmed bookings per package and per
 * add-on tier over a trailing window (a rolling 90 days keeps it current
 * without letting one busy week dominate), and feed those counts in here.
 * Nothing else has to change: the sort only ever asks popularityOf() for a
 * number and compares it, so the shape of the answer stays the same whether
 * it comes from this table or from the database.
 *
 * Deliberately NOT the same thing as `featured`. Featured is what Elijah wants
 * to sell; this is what customers choose. They will not always agree, and when
 * they disagree that is worth knowing rather than papering over.
 */
export const POPULARITY_SEED: Record<string, number> = {
  // packages
  "full-interior": 100,
  "basic-exterior": 90,
  "basic-interior": 74,
  "full-exterior": 68,
  "express-exterior": 44,
  "maintenance-interior": 36,
  "showroom-interior": 30,
  "showroom-exterior": 20,

  // add-ons
  "pet-hair": 62,
  stain: 56,
  headlight: 40,
  "scratch-reduction": 39,
  "tire-rim-shine": 38,
  ozone: 34,
  "ceramic-sealant": 32,
  "engine-bay": 27,
  steam: 24,
  "paint-decon": 22,
  "clay-bar": 18,
  "hard-water": 16,
  "seat-removal": 14,
  "ceramic-coating": 12,
  "paint-polish": 10,
  "paint-correction": 8,
};

/** Higher is more popular. Anything unranked sorts to the bottom, not the top. */
export function popularityOf(id: string): number {
  return POPULARITY_SEED[id] ?? 0;
}
