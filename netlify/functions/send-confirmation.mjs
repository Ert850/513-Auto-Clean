import { priceFromWire, validateWire, findPackage, findAddon, vehicleSize, isLive, ADVICE_HOLD_MIN, businessPhone, multiDayEvents, LONG_JOB_STARTS, CORRECTION_RULES } from "./_pricing.mjs";
import { blockFeeFor, detailerFor, homeFor, timeFeeWaived } from "./_detailers.mjs";
import { createBookingEvent, findBookingEvent, gcalAuthMode, gcalConfigured } from "./_gcal.mjs";
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

// The number in every email: BUSINESS_PHONE in Netlify, else today's number
// (config/business.json), the same as the pages (A2P plan T1). A bad value
// stops the build, so it cannot normally get this far.
const PHONE = (() => {
  // A bad value only fails the build if it is also in the Builds scope; in
  // the Functions scope alone it threw at load and no booking could be sent
  // (final review, November 13). Fall back to the repo number and say so.
  try {
    return businessPhone();
  } catch (e) {
    console.error("BUSINESS_PHONE", String(e).slice(0, 200));
    return businessPhone("");
  }
})();

// `preview` is the inbox preview line (the grey text under the subject). Hidden
// in the email itself; the padding stops mail apps filling the rest of the
// line with body text.
const SHELL = (title, inner, preview = "") => `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f4f5f2;font:16px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#14171d">
${preview ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:transparent">${esc(preview)}${"&#847;&zwnj;&nbsp;".repeat(60)}</div>` : ""}
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:28px">
<p style="margin:0 0 4px;font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#c41414">513 Auto Clean</p>
<h1 style="margin:0 0 16px;font-size:24px;line-height:1.2">${title}</h1>
${inner}
<p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #e2e4df;font-size:13px;color:#5a6069">
Questions, or need to change something? Text or call
<a href="sms:${PHONE.e164}" style="color:#c41414;font-weight:700">${PHONE.display}</a>.
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
${
    priced.lines.some((l) => /travel/i.test(l.label))
      // It is already a line in the table above, measured from the address at
      // the hour picked. Saying it will be "added when we confirm" underneath
      // a table that already added it is how a customer starts wondering what
      // else is going to appear.
      ? `<p style="margin:0;font-size:13px;color:#5a6069">Travel is the measured drive from us to you at the time you picked, and it is in the total above.</p>`
      : `<p style="margin:0;font-size:13px;color:#5a6069">Travel is worked out from your address and added when we confirm.</p>`
  }`;
}

function customerEmail({ contact, when, priced, kind, slot, textsOk, flex, asked, calendarOk = true }) {
  const name = esc(String(contact.name || "").split(" ")[0] || "there");

  if (kind === "inquiry" || !when) {
    return {
      subject: "We have your request, 513 Auto Clean",
      html: SHELL(
        `Thanks ${name}, we have your request`,
        `${asked ? `<p style="margin:0 0 14px">You asked for ${esc(asked)}.</p>` : ""}<p style="margin:0 0 14px">${
          flex
            ? "We confirm the day with you, usually within a few hours, and let you know the start time by the evening before."
            : "We will come back with a time that works, usually within a few hours."
        }</p>
