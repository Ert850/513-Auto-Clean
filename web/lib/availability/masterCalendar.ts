/**
 * The master calendar, 513 All Jobs: one copy of every booked job, for
 * GoHighLevel to link to (docs/ONE-CALENDAR-SPEC.md, concept (d); the website
 * does the copying, Emmett, November 26).
 *
 * This file is the part with no network: the settings (config/master-calendar.json),
 * what a copy looks like, and what one reconciler run should change. The
 * reading and writing are netlify/functions/_mastercal.mjs.
 *
 * THE COPY IS WRITE-ONLY. Nothing the site sells from reads it: not the
 * booking form, not computeSlots, not stillFree, and not JobsSync, which
 * would count every job twice. The detailers' own bookings calendars stay the
 * truth; the copy follows them.
 */
import raw from "../../../config/master-calendar.json" with { type: "json" };

export interface MasterCalendarSettings {
  /** Google event colour ids, by detailer name in lower case. */
  colors: Record<string, string>;
  defaultColor: string;
  cancelledColor: string;
  /** "mark": a copy whose job is gone is kept, titled CANCELLED and Free. "delete": it is deleted. */
  cancelMode: "mark" | "delete";
  /** More cancellations than this in one run means something else is wrong: none are made. */
  maxCancelsPerRun: number;
  daysBack: number;
  daysAhead: number;
  /** The most the copy may add to a booking before its emails go. */
  writeTimeoutMs: number;
  /** A reconciler run stops writing after this and finishes in the next run. */
  runBudgetMs: number;
}

const COLOR_ID = /^(?:[1-9]|1[01])$/;

export function checkMasterCalendar(input: unknown): MasterCalendarSettings {
  const o = (input ?? {}) as Record<string, unknown>;
  const bad = (field: string, what: string): never => {
    throw new Error(`config/master-calendar.json: ${field}: ${what}`);
  };
  const whole = (field: string, min: number, max: number): number => {
    const v = o[field];
    return typeof v === "number" && Number.isInteger(v) && v >= min && v <= max
      ? v
      : bad(field, `must be a whole number from ${min} to ${max}`);
  };
  const color = (field: string, v: unknown): string =>
    typeof v === "string" && COLOR_ID.test(v) ? v : bad(field, "must be a Google event colour id, \"1\" to \"11\"");
  const colors: Record<string, string> = {};
  const rawColors = o["colors"];
  if (!rawColors || typeof rawColors !== "object" || Array.isArray(rawColors)) bad("colors", "must be an object of detailer name to colour id");
  for (const [name, v] of Object.entries(rawColors as Record<string, unknown>)) {
    if (name.startsWith("_")) continue;
    colors[name.trim().toLowerCase()] = color(`colors.${name}`, v);
  }
  const mode = o["cancelMode"];
  if (mode !== "mark" && mode !== "delete") bad("cancelMode", "must be \"mark\" or \"delete\"");
  return {
    colors,
    defaultColor: color("defaultColor", o["defaultColor"]),
    cancelledColor: color("cancelledColor", o["cancelledColor"]),
    cancelMode: mode as "mark" | "delete",
    maxCancelsPerRun: whole("maxCancelsPerRun", 0, 1000),
    daysBack: whole("daysBack", 0, 366),
    daysAhead: whole("daysAhead", 1, 800),
    writeTimeoutMs: whole("writeTimeoutMs", 500, 10_000),
    runBudgetMs: whole("runBudgetMs", 1000, 25_000),
  };
}

export const MASTER_CALENDAR: MasterCalendarSettings = checkMasterCalendar(raw);

/** Hours, best times and blocked time, never jobs: never copied (the site reads them the same way). */
export const NOT_A_JOB = /^(open|best|dns)\b/i;

export const CANCELLED_PREFIX = "CANCELLED: ";
const SHORT_NOTICE = /^(SHORT NOTICE[^:]*:\s*)/;
const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The copy's title: the original's, with the detailer always named first,
 * after any SHORT NOTICE prefix, so JobsSync's DETAILER and CONTINUATION_DAY
 * patterns read the copy as they read the original. A name already there is
 * replaced by the calendar's detailer: a job moved to another detailer's
 * calendar is theirs now.
 */
