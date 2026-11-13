/**
 * A checkout left part way (owner, November 10, round 15: "capture now, send
 * via GHL later").
 *
 * The booking form calls this once, when someone who has typed their name and
 * a phone number or email at the top of the checkout leaves without booking
 * (they close the form, or the page). It emails the owner what they had
 * picked, so nothing is lost while GoHighLevel is not connected. When GHL is
 * connected, its "you did not finish your booking" reminder takes this over;
 * that part is not built yet, because it cannot be tested without the keys.
 *
 * Disclosed in the privacy policy (capability `checkoutFollowUp`), and the
 * form only calls this while that capability is live.
 *
 * Never a relay: the only recipient is the owner's own address, and requests
 * are rate limited per client.
 */
import { limited } from "./_ratelimit.mjs";

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify(body),
  };
}

function text(v, max) {
  return String(v ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, " ")
    .trim()
    .slice(0, max);
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

/** Ten US digits, or "" when it is not a phone number. */
export function usPhone(raw) {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  return d.length === 10 && !/^[01]/.test(d) ? d : "";
}

export function validEmail(raw) {
  const e = text(raw, 120);
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) ? e : "";
}

/** What the owner needs to follow up, or null when there is no way to reach them. */
export function captureFrom(payload) {
  const name = text(payload?.contact?.name, 80);
  const phone = usPhone(payload?.contact?.phone);
  const email = validEmail(payload?.contact?.email);
  if (!name || (!phone && !email)) return null;
  return {
    name,
    phone,
    email,
    picked: text(payload?.summary, 1200),
    left: text(payload?.reason, 40),
    source: text(payload?.source, 120),
    heard: text(payload?.heard, 60),
  };
}

function ownerEmail(c) {
  const phoneLine = c.phone
    ? `<a href="tel:+1${c.phone}">(${c.phone.slice(0, 3)}) ${c.phone.slice(3, 6)}-${c.phone.slice(6)}</a>`
    : "none given";
  return {
    subject: `Unfinished booking: ${c.name}`,
    html:
      `<p><strong>${esc(c.name)}</strong> reached checkout and left without booking.</p>` +
      `<p>Phone: ${phoneLine}<br>Email: ${c.email ? esc(c.email) : "none given"}</p>` +
      (c.picked ? `<p><strong>What they had picked</strong></p><pre style="font:inherit;white-space:pre-wrap">${esc(c.picked)}</pre>` : "") +
      (c.heard ? `<p>Heard about us: ${esc(c.heard)}</p>` : "") +
      (c.source ? `<p>Arrived through: ${esc(c.source)}</p>` : "") +
      `<p style="color:#666">One follow-up only. They have not agreed to marketing messages.</p>`,
  };
}

export async function handler(event) {
  if (event?.httpMethod !== "POST") return json(405, { error: "POST only" });
  if (limited(event, "cart-capture", 4)) return json(429, { error: "slow_down" });

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "bad_json" });
  }

  const capture = captureFrom(payload);
  if (!capture) return json(200, { captured: false, reason: "no_contact" });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return json(200, { captured: false, reason: "unconfigured" });
  const from = process.env.RESEND_FROM || "513 Auto Clean <onboarding@resend.dev>";
  const owner = process.env.OWNER_EMAIL || "elijahthackerllc@gmail.com";

  const { subject, html } = ownerEmail(capture);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [owner], subject, html, ...(capture.email ? { reply_to: capture.email } : {}) }),
  });
  if (!res.ok) {
    console.error("resend", res.status, (await res.text()).slice(0, 300));
    return json(200, { captured: false, reason: "send_failed" });
  }
  return json(200, { captured: true });
}