<p style="margin:0 0 14px"><strong>Nothing is booked and nothing is charged until you say yes to it.</strong></p>
${receiptRows(priced)}`,
      ),
    };
  }

  /*
   * CONFIRMED MEANS CONFIRMED.
   *
   * The time was taken off a live calendar and a job has been written back
   * onto it, so the slot is gone for everybody else. Telling that customer
   * we will "come back to confirm" makes them sit waiting for an email that
   * is never coming, and some of them will book somebody else instead.
   *
   * The one honest exception is a booking made inside a day of the
   * appointment. The calendar says the hour is free, and it is, but nobody
   * may have looked at a phone between the booking and the van needing to
   * leave. That gets a line saying so rather than a blanket hedge on every
   * booking.
   */
  const soon = slot !== null && slot - Date.now() < 24 * 60 * 60 * 1000;
  // Short notice is a request until a detailer accepts it, as the booking
  // form says (owner, November 10; session audit, November 11: this email
  // used to tell the same customer it was "confirmed and booked in").
  // And only when the calendar write worked: a failed write leaves the time
  // sellable, so it is a request until Elijah puts it on by hand (final
  // review, November 13: it said "booked in" with nothing on the calendar).
  const confirmed = isLive("liveCalendar") && !soon && calendarOk;

  /*
   * A HELD TIME WITH NO PRICE ON IT.
   *
   * They pressed "help me decide", so the appointment is real and the
   * package is not. Both halves have to be said, in that order: the thing
   * that is settled first, so the email reads as a confirmation rather than
   * as a loose end, then the thing that is still open and when it closes.
   *
   * There is no receipt, because priced.lines is empty, and receiptRows()
   * already returns nothing for that. A total of $0.00 would be worse than
   * no total at all.
   */
  const advice = kind === "advice";

  const opening = advice
    ? `<p style="margin:0 0 14px">Your time is <strong>${confirmed ? "held" : "requested"}</strong>. What we have not settled yet is which detail you want, which is the part you asked us about.</p>` +
      `<p style="margin:0 0 14px">We will work that out with you: from what you have told us if there is enough to go on, otherwise on the day, looking at the vehicle together. <strong>You hear the price before we start anything</strong>, and if none of it is worth it to you we will leave and there is nothing to pay.</p>`
    : confirmed
      ? `<p style="margin:0 0 14px">This is <strong>confirmed and booked in</strong>. Nothing else is needed from you, and there is nothing left to accept.</p>`
      : `<p style="margin:0 0 14px">We will confirm this with you shortly, usually within a few hours. Treat the time as requested until you hear back.</p>`;

  const shortNotice = soon && !advice
    ? `<p style="margin:0 0 14px;padding:10px 12px;background:#fdf3e3;border-radius:8px;font-size:14px">` +
      `This is short notice, so it is a request until a detailer accepts it. We will reply as fast as ` +
      `we can, and nothing is charged either way.</p>`
    : "";

  return {
    subject: advice
      ? `Your time is held for ${when}`
      : soon
        ? `We have your short-notice request for ${when}`
        : confirmed
          ? `Booked in for ${when}`
          : `We have your booking for ${when}`,
    html: SHELL(
      advice
        ? `Thanks ${name}, your time is held`
        : soon
          ? `Thanks ${name}, we have your request`
          : confirmed
            ? `Thanks ${name}, you are booked in`
            : `Thanks ${name}, we have your booking`,
      `${opening}${shortNotice}<p style="margin:0 0 6px;font-size:13px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#5a6069">When</p>
