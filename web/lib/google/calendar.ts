import { google } from "googleapis";
import type { Interval } from "../availability/slots.js";

/**
 * Google Calendar, two-calendar model.
 *
 *   513 Availability  read only. Elijah creates recurring OPEN events from the
 *                     phone app. Only events whose title starts with OPEN count
 *                     as capacity, so personal events can sit on the same
 *                     calendar without breaking anything.
 *   513 Booked Jobs   write. The system mirrors confirmed bookings here.
 *
 * Auth is a service account with each calendar shared to its address. No OAuth
 * consent screen, no verification review, and no refresh token that silently
 * rots after six months of inactivity.
 */

const AVAILABILITY_PREFIX = "OPEN";

export interface CalendarConfig {
  serviceAccountJson: string;
  availabilityCalendarId: string;
  bookedCalendarId: string;
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): CalendarConfig | null {
  const serviceAccountJson = env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const availabilityCalendarId = env.GOOGLE_CALENDAR_AVAILABILITY_ID;
  const bookedCalendarId = env.GOOGLE_CALENDAR_BOOKED_ID;
  if (!serviceAccountJson || !availabilityCalendarId || !bookedCalendarId) return null;
  return { serviceAccountJson, availabilityCalendarId, bookedCalendarId };
}

function client(cfg: CalendarConfig) {
  const creds = JSON.parse(cfg.serviceAccountJson);
  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });
  return google.calendar({ version: "v3", auth });
}

/**
 * OPEN blocks in a window.
 *
 * `singleEvents: true` is essential: Google expands recurrence server side, so
 * we never have to implement RRULE. That alone saves about a week of work and
 * an entire category of bugs.
 */
export async function fetchOpenBlocks(
  cfg: CalendarConfig,
  fromMs: number,
  toMs: number,
): Promise<Interval[]> {
  const cal = client(cfg);
  const res = await cal.events.list({
    calendarId: cfg.availabilityCalendarId,
    timeMin: new Date(fromMs).toISOString(),
    timeMax: new Date(toMs).toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 2500,
  });

  const out: Interval[] = [];
  for (const e of res.data.items ?? []) {
    const title = (e.summary ?? "").trim().toUpperCase();
    if (!title.startsWith(AVAILABILITY_PREFIX)) continue;
    const start = e.start?.dateTime ?? e.start?.date;
    const end = e.end?.dateTime ?? e.end?.date;
    if (!start || !end) continue;
    out.push({ start: new Date(start).getTime(), end: new Date(end).getTime() });
  }
  return out;
}

export interface BookedEventInput {
  ref: string;
  startsAt: Date;
  endsAt: Date;
  customerName: string;
  customerPhone: string;
  addressText: string;
  vehicles: string[];
  services: string[];
  totalCents: number;
  depositPaidCents: number;
  provisional: boolean;
  locationNote?: string | null;
  customerNotes?: string | null;
}

/**
 * Mirror a booking onto the Booked Jobs calendar.
 *
 * Written only AFTER the database row is committed. Google is downstream and
 * never the arbiter of whether a slot is taken: the database holds the
 * exclusion constraint, Google holds a copy Elijah can read on his phone.
 */
export async function upsertBookedEvent(
  cfg: CalendarConfig,
  b: BookedEventInput,
  existingEventId?: string | null,
): Promise<string> {
  const cal = client(cfg);
  const money = (c: number) => "$" + (c / 100).toFixed(2);

  const summary =
    (b.provisional ? "[UNPAID] " : "") +
    `${b.customerName} ${b.vehicles.join(", ") || "vehicle"} ${money(b.totalCents)}`;

  const description = [
    `Ref: ${b.ref}`,
    b.provisional
      ? "NOT RESERVED. No deposit yet, this slot can still be taken."
      : `Deposit paid: ${money(b.depositPaidCents)}`,
    "",
    `Phone: ${b.customerPhone}`,
    `Address: ${b.addressText}`,
    b.locationNote ? `Location help needed: ${b.locationNote}` : null,
    "",
    "Services:",
    ...b.services.map((s) => `  ${s}`),
    "",
    `Total: ${money(b.totalCents)}`,
    b.customerNotes ? `\nNotes: ${b.customerNotes}` : null,
  ]
    .filter((l) => l !== null)
    .join("\n");

  const requestBody = {
    summary,
    description,
    start: { dateTime: b.startsAt.toISOString(), timeZone: "America/New_York" },
    end: { dateTime: b.endsAt.toISOString(), timeZone: "America/New_York" },
    location: b.addressText,
    // Red for confirmed, grey for provisional, readable at a glance on a phone.
    colorId: b.provisional ? "8" : "11",
  };

  if (existingEventId) {
    const res = await cal.events.patch({
      calendarId: cfg.bookedCalendarId,
      eventId: existingEventId,
      requestBody,
    });
    return res.data.id as string;
  }

  const res = await cal.events.insert({
    calendarId: cfg.bookedCalendarId,
    requestBody,
  });
  return res.data.id as string;
}

export async function deleteBookedEvent(cfg: CalendarConfig, eventId: string): Promise<void> {
  const cal = client(cfg);
  try {
    await cal.events.delete({ calendarId: cfg.bookedCalendarId, eventId });
  } catch (err: unknown) {
    // A already-deleted event is not an error worth failing a cancellation over.
    const code = (err as { code?: number })?.code;
    if (code !== 404 && code !== 410) throw err;
  }
}
