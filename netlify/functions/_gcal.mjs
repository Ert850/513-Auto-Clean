import crypto from "node:crypto";

/**
 * Writing a booking onto the Google Calendar.
 *
 * Until now a booking existed in an inbox and nowhere else. Elijah read the
 * email and typed the job into his calendar by hand, which is fine until the
 * evening he does not, and then the site cheerfully offers that afternoon to
 * somebody else. The scheduler already treats any non-OPEN event as busy, so
 * writing the job onto the calendar is also what closes the slot.
 *
 * AUTH IS A SERVICE ACCOUNT, not OAuth. Nobody is present when this runs, so
 * there is no one to consent; a service account is a machine identity with
 * its own key, and the calendar is shared with its email address the same way
 * it would be shared with a person.
 *
 * The signing is done here rather than with googleapis, which is a large
 * dependency for one JWT. Node's crypto signs RS256 directly.
 *
 * EVERYTHING DEGRADES. No key, no calendar id, a Google outage: all of it
 * comes back {ok:false} with a reason, and the caller carries on. A booking
 * that reached the inbox and not the calendar is recoverable by hand. A
 * booking refused because Google was briefly unreachable is lost.
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/calendar.events";
export const TIME_ZONE = "America/New_York";

function serviceAccount() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const j = JSON.parse(raw);
    if (!j.client_email || !j.private_key) return null;
    // Netlify's UI turns a pasted newline into the two characters \ and n, so
    // the key arrives as one line and openssl refuses it with a message about
    // PEM routines that tells you nothing.
    return { email: j.client_email, key: String(j.private_key).replace(/\\n/g, "\n") };
  } catch {
    return null;
  }
}

/** The calendar jobs are written to. Defaults to the one already being read. */
function bookedCalendarId() {
  return (
    process.env.GOOGLE_BOOKED_CALENDAR_ID ||
    process.env.GOOGLE_CALENDAR_ID ||
    "75726fed82aa92a27201386beda7b3a15f550a3a5691e5e6cfc51382f0f0b9cf@group.calendar.google.com"
  );
}

export function gcalConfigured() {
  return Boolean(serviceAccount() && bookedCalendarId());
}

const b64 = (s) => Buffer.from(s).toString("base64url");

/** Tokens last an hour; a warm container reuses one rather than minting 50. */
let cached = null;

async function accessToken() {
  const sa = serviceAccount();
  if (!sa) return null;
  if (cached && cached.expires > Date.now() + 60_000) return cached.token;

  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: sa.email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${b64(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64(JSON.stringify(claim))}`;
  const signature = crypto.createSign("RSA-SHA256").update(unsigned).end().sign(sa.key).toString("base64url");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`,
    }),
  });
  if (!res.ok) {
    console.error("gcal token", res.status, (await res.text()).slice(0, 300));
    return null;
  }
  const j = await res.json();
  if (!j.access_token) return null;
  cached = { token: j.access_token, expires: Date.now() + (j.expires_in ?? 3600) * 1000 };
  return cached.token;
}

/**
 * Put a booking on the calendar.
 *
 * `summary` MUST NOT begin with OPEN. That prefix is what the scheduler reads
 * as "this is bookable time", so a job titled OPEN would open its own hours
 * back up, which is the exact opposite of the point. Guarded below rather
 * than left to a comment nobody reads.
 */
export async function createBookingEvent({
  summary,
  description,
  location,
  startMs,
  endMs,
  key,
}) {
  if (!gcalConfigured()) return { ok: false, reason: "unconfigured" };
  if (!startMs || !endMs || endMs <= startMs) return { ok: false, reason: "bad_times" };

  const token = await accessToken();
  if (!token) return { ok: false, reason: "auth_failed" };

  const title = /^open/i.test(String(summary).trim()) ? `Booking: ${summary}` : String(summary);

  const body = {
    summary: title.slice(0, 200),
    description: String(description ?? "").slice(0, 7000),
    location: String(location ?? "").slice(0, 300),
    start: { dateTime: new Date(startMs).toISOString(), timeZone: TIME_ZONE },
    end: { dateTime: new Date(endMs).toISOString(), timeZone: TIME_ZONE },
    // Busy, explicitly. A "free" event is discarded by the reader, which
    // would leave the job invisible to the scheduler that wrote it.
    transparency: "opaque",
    // The booking key, so a retry can be recognised as the same job rather
    // than written twice.
    ...(key ? { extendedProperties: { private: { bookingKey: String(key).slice(0, 120) } } } : {}),
  };

  const url =
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(bookedCalendarId())}/events`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    // Google's message names the problem: notFound when the calendar has not
    // been shared with the service account, forbidden when it is shared read
    // only. Both are one click to fix and impossible to guess at.
    console.error("gcal insert", res.status, (await res.text()).slice(0, 400));
    return { ok: false, reason: `http_${res.status}` };
  }
  const j = await res.json();
  return { ok: true, id: j.id ?? null, link: j.htmlLink ?? null };
}
