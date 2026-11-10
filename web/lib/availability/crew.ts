/**
 * Who can take a job, and who gets it.
 *
 * Every detailer other than the owner is one entry in ONE setting, DETAILERS,
 * read by the browser (through js/config.js) and by the booking function
 * alike, so adding somebody is two Google calendars and one paste. The list
 * order is the booking order: the first detailer free for a time gets it.
 *
 *   [
 *     { "name": "Kris", "does": "interior",
 *       "availability": "abc...@group.calendar.google.com",
 *       "bookings": "def...@group.calendar.google.com" },
 *     { "name": "Elijah", "owner": true }
 *   ]
 *
 * - `availability`: OPEN blocks for their hours (busy events block too).
 *   Shared publicly with full details: it holds nothing private.
 * - `bookings`: where their jobs are written. Shared publicly as free/busy
 *   ONLY, and read through Google's free/busy endpoint, so customer names
 *   and addresses on it are never public.
 * - `does`: what they can take on, as one word or a list of words, or "all"
 *   (the default). Today's words: "interior", "exterior", "correction"
 *   (polishing and paint correction), "coating". A job needs every word that
 *   applies to it, so a new kind of work is a new word, not new code.
 * - `noFeeStarts` (optional): "18:00-19:00", the first and last start, in
 *   Cincinnati time, that carry no early or late fee when this detailer takes
 *   the job, because they work those hours anyway (owner, November 10: Kris
 *   at 6 to 7pm). The rush fee still applies. Days may lead it, and several
 *   ranges may be listed (round 16: Kris waives 6 to 7pm only on the days he
 *   works evenings): "Tue-Sat 18:00-19:00", "Sun,Mon 10:00-18:00;
 *   Tue-Sat 18:00-19:00". A bare range means every day.
 * - `arrivalWindow` (optional): minutes after a start time this detailer may
 *   still arrive, which their drive may use (owner, November 11: "6pm" means
 *   arriving 6 to 7pm). 60 when left out; 0 means the drive must end by the
 *   start.
 * - The owner's own entry is optional and only sets his place in the order;
 *   his calendars stay the site's existing ones. Without it he books last.
 *
 * Detailers may overlap: each one's calendars are checked on their own.
 */
import { ARRIVAL_WINDOW_MIN, localMinutesOfDay } from "./slots.js";
import { localWeekday } from "../time/zone.js";

/** A skill a job can need. Free text, so a new one needs no code change. */
export type Work = string;

export interface Detailer {
  id: string;
  name: string;
  does: Work[];
  /** Their OPEN blocks, read in full. Empty for the owner. */
  availabilityCalendarId: string;
  /** Where this detailer's jobs are written. Empty for the owner (default calendar). */
  bookingsCalendarId: string;
  owner: boolean;
  /** Starts (minutes past midnight, inclusive) with no early or late fee. */
  noFeeStarts: FeeFree[] | null;
  /**
   * Minutes after a start time they may still arrive ("6pm" means 6 to 7pm),
   * which the drive may use (slots.ts arrivalWindowMin). DETAILERS
   * `arrivalWindow`; 60 when left out.
   */
  arrivalWindowMin: number;
}

/** One fee-free range: its days (0 Sun to 6 Sat; null = every day) and its starts. */
export interface FeeFree { days: number[] | null; fromMin: number; toMin: number }

export const OWNER: Detailer = {
  id: "owner",
  name: "Elijah",
  does: ["*"],
  availabilityCalendarId: "",
  bookingsCalendarId: "",
  owner: true,
  noFeeStarts: null,
  arrivalWindowMin: ARRIVAL_WINDOW_MIN,
};


/** "Tue-Sat" or "Sun,Mon" as weekday numbers, or null if it does not read. */
const FULL_DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
/** "tue", "tues" or "tuesday": letters only, at least three, the start of a day's name. */
function dayIndex(word: string): number {
  if (!/^[a-z]{3,}$/.test(word)) return -1;
  return FULL_DAYS.findIndex((d) => d.startsWith(word));
}

function parseDays(text: string): number[] | null {
  const out = new Set<number>();
  for (const part of text.toLowerCase().split(",").map((x) => x.trim()).filter(Boolean)) {
    // One day or one run of two. "Sun Mon", "Mon to Fri" or "Tue-Sat-Sun"
    // used to read as their first day only (engine check, November 10).
    const names = part.split("-").map((x) => x.trim());
    if (names.length > 2) return null;
    const [a, b] = names.map(dayIndex);
    if (a === undefined || a < 0 || (b !== undefined && b < 0)) return null;
    // Tue-Sat, or a run that wraps, like Sat-Mon.
    for (let i = a, n = 0; n < 7; i = (i + 1) % 7, n++) { out.add(i); if (b === undefined || i === b) break; }
  }
  return out.size ? [...out].sort((x, y) => x - y) : null;
}

/**
 * "18:00-19:00", "Tue-Sat 18:00-19:00" or several of those split by ";", or
 * null if any part does not read.
 */
