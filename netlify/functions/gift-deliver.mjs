import Stripe from "stripe";
import { cincinnatiDay } from "./_pricing.mjs";
import { GIFT_KIND, appendLog, cardFromMeta, codeFor, giftSecret, siteUrl } from "./_giftcards.mjs";
import { recipientEmail, sendMail } from "./_giftmail.mjs";
import { issue } from "./gift-webhook.mjs";

/**
 * Sends the cards that were scheduled for a later day (gift_deliver "pending")
 * once that day has come in Cincinnati. Runs every hour from 8 AM to 6 PM
 * (netlify.toml [functions."gift-deliver"]), so a busy morning (Christmas)
 * that doesn't finish in one run finishes in the next, and stops itself well
 * inside a function's time limit. Scheduled functions run only on the
 * published site, never on a preview.
 *
 * A card whose email fails is tried again each hour; after MAX_TRIES it is
 * marked "failed" and Elijah is told once, rather than every hour forever.
 */
export const MAX_TRIES = 3;
/** One at a time, a little apart: Resend allows only a few sends a second (validation pass 3). */
const GAP_MS = 600;
const BUDGET_MS = 20_000;
const STRANDED_MS = 15 * 60_000;

export async function deliverDue(stripe, secret, nowMs = Date.now(), mail, startMs = Date.now(), gapMs = GAP_MS) {
  const today = cincinnatiDay(nowMs);
  const out = { sent: 0, failed: 0, busy: 0, gaveUp: [], waiting: 0, stopped: false };
  // One search, then each card re-read by id before it is sent: search can
  // trail a change by a minute, and an earlier run (or a resend) may have sent it.
  // Also "now" cards left unsent: recorded by the certificate page while the
  // webhook never came, so nobody emailed them (validation pass 2). Given the
  // webhook a quarter of an hour first.
  const found = [];
  for (const state of ["pending", "now"]) {
    let page;
    do {
      page = await stripe.paymentIntents.search({
        query: `metadata['gift_deliver']:'${state}'`,
        limit: 100,
        ...(page?.next_page ? { page: page.next_page } : {}),
      });
      found.push(...page.data.filter((p) => state === "pending" || (p.created || 0) * 1000 < nowMs - STRANDED_MS).map((p) => p.id));
    } while (page.has_more && page.next_page);
  }

  const one = async (id) => {
    const pi = await stripe.paymentIntents.retrieve(id);
    const m = pi?.metadata || {};
    if (m.kind !== GIFT_KIND || !["pending", "now"].includes(m.gift_deliver) || m.gift_mail_to === "1") return;
    if (m.gift_deliver === "pending" && (!m.gift_send_on || m.gift_send_on > today)) { out.waiting++; return; }
    // A cancelled card isn't sent. A disputed one waits: if the dispute is
    // won, it goes out then (validation pass 2).
    if (m.gift_status === "disputed") { out.waiting++; return; }
    if (m.gift_status === "void") {
      await stripe.paymentIntents.update(pi.id, { metadata: { gift_deliver: "cancelled" } });
      return;
    }
    const code = codeFor(m.gift_session, secret);
    const link = `${siteUrl()}/gift-certificate#s=${encodeURIComponent(m.gift_session)}`;
    const result = await mail(m.gift_to_email, recipientEmail({ card: cardFromMeta(m), code, link }));
    // Busy (rate limited, Resend down): the next hour tries again, and it doesn't count.
    if (result === "busy") { out.busy++; return; }
    if (result === "ok" || result === true) {
      await stripe.paymentIntents.update(pi.id, { metadata: { gift_deliver: "sent", gift_mail_to: "1", gift_log: appendLog(m.gift_log, `${today} emailed to them`) } });
      out.sent++;
      return;
    }
    const tries = (Number(m.gift_deliver_tries) || 0) + 1;
    const gaveUp = tries >= MAX_TRIES;
    await stripe.paymentIntents.update(pi.id, {
      metadata: gaveUp
        ? { gift_deliver: "failed", gift_deliver_tries: String(tries), gift_log: appendLog(m.gift_log, `${today} email to them failed ${tries} times`) }
        : { gift_deliver_tries: String(tries) },
    });
    out.failed++;
    if (gaveUp) out.gaveUp.push(`${m.gift_last4 || "?"} (${m.gift_to_email})`);
  };

  for (let i = 0; i < found.length; i++) {
    if (Date.now() - startMs > BUDGET_MS) { out.stopped = true; break; }
    await one(found[i]);
    if (i < found.length - 1) await new Promise((r) => setTimeout(r, gapMs));
  }
  return out;
}

