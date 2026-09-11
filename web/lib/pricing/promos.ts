/**
 * Promo codes.
 *
 * One table, edited here, read by the funnel AND by the payment functions.
 * The browser is never trusted with a discount: it sends the code the
 * customer typed, and the server looks it up in this same list and applies it
 * itself. A tampered request that claims "PROMO: 90% off" gets repriced at
 * whatever this table actually says, or at nothing if the code is not here.
 *
 * TO ADD A CODE: add a row. To turn one off: set `active: false`, or give it
 * an `expiresOn`. Nothing else has to change, and no deploy step is special.
 *
 * Percentages are basis points, money is integer cents, as everywhere else.
 */

export interface Promo {
  /** Matched case and whitespace insensitively. Stored uppercase. */
  code: string;
  /** Shown on the price breakdown. Keep it short. */
  label: string;
  /** 1000 = 10% off. Use this or amountCents, not both. */
  percentBp?: number;
  /** Flat money off. Never takes the subtotal below zero. */
  amountCents?: number;
  active: boolean;
  /** ISO date, inclusive. The code stops working the day after. */
  expiresOn?: string;
  /** Refuse the code under this much service. Guards against a $10 job. */
  minServiceCents?: number;
  /** Short line shown to the customer when the code lands. */
  blurb?: string;
}

export const PROMOS: Promo[] = [
  {
    code: "LIKENEW",
    label: "LIKENEW, 10% off",
    percentBp: 1000,
    active: true,
    blurb: "10% off your service.",
  },
  {
    // Not advertised anywhere on the site. It works when somebody types it,
    // which is the point: Elijah hands it out to friends, family and anyone
    // working for him, and nothing on the page invites a stranger to guess
    // at it. If it ever leaks, set active to false and it stops that minute.
    code: "FRIANDFAM",
    label: "FRIANDFAM, 25% off",
    percentBp: 2500,
    active: true,
    blurb: "Friends and family rate, 25% off your service.",
  },
];

/** Uppercase, trimmed, and stripped of the spaces people type out of habit. */
export function normalisePromo(code: string): string {
  return String(code ?? "").trim().toUpperCase().replace(/\s+/g, "");
}

export type PromoRejection = "empty" | "unknown" | "expired" | "too_small";

export interface PromoResult {
  promo: Promo | null;
  /** Null when the code is good. */
  rejected: PromoRejection | null;
}

/**
 * Look up a code and say plainly why it did not apply.
 *
 * `serviceCents` is optional so the funnel can validate a code the moment it
 * is typed, before a cart is complete, and re-check it at checkout.
 */
export function findPromo(
  code: string,
  opts: { serviceCents?: number; today?: Date } = {},
): PromoResult {
  const wanted = normalisePromo(code);
  if (!wanted) return { promo: null, rejected: "empty" };

  const hit = PROMOS.find((p) => normalisePromo(p.code) === wanted);
  if (!hit || !hit.active) return { promo: null, rejected: "unknown" };

  if (hit.expiresOn) {
    // Compared as dates, not timestamps: a code that expires on the 30th
    // should work all day on the 30th in Cincinnati, not stop at midnight UTC.
    const today = opts.today ?? new Date();
    const stamp =
      today.getFullYear() +
      "-" +
      String(today.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(today.getDate()).padStart(2, "0");
    if (stamp > hit.expiresOn) return { promo: null, rejected: "expired" };
  }

  if (
    hit.minServiceCents !== undefined &&
    opts.serviceCents !== undefined &&
    opts.serviceCents < hit.minServiceCents
  ) {
    return { promo: null, rejected: "too_small" };
  }

  return { promo: hit, rejected: null };
}

/**
 * What the code is worth against a given service subtotal.
 *
 * Service only. Travel is a pass-through cost, not margin, so discounting it
 * would mean paying someone to drive. Never returns more than the subtotal.
 */
export function promoDiscountCents(promo: Promo | null, serviceCents: number): number {
  if (!promo || serviceCents <= 0) return 0;
  const raw = promo.percentBp
    ? Math.round((serviceCents * promo.percentBp) / 10_000)
    : (promo.amountCents ?? 0);
  return Math.max(0, Math.min(raw, serviceCents));
}

/** Wording for a code that did not apply. Shown verbatim to the customer. */
export function promoMessage(rejected: PromoRejection): string {
  switch (rejected) {
    case "expired":
      return "That code has expired.";
    case "too_small":
      return "That code needs a larger booking.";
    case "empty":
      return "Enter a code.";
    default:
      return "We do not recognise that code.";
  }
}
