/**
 * What the booking form says about discounts (Emmett, November 15), as pure
 * functions so they can be tested: the bar's label beside the struck price,
 * and the note beside "You saved".
 *
 * The struck price and "You saved" both come from one re-pricing with every
 * discount off (js/funnel.js undiscounted()), tax included. "You saved" is
 * therefore the money actually saved, which takes in the tax (and any rush or
 * early/late fee, a percentage of the discounted price) that came off with
 * the discounts. The note says so, so a "-$25.00" row above "You saved
 * $26.95" doesn't read as a mistake (Emmett's pick: "Keep it, label the tax").
 */
import type { Quote } from "./quote.js";

/** The kinds of discount line on a quote, each once, in line order. */
export function discountKinds(q: Pick<Quote, "lines">): string[] {
  const seen: string[] = [];
  for (const l of q.lines) if (l.amountCents < 0 && l.kind !== "tax" && !seen.includes(l.kind)) seen.push(l.kind);
  return seen;
}

const NAMES: Record<string, (q: Pick<Quote, "promoCode">) => string> = {
  promo_discount: (q) => `${q.promoCode ?? "Code"} applied`,
  additional_vehicle_discount: () => "multi-vehicle saving applied",
  combo_discount: () => "interior + exterior saving applied",
  pay_in_full_discount: () => "paid-in-full saving applied",
};

/** Beside the bar's struck price: the one discount by name, or "savings applied" for several. Null with none. */
export function barLabel(q: Pick<Quote, "lines" | "promoCode">): string | null {
  const kinds = discountKinds(q);
  if (!kinds.length) return null;
  if (kinds.length > 1) return "savings applied";
  return (NAMES[kinds[0]!] ?? (() => "saving applied"))(q);
}

/** The fee on the quote in words, "rush fee" or "late start fee", from its own line; null without one. */
function feeName(q: Pick<Quote, "lines">): string | null {
  const l = q.lines.find((x) => x.kind === "surcharge");
  return l ? l.label.replace(/\s*\(.*\)\s*$/, "").toLowerCase() : null;
}

/**
 * The saving and its note: cents saved (undiscounted total minus this one)
 * and "5% off, tax included", "10% off, tax and rush fee included". The
 * percentage is of the SERVICE list price, before tax: travel is never
 * discounted, so counting it would shrink "25%" to "19%".
 */
export function savingSummary(
  q: Pick<Quote, "lines" | "totalCents" | "taxCents" | "taxIsEstimate">,
  undiscountedTotalCents: number,
): { cents: number; pct: number; note: string } {
  let list = 0, pre = 0;
  for (const l of q.lines) {
    if (l.kind === "travel" || l.kind === "tax" || l.kind === "surcharge") continue;
    if (l.amountCents > 0) list += l.amountCents;
    else pre -= l.amountCents;
  }
  const cents = pre > 0 ? Math.max(0, undiscountedTotalCents - q.totalCents) : 0;
  const pct = list > 0 ? Math.round((pre / list) * 100) : 0;
  const taxed = q.taxCents > 0 && !q.taxIsEstimate;
  const fee = feeName(q);
  const incl = taxed && fee ? `tax and ${fee} included` : taxed ? "tax included" : fee ? `${fee} included` : "";
  const note = [pct >= 1 ? `${pct}% off` : "", incl].filter(Boolean).join(", ");
  return { cents, pct, note };
}