/**
 * Cards the webhook never handled: recorded by the certificate page, but with
 * no email to the buyer or to Elijah after a quarter of an hour. That means
 * Stripe's webhook isn't reaching the site (a wrong STRIPE_WEBHOOK_SECRET, a
 * test endpoint, a missing event): send what it would have, and tell Elijah
 * once to check it (pre-merge pass).
 */
export async function catchUp(stripe, secret, nowMs = Date.now(), startMs = Date.now(), gapMs = GAP_MS) {
  const since = Math.floor(nowMs / 1000) - 7 * 86_400;
  const page = await stripe.paymentIntents.search({
    query: `metadata['kind']:'giftcard' AND -metadata['gift_mail_owner']:'1' AND created>${since}`,
    limit: 50,
  });
  // Checked here too: search can trail a change by a minute. Cancelled or
  // disputed cards send nothing, so they'd come back every hour: skipped.
  const stranded = page.data.filter((p) => {
    const m = p.metadata || {};
    return m.gift_code_hash && m.gift_session && m.gift_mail_owner !== "1" && m.gift_status !== "void" && m.gift_status !== "disputed" && (p.created || 0) * 1000 < nowMs - STRANDED_MS;
  });
  let done = 0;
  for (const pi of stranded) {
    if (Date.now() - startMs > BUDGET_MS) break;
    try {
      await issue(stripe, pi.metadata.gift_session, secret, nowMs, "The webhook didn't finish for this card (it may not be reaching the site: check its signing secret, STRIPE_WEBHOOK_SECRET, and its events in Stripe), so the hourly run sent these emails.");
      done++;
    } catch (err) {
      console.error("gift-deliver catch-up", String(err?.message || err).slice(0, 200));
    }
    await new Promise((r) => setTimeout(r, gapMs));
  }
  return done;
}

export async function handler() {
  const key = process.env.STRIPE_SECRET_KEY;
  const secret = giftSecret();
  const apiKey = process.env.RESEND_API_KEY;
  if (!key || !secret || !apiKey) return { statusCode: 200, body: "not configured" };
  const from = process.env.RESEND_FROM || "513 Auto Clean <onboarding@resend.dev>";
  const owner = process.env.OWNER_EMAIL || "elijahthackerllc@gmail.com";
  const mail = (to, msg) => sendMail(apiKey, from, to, msg);
  try {
    const stripe = new Stripe(key);
    const out = await deliverDue(stripe, secret, Date.now(), mail);
    // After the scheduled sends, and on its own: a failure here must never
    // stop Christmas morning's cards (final pre-merge pass).
    try {
      out.caught = await catchUp(stripe, secret);
    } catch (err) {
      console.error("gift-deliver catch-up search", String(err?.message || err).slice(0, 200));
    }
    if (out.gaveUp.length) {
      await sendMail(apiKey, from, owner, {
        subject: `CHECK: ${out.gaveUp.length} gift card email(s) couldn't be delivered`,
        html: `<p>These scheduled cards couldn't be emailed to the person they're for, after ${MAX_TRIES} tries. The address may be wrong. Look them up at /gift-admin and resend to the buyer, who can pass the card on:</p><p>${out.gaveUp.map((g) => g.replace(/[<>&]/g, "")).join("<br>")}</p>`,
      });
    }
    console.log("gift-deliver", JSON.stringify({ ...out, gaveUp: out.gaveUp.length }));
    return { statusCode: 200, body: "ok" };
  } catch (err) {
    console.error("gift-deliver", String(err?.message || err).slice(0, 300));
    return { statusCode: 500, body: "failed" };
  }
}
