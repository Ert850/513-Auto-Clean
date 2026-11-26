/**
 * What a Book link carries into /book, and how it is written in the address
 * (config/booking-page.json bookLinkParams; Emmett, November 14: "not hardcoded
 * but driven by configurable settings"). The browser (funnel.js), the build
 * (web/scripts/book-links.mjs) and the home page's service buttons all use
 * this one table. Which values are allowed comes from the catalog itself.
 */
import raw from "../../../config/booking-page.json" with { type: "json" };
import { SEED_CATALOG, findPackage } from "../catalog/seed.js";

export type ArrivalKind = "package" | "interest" | "intent" | "browse";
const KINDS: ArrivalKind[] = ["package", "interest", "intent", "browse"];

function load(): Record<ArrivalKind, string> {
  const p = (raw as { bookLinkParams?: Record<string, unknown> }).bookLinkParams;
  if (!p || typeof p !== "object") throw new Error("config/booking-page.json: bookLinkParams is missing");
  const out = {} as Record<ArrivalKind, string>;
  const seen = new Set<string>();
  for (const k of KINDS) {
    const v = p[k];
    if (typeof v !== "string" || !/^[a-z][a-z0-9_-]{0,19}$/.test(v)) {
      throw new Error(`config/booking-page.json: bookLinkParams.${k} must be a short lowercase word`);
    }
    if (seen.has(v)) throw new Error(`config/booking-page.json: bookLinkParams uses "${v}" twice`);
    seen.add(v);
    out[k] = v;
  }
  return out;
}

export const BOOK_LINK_PARAMS: Record<ArrivalKind, string> = load();

/** The sides a link can choose: the catalog's own package categories. */
export const BOOK_INTENTS: string[] = [...new Set(SEED_CATALOG.packages.map((p) => p.category))];

/** Is this a value the kind accepts? Packages and interests are real catalog ids. */
export function arrivalValueOk(kind: ArrivalKind, id: string): boolean {
  if (kind === "browse") return id === "1";
  if (kind === "intent") return BOOK_INTENTS.includes(id);
  return Boolean(findPackage(id));
}

/** "?package=full-interior", or "" for nothing. */
export function arrivalQuery(kind: ArrivalKind | null, id = "1"): string {
  if (!kind || !arrivalValueOk(kind, id)) return "";
  return `?${BOOK_LINK_PARAMS[kind]}=${encodeURIComponent(id)}`;
}

/** The first thing an address carries, read back the same way. */
export function parseArrival(search: string): { kind: ArrivalKind; id: string } | null {
  const q = new URLSearchParams(search || "");
  for (const k of KINDS) {
    const v = q.get(BOOK_LINK_PARAMS[k]);
    if (v !== null && arrivalValueOk(k, v)) return { kind: k, id: v };
  }
  return null;
}
