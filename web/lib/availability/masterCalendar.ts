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

/**
 * What JobsSync counts as a job is what gets copied (tools/jobs-sync/JobsSync.gs,
 * jobRow and CONFIG). These are its own patterns, and jobs-sync-contract.test.ts
 * fails if the two drift apart. One difference on purpose: JobsSync also skips
 * "Day N of M" events so each job is counted once, but they are copied, one
 * copy per working day, like the originals.
 */
export const JOBS_SYNC_SKIP_TITLE = /^(open|best|dns|busy|blocked?|unavailable|availability|hold|personal)\b/i;
export const JOBS_SYNC_OFFICE = /505\s+Sandheger/i;
/** JobsSync's DETAILER: the detailer named at the start of a title, after any SHORT NOTICE prefix. */
export const JOBS_SYNC_DETAILER = /^(?:SHORT NOTICE[^:]*:\s*)?([A-Z][a-z]+):/;

/**
 * Why an event on a bookings calendar is not a job, or "" when it is one:
 * deleted, Free (fee blocks and the like), hours or a personal block by its
 * title (OPEN, BEST, DNS, Busy, Blocked, Hold, Personal...), the office
 * address, or all day with no $ amount. The same rules, in the same order,
 * as JobsSync's jobRow.
 */
export function notAJob(e: GEvent): string {
  const title = String(e.summary ?? "");
  const loc = String(e.location ?? "");
  const desc = String(e.description ?? "");
  if (e.status === "cancelled") return "deleted";
  if (e.transparency === "transparent") return "free";
  if (JOBS_SYNC_SKIP_TITLE.test(title.trim())) return "title";
  if (JOBS_SYNC_OFFICE.test(loc) || JOBS_SYNC_OFFICE.test(desc)) return "office";
  if (!e.start?.dateTime && !/\$\d/.test(title + desc)) return "all-day";
  return "";
}
export const isJob = (e: GEvent): boolean => notAJob(e) === "";

export const CANCELLED_PREFIX = "CANCELLED: ";
const SHORT_NOTICE = /^(SHORT NOTICE[^:]*:\s*)/;

/** Who did the job, as JobsSync reads it: a name at the start of the title wins over the calendar's detailer. */
export const titleDetailer = (title: string, fallback: string): string =>
  JOBS_SYNC_DETAILER.exec(String(title ?? "").trim())?.[1] || fallback;

/**
 * The copy's title: the original's, with the detailer always named first,
 * after any SHORT NOTICE prefix, so JobsSync's DETAILER and CONTINUATION_DAY
 * patterns read the copy as they read the original. A title that already
 * names someone ("Kris: ..." typed on Elijah's calendar) is kept as it is:
 * that name wins, as it does in JobsSync.
 */