<p style="margin:0 0 16px;font-size:18px;font-weight:700">${esc(when)}</p>
<p style="margin:0 0 14px">That is a start time, not how long we stay: we arrive within the hour after it. ${textsOk ? "We will text you an ETA before we set off." : "If anything changes we will call or email you."}</p>
${
  advice
    ? `<p style="margin:0 0 14px">We have set aside <strong>${Math.round(ADVICE_HOLD_MIN / 60)} hours</strong>, which covers our longest single-vehicle detail. If what you pick needs less, we finish earlier and you pay less.</p>`
    : ""
}${receiptRows(priced)}`,
    ),
  };
}

/**
 * The days and parts of the day a request asked for, from the raw cart (the
 * pricing check does not carry them), or "" (validation, November 11: the
 * owner's email said only "not selected", so nobody could reply with a time).
 */
export function askedFor(prefer) {
  if (!prefer || typeof prefer !== "object") return "";
  const days = (Array.isArray(prefer.days) ? prefer.days : [])
    // The booking form writes days unpadded ("2026-12-3"); \d{2} dropped every
    // single-digit month or day from the email (final review, November 13).
    .filter((d) => /^\d{4}-\d{1,2}-\d{1,2}$/.test(String(d))).slice(0, 14)
    .map((d) => {
      const [y, m, day] = String(d).split("-").map(Number);
      return new Date(Date.UTC(y, m - 1, day, 12)).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" });
    });
  const parts = (Array.isArray(prefer.parts) ? prefer.parts : [])
    .map((x) => String(x).replace(/[^a-z -]/gi, "").slice(0, 20)).filter(Boolean).slice(0, 4);
  if (!days.length && !parts.length) return "";
  return [days.join(", "), prefer.flex === true ? "any start that day" : parts.join(", ")].filter(Boolean).join("; ");
}

function ownerEmail({ contact, when, priced, kind, cart, detailer, asked, notes, calendarFail = "" }) {
  const a = cart?.address ?? {};
  const where = [a.line1, a.city, a.region, a.zip].filter(Boolean).join(", ");
  const soon = kind === "booking" && cart?.slot && cart.slot - Date.now() < 24 * 60 * 60 * 1000;
  return {
    subject:
      // "HELP ME DECIDE" first, because it is the one that needs something
      // from him before the day rather than just turning up.
      `${calendarFail ? "NOT ON THE CALENDAR, " : ""}${kind === "advice" ? "HELP ME DECIDE" : kind === "inquiry" ? "REQUEST" : soon ? "SHORT NOTICE REQUEST" : "BOOKING"}, ${contact.name}, ` +
      `${kind === "advice" ? "no package yet" : $(priced?.totalCents ?? 0)}${when ? `, ${when}` : ""}`,
    // Elijah's inbox preview (November 13): price, job, date and time, place.
    html: ((title, inner) => SHELL(title, inner, [
      kind === "advice" ? "Help me decide" : $(priced?.totalCents ?? 0),
      (cart?.vehicles ?? []).flatMap((v) => (v.packageIds ?? []).map((id) => findPackage(id)?.name)).filter(Boolean).join(" + ") ||
        (kind === "advice" ? "package to work out" : ""),
      when || (asked ? `asked for ${asked}` : "no time yet"),
      [a.city, a.zip].filter(Boolean).join(" "),
    ].filter(Boolean).join(" · ")))(
      kind === "advice"
        ? cart?.slot ? "Time held, package to work out" : "Help me decide, no time yet"
        : kind === "inquiry" ? "New request" : soon ? "Short-notice request, not confirmed until you accept it" : "New booking",
      (calendarFail
        ? `<p style="margin:0 0 14px;padding:10px 12px;background:#fdecea;border-left:3px solid #c62828;color:#7f1d1d"><strong>NOT ON THE CALENDAR</strong> (${esc(calendarFail)}). The time is still open to other customers: add it by hand now.</p>`
        : "") +
      `<table style="width:100%;font-size:14px;border-collapse:collapse">
