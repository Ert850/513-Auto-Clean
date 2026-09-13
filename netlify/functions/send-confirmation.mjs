import { priceFromWire, validateWire } from "./_pricing.mjs";
import { limited } from "./_ratelimit.mjs";
import { verifyTurnstile } from "./_turnstile.mjs";

/**
 * The email the customer gets, and the one Elijah gets.
 *
 * Until this existed the customer got NOTHING. They filled in nine screens,
 * agreed to terms, handed over a phone number, pressed the button and were
 * shown a page that said we would be in touch. The only email in the whole
 * system went to Elijah, through Web3Forms. Every other business they book
 * anything with sends a confirmation, so its absence reads as "did that
 * actually work".
 *
 * THE NUMBERS ARE REPRICED HERE, not taken from the request. The browser
 * sends ids; validateWire checks each one against the catalog and
 * priceFromWire recomputes with the same engine the unit tests cover. So the
 * receipt in the customer's inbox is the server's arithmetic, and it agrees
 * with the Stripe intent by construction rather than by luck.
 *
 * FAILURE IS NEVER FATAL. No key, a Resend outage, a bad address: all of it
 * comes back 200 with sent:false. The booking already reached Elijah through
 * the existing path, and a funnel that announces an email problem is a funnel
 * that loses the job it had already won.
 */

const json = (status, body) => ({
  statusCode: status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  body: JSON.stringify(body),
});