function parseRanges(text: unknown): FeeFree[] | null {
  const parts = String(text ?? "").split(";").map((x) => x.trim()).filter(Boolean);
  if (!parts.length) return null;
  const out: FeeFree[] = [];
  for (const part of parts) {
    const m = /^(?:([A-Za-z,\s-]+?)\s+)?(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/.exec(part);
    if (!m) return null;
    const days = m[1] ? parseDays(m[1]) : null;
    if (m[1] && !days) return null;
    if (Number(m[3]) > 59 || Number(m[5]) > 59) return null;
    const fromMin = Number(m[2]) * 60 + Number(m[3]);
    const toMin = Number(m[4]) * 60 + Number(m[5]);
    if (!(fromMin <= toMin && toMin < 24 * 60)) return null;
    out.push({ days, fromMin, toMin });
  }
  return out;
}

/** The same, for a start as a timestamp (Cincinnati time and weekday). */
export function waivesFeeAt(d: Detailer | null | undefined, startMs: number): boolean {
  return waivesTimeFee(d, localMinutesOfDay(startMs), localWeekday(startMs, "America/New_York"));
}

/**
 * Does this detailer waive the early or late fee for a start at this time of
 * day (and, when the range names days, on this weekday)?
 */
export function waivesTimeFee(d: Detailer | null | undefined, startMinutesLocal: number, weekday?: number): boolean {
  return Boolean(d?.noFeeStarts?.some((r) =>
    startMinutesLocal >= r.fromMin && startMinutesLocal <= r.toMin &&
    (!r.days || weekday === undefined || r.days.includes(weekday))));
}

const CAL_ID = /^[\w.+-]+@[\w.-]+$/;

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30);
}

/**
 * The DETAILERS setting, as the ordered crew, owner included.
 *
 * Forgiving on purpose: a typo in one entry drops that entry (and says so in
 * `problems`), it never takes the booking form down with it.
 */
export function parseDetailers(raw: string | null | undefined): { crew: Detailer[]; problems: string[] } {
  const problems: string[] = [];
  let list: unknown[] = [];
  const text = String(raw ?? "").trim();
  if (text) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) list = parsed;
      else problems.push("DETAILERS must be a list, in [ square brackets ]");
    } catch {
      problems.push("DETAILERS is not valid JSON");
    }
  }

  const crew: Detailer[] = [];
  let ownerPlaced = false;
  const seen = new Set<string>();

  list.forEach((entry, i) => {
    const e = (entry ?? {}) as Record<string, unknown>;
    if (e["owner"] === true) {
      if (!ownerPlaced) crew.push({ ...OWNER, name: String(e["name"] || OWNER.name).slice(0, 40), arrivalWindowMin: windowOf(e, OWNER.name, problems) });
      ownerPlaced = true;
      return;
    }
    const name = String(e["name"] ?? "").trim().slice(0, 40);
    const availability = String(e["availability"] ?? "").trim();
    const bookings = String(e["bookings"] ?? "").trim();
    const id = slug(name);
    if (!name || !id) return problems.push(`entry ${i + 1} has no name`);
    if (id === OWNER.id || seen.has(id)) return problems.push(`${name} is listed twice`);
    if (!CAL_ID.test(availability) || !CAL_ID.test(bookings)) {
      return problems.push(`${name} needs both an availability and a bookings calendar id`);
    }
    const does = parseDoes(e["does"]);
    const noFeeStarts = e["noFeeStarts"] === undefined ? null : parseRanges(e["noFeeStarts"]);
    if (e["noFeeStarts"] !== undefined && !noFeeStarts) problems.push(`${name}: noFeeStarts should look like "18:00-19:00" or "Tue-Sat 18:00-19:00"`);
    seen.add(id);
    crew.push({
      id,
      name,
      does,
      availabilityCalendarId: availability,
      bookingsCalendarId: bookings,
      owner: false,
      noFeeStarts,
      arrivalWindowMin: windowOf(e, name, problems),
    });
  });

  if (!ownerPlaced) crew.push(OWNER);
  return { crew, problems };
}

/** `arrivalWindow`: whole minutes, 0 to 120; 60 when left out. */
function windowOf(e: Record<string, unknown>, name: string, problems: string[]): number {
  if (e["arrivalWindow"] === undefined) return ARRIVAL_WINDOW_MIN;
  const n = Number(e["arrivalWindow"]);
  if (Number.isInteger(n) && n >= 0 && n <= 120) return n;
  problems.push(`${name}: arrivalWindow should be minutes, 0 to 120`);
  return ARRIVAL_WINDOW_MIN;
}

/** "interior", ["interior", "coating"] or "all" as a list of skills ("*" is everything). */
function parseDoes(raw: unknown): Work[] {
  const list = (Array.isArray(raw) ? raw : [raw ?? "all"])
    .map((w) => String(w ?? "").trim().toLowerCase())
    .filter(Boolean);
  return !list.length || list.includes("all") ? ["*"] : [...new Set(list)];
}

/** Can this detailer do every part of the job? `needs` lists the skills it takes. */
export function canDo(d: Detailer, needs: Work[]): boolean {
  return d.does.includes("*") || needs.every((n) => d.does.includes(n));
}

/**
 * Every start anyone can take, and who takes it: the first in crew order.
 * `free` holds each detailer's own valid starts, in crew order.
 */
export function assignStarts(free: { id: string; starts: number[] }[]): { starts: number[]; who: Map<number, string> } {
  const who = new Map<number, string>();
  for (const d of free) {
    for (const ms of d.starts) if (!who.has(ms)) who.set(ms, d.id);
  }
  return { starts: [...who.keys()].sort((a, b) => a - b), who };
}