export function masterTitle(title: string, detailer: string, crewNames: string[] = []): string {
  const t = String(title ?? "").trim();
  const pre = SHORT_NOTICE.exec(t)?.[1] ?? "";
  let rest = t.slice(pre.length);
  for (const n of [detailer, ...crewNames]) {
    const p = new RegExp(`^${escRe(n)}:\\s*`);
    if (n && p.test(rest)) { rest = rest.replace(p, ""); break; }
  }
  return `${pre}${detailer}: ${rest || "Job"}`.slice(0, 250);
}

/** The fixed header (one "Field: value" per line, then ---) and the original description word for word. */
export function masterDescription(h: { status: "Booked" | "Cancelled"; detailer: string; key: string; source: string; original: string }): string {
  return [
    `Status: ${h.status}`,
    `Detailer: ${h.detailer}`,
    `Booking key: ${h.key}`,
    `Source calendar: ${h.source}`,
    "---",
    String(h.original ?? ""),
  ].join("\n").slice(0, 8000);
}

export interface GTime { dateTime?: string; date?: string; timeZone?: string }

/** The parts of a Google Calendar event this code reads or writes. */
export interface GEvent {
  id?: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: GTime;
  end?: GTime;
  transparency?: string;
  colorId?: string;
  extendedProperties?: { private?: Record<string, string> };
}

/** One detailer's bookings calendar as one reconciler run read it. */
export interface SourceRead {
  calendarId: string;
  /** The calendar's own name (events.list `summary`), else its id. */
  label: string;
  detailer: string;
  events: GEvent[];
}

export const colorFor = (detailer: string, s: MasterCalendarSettings = MASTER_CALENDAR): string =>
  s.colors[String(detailer).trim().toLowerCase()] ?? s.defaultColor;

/** "calendar id|event id": where a copy's original lives. */
export const sourceIdOf = (calendarId: string, eventId: string) => `${calendarId}|${eventId}`;
export function splitSourceId(v: string | undefined): { calendarId: string; eventId: string } | null {
  const i = String(v ?? "").lastIndexOf("|");
  return i > 0 ? { calendarId: v!.slice(0, i), eventId: v!.slice(i + 1) } : null;
}

/** An original's booking key: the website's own, or manual:<event id> for a job typed in by hand. */
export const keyOf = (e: GEvent): string => e.extendedProperties?.private?.["bookingKey"] || `manual:${e.id}`;

/** The copy of one original, as it should be on the master calendar. */
export function masterCopy(i: {
  original: GEvent;
  key: string;
  calendarId: string;
  label: string;
  detailer: string;
  crewNames?: string[];
  settings?: MasterCalendarSettings;
}): GEvent {
  const s = i.settings ?? MASTER_CALENDAR;
  const o = i.original;
  return {
    summary: masterTitle(o.summary ?? "", i.detailer, i.crewNames),
    description: masterDescription({ status: "Booked", detailer: i.detailer, key: i.key, source: i.label, original: o.description ?? "" }),
    location: o.location ?? "",
    start: pickTime(o.start),
    end: pickTime(o.end),
    // As the original: a job is Busy, so GHL blocks its time.
    transparency: o.transparency === "transparent" ? "transparent" : "opaque",
    colorId: colorFor(i.detailer, s),
    extendedProperties: { private: { bookingKey: i.key, sourceId: sourceIdOf(i.calendarId, String(o.id ?? "")) } },
  };
}

function pickTime(t: GTime | undefined): GTime {
  if (!t) return {};
  if (t.date) return { date: t.date };
  return { ...(t.dateTime ? { dateTime: t.dateTime } : {}), ...(t.timeZone ? { timeZone: t.timeZone } : {}) };
}

/** A copy marked cancelled: kept, titled CANCELLED, Free so GHL stops blocking the time, graphite. */
export function cancelledPatch(copy: GEvent, s: MasterCalendarSettings = MASTER_CALENDAR): GEvent {
  const summary = String(copy.summary ?? "");
  const desc = String(copy.description ?? "");
  return {
    summary: summary.startsWith(CANCELLED_PREFIX) ? summary : `${CANCELLED_PREFIX}${summary}`.slice(0, 250),
    description: /^Status: .*$/m.test(desc) ? desc.replace(/^Status: .*$/m, "Status: Cancelled") : `Status: Cancelled\n${desc}`,
    transparency: "transparent",
    colorId: s.cancelledColor,
  };
}

