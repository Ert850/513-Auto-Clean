import Stripe from "stripe";
import { cincinnatiDay } from "./_pricing.mjs";
import { GIFT_KIND, appendLog, cardFromMeta, codeFor, codeHash, dollars, giftSecret, sameSecret, siteUrl } from "./_giftcards.mjs";
import { buyerEmail, recipientEmail } from "./_giftmail.mjs";
import { send } from "./send-confirmation.mjs";
import { limited } from "./_ratelimit.mjs";

/**
 * Elijah's gift card tool (/gift-admin): look a card up by its code, take an
 * amount off it when a detail is paid with it, void it, or resend it.
 *
 * Behind GIFT_ADMIN_KEY (a long secret only Elijah has; compared in constant
 * time). Every change is written to the card's payment in Stripe with the
 * day, the amount and the note, so the history can't quietly drift from the
 * money. Each change carries the page's own request id as its idempotency
 * key, and the id is kept on the card (gift_last_req): a double tap, or a
 * retry after a lost answer, takes the amount once.
 *
 * Before any change the card is read again by id, not from the search result:
 * search can trail a change by a minute. Stripe has no compare-and-set, so two
 * devices changing the SAME card in the same second could still race; this is
 * a one-person tool and the page says so (validation pass 1).
 */

const json = (status, body) => ({
  statusCode: status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  body: JSON.stringify(body),
});

const REQUEST_ID = /^[A-Za-z0-9_-]{8,64}$/;

/** The card's payment, found by its code; null when there is none (yet). */
export async function findCard(stripe, code, secret) {
  const hash = codeHash(code, secret);
  if (!hash) return { error: "bad_code" };
  const found = await stripe.paymentIntents.search({ query: `metadata['gift_code_hash']:'${hash}'`, limit: 2 });
  const pi = found.data.find((p) => p.metadata?.kind === GIFT_KIND && p.metadata?.gift_code_hash === hash);
  return pi ? { pi } : { error: "not_found" };
}

const view = (pi) => {
  const c = cardFromMeta(pi.metadata);
  return { ...c, last4: pi.metadata.gift_last4 || "", issued: pi.metadata.gift_issued || "", toEmail: pi.metadata.gift_to_email || "", deliver: pi.metadata.gift_deliver || "" };
};

export async function handler(event) {
  if (event?.httpMethod !== "POST") return json(405, { error: "POST only" });
  // Tight: this is the one endpoint where guessing is the attack.
  if (limited(event, "gift-admin", 20)) return json(429, { error: "slow_down" });
  const key = process.env.STRIPE_SECRET_KEY;
  const secret = giftSecret();
  const adminKey = process.env.GIFT_ADMIN_KEY;
  if (!key || !secret || !adminKey || adminKey.length < 16) return json(503, { error: "unconfigured" });

  let p;
  try {
    p = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "bad_json" });
  }
  if (!sameSecret(p?.key, adminKey)) return json(401, { error: "wrong_key" });

  const stripe = new Stripe(key);
  try {
    const hit = await findCard(stripe, p.code, secret);
    if (hit.error) return json(hit.error === "bad_code" ? 400 : 404, { error: hit.error });
    const pi = await stripe.paymentIntents.retrieve(hit.pi.id);
    const card = cardFromMeta(pi.metadata);
    const day = cincinnatiDay(Date.now());
    const note = typeof p.note === "string" ? p.note.replace(/[;\u0000-\u001f]+/g, " ").trim().slice(0, 60) : "";

    if (p.action === "lookup") return json(200, { card: view(pi) });

    if (!REQUEST_ID.test(p.requestId || "")) return json(400, { error: "bad_request_id" });
    // Already done (the answer to the first try was lost): say so, change nothing.
    if (pi.metadata.gift_last_req === p.requestId) return json(200, { card: view(pi), repeated: true });
    const idem = { idempotencyKey: `gift-admin-${pi.id}-${p.requestId}` };
    const req = { gift_last_req: p.requestId };

    if (p.action === "redeem") {
      const amount = p.amountCents;
      if (!Number.isInteger(amount) || amount <= 0) return json(400, { error: "bad_amount" });
      if (card.status !== "active") return json(409, { error: "not_active", card: view(pi) });
      if (amount > card.balanceCents) return json(409, { error: "too_much", card: view(pi) });
      const balance = card.balanceCents - amount;
      const metadata = {
        gift_balance_cents: String(balance),
        gift_status: balance === 0 ? "used" : "active",
        gift_log: appendLog(card.log, `${day} used ${dollars(amount)}${note ? ` (${note})` : ""}, left ${dollars(balance)}`),
        ...req,
      };
      const updated = await stripe.paymentIntents.update(pi.id, { metadata }, idem);
      return json(200, { card: view(updated) });
    }

    if (p.action === "void") {
      const metadata = { gift_status: "void", gift_balance_cents: "0", gift_log: appendLog(card.log, `${day} voided${note ? ` (${note})` : ""}`), ...req };
      const updated = await stripe.paymentIntents.update(pi.id, { metadata }, idem);
      return json(200, { card: view(updated) });
    }

    if (p.action === "resend") {
      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey) return json(503, { error: "no_email" });
      const session = await stripe.checkout.sessions.retrieve(pi.metadata.gift_session);
      const code = codeFor(session.id, secret);
      const link = `${siteUrl()}/gift-certificate#s=${encodeURIComponent(session.id)}`;
      const toRecipient = p.to === "recipient";
      const to = toRecipient ? pi.metadata.gift_to_email : session.customer_details?.email;
      if (!to) return json(400, { error: "no_address" });
      const msg = toRecipient
        ? recipientEmail({ card, code, link })
        : buyerEmail({ card, code, link, payCents: Number(pi.metadata.gift_pay_cents) || pi.amount, toEmail: pi.metadata.gift_to_email || "" });
      const from = process.env.RESEND_FROM || "513 Auto Clean <onboarding@resend.dev>";
      if (!(await send(apiKey, from, to, msg))) return json(502, { error: "email_failed" });
      const metadata = { gift_log: appendLog(card.log, `${day} resent to the ${toRecipient ? "recipient" : "buyer"}`), ...req };
      // Sent to them now: the scheduled run must not send it again.
      if (toRecipient) Object.assign(metadata, { gift_deliver: "sent", gift_mail_to: "1" });
      const updated = await stripe.paymentIntents.update(pi.id, { metadata }, idem);
      return json(200, { card: view(updated) });
    }

    return json(400, { error: "bad_action" });
  } catch (err) {
    console.error("gift-admin", err?.type, String(err?.message || "").slice(0, 200));
    return json(502, { error: "stripe" });
  }
}