<tr><td style="padding:4px 0;color:#5a6069;width:90px">Who</td><td style="padding:4px 0">${esc(contact.name)}<br>${esc(contact.phone)}${contact.email ? `<br>${esc(contact.email)}` : ""}</td></tr>
<tr><td style="padding:4px 0;color:#5a6069">When</td><td style="padding:4px 0">${esc(when || (asked ? `asked for ${asked}` : "not selected, they asked us to come back with a time"))}</td></tr>
<tr><td style="padding:4px 0;color:#5a6069">Where</td><td style="padding:4px 0">${esc(where || "not given")}</td></tr>
${detailer ? `<tr><td style="padding:4px 0;color:#5a6069">Detailer</td><td style="padding:4px 0">${esc(detailer.name)}</td></tr>` : ""}
</table>
${
  kind === "advice"
    ? `<p style="margin:16px 0 0;padding:10px 12px;background:#fdf3e3;border-radius:8px;font-size:14px">` +
      `<strong>They have not picked a package.</strong> ` +
      (cart?.slot
        ? `${Math.round(ADVICE_HOLD_MIN / 60)} hours are blocked on the calendar. Read what they wrote about the vehicle, and either come back with a recommendation beforehand or work it out on the driveway.`
        : `Nothing is held. Come back with a package, its price and a time from the days they asked for.`) +
      `</p>`
    : ""
}${notes ? `<p style="margin:16px 0 0;font-size:14px"><strong>What they wrote:</strong> ${esc(notes)}</p>` : ""}${receiptRows(priced)}`,
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
/*
 * Elijah's Accounting sheet reads these events every hour (JobsSync.gs, an
 * Apps Script): the TOTAL and "Sales tax" lines, the SOURCE and HEARD ABOUT
 * US blocks, the ZIP at the end of the location, and "Name:" at the start of
 * the title. jobs-sync-contract.test.ts holds his patterns; change the format
 * and that test fails, so tell him first.
 */
export function eventDescription({ contact, cart, priced, extras, payInFull, kind }) {
  const a = cart.address ?? {};
  const lines = [];

  if (kind === "advice") {
    lines.push("** HELP ME DECIDE. No package chosen. Price to agree before starting. **");
    lines.push("");
  }

  lines.push(`WHO  ${contact.name}  ${contact.phone}${contact.email ? `  ${contact.email}` : ""}`);
  lines.push(`WHERE  ${[a.line1, a.city, a.region, a.zip].filter(Boolean).join(", ")}`);
  lines.push("");

  for (const [i, v] of (cart.vehicles ?? []).entries()) {
    const size = v.sizeId ? vehicleSize(v.sizeId) : null;
    const pkgs = (v.packageIds ?? []).map((id) => findPackage(id)?.name).filter(Boolean);
    lines.push(
      `VEHICLE ${i + 1}${v.label ? `  ${v.label}` : ""}${size ? `  [${size.label}]` : ""}`,
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
  if (kind === "advice") {
    lines.push("  Nothing priced yet. Agree it with them before starting.");
    lines.push(`  Holding ${Math.round(ADVICE_HOLD_MIN / 60)} hours.`);
  } else {
    for (const l of priced.lines ?? []) lines.push(`  ${l.label}: ${$(l.amountCents)}`);
    lines.push(`  TOTAL: ${$(priced.totalCents)}`);
    lines.push(`  ${payInFull ? "PAID IN FULL online" : "TO COLLECT on the day"}`);
    // Travel is a line above when the drive was measured (validation,
    // November 11: this said "not in the figure above" even then).
    if (!(priced.lines ?? []).some((l) => /travel/i.test(l.label))) lines.push(`  Travel: added once the drive is measured, not in the figure above`);
    lines.push(`  On site: about ${Math.round((priced.serviceDurationMin ?? 0) / 60 * 10) / 10} hours`);
  }

  lines.push("");
  lines.push("ON ARRIVAL");
  // Asked after booking now, so usually blank here: say where the answers go
  // rather than "not answered" (validation, November 11).
  if (ACCESS[extras.water]) lines.push(`  Outdoor tap: ${ACCESS[extras.water]}`);
  if (ACCESS[extras.power]) lines.push(`  Outdoor outlet: ${ACCESS[extras.power]}`);
  if (!ACCESS[extras.water] && !ACCESS[extras.power] && !extras.parking) lines.push("  Tap, outlet and parking: asked after booking; any answers reach the owner by email (BOOKING FOLLOW-UP).");
  if (extras.parking) lines.push(`  Parking: ${extras.parking}`);
  if (extras.notes) lines.push(`  Notes: ${extras.notes}`);
  if (extras.locationNote) lines.push(`  ** NEEDS A LOCATION SORTED ** ${extras.locationNote}`);
  if (extras.source) lines.push("", "SOURCE", `  ${extras.source}`);
  if (extras.experiments) lines.push("", "A/B TESTS", `  ${extras.experiments}`);
  if (extras.heard) lines.push("", "HEARD ABOUT US", `  ${extras.heard}`);

  return lines.join("\n");
}

/** The event title (read by JobsSync too: "Kris:" names the detailer). */
export function eventTitle({ kind, slotMs, nowMs, detailer, names, contactName }) {
  return (kind === "booking" && slotMs - nowMs < 24 * 60 * 60 * 1000 ? "SHORT NOTICE, accept or decline: " : "") +
    (detailer ? `${detailer.name}: ` : "") + (kind === "advice"
    ? `HELP ME DECIDE, ${contactName}`
    : `${names.join(" + ") || "Detail"}, ${contactName}`);
}

/**
 * The events a booking writes: one for a job that fits a day, and one per
 * working day for a longer one (review, November 13: a two day job used to be
 * one event from Saturday 8am to Sunday 4am, so Sunday's real hours stayed
 * bookable). Day 1 is the booking as always, with the TOTAL and everything
 * JobsSync reads; days 2 and on are titled "Day N of M" and carry no TOTAL,
 * so the job is counted once (jobs-sync-contract.test.ts).
 */
export function bookingEvents({ contact, cart, priced, extras, payInFull, kind, detailer, nowMs, measuredMin }) {
  const names = (cart.vehicles ?? [])
    .flatMap((v) => (v.packageIds ?? []).map((id) => findPackage(id)?.name))
    .filter(Boolean);
  /*
   * A "help me decide" visit has no package, so it has no duration, and
   * `?? 120` did not save it: zero is not null, so the event would have ended
   * the moment it started and Google would have refused it outright. It holds
   * the same block the customer was offered on the booking screen.
   */
  const minutes = priced.serviceDurationMin || (kind === "advice" ? ADVICE_HOLD_MIN : 120);
  const location = [cart.address?.line1, cart.address?.city, cart.address?.region, cart.address?.zip]
    .filter(Boolean)
    .join(", ");
  const title = eventTitle({ kind, slotMs: cart.slot, nowMs, detailer, names, contactName: contact.name });
  const description = eventDescription({ contact, cart, priced, extras, payInFull, kind });

  // The same plan the booking form showed: the measured drive, else 30
  // minutes (travelAllowanceMin), and the correction start times.
  const corr = (cart.vehicles ?? []).some((v) => v.correction);
  const days = kind === "booking"
    ? multiDayEvents({
        slotMs: cart.slot,
        serviceMinutes: minutes,
        travelMin: Number.isFinite(measuredMin) ? measuredMin : 30,
        preferredStartsMin: corr ? CORRECTION_RULES.allowedStartsMin : LONG_JOB_STARTS,
      })
    : null;

  if (!days) {
    return [{
      // The title is what Elijah reads at a glance on a phone, so it says the
      // thing he needs to know before setting off: nobody has chosen yet.
      // A short-notice time is a request until someone accepts it, and the
      // calendar says so too (validation, November 11).
      summary: title,
      description,
      location,
      startMs: cart.slot,
      // To the planned arrival plus the work: a start late in its arrival window
      // ends that much later, and the next job is spaced from this end.
      endMs: cart.slot + ((cart.arrivalLateMin || 0) + minutes) * 60_000,
    }];
  }
  const n = days.length;
  return days.map((d, i) => i === 0
    ? {
        summary: title,
        description: `${description}\n\nDAYS\n  Day 1 of ${n}. This job runs over ${n} days in a row; each day is its own event, and only this one carries the total.`,
        location,
        startMs: d.startMs,
        endMs: d.endMs + (cart.arrivalLateMin || 0) * 60_000,
      }
    : {
        summary: `${detailer ? `${detailer.name}: ` : ""}Day ${i + 1} of ${n}, ${names.join(" + ") || "Detail"}, ${contact.name}`,
        description: `Day ${i + 1} of ${n} of ${contact.name}'s booking. The total, the contact details and the notes are on day 1.`,
        location,
        startMs: d.startMs,
        endMs: d.endMs,
      });
}

