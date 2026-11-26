/**
 * Gift cards (holiday sale, November 2026): what a card is sold for, and what
 * it covers.
 *
 * Every number here comes from a setting: the card values and the sale from
 * config/gift-cards.json, the package prices and size upcharges from the
 * catalog, and the tax from the highest rate in the tax table. The page's
 * calculator reads this module, so a price change moves it, and it can never
 * promise more than a card buys.
 *
 * A gift card is a payment, applied after tax. It is never a promo code:
 * promo codes lower the taxable base in quote.ts, and a card must not
 * (docs/GIFT-CARDS-PLAN-2026-11-23.md, section 2).
 */
import { SEED_CATALOG, VEHICLE_SIZES } from "./seed.js";
import { SEED_TAX_TABLE } from "../pricing/tax.js";
import type { TaxTable } from "../pricing/tax.js";
import { localParts } from "../time/zone.js";
import raw from "../../../config/gift-cards.json" with { type: "json" };

export interface GiftCardConfig {
  /** "sale": the discount runs; "regular": cards sell at their value; "off": no page, no links. */
  mode: "sale" | "regular" | "off";
  sale: {
    percentOff: number;
    starts: string;
    ends: string;
    /** Next year's dates, said on the page once this sale has ended (until they come). Wording only: next year they become starts and ends. */
    next?: { starts: string; ends: string };
  };
  /** Card values in whole dollars, in the order shown. */
  tiers: { value: number; featured?: boolean }[];
  /** Any amount between these whole-dollar limits, to the cent, set in the calculator. */
  custom: { min: number; max: number };
  /** False until the checkout function exists: the buy buttons render disabled. methods: Stripe's payment method types (CHECKOUT_METHODS). */
  checkout: { enabled: boolean; methods: string[] };
  /** A card is good for this many years from the day it's bought: 5 at least (federal CARD Act, 12 CFR 1005.20). */
  expiryYears: number;
  /** Days after buying in which an unused card can be refunded. */
  refundDays: number;
  /** How many days ahead a card can be scheduled to be emailed. */
  scheduleDays: number;
  /** Hours after buying in which the card's page can email it to someone, once (gift-send.mjs). */
  sendWindowHours: number;
}

/** What a buyer calls each size (VEHICLE_SIZES ids). */
export const SIZE_WORDS: Record<string, string> = {
  small: "car",
  medium: "SUV or truck",
  large: "3-row SUV or van",
};

export interface CoverRow {
  id: string;
  name: string;
  /** Price with tax, by size id, at the highest rate in the tax table. */
  cents: Record<string, number>;
}

/** The highest combined rate we charge anywhere, so "covers" holds in every county. */
export function maxTaxRateBp(table: TaxTable = SEED_TAX_TABLE): number {
  return Math.max(...table.rates.map((r) => r.rateBp));
}

/** Rounded as computeTax rounds it, so the calculator agrees with the booking form. */
function withTax(cents: number, rateBp: number): number {
  return cents + Math.round((cents * rateBp) / 10_000);
}

/** Every package sold to the public, priced with tax for each size. */
export function coverTable(rateBp: number = maxTaxRateBp()): CoverRow[] {
  return SEED_CATALOG.packages
    .filter((p) => !p.requiresPriorDetail && !p.comingSoon && p.priceCents > 0)
    .map((p) => ({
      id: p.id,
      name: p.name,
      cents: Object.fromEntries(VEHICLE_SIZES.map((s) => [s.id, withTax(p.priceCents + s.upchargeCents, rateBp)])),
    }));
}

/** What the buyer pays for a card worth `valueCents`. */
export function salePriceCents(valueCents: number, cfg: Pick<GiftCardConfig, "mode" | "sale">): number {
  if (cfg.mode !== "sale") return valueCents;
  return Math.round((valueCents * (100 - cfg.sale.percentOff)) / 100);
}

