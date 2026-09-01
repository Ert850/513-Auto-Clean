import type { MileageRules } from "./rules.js";

/**
 * Travel fee. Pure — no I/O, no clock, no network.
 *
 * `oneWayMinutes` is NOT a single Google lookup. It is the average of the two
 * real legs, each priced at its actual traffic time (see measureOneWayMinutes
 * below), so that a job is charged for the round trip it actually costs.
 *
 *   t <= 10        -> $0
 *   10 < t <= 30   -> (t - 10) x $1.00
 *   t > 30         -> $20 + (t - 30) x $1.50
 *
 * then rounded to $5, with the direction depending on distance:
 *   t < 20         -> round DOWN
 *   20 <= t < 30   -> round to NEAREST
 *   t >= 30        -> round UP
 *
 * Worked examples confirmed with Elijah:
 *   60 min  -> $20 + 30 x $1.50 = $65
 *  120 min  -> $20 + 90 x $1.50 = $155
 *
 * Note the emergent behaviour of round-down-below-20: anything under 15 minutes
 * lands on $0, and 15 minutes is the first $5. So the ladder independently
 * reproduces the "15 free minutes, $5 minimum" rule from context_outline.txt.
 */
export function mileageFeeCents(oneWayMinutes: number, r: MileageRules): number {
  if (!Number.isFinite(oneWayMinutes) || oneWayMinutes <= r.freeMinutes) return 0;

  const t = oneWayMinutes;
  const raw =
    t <= r.tier2StartMin
      ? (t - r.freeMinutes) * r.tier1RateCents
      : r.tier2BaseCents + (t - r.tier2StartMin) * r.tier2RateCents;

  const step = r.roundToCents;
  if (t < r.roundDownBelowMin) return Math.floor(raw / step) * step;
  if (t < r.roundNearestBelowMin) return Math.round(raw / step) * step;
  return Math.ceil(raw / step) * step;
}

/**
 * Collapse the two measured legs into the single one-way figure the fee ladder
 * expects: drive out at the time you must leave to arrive, drive back at the
 * time you actually finish, then average.
 *
 * Both legs come from the Routes API with TRAFFIC_AWARE. The caller owns the
 * API interaction; this stays pure so it can be tested.
 */
export function averageOneWayMinutes(outboundMinutes: number, returnMinutes: number): number {
  return (outboundMinutes + returnMinutes) / 2;
}

/**
 * Total minutes of driving a booking commits Elijah to. This is what gets
 * subtracted from an availability block alongside the job itself — per the
 * outline's rule that a 4-hour detail plus an hour of travel needs a 5-hour
 * window.
 */
export function travelCommitmentMinutes(outboundMinutes: number, returnMinutes: number): number {
  return outboundMinutes + returnMinutes;
}