const $ = (cents) =>
  (cents < 0 ? "-$" : "$") +
  (Math.abs(cents) / 100).toFixed(2).replace(/\.00$/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/** Everything that reaches the HTML goes through this. It is all user input. */
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

function whenLabel(slot) {
  if (!slot) return null;
  return new Date(slot).toLocaleString("en-US", {
    timeZone: "America/New_York",
    weekday: "long", month: "long", day: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

/* ------------------------------------------------------------------ */
/* The emails                                                          */
/* ------------------------------------------------------------------ */

const SHELL = (title, inner) => `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f4f5f2;font:16px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#14171d">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:28px">
<p style="margin:0 0 4px;font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#c41414">513 Auto Clean</p>
<h1 style="margin:0 0 16px;font-size:24px;line-height:1.2">${title}</h1>
${inner}
<p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #e2e4df;font-size:13px;color:#5a6069">
Questions, or need to change something? Text or call
<a href="sms:+15132792915" style="color:#c41414;font-weight:700">(513) 279-2915</a>.
</p>
</div></body></html>`;

function receiptRows(priced) {
  if (!priced?.lines?.length) return "";
  const rows = priced.lines
    .map(
      (l) =>
        `<tr><td style="padding:6px 0;color:#5a6069">${esc(l.label)}</td>` +
        `<td style="padding:6px 0;text-align:right;white-space:nowrap">${$(l.amountCents)}</td></tr>`,
    )
    .join("");
  return `<table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0">
${rows}
<tr><td style="padding:10px 0 0;border-top:1px solid #e2e4df;font-weight:800">Total</td>
<td style="padding:10px 0 0;border-top:1px solid #e2e4df;text-align:right;font-weight:800">${$(priced.totalCents)}</td></tr>
</table>
<p style="margin:0;font-size:13px;color:#5a6069">Travel is worked out from your address and added when we confirm.</p>`;
}

function customerEmail({ contact, when, priced, kind }) {
  const name = esc(String(contact.name || "").split(" ")[0] || "there");

  if (kind === "inquiry" || !when) {
    return {
      subject: "We have your request, 513 Auto Clean",
      html: SHELL(
        `Thanks ${name}, we have your request`,
        `<p style="margin:0 0 14px">We will come back with a time that works, usually within a few hours.</p>
<p style="margin:0 0 14px"><strong>Nothing is booked and nothing is charged until you say yes to it.</strong></p>
${receiptRows(priced)}`,
      ),
    };
  }

  return {
    subject: `You are booked in for ${when}`,
    html: SHELL(
      `Thanks ${name}, you are booked in`,
      `<p style="margin:0 0 6px;font-size:13px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#5a6069">When</p>
<p style="margin:0 0 16px;font-size:18px;font-weight:700">${esc(when)}</p>
<p style="margin:0 0 14px">That is a start time, not how long we stay. We will text you an ETA before we set off.</p>
${receiptRows(priced)}`,
    ),
  };
}

function ownerEmail({ contact, when, priced, kind, cart }) {
  const a = cart?.address ?? {};
  const where = [a.line1, a.city, a.region, a.zip].filter(Boolean).join(", ");
  return {
    subject:
      `${kind === "inquiry" ? "REQUEST" : "BOOKING"}, ${contact.name}, ` +
      `${$(priced?.totalCents ?? 0)}${when ? `, ${when}` : ""}`,
    html: SHELL(
      kind === "inquiry" ? "New request" : "New booking",
      `<table style="width:100%;font-size:14px;border-collapse:collapse">
<tr><td style="padding:4px 0;color:#5a6069;width:90px">Who</td><td style="padding:4px 0">${esc(contact.name)}<br>${esc(contact.phone)}${contact.email ? `<br>${esc(contact.email)}` : ""}</td></tr>
<tr><td style="padding:4px 0;color:#5a6069">When</td><td style="padding:4px 0">${esc(when || "not selected, they asked us to come back with a time")}</td></tr>
<tr><td style="padding:4px 0;color:#5a6069">Where</td><td style="padding:4px 0">${esc(where || "not given")}</td></tr>
</table>
${receiptRows(priced)}`,
    ),
  };
}

/* ------------------------------------------------------------------ */

async function send(apiKey, from, to, { subject, html }, replyTo) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
  });
  if (!res.ok) {
    // The body can name the address that was refused, which is useful in a
    // log and must never reach a browser.
    console.error("resend", res.status, (await res.text()).slice(0, 300));
    return false;
  }
  return true;
}

export async function handler(event) {
  if (event?.httpMethod !== "POST") return json(405, { error: "POST only" });

  // This endpoint sends mail to an address in its own request body, so it is
  // the one place on the site that could be leaned on as a relay. The limit
  // is deliberately tighter than the payment endpoint's, the recipient is
  // only ever the single validated contact address, every field is escaped
  // into a fixed template, and Elijah is copied on all of it so abuse is
  // visible on the first attempt rather than the thousandth. Switch on
  // Turnstile before this sees real traffic.
  if (limited(event, "send-confirmation", 6)) return json(429, { error: "slow_down" });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return json(200, { sent: false, reason: "unconfigured" });

  const from = process.env.RESEND_FROM || "513 Auto Clean <onboarding@resend.dev>";
  const owner = process.env.OWNER_EMAIL || "elijahthackerllc@gmail.com";

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "bad_json" });
  }

  const bot = await verifyTurnstile(payload?.turnstileToken, event);
  if (bot) return json(400, { error: bot });

  const mode = payload?.mode === "pay_now" ? "pay_now" : "card_only";
  const checked = validateWire(payload, { nowMs: Date.now(), mode });
  if (!checked.ok) return json(400, { error: checked.error });
  const { cart, contact, kind, payInFull } = checked.booking;

  const priced = priceFromWire(cart, { nowMs: Date.now(), payInFull });
  const when = whenLabel(cart.slot);
  const ctx = { contact, when, priced, kind, cart };

  // Elijah's copy first. If only one of the two can get through, it has to be
  // the one that means the job happens.
  const toOwner = await send(apiKey, from, owner, ownerEmail(ctx), contact.email);
  const toCustomer = contact.email ? await send(apiKey, from, contact.email, customerEmail(ctx)) : false;

  return json(200, { sent: toOwner || toCustomer, owner: toOwner, customer: toCustomer });
}
