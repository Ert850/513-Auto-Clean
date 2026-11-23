import Stripe from "stripe";
import { cincinnatiDay } from "./_pricing.mjs";
import { GIFT_KIND, appendLog, cardFromMeta, codeFor, codeHash, dollars, giftSecret, siteUrl } from "./_giftcards.mjs";
import { buyerEmail, ownerEmail, recipientEmail } from "./_giftmail.mjs";
import { send } from "./send-confirmation.mjs";

/**
 * Stripe's webhook for gift cards: the only place a card is issued.
 *
 * Signed (STRIPE_WEBHOOK_SECRET), so nobody can claim a payment that didn't
 * happen: the lesson of the booking form's trusted "paid in full" (P1). Every
 * step is idempotent: the code is derived from the session (_giftcards.mjs),
 * the issue writes the same metadata every time, and each email is marked
 * sent on the payment once it goes, so a webhook delivered twice, or retried
 * after a failure, never makes a second card or a second email.
 *
 * Events (set these on the endpoint in Stripe):
 *   checkout.session.completed, checkout.session.async_payment_succeeded: issue
 *   charge.refunded: a full refund voids what is left on the card
 *   charge.dispute.created: the card is frozen until Elijah looks at it
 */

const reply = (status, text) => ({ statusCode: status, headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" }, body: text });

function mailer() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || "513 Auto Clean <onboarding@resend.dev>";
  return apiKey ? (to, msg) => send(apiKey, from, to, msg) : null;
}
const owner = () => process.env.OWNER_EMAIL || "elijahthackerllc@gmail.com";

/** Issue the card for a paid session, then send whatever hasn't been sent. */
export async function issue(stripe, sessionId, secret, nowMs = Date.now()) {
  const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["payment_intent"] });
  if (session?.metadata?.kind !== GIFT_KIND) return "not a gift card";
  if (session.payment_status !== "paid") return "not paid yet";
  const pi = session.payment_intent;
  if (!pi || typeof pi !== "object") throw new Error("no payment on session " + sessionId);

  const code = codeFor(session.id, secret);
  let meta = { ...pi.metadata };
  const card = cardFromMeta(meta);
  if (!meta.gift_code_hash) {
    const toEmail = meta.gift_to_email || "";
    const issued = {
      gift_code_hash: codeHash(code, secret),
      gift_last4: code.slice(-4),
      gift_session: session.id,
      gift_balance_cents: String(card.valueCents),
      gift_status: "active",
      gift_issued: cincinnatiDay(nowMs),
      // Who still needs it: "pending" waits for gift_send_on (gift-deliver.mjs).
      gift_deliver: !toEmail ? "none" : meta.gift_send_on ? "pending" : "now",
      gift_log: `${cincinnatiDay(nowMs)} issued ${dollars(card.valueCents)}`,
    };
    // Same parameters every time for this session, so a retry is the same request.
    await stripe.paymentIntents.update(pi.id, { metadata: issued }, { idempotencyKey: `gift-issue-${session.id}` });
    meta = { ...meta, ...issued };
  }

  const mail = mailer();
  const link = `${siteUrl()}/gift-certificate#s=${encodeURIComponent(session.id)}`;
  const payCents = Number(meta.gift_pay_cents) || session.amount_total || 0;
  const buyer = session.customer_details?.email || "";
  const toEmail = meta.gift_to_email || "";
  const marks = {};
  const problems = [];
  const sendOnce = async (flag, to, msg) => {
    if (meta[flag] === "1" || !to) return;
    if (mail && (await mail(to, msg))) marks[flag] = "1";
    else problems.push(`${flag.replace("gift_mail_", "")} email not sent${mail ? "" : " (no RESEND_API_KEY)"}`);
  };
  await sendOnce("gift_mail_buyer", buyer, buyerEmail({ card: cardFromMeta(meta), code, link, payCents, toEmail }));
  if (meta.gift_deliver === "now") {
    await sendOnce("gift_mail_to", toEmail, recipientEmail({ card: cardFromMeta(meta), code, link }));
    if (marks.gift_mail_to) marks.gift_deliver = "sent";
  }
  await sendOnce("gift_mail_owner", owner(), ownerEmail({
    card: cardFromMeta(meta), code, payCents, buyer, toEmail, problem: problems.join("; ") || (buyer ? "" : "Stripe gave no buyer email: send the card yourself."),
  }));
  if (Object.keys(marks).length) await stripe.paymentIntents.update(pi.id, { metadata: marks });
  // A failed email is retried by Stripe (the 500 below); what was sent stays marked.
  if (problems.length) throw new Error(problems.join("; "));
  return "issued";
}

/** A refund or a dispute on a gift card's payment. */
export async function settle(stripe, charge, kind, nowMs = Date.now()) {
  if (!charge?.payment_intent) return "no payment";
  const pi = await stripe.paymentIntents.retrieve(typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent.id);
  if (pi?.metadata?.kind !== GIFT_KIND) return "not a gift card";
  const card = cardFromMeta(pi.metadata);
  const day = cincinnatiDay(nowMs);
  let metadata;
  if (kind === "dispute") {
    metadata = { gift_status: "disputed", gift_log: appendLog(card.log, `${day} frozen: payment disputed`) };
  } else if (charge.amount_refunded >= charge.amount) {
    metadata = { gift_status: "void", gift_balance_cents: "0", gift_log: appendLog(card.log, `${day} void: refunded`) };
  } else {
    metadata = { gift_log: appendLog(card.log, `${day} partly refunded ${dollars(charge.amount_refunded)}: balance not changed`) };
  }
  await stripe.paymentIntents.update(pi.id, { metadata });
  const mail = mailer();
  if (mail) {
    await mail(owner(), {
      subject: `CHECK: gift card ${kind === "dispute" ? "payment disputed" : "refunded"}, code ending ${pi.metadata.gift_last4 || "?"}`,
      html: `<p>${kind === "dispute" ? "The card is frozen until you look at it." : charge.amount_refunded >= charge.amount ? "The card is void." : "Partly refunded: the card's balance was not changed. Adjust it at /gift-admin if needed."} ${dollars(card.valueCents)} card, balance before: ${dollars(card.balanceCents ?? 0)}.</p>`,
    });
  }
  return metadata.gift_status || "logged";
}

export async function handler(event) {
  if (event?.httpMethod !== "POST") return reply(405, "POST only");
  const key = process.env.STRIPE_SECRET_KEY;
  const whsec = process.env.STRIPE_WEBHOOK_SECRET;
  const secret = giftSecret();
  if (!key || !whsec || !secret) return reply(503, "not configured");

  const stripe = new Stripe(key);
  const raw = event.isBase64Encoded ? Buffer.from(event.body || "", "base64") : event.body || "";
  const sig = event.headers?.["stripe-signature"] || event.headers?.["Stripe-Signature"];
  let ev;
  try {
    ev = stripe.webhooks.constructEvent(raw, sig, whsec);
  } catch {
    return reply(400, "bad signature");
  }

  try {
    const o = ev.data?.object;
    let result = "ignored";
    if (ev.type === "checkout.session.completed" || ev.type === "checkout.session.async_payment_succeeded") {
      result = await issue(stripe, o.id, secret);
    } else if (ev.type === "charge.refunded") {
      result = await settle(stripe, o, "refund");
    } else if (ev.type === "charge.dispute.created") {
      result = await settle(stripe, { payment_intent: o.payment_intent }, "dispute");
    }
    return reply(200, result);
  } catch (err) {
    console.error("gift-webhook", ev.type, String(err?.message || err).slice(0, 300));
    return reply(500, "retry");
  }
}