/** The packages a card covers in full for one size, dearest first, and the nearest one it doesn't. */
export function coverage(valueCents: number, sizeId: string, rows: CoverRow[] = coverTable()): {
  covered: { name: string; cents: number }[];
  next: { name: string; shortCents: number } | null;
} {
  const priced = rows.map((r) => ({ name: r.name, cents: r.cents[sizeId] ?? Infinity }));
  const covered = priced.filter((r) => r.cents <= valueCents).sort((a, b) => b.cents - a.cents);
  const above = priced.filter((r) => r.cents > valueCents && Number.isFinite(r.cents)).sort((a, b) => a.cents - b.cents)[0];
  return { covered, next: above ? { name: above.name, shortCents: above.cents - valueCents } : null };
}

/**
 * The payment methods a gift card may be paid with, each checked against its
 * provider's rules for gift cards (November 23, 2026): card (with Apple Pay
 * and Google Pay) and Link; Amazon Pay allows a store's own cards under
 * $2,000.
 * Not here: Afterpay and Cash App Pay ban gift cards, Klarna restricts them,
 * and Stripe offers PayPal only to European businesses. Affirm allows them
 * but costs about 6% a sale: Elijah chose to skip it and Klarna (November 24).
 */
export const CHECKOUT_METHODS = ["card", "link", "amazon_pay"];

/** The federal minimum for a gift card's life (12 CFR 1005.20(e)). */
export const MIN_EXPIRY_YEARS = 5;

/** The last day a card bought on `issued` (YYYY-MM-DD) can be used: the same date, `years` later (February 29 becomes March 1). */
export function expiresOn(issued: string, years: number): string {
  const [y, m, d] = issued.split("-").map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y + years, m - 1, d));
  return t.toISOString().slice(0, 10);
}

/** Everything wrong with config/gift-cards.json; empty means fine. */
export function giftCardProblems(cfg: GiftCardConfig): string[] {
  const out: string[] = [];
  const day = /^\d{4}-\d{2}-\d{2}$/;
  if (!["sale", "regular", "off"].includes(cfg.mode)) out.push(`mode must be sale, regular or off, not "${cfg.mode}"`);
  const pct = cfg.sale?.percentOff;
  if (!Number.isInteger(pct) || pct < 1 || pct > 50) out.push("sale.percentOff must be a whole number from 1 to 50");
  if (!day.test(cfg.sale?.starts ?? "") || !day.test(cfg.sale?.ends ?? "")) out.push("sale.starts and sale.ends must be YYYY-MM-DD (Cincinnati dates)");
  else if (cfg.sale.starts > cfg.sale.ends) out.push("sale.starts is after sale.ends");
  else if (cfg.sale.next !== undefined) {
    const n = cfg.sale.next;
    if (!day.test(n?.starts ?? "") || !day.test(n?.ends ?? "")) out.push("sale.next.starts and sale.next.ends must be YYYY-MM-DD");
    else if (n.starts <= cfg.sale.ends || n.starts > n.ends) out.push("sale.next must come after the sale and start before it ends");
  }
  const values = (cfg.tiers ?? []).map((t) => t.value);
  if (values.length < 1 || values.length > 4) out.push("tiers: 1 to 4 cards");
  values.forEach((v, i) => {
    if (!Number.isInteger(v) || v < 5 || v > 2000) out.push(`tiers[${i}].value must be whole dollars, 5 to 2000`);
    if (i && v <= values[i - 1]!) out.push("tiers must go up in value");
  });
  if ((cfg.tiers ?? []).filter((t) => t.featured).length > 1) out.push("at most one featured tier");
  const { min, max } = cfg.custom ?? ({} as GiftCardConfig["custom"]);
  if (!Number.isInteger(min) || !Number.isInteger(max) || min < 5 || min >= max) out.push("custom.min and custom.max must be whole dollars, min below max");
  if (typeof cfg.checkout?.enabled !== "boolean") out.push("checkout.enabled must be true or false");
  const methods = cfg.checkout?.methods;
  if (!Array.isArray(methods) || !methods.includes("card") || methods.some((m) => !CHECKOUT_METHODS.includes(m)) || new Set(methods).size !== methods.length) {
    out.push(`checkout.methods must include "card" and only these: ${CHECKOUT_METHODS.join(", ")}`);
  }
  if (!Number.isInteger(cfg.expiryYears) || cfg.expiryYears < MIN_EXPIRY_YEARS || cfg.expiryYears > 50) out.push(`expiryYears must be a whole number of years, at least ${MIN_EXPIRY_YEARS} (federal law)`);
  if (!Number.isInteger(cfg.refundDays) || cfg.refundDays < 0 || cfg.refundDays > 365) out.push("refundDays must be a whole number of days, 0 to 365");
  if (!Number.isInteger(cfg.scheduleDays) || cfg.scheduleDays < 1 || cfg.scheduleDays > 365) out.push("scheduleDays must be a whole number of days, 1 to 365");
  if (!Number.isInteger(cfg.sendWindowHours) || cfg.sendWindowHours < 1 || cfg.sendWindowHours > 24 * 30) out.push("sendWindowHours must be a whole number of hours, 1 to 720");
  return out;
}