async function writeCalendar({ contact, cart, priced, extras, payInFull, key, kind, detailer, measuredMin }) {
  if (!gcalConfigured()) return { ok: false, reason: "unconfigured" };
  if (!cart.slot) return { ok: false, reason: "no_slot" };

  const events = bookingEvents({ contact, cart, priced, extras, payInFull, kind, detailer, nowMs: Date.now(), measuredMin });
  const phone = String(contact.phone ?? "").replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  const calendarId = detailer ? detailer.bookingsCalendarId : "";
  // A retry of the same booking (Confirm pressed again after an error) finds
  // the event the first try wrote, by its booking key, and stops there
  // (final review, November 13: two events and four emails).
  if (key) {
    const existing = await findBookingEvent({ key, calendarId, aroundMs: cart.slot }).catch(() => null);
    if (existing) return { ok: true, id: existing.id, duplicate: true };
  }
  const first = await createBookingEvent({ ...events[0], key, phone, calendarId });
  if (!first.ok) return first;
  // Days 2 and on: their own key, so day 1 stays the one a follow-up finds.
  for (let i = 1; i < events.length; i++) {
    const r = await createBookingEvent({ ...events[i], key: key ? `${key}:day${i + 1}` : key, phone, calendarId });
    if (!r.ok) return { ...first, ok: false, reason: `day${i + 1}_${r.reason}` };
  }
  return events.length > 1 ? { ...first, days: events.length } : first;
}

