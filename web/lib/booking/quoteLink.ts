/**
 * Shareable quote links.
 *
 * Elijah builds a booking for someone who would rather text than use a
 * website, then sends them a link that opens the funnel with everything
 * already filled in: their name, their address, the vehicle, the packages,
 * the add-ons, the time. They check it and pay.
 *
 * NO BACKEND. The whole quote rides in the URL fragment, which means:
 *
 *   - It works today, with nothing to deploy and no database.
 *   - A fragment is never sent to a server, so a customer's name and address
 *     do not land in an access log or a referrer header on the way.
 *   - Anyone holding the link can open it. Treat it like the private link it
 *     is, and that is why it expires.
 *
 * WHAT IT DELIBERATELY DOES NOT CARRY: any price. Only ids and a slot go in.
 * The funnel recomputes every figure from the catalog on open, and the server
 * recomputes again before charging, so a link cannot be edited into a cheap
 * detail. The worst a tampered link can do is name a package that does not
 * exist, which is rejected.
 *
 * THE SLOT IS A REQUEST, NOT A HOLD. Nothing is reserved until they pay, so
 * the funnel rechecks it against live availability when the link opens. If
 * the time went to someone else in the meantime it is dropped and they pick
 * again, which is the honest behaviour and the only one that is safe.
 */

/** Bumped when the shape changes, so an old link fails cleanly. */
export const QUOTE_VERSION = 1;

/** How long a link stays good. Long enough to answer a text, short enough to matter. */
export const QUOTE_TTL_HOURS = 24;

export interface QuoteVehicle {
  /** Vehicle size id. */
  z?: string;
  /** "interior" | "exterior" | "both". */
  i?: string;
  /** Package ids. */
  p?: string[];
  /** Add-ons as [addonId, tierId]. */
  a?: [string, string][];
  /** Free text label, e.g. "Blue F-150". */
  l?: string;
  /** Correction tier and coating term ids. */
  c?: string;
  t?: string;
  /** No garage, so the canopy applies. */
  g?: 1;
}

export interface QuotePayload {
  v: number;
  /** Created at, epoch seconds. Kept short. */
  ts: number;
  vs: QuoteVehicle[];
  /** Street, city, region, zip. */
  ad?: [string, string, string, string];
  /** Name, phone, email. */
  ct?: [string, string, string];
  /** Chosen slot, epoch ms. */
  sl?: number;
  /** Promo code. */
  pc?: string;
  /** Interest in services that are not bookable yet. */
  in?: string[];
  /** Notes about the vehicle or the parking. */
  nt?: string;
  /** Who built it, for the customer's benefit: "513 Auto Clean". */
  by?: string;
}

/* ---------------- base64url, without padding ---------------- */

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** UTF-8 in and out, so a name with an accent survives the round trip. */
export function encodeQuote(payload: QuotePayload): string {
  const json = JSON.stringify(payload);
  return toBase64Url(new TextEncoder().encode(json));
}

export interface DecodedQuote {
  ok: boolean;
  payload?: QuotePayload;
  /** Why it was refused, in words a customer can act on. */
  reason?: string;
  /** Hours since it was made. */
  ageHours?: number;
}

export function decodeQuote(text: string, nowMs: number = Date.now()): DecodedQuote {
  if (!text) return { ok: false, reason: "empty" };

  let payload: QuotePayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(fromBase64Url(text))) as QuotePayload;
  } catch {
    return { ok: false, reason: "This link is damaged. Ask us to send a fresh one." };
  }

  if (!payload || typeof payload !== "object" || !Array.isArray(payload.vs)) {
    return { ok: false, reason: "This link is damaged. Ask us to send a fresh one." };
  }

  if (payload.v !== QUOTE_VERSION) {
    return { ok: false, reason: "This link is from an older version of our booking page. Ask us for a new one." };
  }

  const ageHours = (nowMs - (payload.ts ?? 0) * 1000) / 3_600_000;

  // A clock skewed a little into the future is a device problem, not an
  // attack, so a small negative age is tolerated rather than refused.
  if (ageHours < -2) {
    return { ok: false, reason: "This link is not valid yet. Check your device's clock." };
  }

  if (ageHours > QUOTE_TTL_HOURS) {
    return {
      ok: false,
      ageHours,
      reason: `This quote was put together ${Math.round(ageHours / 24) || 1} day${
        ageHours > 48 ? "s" : ""
      } ago and has expired. Prices and times move, so ask us for a fresh one.`,
    };
  }

  return { ok: true, payload, ageHours };
}

/** Hours left before it expires. Negative once it has. */
export function hoursRemaining(payload: QuotePayload, nowMs: number = Date.now()): number {
  return QUOTE_TTL_HOURS - (nowMs - (payload.ts ?? 0) * 1000) / 3_600_000;
}

/** The full link, fragment and all. */
export function quoteUrl(payload: QuotePayload, base = "https://513autoclean.com/"): string {
  return `${base.replace(/#.*$/, "")}#q=${encodeQuote(payload)}`;
}
