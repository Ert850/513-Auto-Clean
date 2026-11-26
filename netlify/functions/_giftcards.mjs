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
import { GIFT_CARDS, cincinnatiDay, expiresOn } from "./_pricing.mjs";

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

/** A Deploy Preview of this site, as a request's Host header names it. */
const PREVIEW_HOST = /^deploy-preview-\d+--513-auto-clean\.netlify\.app$/;

/** The Host header of a function's request, or "". */
export const requestHost = (event) => String(event?.headers?.host || event?.headers?.Host || "").trim().toLowerCase();

/**
 * The site's own address for links in emails and Stripe's return: this deploy's, so a preview links to itself.
 * `host` is the request's Host header. It wins only when it is one of this
 * site's Deploy Previews: DEPLOY_PRIME_URL doesn't reach a function at run
 * time, so a test purchase on Deploy Preview 13 came back to the live domain's
 * 404 (November 26). Any other host falls through to the settings below.
 */
export function siteUrl(env = process.env, host = "") {
  if (PREVIEW_HOST.test(host)) return `https://${host}`;
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
    // The last day it can be used, fixed when it was sold (gift_expires); a
    // card issued before expiry dates were written gets its date from the day
    // it was issued. "" until issued.
    expires: m.gift_expires || (m.gift_issued ? expiresOn(m.gift_issued, GIFT_CARDS.expiryYears) : ""),
  };
}

/** Past its last day, as of Cincinnati day `today`. */
export const isExpired = (card, today) => !!card.expires && today > card.expires;

/** "December 1, 2031": the date a card is good through, as the page, the emails and the terms say it. */
export const longDate = (iso) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

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
    gift_expires: meta.gift_expires || expiresOn(today, GIFT_CARDS.expiryYears),
    gift_deliver: !toEmail ? "none" : due ? "now" : "pending",
    gift_log: appendLog(meta.gift_log, `${today} issued ${dollars(card.valueCents)}`),
  };
  await stripe.paymentIntents.update(pi.id, { metadata: issued });
  return { pi, meta: { ...meta, ...issued } };
}

/**
 * Why a card can't be emailed to someone from its page now (gift-send.mjs),
 * or null when it can: only while it's active and unexpired, within
 * config/gift-cards.json sendWindowHours of the session (Stripe's `created`),
 * and once: never when it has someone already (bought with a recipient, or
 * sent from the page before). The certificate page gets only true or false.
 */
export function sendRefusal(session, meta, nowMs, hours = GIFT_CARDS.sendWindowHours) {
  const card = cardFromMeta(meta);
  if (meta.gift_to_email || meta.gift_send_req || meta.gift_mail_to === "1") return "already_sent";
  if (isExpired(card, cincinnatiDay(nowMs))) return "expired";
  if (card.status !== "active") return "not_active";
  const by = sendDeadline(session, hours);
  if (!by || nowMs > by) return "too_late";
  return null;
}

/** The moment the card's page stops offering to send it (ms), from the session's creation; null without one. */
export function sendDeadline(session, hours = GIFT_CARDS.sendWindowHours) {
  const at = Number(session?.created);
  return at > 0 ? at * 1000 + hours * 3_600_000 : null;
}

/**
 * How long a "now" card claimed by the card's page (gift-send.mjs writes
 * gift_send_started) is left to that page before the webhook or the hourly
 * run sends it themselves. The page sends within seconds; if it emailed but
 * couldn't mark the card sent, this keeps the others from emailing it again.
 * If it never sent, the hourly run picks it up after this. Not said to
 * customers.
 */
export const SEND_CLAIM_HOLD_MS = 10 * 60_000;
export const claimedByPage = (meta, nowMs) => {
  const at = Number(meta?.gift_send_started);
  return at > 0 && nowMs - at < SEND_CLAIM_HOLD_MS;
};

/** Strips characters that can disguise text (direction overrides, zero-width marks). */
export const plain = (s) => String(s).replace(/[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, "");
