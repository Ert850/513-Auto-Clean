/**
 * Promo codes.
 *
 * One table, config/promo-codes.json, read by the funnel AND by the payment
 * functions. The browser is never trusted with a discount: it sends the code
 * the customer typed, and the server looks it up in this same list and
 * applies it itself. A tampered request that claims "PROMO: 90% off" gets
 * repriced at whatever this table actually says, or at nothing if the code is
 * not here.
 *
 * TO ADD A CODE: add a block to the file. To turn one off: `active: false`,
 * or an `until` date. A code with no `until` never ends on its own (owner,
 * November 11: printed offers must not quietly stop). The file is checked
 * when this module loads, so a typo fails the build and the tests.
 *
 * Percentages are basis points, money is integer cents, as everywhere else.
 */
import raw from "../../../config/promo-codes.json" with { type: "json" };
import { localParts } from "../time/zone.js";

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
  /** ISO date, inclusive, Cincinnati. The code stops working the day after. */
  expiresOn?: string;
  /** Refuse the code under this much service. Guards against a $10 job. */
  minServiceCents?: number;
  /** Short line shown to the customer when the code lands. */
  blurb?: string;
}

/** The file's friendly shape (percentOff, dollarsOff, until) into Promo. Throws on a mistake. */
export function checkPromoCodes(input: unknown): Promo[] {
  const bad = (where: string, what: string): never => {
    throw new Error(`config/promo-codes.json: ${where}: ${what}`);
  };
  const codes = (input as { codes?: unknown })?.codes;
  if (!Array.isArray(codes)) bad("codes", "must be a list");
  const seen = new Set<string>();
  const known = ["code", "label", "percentOff", "dollarsOff", "active", "until", "minServiceDollars", "blurb", "note"];
  return (codes as unknown[]).map((c, i) => {
    const o = (c ?? {}) as Record<string, unknown>;
    const code = typeof o["code"] === "string" ? normalisePromo(o["code"]) : "";
    const where = code || `code ${i + 1}`;
    if (!/^[A-Z0-9]{3,32}$/.test(code)) bad(where, "code must be 3 to 32 letters or digits");
    if (seen.has(code)) bad(where, "this code is listed twice");
    seen.add(code);
    for (const k of Object.keys(o)) if (!known.includes(k)) bad(where, `unknown field "${k}" (use ${known.join(", ")})`);
    if (typeof o["label"] !== "string" || !o["label"].trim()) bad(where, "needs a label");
    if (typeof o["active"] !== "boolean") bad(where, "active must be true or false");
    const pct = o["percentOff"];
    const usd = o["dollarsOff"];
    if ((pct === undefined) === (usd === undefined)) bad(where, "give percentOff OR dollarsOff, not both or neither");
    if (pct !== undefined && (typeof pct !== "number" || !(pct > 0 && pct <= 100))) bad(where, "percentOff must be more than 0 and at most 100");
    if (usd !== undefined && (typeof usd !== "number" || !(usd > 0))) bad(where, "dollarsOff must be more than 0");
    const until = o["until"];
    if (until !== undefined && (typeof until !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(until))) bad(where, "until must be a date like 2027-06-30");
    const min = o["minServiceDollars"];
    if (min !== undefined && (typeof min !== "number" || min < 0)) bad(where, "minServiceDollars must be 0 or more");
    return {
      code,
      label: (o["label"] as string).trim(),
      ...(pct !== undefined ? { percentBp: Math.round((pct as number) * 100) } : {}),
      ...(usd !== undefined ? { amountCents: Math.round((usd as number) * 100) } : {}),
      active: o["active"] as boolean,
      ...(until !== undefined ? { expiresOn: until as string } : {}),
      ...(min !== undefined ? { minServiceCents: Math.round((min as number) * 100) } : {}),
      ...(typeof o["blurb"] === "string" ? { blurb: o["blurb"] } : {}),
    };
  });
}

export const PROMOS: Promo[] = checkPromoCodes(raw);

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
    // should work all day on the 30th in Cincinnati. The date is read in
    // Cincinnati, not from the machine: the functions run on UTC, where the
    // 30th ended at 7 or 8pm Cincinnati time while the screen still took it.
    const today = opts.today ?? new Date();
    const { y, mo, d } = localParts(today.getTime(), "America/New_York");
    const stamp = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
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
