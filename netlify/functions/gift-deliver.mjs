import Stripe from "stripe";
import { cincinnatiDay } from "./_pricing.mjs";
import { GIFT_KIND, cardFromMeta, codeFor, giftSecret, siteUrl } from "./_giftcards.mjs";
import { recipientEmail } from "./_giftmail.mjs";
import { send } from "./send-confirmation.mjs";

/**
 * Sends the cards that were scheduled for a later day (gift_deliver "pending"),
 * once that day has come in Cincinnati. Runs every morning (netlify.toml
 * [functions."gift-deliver"]); scheduled functions run only on the published
 * site, never on a preview.
 *
 * Found through Stripe's search, which can lag a minute behind a change:
 * harmless here, as a card is only ever due on a later day than it was bought.
 */
export async function deliverDue(stripe, secret, nowMs = Date.now(), mail) {
  const today = cincinnatiDay(nowMs);
  const out = { sent: 0, failed: 0, waiting: 0 };
  let page;
  do {
    page = await stripe.paymentIntents.search({
      query: `metadata['gift_deliver']:'pending'`,
      limit: 100,
      ...(page?.next_page ? { page: page.next_page } : {}),
    });
    for (const pi of page.data) {
      const m = pi.metadata || {};
      if (m.kind !== GIFT_KIND || m.gift_deliver !== "pending") continue;
      if (!m.gift_send_on || m.gift_send_on > today) { out.waiting++; continue; }
      // A refunded or disputed card isn't sent.
      if (m.gift_status === "void" || m.gift_status === "disputed") {
        await stripe.paymentIntents.update(pi.id, { metadata: { gift_deliver: "cancelled" } });
        continue;
      }
      const code = codeFor(m.gift_session, secret);
      const link = `${siteUrl()}/gift-certificate#s=${encodeURIComponent(m.gift_session)}`;
      if (await mail(m.gift_to_email, recipientEmail({ card: cardFromMeta(m), code, link }))) {
        await stripe.paymentIntents.update(pi.id, { metadata: { gift_deliver: "sent", gift_mail_to: "1" } });
        out.sent++;
      } else {
        out.failed++;
      }
    }
  } while (page.has_more && page.next_page);
  return out;
}

export async function handler() {
  const key = process.env.STRIPE_SECRET_KEY;
  const secret = giftSecret();
  const apiKey = process.env.RESEND_API_KEY;
  if (!key || !secret || !apiKey) return { statusCode: 200, body: "not configured" };
  const from = process.env.RESEND_FROM || "513 Auto Clean <onboarding@resend.dev>";
  const owner = process.env.OWNER_EMAIL || "elijahthackerllc@gmail.com";
  const mail = (to, msg) => send(apiKey, from, to, msg);
  try {
    const out = await deliverDue(new Stripe(key), secret, Date.now(), mail);
    if (out.failed) {
      await mail(owner, { subject: `CHECK: ${out.failed} scheduled gift card email(s) didn't send`, html: "<p>They'll be tried again tomorrow morning. Look them up at /gift-admin to send them yourself today.</p>" });
    }
    console.log("gift-deliver", JSON.stringify(out));
    return { statusCode: 200, body: JSON.stringify(out) };
  } catch (err) {
    console.error("gift-deliver", String(err?.message || err).slice(0, 300));
    return { statusCode: 500, body: "failed" };
  }
}
