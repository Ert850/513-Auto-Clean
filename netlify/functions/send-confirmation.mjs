import { priceFromWire, validateWire, findPackage, findAddon, vehicleSize } from "./_pricing.mjs";
import { createBookingEvent, gcalConfigured } from "./_gcal.mjs";
import { measuredOneWayMinutes } from "./_routes.mjs";
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
 * IT ALSO WRITES THE JOB ONTO THE CALENDAR, which is the thing that stops
 * the same afternoon being sold twice. Until now a booking lived in an inbox
 * and nowhere else: Elijah read the email and typed it into his calendar by
 * hand, which works until the evening he does not, and then the site offers
 * that slot to somebody else. The scheduler already treats any non-OPEN event
 * as busy, so writing the job IS closing the slot.
 *
 * FAILURE IS NEVER FATAL. No key, a Resend outage, a calendar not shared with
 * the service account: all of it comes back 200 with the detail of what did
 * and did not happen. The booking already reached Elijah through the existing
 * path, and a funnel that announces an email problem is a funnel that loses
 * the job it had already won.
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

/**
 * Free text from the browser: notes, parking, access answers.
 *
 * validateWire deliberately drops these. It is the gate that decides what a
 * booking COSTS, and free text cannot change a price, so it has no business
 * passing through it. But the calendar event and the email both want it, so
 * it is taken from the raw payload here, capped, and stripped of anything
 * that is not printable. It reaches an inbox and a calendar we own, and
 * nothing else.
 */
function text(v, max) {
  return String(v ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, " ")
    .trim()
    .slice(0, max);
}

const ACCESS = { yes: "yes", no: "no", unsure: "not sure" };

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

/**
 * The job, written out the way Elijah reads it at seven in the morning.
 *
 * Everything he needs before setting off, in the order he needs it: where he
 * is going, who he is meeting, what he is doing, what he is owed, and what to
 * expect when he gets there.
 */
function eventDescription({ contact, cart, priced, extras, payInFull }) {
  const a = cart.address ?? {};
  const lines = [];

  lines.push(`WHO  ${contact.name}  ${contact.phone}${contact.email ? `  ${contact.email}` : ""}`);
  lines.push(`WHERE  ${[a.line1, a.city, a.region, a.zip].filter(Boolean).join(", ")}`);
  lines.push("");

  for (const [i, v] of (cart.vehicles ?? []).entries()) {
    const size = v.sizeId ? vehicleSize(v.sizeId) : null;
    const pkgs = (v.packageIds ?? []).map((id) => findPackage(id)?.name).filter(Boolean);
    lines.push(
      `VEHICLE ${i + 1}  ${v.label || "(not named)"}${size ? `  [${size.label}]` : ""}`,
    );
    if (pkgs.length) lines.push(`  ${pkgs.join(" + ")}`);
    for (const ad of v.addons ?? []) {
      const def = findAddon(ad.addonId);
      const tier = def?.tiers.find((t) => t.id === ad.tierId);
      if (def) lines.push(`  + ${def.name}${tier && def.tiers.length > 1 ? `, ${tier.label}` : ""}`);
    }
  }

  lines.push("");
  lines.push("PRICE");
  for (const l of priced.lines ?? []) lines.push(`  ${l.label}: ${$(l.amountCents)}`);
  lines.push(`  TOTAL: ${$(priced.totalCents)}`);
  lines.push(`  ${payInFull ? "PAID IN FULL online" : "TO COLLECT on the day"}`);
  lines.push(`  Travel: added at confirmation, not in the figure above`);
  lines.push(`  On site: about ${Math.round((priced.serviceDurationMin ?? 0) / 60 * 10) / 10} hours`);

  lines.push("");
  lines.push("ON ARRIVAL");
  lines.push(`  Outdoor tap: ${ACCESS[extras.water] ?? "not answered"}`);
  lines.push(`  Outdoor outlet: ${ACCESS[extras.power] ?? "not answered"}`);
  if (extras.parking) lines.push(`  Parking: ${extras.parking}`);
  if (extras.notes) lines.push(`  Notes: ${extras.notes}`);
  if (extras.locationNote) lines.push(`  ** NEEDS A LOCATION SORTED ** ${extras.locationNote}`);

  return lines.join("\n");
}

async function writeCalendar({ contact, cart, priced, extras, payInFull, key }) {
  if (!gcalConfigured()) return { ok: false, reason: "unconfigured" };
  if (!cart.slot) return { ok: false, reason: "no_slot" };

  const names = (cart.vehicles ?? [])
    .flatMap((v) => (v.packageIds ?? []).map((id) => findPackage(id)?.name))
    .filter(Boolean);

  return createBookingEvent({
    summary: `${names.join(" + ") || "Detail"}, ${contact.name}`,
    description: eventDescription({ contact, cart, priced, extras, payInFull }),
    location: [cart.address?.line1, cart.address?.city, cart.address?.region, cart.address?.zip]
      .filter(Boolean)
      .join(", "),
    startMs: cart.slot,
    endMs: cart.slot + (priced.serviceDurationMin ?? 120) * 60_000,
    key,
  });
}

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

  /*
   * MEASURED, not estimated. This line used to read
   * `priceFromWire(cart, { nowMs, payInFull })` with no drive time, so the
   * confirmation email quietly priced travel off the ZIP band while the
   * screen and the card both used the real drive. A Mason booking read $30
   * in the inbox and $20 everywhere else.
   */
  const measured = await measuredOneWayMinutes(cart);
  const priced = priceFromWire(cart, {
    measuredOneWayMinutes: measured,
    nowMs: Date.now(),
    payInFull,
  });
  const when = whenLabel(cart.slot);
  const ctx = { contact, when, priced, kind, cart };

  const rawCart = payload?.cart ?? {};
  const rawAccess = rawCart.access ?? {};
  const extras = {
    water: text(rawAccess.water, 10),
    power: text(rawAccess.power, 10),
    parking: text(rawAccess.parking, 300),
    notes: text(rawCart.notes ?? payload?.notes, 500),
    locationNote: text(rawCart.locationNote, 300),
  };

  // THE CALENDAR FIRST. It is the half that stops the slot being sold again,
  // and it is the half nobody can reconstruct from memory at 11pm.
  const calendar =
    kind === "inquiry"
      ? { ok: false, reason: "inquiry" }
      : await writeCalendar({
          contact, cart, priced, extras, payInFull,
          key: text(payload?.idempotencyKey, 120),
        }).catch((err) => {
          console.error("calendar write", err);
          return { ok: false, reason: "threw" };
        });

  if (!apiKey) {
    return json(200, { sent: false, reason: "unconfigured", calendar });
  }

  // Elijah's copy first. If only one of the two can get through, it has to be
  // the one that means the job happens.
  const toOwner = await send(apiKey, from, owner, ownerEmail(ctx), contact.email);
  const toCustomer = contact.email ? await send(apiKey, from, contact.email, customerEmail(ctx)) : false;

  return json(200, { sent: toOwner || toCustomer, owner: toOwner, customer: toCustomer, calendar });
}