/** config/gift-cards.json, as the checkout and the page's script read it. */
export const GIFT_CARDS = raw as unknown as GiftCardConfig;

/** Today in Cincinnati, YYYY-MM-DD: the functions run on UTC. */
export function cincinnatiDay(nowMs: number): string {
  const { y, mo, d } = localParts(nowMs, "America/New_York");
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Is the discount on right now? Mode "sale" and today between the sale's
 * dates, both included. The checkout charges by this, and the page's script
 * switches the page to full prices by the same test, so what the page shows
 * is what Stripe charges.
 */
export function saleOn(cfg: Pick<GiftCardConfig, "mode" | "sale">, nowMs: number): boolean {
  if (cfg.mode !== "sale") return false;
  const day = cincinnatiDay(nowMs);
  return day >= cfg.sale.starts && day <= cfg.sale.ends;
}

export type GiftOffer =
  | { ok: true; valueCents: number; payCents: number; percentOff: number }
  | { ok: false; error: "off" | "bad_amount" };

/**
 * Has this year's sale ended, with next year's dates still to come? The page
 * then says the sale is over and when the next one runs (Elijah, November 23).
 */
export function saleEndedNext(cfg: Pick<GiftCardConfig, "mode" | "sale">, nowMs: number): boolean {
  if (cfg.mode !== "sale" || !cfg.sale.next) return false;
  const day = cincinnatiDay(nowMs);
  return day > cfg.sale.ends && day < cfg.sale.next.starts;
}

/** Whole cents for an amount in dollars with at most 2 decimals ($119.13), or null. */
export function dollarsToCents(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  const c = Math.round(v * 100);
  return Math.abs(v * 100 - c) < 1e-6 ? c : null;
}

/**
 * What a card of `value` dollars costs now: a tier, or any amount to the cent
 * between the calculator's limits (Elijah, November 23: "$119.13"). Only the
 * server's answer counts: the browser sends the value, never a price.
 */
export function giftOffer(value: unknown, nowMs: number, cfg: GiftCardConfig = GIFT_CARDS): GiftOffer {
  if (cfg.mode === "off") return { ok: false, error: "off" };
  const valueCents = dollarsToCents(value);
  const tier = cfg.tiers.some((t) => t.value * 100 === valueCents);
  if (valueCents === null || (!tier && (valueCents < cfg.custom.min * 100 || valueCents > cfg.custom.max * 100))) return { ok: false, error: "bad_amount" };
  const percentOff = saleOn(cfg, nowMs) ? cfg.sale.percentOff : 0;
  return { ok: true, valueCents, payCents: Math.round((valueCents * (100 - percentOff)) / 100), percentOff };
}
