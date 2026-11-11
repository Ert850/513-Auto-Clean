/**
 * How many days carry the rush fee, for one booking (owner, November 11, 2026).
 *
 * The settings live in config/rush-fee.json, so they change without touching
 * code: a default, then rules checked top to bottom, first match wins. Both
 * the browser and the booking functions bundle that file, so the price shown
 * is the price charged.
 *
 * The file is checked when this module loads. A typo (an unknown kind, a
 * negative day count, a bad date) throws, which fails the build and the tests
 * instead of quietly mispricing bookings.
 */
import raw from "../../../config/rush-fee.json" with { type: "json" };
import type { BookingWindowRules } from "./rules.js";
import { localParts } from "../time/zone.js";
import { findPackage } from "../catalog/seed.js";

export type BookingSide = "interior" | "exterior" | "both";

export interface RushWhen {
  sources?: string[];
  kinds?: BookingSide[];
  packages?: string[];
  /** YYYY-MM-DD, Cincinnati, inclusive. */
  from?: string;
  until?: string;
}

export interface RushRule {
  name: string;
  when: RushWhen;
  rushDays: number;
}

export interface RushSettings {
  defaultRushDays: number;
  rules: RushRule[];
}

/** What a rule can look at. Every field is optional: unknown never matches a rule that asks for it. */
export interface RushBooking {
  /** The arrival source, "golf" from "golf / print / qr". */
  source?: string | null;
  packageIds?: string[];
}

const KINDS: BookingSide[] = ["interior", "exterior", "both"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Throws with a message that names the rule and the field. */
export function checkRushSettings(input: unknown): RushSettings {
  const bad = (where: string, what: string): never => {
    throw new Error(`config/rush-fee.json: ${where}: ${what}`);
  };
  const days = (v: unknown, where: string) =>
    typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 30
      ? v
      : bad(where, "rushDays must be a whole number from 0 to 30");
  const list = (v: unknown, where: string): string[] | undefined => {
    if (v === undefined) return undefined;
    if (!Array.isArray(v) || !v.length || v.some((s) => typeof s !== "string" || !s.trim())) {
      bad(where, "must be a list of words, like [\"golf\"]");
    }
    return (v as string[]).map((s) => s.trim().toLowerCase());
  };
  if (!input || typeof input !== "object") bad("the file", "is not a JSON object");
  const o = input as Record<string, unknown>;
  const defaultRushDays = days(o["defaultRushDays"], "defaultRushDays");
  if (!Array.isArray(o["rules"])) bad("rules", "must be a list (it can be empty: [])");
  const rules = (o["rules"] as unknown[]).map((r, i): RushRule => {
    const rr = (r ?? {}) as Record<string, unknown>;
    const name = typeof rr["name"] === "string" && rr["name"].trim() ? rr["name"].trim() : `rule ${i + 1}`;
    const w = (rr["when"] ?? {}) as Record<string, unknown>;
    if (typeof w !== "object") bad(name, "'when' must be an object");
    const known = ["sources", "kinds", "packages", "from", "until"];
    for (const k of Object.keys(w)) if (!known.includes(k)) bad(name, `unknown condition "${k}" (use ${known.join(", ")})`);
    const when: RushWhen = {};
    const sources = list(w["sources"], `${name}, sources`);
    if (sources) when.sources = sources;
    const kinds = list(w["kinds"], `${name}, kinds`);
    if (kinds) {
      for (const k of kinds) if (!KINDS.includes(k as BookingSide)) bad(name, `kind "${k}" is not one of ${KINDS.join(", ")}`);
      when.kinds = kinds as BookingSide[];
    }
    const packages = list(w["packages"], `${name}, packages`);
    if (packages) {
      for (const p of packages) if (!findPackage(p)) bad(name, `no package called "${p}"`);
      when.packages = packages;
    }
    for (const k of ["from", "until"] as const) {
      if (w[k] === undefined) continue;
      if (typeof w[k] !== "string" || !DATE.test(w[k] as string)) bad(name, `${k} must be a date like 2027-06-30`);
      when[k] = w[k] as string;
    }
    if (when.from && when.until && when.from > when.until) bad(name, "from is after until");
    return { name, when, rushDays: days(rr["rushDays"], `${name}, rushDays`) };
  });
  return { defaultRushDays, rules };
}

export const RUSH_SETTINGS: RushSettings = checkRushSettings(raw);

/** "golf" from "golf / print / qr"; lower case, nothing else. */
export function sourceKey(source: string | null | undefined): string {
  return String(source ?? "").split("/")[0]!.trim().toLowerCase();
}

/** Interior, exterior or both, from the packages booked; null with none. */
export function bookingSide(packageIds: string[] = []): BookingSide | null {
  let inside = false;
  let outside = false;
  for (const id of packageIds) {
    const c = findPackage(id)?.category;
    if (c === "interior") inside = true;
    if (c === "exterior") outside = true;
  }
  return inside && outside ? "both" : inside ? "interior" : outside ? "exterior" : null;
}

/** The rule that applies, or null for the default. */
export function rushRuleFor(
  b: RushBooking,
  nowMs: number,
  s: RushSettings = RUSH_SETTINGS,
  timeZone = "America/New_York",
): RushRule | null {
  const { y, mo, d } = localParts(nowMs, timeZone);
  const today = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const src = sourceKey(b.source);
  const ids = b.packageIds ?? [];
  const side = bookingSide(ids);
  return (
    s.rules.find(({ when: w }) =>
      (!w.sources || (!!src && w.sources.includes(src))) &&
      (!w.kinds || (!!side && w.kinds.includes(side))) &&
      (!w.packages || ids.some((id) => w.packages!.includes(id))) &&
      (!w.from || today >= w.from) &&
      (!w.until || today <= w.until),
    ) ?? null
  );
}

/**
 * The lead window for this booking, in the shape slotNeedsPriority takes:
 * a start on any of the first `minLeadDays` days, today included, pays the
 * rush fee. 0 means it never does.
 */
export function rushWindow(
  b: RushBooking,
  nowMs: number,
  s: RushSettings = RUSH_SETTINGS,
  timeZone = "America/New_York",
): BookingWindowRules {
  const rule = rushRuleFor(b, nowMs, s, timeZone);
  return { minLeadDays: rule ? rule.rushDays : s.defaultRushDays };
}
