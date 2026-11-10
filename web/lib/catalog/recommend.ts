/**
 * Which add-ons to put first, "Recommended for your package".
 *
 * One place for the ranking, so it can get smarter without touching the
 * booking form. Today it is a hand-picked order per side of the car (owner,
 * November 10: what customers pick most, and what earns most per hour of
 * work), then catalog popularity. Later, analytics can say which add-ons are
 * actually booked with which package; pass those as `signals.score` and they
 * outrank the hand-picked order. Nothing else changes.
 */
import { popularityOf } from "./popularity.js";

export type Side = "interior" | "exterior";

export const RECOMMENDATION_RULES = {
  /** Hand-picked order. Anything included in, or blocked by, the package drops out. */
  priority: {
    interior: ["pet-hair", "stain", "ozone", "steam"],
    exterior: ["tire-rim-shine", "engine-bay", "headlight", "paint-decon"],
  } as Record<Side, string[]>,
  /** How many to show: three for one side of the car, two each for both. */
  perSide: { one: 3, both: 2 },
};

export interface AddonSignals {
  /**
   * Higher is recommended sooner, e.g. how often an add-on is booked with
   * this package (from analytics). Add-ons without a score keep the
   * hand-picked order, after every scored one.
   */
  score?: Record<string, number>;
}

/**
 * The ids to recommend, in order.
 *
 * `candidates` are the add-ons this vehicle could actually take now (already
 * filtered for "coming soon" and for what the package blocks), per side.
 * Only hand-picked or scored add-ons are recommended; the rest are listed
 * under "More extras" as before.
 */
export function recommendAddons(req: {
  candidates: Record<Side, string[]>;
  sides: Side[];
  signals?: AddonSignals;
  rules?: typeof RECOMMENDATION_RULES;
}): string[] {
  const rules = req.rules ?? RECOMMENDATION_RULES;
  const score = req.signals?.score ?? {};
  const limit = req.sides.length > 1 ? rules.perSide.both : rules.perSide.one;
  const out: string[] = [];

  for (const side of req.sides) {
    const can = new Set(req.candidates[side] ?? []);
    const picked = rules.priority[side] ?? [];
    const pool = [...new Set([...picked, ...Object.keys(score)])].filter((id) => can.has(id));
    const rank = (id: string) => [
      id in score ? 0 : 1,
      -(score[id] ?? 0),
      picked.includes(id) ? picked.indexOf(id) : picked.length,
      -popularityOf(id),
    ];
    pool.sort((a, b) => {
      const x = rank(a), y = rank(b);
      for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i]! - y[i]!;
      return 0;
    });
    out.push(...pool.slice(0, limit));
  }
  return out;
}
