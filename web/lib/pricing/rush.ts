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
const SOURCE = /^[a-z0-9_-]{1,40}$/;

/** A real calendar date, YYYY-MM-DD: 2027-13-45 is refused, not just odd-looking. */
export function isRealDate(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number);
  const t = new Date(Date.UTC(y!, m! - 1, d!));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m! - 1 && t.getUTCDate() === d;
}

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
  if (!input || typeof input !== "object" || Array.isArray(input)) bad("the file", "is not a JSON object");
  const o = input as Record<string, unknown>;
  // A misspelt key is silently ignored by JSON, so every key is checked.
  for (const k of Object.keys(o)) {
    if (!["_read_me", "defaultRushDays", "rules"].includes(k)) bad("the file", `unknown key "${k}" (use defaultRushDays, rules)`);
  }
  const defaultRushDays = days(o["defaultRushDays"], "defaultRushDays");
  if (!Array.isArray(o["rules"])) bad("rules", "must be a list (it can be empty: [])");
  const rules = (o["rules"] as unknown[]).map((r, i): RushRule => {
    if (!r || typeof r !== "object" || Array.isArray(r)) bad(`rule ${i + 1}`, "must be an object");
    const rr = r as Record<string, unknown>;
    const name = typeof rr["name"] === "string" && rr["name"].trim() ? rr["name"].trim() : `rule ${i + 1}`;
    for (const k of Object.keys(rr)) {
      if (!["name", "when", "rushDays", "note"].includes(k)) bad(name, `unknown key "${k}" (use name, when, rushDays, note)`);
    }
    // A rule with no conditions would match every booking: a misspelt "when"
    // must not quietly change the price of everything.
    const w = rr["when"] as Record<string, unknown>;
    if (!w || typeof w !== "object" || Array.isArray(w)) bad(name, "needs a 'when' object with at least one condition");
    if (!Object.keys(w).length) bad(name, "'when' has no conditions; for every booking, change defaultRushDays instead");
    const known = ["sources", "kinds", "packages", "from", "until"];
    for (const k of Object.keys(w)) if (!known.includes(k)) bad(name, `unknown condition "${k}" (use ${known.join(", ")})`);
    const when: RushWhen = {};
    const sources = list(w["sources"], `${name}, sources`);
    if (sources) {
      // The same alphabet the browser and the server reduce a source to
      // (sourceKey), or a rule could match on one side and not the other.
      for (const src of sources) if (!SOURCE.test(src)) bad(name, `source "${src}": lower case letters, digits, - and _ only, at most 40`);
      when.sources = sources;
    }
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
      if (!isRealDate(w[k])) bad(name, `${k} must be a real date like 2027-06-30`);
      when[k] = w[k] as string;
    }
    if (when.from && when.until && when.from > when.until) bad(name, "from is after until");
    return { name, when, rushDays: days(rr["rushDays"], `${name}, rushDays`) };
  });
  return { defaultRushDays, rules };
}

export const RUSH_SETTINGS: RushSettings = checkRushSettings(raw);

/**
 * "golf" from "golf / print / qr": the first part, lower case, letters,
 * digits, - and _ only, at most 40. The browser and the server (wire.ts) both
 * reduce a source with this, so a rule matches on both sides or neither.
 */
export function sourceKey(source: unknown): string {
  return String(source ?? "").split("/")[0]!.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);
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