export const isCancelledCopy = (e: GEvent): boolean =>
  String(e.summary ?? "").startsWith(CANCELLED_PREFIX) && /^Status: Cancelled$/m.test(String(e.description ?? ""));

const instant = (t: GTime | undefined) => (t?.date ? `d:${t.date}` : t?.dateTime ? `t:${Date.parse(t.dateTime)}` : "");

/** Is the copy on the master calendar already what it should be? */
export function sameCopy(have: GEvent, want: GEvent): boolean {
  const hp = have.extendedProperties?.private ?? {};
  const wp = want.extendedProperties?.private ?? {};
  return (have.summary ?? "") === (want.summary ?? "") &&
    (have.description ?? "") === (want.description ?? "") &&
    (have.location ?? "") === (want.location ?? "") &&
    instant(have.start) === instant(want.start) &&
    instant(have.end) === instant(want.end) &&
    (have.transparency || "opaque") === (want.transparency || "opaque") &&
    (have.colorId ?? "") === (want.colorId ?? "") &&
    hp["bookingKey"] === wp["bookingKey"] && hp["sourceId"] === wp["sourceId"];
}

export interface MirrorPlan {
  /** Copies to write, new or put back. */
  creates: { key: string; body: GEvent }[];
  /** Copies that differ from their original; `restore` when the copy was marked cancelled. */
  updates: { id: string; key: string; body: GEvent; restore: boolean }[];
  /** Copies whose original wasn't read this run: each is looked up before anything is marked. */
  missing: { id: string; key: string; copy: GEvent }[];
  /** Events on the master with no sourceId (made in GHL, or by hand): left alone. */
  foreign: string[];
  /** A second copy of the same booking key: left alone, and logged. */
  duplicates: string[];
  /** Originals skipped as hours (OPEN, BEST, DNS). */
  skipped: number;
}

/**
 * What one run should change, from what it read: every original gets a copy
 * that matches it; a copy whose original is missing is listed for a direct
 * look-up, never marked from the list alone.
 */
export function planMirror(sources: SourceRead[], master: GEvent[], crewNames: string[], s: MasterCalendarSettings = MASTER_CALENDAR): MirrorPlan {
  const plan: MirrorPlan = { creates: [], updates: [], missing: [], foreign: [], duplicates: [], skipped: 0 };
  const copies = new Map<string, GEvent>();
  for (const e of master) {
    if (e.status === "cancelled") continue;
    const p = e.extendedProperties?.private ?? {};
    if (!p["sourceId"] || !p["bookingKey"]) { plan.foreign.push(String(e.id)); continue; }
    if (copies.has(p["bookingKey"])) { plan.duplicates.push(String(e.id)); continue; }
    copies.set(p["bookingKey"], e);
  }

  const seen = new Set<string>();
  for (const src of sources) {
    for (const e of src.events) {
      if (e.status === "cancelled" || !e.id) continue;
      if (NOT_A_JOB.test(String(e.summary ?? "").trim())) { plan.skipped++; continue; }
      // Two originals with one key (an event duplicated by hand keeps it): the later one is its own job.
      let key = keyOf(e);
      if (seen.has(key)) key = `manual:${e.id}`;
      seen.add(key);
      const want = masterCopy({ original: e, key, calendarId: src.calendarId, label: src.label, detailer: src.detailer, crewNames, settings: s });
      const have = copies.get(key);
      if (!have) plan.creates.push({ key, body: want });
      else if (!sameCopy(have, want)) plan.updates.push({ id: String(have.id), key, body: want, restore: isCancelledCopy(have) });
    }
  }
  for (const [key, copy] of copies) {
    if (seen.has(key)) continue;
    // Already marked: nothing more to do, and no look-up every run.
    if (isCancelledCopy(copy)) continue;
    plan.missing.push({ id: String(copy.id), key, copy });
  }
  return plan;
}
