/**
 * "Help us get ready" answers, onto the booking's own calendar event
 * (November 11). The Done screen's tap, outlet, parking, vehicle and notes
 * answers used to reach only the owner's inbox, so a detailer (Kris) never
 * saw them with the job. This adds them to the event the booking wrote, on
 * whichever calendar it went to, under one heading that a later send
 * replaces rather than repeats.
 *
 * Not a way to edit someone else's booking: the request must name the
 * booking key the event was written with AND the phone number it was booked
 * under (kept privately on the event), within three days of the booking.
 * Every miss gets the same answer, it only ever touches the AFTER BOOKING
 * part of an event this site wrote, and it is rate limited per client.
 *
 * The owner's follow-up email still goes from the browser as before; this
 * runs alongside it.
 */
import { limited } from "./_ratelimit.mjs";
import { usPhone } from "./cart-capture.mjs";
import { detailerFor } from "./_detailers.mjs";
import { gcalConfigured, findBookingEvent, setEventDescription } from "./_gcal.mjs";

const MARKER = "AFTER BOOKING (Help us get ready)";
const WINDOW_MS = 3 * 86_400_000;
const ANSWER = { yes: "yes", no: "no", unsure: "not sure" };

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

/** The answers as event lines, or "" when there are none. */
export function followupSection(payload) {
  const a = payload?.access ?? {};
  const lines = [];
  if (ANSWER[a.water]) lines.push(`  Outdoor tap: ${ANSWER[a.water]}`);
  if (ANSWER[a.power]) lines.push(`  Outdoor outlet: ${ANSWER[a.power]}`);
  const parking = text(a.parking, 300);
  if (parking) lines.push(`  Parking: ${parking}`);
  const labels = (Array.isArray(payload?.labels) ? payload.labels : []).slice(0, 6).map((l) => text(l, 80));
  labels.forEach((l, i) => { if (l) lines.push(`  Vehicle${labels.length > 1 ? ` ${i + 1}` : ""}: ${l}`); });
  const notes = text(payload?.notes, 500);
  if (notes) lines.push(`  Notes: ${notes}`);
  return lines.length ? `${MARKER}\n${lines.join("\n")}` : "";
}

/** The description with this section in place of any earlier one. */
export function withSection(description, section) {
  const base = String(description ?? "");
  const at = base.indexOf(MARKER);
  const head = (at < 0 ? base : base.slice(0, at)).replace(/\s+$/, "");
  return `${head}\n\n${section}`;
}

export async function handler(event) {
  if (event?.httpMethod !== "POST") return json(405, { error: "POST only" });
  if (limited(event, "booking-followup", 6)) return json(429, { error: "slow_down" });

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "bad_json" });
  }

  const key = text(payload?.key, 120);
  const phone = usPhone(payload?.phone);
  const slot = Number(payload?.slot);
  if (!/^[\w-]{6,120}$/.test(key) || !phone || !Number.isFinite(slot)) return json(400, { error: "bad_request" });

  const section = followupSection(payload);
  if (!section) return json(200, { saved: false, reason: "nothing_to_add" });
  if (!gcalConfigured()) return json(200, { saved: false, reason: "unconfigured" });

  const detailer = detailerFor(payload?.detailer);
  const calendarId = detailer ? detailer.bookingsCalendarId : "";
  const found = await findBookingEvent({ key, calendarId, aroundMs: slot }).catch(() => null);
  const created = Date.parse(found?.created ?? "");
  // One answer for every miss, so it says nothing about which part was wrong.
  if (!found || found.extendedProperties?.private?.phone !== phone || !(Date.now() - created < WINDOW_MS)) {
    return json(200, { saved: false, reason: "not_found" });
  }

  const r = await setEventDescription({ calendarId, eventId: found.id, description: withSection(found.description, section) })
    .catch(() => ({ ok: false, reason: "threw" }));
  return json(200, r.ok ? { saved: true } : { saved: false, reason: r.reason });
}
