/**
 * Gift cards, server side (docs/GIFT-CARDS-PLAN-2026-11-23.md, section 5).
 *
 * WHERE A CARD LIVES. On its own Stripe payment: the PaymentIntent's metadata
 * holds the value, the balance, the status and a short history. There is no
 * database on this site, and Stripe is where Elijah already looks for money,
 * so a card can be found in his dashboard as well as on /gift-admin.
 *
 * THE CODE. Derived from the Checkout Session id with a secret
 * (GIFT_CODE_SECRET), never random and never stored. So a webhook delivered
 * twice, or at the same moment as the thank-you page loads, always arrives at
 * the same code, and a lost card can be resent from the payment alone. The
 * secret makes it unguessable: 60 bits, and only its keyed hash is written
 * anywhere (for lookup by code).
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { cincinnatiDay } from "./_pricing.mjs";

/** Crockford base32: no I, L, O or U, so a code read aloud or retyped survives. */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** The metadata marker on every gift card payment. */
export const GIFT_KIND = "giftcard";

/** The secret, or null when it is missing or too short to be safe. */
export function giftSecret(env = process.env) {
  const s = env.GIFT_CODE_SECRET;
  return typeof s === "string" && s.length >= 32 ? s : null;
}

/** 513-XXXX-XXXX-XXXX for one Checkout Session. */
export function codeFor(sessionId, secret) {
  const mac = createHmac("sha256", secret).update("code:" + sessionId).digest();
  let bits = 0n;
  for (let i = 0; i < 8; i++) bits = (bits << 8n) | BigInt(mac[i]);
  let out = "";
  for (let i = 0; i < 12; i++) out += ALPHABET[Number((bits >> BigInt(64 - 5 * (i + 1))) & 31n)];
  return `513-${out.slice(0, 4)}-${out.slice(4, 8)}-${out.slice(8)}`;
}

/** The 12 code characters from however it was typed, or null. */
export function normaliseCode(input) {
  if (typeof input !== "string") return null;
  let s = input.toUpperCase().replace(/[^0-9A-Z]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
  if (s.length === 15 && s.startsWith("513")) s = s.slice(3);
  return s.length === 12 && [...s].every((c) => ALPHABET.includes(c)) ? s : null;
}

/** The keyed hash a card is found by. Never the code itself. */
export function codeHash(code, secret) {
  const n = normaliseCode(code);
  return n ? createHmac("sha256", secret).update("lookup:" + n).digest("hex").slice(0, 40) : null;
}

/** Constant-time comparison for the admin key. */
export function sameSecret(given, expected) {
  if (typeof given !== "string" || typeof expected !== "string" || expected.length < 16) return false;
  const a = Buffer.from(given), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** The site's own address for links in emails and Stripe's return: this deploy's, so a preview links to itself. */
export function siteUrl(env = process.env) {
  // Only a Deploy Preview's own address (deploy-preview-N--site): CONTEXT may
  // not reach a function at run time, and on the live site DEPLOY_PRIME_URL is
  // main--site.netlify.app, not the domain (validation pass 1).
  const prime = env.DEPLOY_PRIME_URL || "";
  const u = /\/\/deploy-preview-\d+--/.test(prime) ? prime : env.URL;
  return (u || "https://513autoclean.com").replace(/\/$/, "");
}

/** Whole cents from a metadata string, or null. */
const cents = (v) => (typeof v === "string" && /^\d+$/.test(v) ? Number(v) : null);

/** A card as read from its PaymentIntent (or Checkout Session) metadata. */
export function cardFromMeta(m = {}) {
  const value = cents(m.gift_value_cents);
  const balance = cents(m.gift_balance_cents);
  return {
    valueCents: value,
    // Not issued yet (the webhook hasn't run): the whole value is on it.
    balanceCents: balance ?? value,
    status: m.gift_status || "active",
    percentOff: Number(m.gift_percent_off) || 0,
    toName: m.gift_to_name || "",
    fromName: m.gift_from_name || "",
    message: m.gift_message || "",
    sendOn: m.gift_send_on || "",
    log: m.gift_log || "",
  };
}

/** Stripe's metadata values are capped at 500 characters: keep the newest history. */
export function appendLog(log, entry) {
  const all = (log ? log + "; " : "") + entry;
  return all.length <= 500 ? all : "..." + all.slice(all.length - 497);
}

/** "$50" or "$29.60". */
export const dollars = (c) => "$" + (c % 100 ? (c / 100).toFixed(2) : String(c / 100));

/**
 * Writes the card onto its payment once the money is in, and returns the
 * metadata as it now stands. Called by the webhook AND by the certificate
 * page: a buyer who can see a code must always be able to have it found on
 * /gift-admin, even if the webhook is misconfigured or late (validation pass
 * 1). Idempotent without an idempotency key: the code hash decides, and a key
 * would replay a transient Stripe error for 24 hours.
 */
export async function ensureIssued(stripe, session, secret, nowMs = Date.now()) {
  const pi = session.payment_intent;
  if (!pi || typeof pi !== "object") throw new Error("no payment on session " + session.id);
  const meta = { ...pi.metadata };
  if (meta.gift_code_hash) return { pi, meta };
  const code = codeFor(session.id, secret);
  const card = cardFromMeta(meta);
  const today = cincinnatiDay(nowMs);
  const toEmail = meta.gift_to_email || "";
  // A card paid on (or after) its send day goes now, not at tomorrow's run.
  const due = !meta.gift_send_on || meta.gift_send_on <= today;
  // A refund or dispute that arrived before the card was ever issued has set
  // these already: keep them, so a cancelled card can't come back (pass 3).
  const issued = {
    gift_code_hash: codeHash(code, secret),
    gift_last4: code.slice(-4),
    gift_session: session.id,
    gift_balance_cents: meta.gift_balance_cents ?? String(card.valueCents),
    gift_status: meta.gift_status || "active",
    gift_issued: today,
    gift_deliver: !toEmail ? "none" : due ? "now" : "pending",
    gift_log: appendLog(meta.gift_log, `${today} issued ${dollars(card.valueCents)}`),
  };
  await stripe.paymentIntents.update(pi.id, { metadata: issued });
  return { pi, meta: { ...meta, ...issued } };
}

/** Strips characters that can disguise text (direction overrides, zero-width marks). */
export const plain = (s) => String(s).replace(/[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, "");