async function send(apiKey, from, to, { subject, html }, replyTo) {
  let res;
  try {
    res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
    });
  } catch (e) {
    // A network failure used to throw a 500 after the calendar was written,
    // skipping the customer's email (final review, November 13).
    console.error("resend network", String(e).slice(0, 200));
    return false;
  }
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
  // Who the time was given to, as THIS server knows them (DETAILERS). Their
  // no-fee hours (Kris at 6 to 7pm) are applied here too, so the receipt in
  // the email matches the price the customer saw, and the drive is measured
  // from their home (DETAILER_HOMES).
  const detailer = detailerFor(payload?.detailer, cart);
  const measured = await measuredOneWayMinutes(cart, homeFor(detailer));
  const priced = priceFromWire(cart, {
    measuredOneWayMinutes: measured,
    nowMs: Date.now(),
    payInFull,
    timeOfDayWaived: timeFeeWaived(detailer, cart.slot),
    blockFeeBp: await blockFeeFor(detailer, cart.slot, payload?.timeFeeBp),
  });
  const when = whenLabel(cart.slot);
  const ctx = { contact, when, priced, kind, cart, slot: cart.slot ?? null, detailer, textsOk: payload?.consent?.sms === true };

  const rawCart = payload?.cart ?? {};
  const rawAccess = rawCart.access ?? {};
  const extras = {
    water: text(rawAccess.water, 10),
    power: text(rawAccess.power, 10),
    parking: text(rawAccess.parking, 300),
    notes: text(rawCart.notes ?? payload?.notes, 500),
    locationNote: text(rawCart.locationNote, 300),
    // The tagged link they arrived through (a magazine QR code), for ROI.
    source: text(payload?.source, 120),
    // Which A/B test versions they saw (config/experiments.json), "golf-code: code".
    experiments: text(payload?.experiments, 200),
    // Their answer to "Where did you hear about us?" on the checkout.
    heard: text(payload?.heard, 60),
  };
  ctx.asked = cart.slot ? "" : askedFor(rawCart.prefer);
  ctx.flex = !cart.slot && rawCart.prefer?.flex === true;
  ctx.notes = extras.notes;

  // THE CALENDAR FIRST. It is the half that stops the slot being sold again,
  // and it is the half nobody can reconstruct from memory at 11pm.
  const calendar =
    kind === "inquiry"
      ? { ok: false, reason: "inquiry" }
      : await writeCalendar({
          contact, cart, priced, extras, payInFull, kind,
          key: text(payload?.idempotencyKey, 120),
          detailer,
          measuredMin: measured,
        }).catch((err) => {
          console.error("calendar write", err);
          return { ok: false, reason: "threw" };
        });

  // The auth mode rides along on every booking. A calendar failure is much
  // easier to read when the reply says WHICH way in was being used.
  const calendarOut = { ...calendar, auth: gcalAuthMode() };

  if (calendar.duplicate) {
    return json(200, { sent: false, duplicate: true, calendar: calendarOut });
  }
  if (!apiKey) {
    return json(200, { sent: false, reason: "unconfigured", calendar: calendarOut });
  }
  ctx.calendarOk = kind === "inquiry" || calendar.ok === true;
  ctx.calendarFail = kind === "inquiry" || calendar.ok ? "" : String(calendar.reason || "write failed");

  // Elijah's copy first. If only one of the two can get through, it has to be
  // the one that means the job happens.
  const toOwner = await send(apiKey, from, owner, ownerEmail(ctx), contact.email);
  const toCustomer = contact.email ? await send(apiKey, from, contact.email, customerEmail(ctx)) : false;

  return json(200, { sent: toOwner || toCustomer, owner: toOwner, customer: toCustomer, calendar: calendarOut });
}