export function masterTitle(title: string, detailer: string): string {
  const t = String(title ?? "").trim();
  if (JOBS_SYNC_DETAILER.test(t)) return t.slice(0, 250);
  const pre = SHORT_NOTICE.exec(t)?.[1] ?? "";
  const rest = t.slice(pre.length);
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
  /** When Google made the event (read-only, RFC 3339). */
  created?: string;
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

/**
 * The copy of one original, as it should be on the master calendar. Every
 * field here is one the mirror owns: it puts them back as the original says,
 * whoever changed them on the master (by hand, or GHL). Fields it doesn't
 * write (guests, GHL's own) are left alone.
 */
export function masterCopy(i: {
  original: GEvent;
  key: string;
  calendarId: string;
  label: string;
  /** The calendar's detailer. A name at the start of the title wins (titleDetailer). */
  detailer: string;
  settings?: MasterCalendarSettings;
}): GEvent {
  const s = i.settings ?? MASTER_CALENDAR;
  const o = i.original;
  const who = titleDetailer(o.summary ?? "", i.detailer);
  return {
    summary: masterTitle(o.summary ?? "", who),
    description: masterDescription({ status: "Booked", detailer: who, key: i.key, source: i.label, original: o.description ?? "" }),
    location: o.location ?? "",
    start: pickTime(o.start),
    end: pickTime(o.end),
    // As the original: a job is Busy, so GHL blocks its time.
    transparency: o.transparency === "transparent" ? "transparent" : "opaque",
    colorId: colorFor(who, s),
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

/**
 * The change that puts a copy right, as a PATCH: only the fields the mirror
 * owns, so anything else on the event (GHL's own fields, guests) survives.
 * Null when a PATCH can't do it: an all-day event turned into a timed one or
 * back (start.date and start.dateTime can't both be set), which takes a PUT.
 */
export function copyPatch(have: GEvent, want: GEvent): GEvent | null {
  const kind = (t: GTime | undefined) => (t?.date ? "date" : "dateTime");
  if (kind(have.start) !== kind(want.start) || kind(have.end) !== kind(want.end)) return null;
  return want;
}

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
  /** Copies that differ from their original (`have` is the copy as read); `restore` when it was marked cancelled. */
  updates: { id: string; key: string; have: GEvent; body: GEvent; restore: boolean }[];
  /** Copies whose original wasn't read this run: each is looked up before anything is marked. */
  missing: { id: string; key: string; copy: GEvent }[];
  /** Events on the master with no sourceId (made in GHL, or by hand): left alone. */
  foreign: string[];
  /** A second copy of the same booking key: left alone, and logged. */
  duplicates: string[];
  /** Originals skipped as not jobs (notAJob: Free, hours, personal blocks, the office...). */
  skipped: number;
}

/**
 * Two originals with one booking key (an event duplicated by hand keeps the
 * key): which one keeps it. The one the existing copy already follows
 * (its sourceId's event id), else the one Google made first (`created`),
 * then the lower id, so the answer never depends on the order the list came
 * back in. The others are their own jobs, manual:<event id>.
 */
function keyHolder(originals: GEvent[], copy: GEvent | undefined): GEvent {
  const follows = splitSourceId(copy?.extendedProperties?.private?.["sourceId"])?.eventId;
  const same = originals.find((e) => follows && e.id === follows);
  if (same) return same;
  const made = (e: GEvent) => { const t = Date.parse(String(e.created ?? "")); return Number.isFinite(t) ? t : Infinity; };
  return [...originals].sort((a, b) => made(a) - made(b) || String(a.id).localeCompare(String(b.id)))[0]!;
}

/**
 * What one run should change, from what it read: every original gets a copy
 * that matches it; a copy whose original is missing is listed for a direct
 * look-up, never marked from the list alone.
 */
export function planMirror(
  sources: SourceRead[],
  master: GEvent[],
  s: MasterCalendarSettings = MASTER_CALENDAR,
  idFor?: (key: string) => string,
): MirrorPlan {
  const plan: MirrorPlan = { creates: [], updates: [], missing: [], foreign: [], duplicates: [], skipped: 0 };
  const copies = new Map<string, GEvent>();
  for (const e of master) {
    if (e.status === "cancelled") continue;
    const p = e.extendedProperties?.private ?? {};
    if (!p["sourceId"] || !p["bookingKey"]) { plan.foreign.push(String(e.id)); continue; }
    const key = p["bookingKey"];
    const held = copies.get(key);
    if (held) {
      // Two copies of one key: the one at the key's own id (idFor) is the copy,
      // whatever order Google lists them in, so a stray can't keep a cancelled
      // time blocked (verification pass 4).
      if (idFor && e.id === idFor(key) && held.id !== idFor(key)) { plan.duplicates.push(String(held.id)); copies.set(key, e); }
      else plan.duplicates.push(String(e.id));
      continue;
    }
    copies.set(key, e);
  }

  const jobs: { src: SourceRead; e: GEvent }[] = [];
  const ids = new Set<string>();
  for (const src of sources) {
    for (const e of src.events) {
      if (e.status === "cancelled" || !e.id) continue;
      if (!isJob(e)) { plan.skipped++; continue; }
      // One event on two calendars that are both read (a calendar invited as
      // a guest): the first calendar in DETAILERS order keeps it, so the copy
      // doesn't swap detailers every run (verification pass 4).
      if (ids.has(e.id)) { plan.skipped++; continue; }
      ids.add(e.id);
      jobs.push({ src, e });
    }
  }
  const byKey = new Map<string, GEvent[]>();
  for (const { e } of jobs) byKey.set(keyOf(e), [...(byKey.get(keyOf(e)) ?? []), e]);

  const seen = new Set<string>();
  for (const { src, e } of jobs) {
    const shared = byKey.get(keyOf(e))!;
    const key = shared.length > 1 && keyHolder(shared, copies.get(keyOf(e))) !== e ? `manual:${e.id}` : keyOf(e);
    seen.add(key);
    const want = masterCopy({ original: e, key, calendarId: src.calendarId, label: src.label, detailer: src.detailer, settings: s });
    const have = copies.get(key);
    if (!have) plan.creates.push({ key, body: want });
    else if (!sameCopy(have, want)) plan.updates.push({ id: String(have.id), key, have, body: want, restore: isCancelledCopy(have) });
  }
  for (const [key, copy] of copies) {
    if (seen.has(key)) continue;
    // Already marked: nothing more to do, and no look-up every run.
    if (isCancelledCopy(copy)) continue;
    plan.missing.push({ id: String(copy.id), key, copy });
  }
  return plan;
}
