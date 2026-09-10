/**
 * iCalendar reader, for Elijah's personal calendar as a conflict source.
 *
 * Pure: text in, busy intervals out. No I/O, no network, so it is fast to
 * test and cannot leak anything by accident.
 *
 * WHAT IT DELIBERATELY DOES NOT RETURN: titles, descriptions, locations,
 * attendees, organisers. Only start and end. A personal calendar carries
 * medical appointments, other people's names and home addresses, and none of
 * that has any business travelling to a stranger's browser to answer the
 * question "is 2pm on Thursday free". The caller literally cannot leak what
 * it was never given.
 *
 * Covers what a real Apple calendar actually contains: folded lines, TZID
 * with named zones, UTC, floating and all-day times, DURATION instead of
 * DTEND, RRULE with INTERVAL/COUNT/UNTIL/BYDAY/BYMONTHDAY, EXDATE, RDATE,
 * cancelled events, free ("transparent") events, and RECURRENCE-ID overrides
 * that move or cancel a single occurrence of a series.
 */

import { zonedToUtc } from "../time/zone.js";

export interface BusyInterval {
  start: number;
  end: number;
}

export interface IcsOptions {
  /** Window to expand recurrences into. Epoch ms. */
  from: number;
  to: number;
  /** Zone for floating and all-day times. */
  timeZone?: string;
  /**
   * Whether a whole-day event blocks the whole day.
   *
   * OFF by default, and that default matters: a personal calendar is full of
   * birthdays, holidays and "package arriving today", and treating those as
   * busy would silently close whole days of bookings. Timed events are the
   * reliable signal. Turn this on only if all-day entries are genuinely
   * "I am not available".
   */
  includeAllDay?: boolean;
  /** Safety valve against a pathological RRULE. */
  maxOccurrences?: number;
}

/* ---------------- time ---------------- */

const DAY_MS = 86400000;

interface ParsedTime {
  ms: number;
  allDay: boolean;
}

function parseTime(value: string, params: Record<string, string>, fallbackZone: string): ParsedTime | null {
  const v = value.trim();

  // All day: 20260910
  const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
  if (dateOnly && (params["VALUE"] === "DATE" || v.length === 8)) {
    const [, y, mo, d] = dateOnly;
    return {
      ms: zonedToUtc(Number(y), Number(mo), Number(d), 0, 0, 0, fallbackZone),
      allDay: true,
    };
  }

  const dt = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/.exec(v);
  if (!dt) return null;
  const [, y, mo, d, h, mi, s, z] = dt;

  if (z) {
    return { ms: Date.UTC(+y!, +mo! - 1, +d!, +h!, +mi!, +s!), allDay: false };
  }

  // TZID when given, otherwise floating, which means local wall clock.
  const zone = params["TZID"] || fallbackZone;
  return { ms: zonedToUtc(+y!, +mo!, +d!, +h!, +mi!, +s!, zone), allDay: false };
}

/** ISO 8601 duration, the subset calendars actually emit. */
function parseDuration(v: string): number | null {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(v.trim());
  if (!m) return null;
  const sign = m[1] === "-" ? -1 : 1;
  const ms =
    (Number(m[2] ?? 0) * 7 * 86400 +
      Number(m[3] ?? 0) * 86400 +
      Number(m[4] ?? 0) * 3600 +
      Number(m[5] ?? 0) * 60 +
      Number(m[6] ?? 0)) *
    1000;
  return sign * ms;
}

/* ---------------- parsing ---------------- */

interface RawLine {
  name: string;
  params: Record<string, string>;
  value: string;
}

/**
 * Unfold, then split each line into name, params and value.
 *
 * Folding is the classic iCalendar trap: a long DESCRIPTION is wrapped with a
 * CRLF and a leading space, and a naive line split turns one property into
 * several nonsense ones.
 */
function readLines(text: string): RawLine[] {
  const unfolded = text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");
  const out: RawLine[] = [];

  for (const line of unfolded.split("\n")) {
    if (!line) continue;
    const colon = line.indexOf(":");
    if (colon < 0) continue;

    const head = line.slice(0, colon);
    const value = line.slice(colon + 1);
    const bits = head.split(";");
    const name = (bits[0] ?? "").toUpperCase();

    const params: Record<string, string> = {};
    for (const bit of bits.slice(1)) {
      const eq = bit.indexOf("=");
      if (eq < 0) continue;
      params[bit.slice(0, eq).toUpperCase()] = bit.slice(eq + 1).replace(/^"|"$/g, "");
    }
    out.push({ name, params, value });
  }
  return out;
}

interface VEvent {
  uid: string;
  start: ParsedTime | null;
  end: ParsedTime | null;
  durationMs: number | null;
  rrule: string | null;
  exDates: number[];
  rDates: number[];
  recurrenceId: ParsedTime | null;
  cancelled: boolean;
  transparent: boolean;
}

function collectEvents(lines: RawLine[], zone: string): VEvent[] {
  const events: VEvent[] = [];
  let cur: VEvent | null = null;
  let depth = 0;

  for (const line of lines) {
    if (line.name === "BEGIN") {
      // VTIMEZONE also contains DTSTART and RRULE. Entering any nested
      // component while inside a VEVENT means those belong to the child.
      if (line.value === "VEVENT") {
        cur = {
          uid: "",
          start: null,
          end: null,
          durationMs: null,
          rrule: null,
          exDates: [],
          rDates: [],
          recurrenceId: null,
          cancelled: false,
          transparent: false,
        };
        depth = 0;
      } else if (cur) {
        depth++;
      }
      continue;
    }

    if (line.name === "END") {
      if (line.value === "VEVENT" && cur) {
        events.push(cur);
        cur = null;
      } else if (cur && depth > 0) {
        depth--;
      }
      continue;
    }

    if (!cur || depth > 0) continue;

    switch (line.name) {
      case "UID":
        cur.uid = line.value;
        break;
      case "DTSTART":
        cur.start = parseTime(line.value, line.params, zone);
        break;
      case "DTEND":
        cur.end = parseTime(line.value, line.params, zone);
        break;
      case "DURATION":
        cur.durationMs = parseDuration(line.value);
        break;
      case "RRULE":
        cur.rrule = line.value;
        break;
      case "RECURRENCE-ID":
        cur.recurrenceId = parseTime(line.value, line.params, zone);
        break;
      case "STATUS":
        if (line.value.toUpperCase() === "CANCELLED") cur.cancelled = true;
        break;
      case "TRANSP":
        // "I am free during this" is the calendar saying do not treat it as busy.
        if (line.value.toUpperCase() === "TRANSPARENT") cur.transparent = true;
        break;
      case "EXDATE":
        for (const v of line.value.split(",")) {
          const t = parseTime(v, line.params, zone);
          if (t) cur.exDates.push(t.ms);
        }
        break;
      case "RDATE":
        for (const v of line.value.split(",")) {
          const t = parseTime(v, line.params, zone);
          if (t) cur.rDates.push(t.ms);
        }
        break;
      default:
        break;
    }
  }
  return events;
}

/* ---------------- recurrence ---------------- */

const WEEKDAY: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

interface Rule {
  freq: string;
  interval: number;
  count: number | null;
  until: number | null;
  byDay: number[];
  byMonthDay: number[];
}

function parseRule(text: string, zone: string): Rule | null {
  const parts: Record<string, string> = {};
  for (const bit of text.split(";")) {
    const eq = bit.indexOf("=");
    if (eq > 0) parts[bit.slice(0, eq).toUpperCase()] = bit.slice(eq + 1);
  }
  const freq = (parts["FREQ"] ?? "").toUpperCase();
  if (!freq) return null;

  const untilRaw = parts["UNTIL"];
  const until = untilRaw ? parseTime(untilRaw, {}, zone)?.ms ?? null : null;

  return {
    freq,
    interval: Math.max(1, Number(parts["INTERVAL"] ?? 1)),
    count: parts["COUNT"] ? Number(parts["COUNT"]) : null,
    until,
    byDay: (parts["BYDAY"] ?? "")
      .split(",")
      .map((d) => WEEKDAY[d.replace(/^[+-]?\d+/, "").toUpperCase()])
      .filter((n): n is number => n !== undefined),
    byMonthDay: (parts["BYMONTHDAY"] ?? "")
      .split(",")
      .map(Number)
      .filter((n) => Number.isFinite(n) && n !== 0),
  };
}

/**
 * Expand a rule into start times overlapping [from, to].
 *
 * Fast-forwards to the window for DAILY and WEEKLY rather than stepping from
 * a DTSTART that may be years back, and hard caps everything else, so a
 * malformed rule burns a bounded amount of time instead of hanging a request.
 */
function expand(startMs: number, rule: Rule, from: number, to: number, cap: number): number[] {
  const out: number[] = [];
  const hardEnd = rule.until !== null ? Math.min(to, rule.until) : to;
  if (startMs > hardEnd) return out;

  let emitted = 0;
  const push = (ms: number): boolean => {
    if (rule.count !== null && emitted >= rule.count) return false;
    emitted++;
    if (ms >= from && ms <= hardEnd) out.push(ms);
    return true;
  };

  if (rule.freq === "DAILY") {
    const step = rule.interval * DAY_MS;
    // With a COUNT we have to walk from the beginning to know when it stops.
    let ms = startMs;
    if (rule.count === null && from > startMs) {
      ms = startMs + Math.floor((from - startMs) / step) * step;
    }
    for (let i = 0; i < cap && ms <= hardEnd; i++, ms += step) {
      if (!push(ms)) break;
    }
    return out;
  }

  if (rule.freq === "WEEKLY") {
    const week = rule.interval * 7 * DAY_MS;
    const days = rule.byDay.length ? rule.byDay : [new Date(startMs).getUTCDay()];
    let anchor = startMs;
    if (rule.count === null && from - week > startMs) {
      anchor = startMs + Math.floor((from - week - startMs) / week) * week;
    }
    for (let i = 0; i < cap && anchor <= hardEnd + week; i++, anchor += week) {
      const base = new Date(anchor);
      for (const d of days) {
        const shift = (d - base.getUTCDay() + 7) % 7;
        const ms = anchor + shift * DAY_MS;
        if (ms < startMs) continue;
        if (ms > hardEnd) continue;
        if (!push(ms)) return out;
      }
    }
    return out;
  }

  if (rule.freq === "MONTHLY" || rule.freq === "YEARLY") {
    const stepMonths = rule.freq === "YEARLY" ? 12 * rule.interval : rule.interval;
    const d0 = new Date(startMs);
    for (let i = 0; i < cap; i++) {
      const ms = Date.UTC(
        d0.getUTCFullYear(),
        d0.getUTCMonth() + i * stepMonths,
        rule.byMonthDay[0] ?? d0.getUTCDate(),
        d0.getUTCHours(),
        d0.getUTCMinutes(),
        d0.getUTCSeconds(),
      );
      if (ms > hardEnd) break;
      if (!push(ms)) break;
    }
    return out;
  }

  return out;
}

/* ---------------- the public call ---------------- */

/**
 * Busy intervals from an iCalendar feed, clipped to the requested window.
 *
 * Overlapping intervals are merged, so the caller gets the minimum set that
 * describes the same busy time.
 */
export function parseIcsBusy(text: string, opts: IcsOptions): BusyInterval[] {
  const zone = opts.timeZone ?? "America/New_York";
  const cap = opts.maxOccurrences ?? 400;
  const events = collectEvents(readLines(text), zone);

  // A RECURRENCE-ID event replaces one occurrence of its series, so the
  // original instance at that time has to disappear whether the override
  // moved it or cancelled it.
  const overridden = new Set<string>();
  for (const e of events) {
    if (e.recurrenceId) overridden.add(`${e.uid}@${e.recurrenceId.ms}`);
  }

  const raw: BusyInterval[] = [];

  for (const e of events) {
    if (e.cancelled || e.transparent || !e.start) continue;
    if (e.start.allDay && !opts.includeAllDay) continue;

    let lengthMs: number;
    if (e.end) lengthMs = e.end.ms - e.start.ms;
    else if (e.durationMs !== null) lengthMs = e.durationMs;
    else lengthMs = e.start.allDay ? DAY_MS : 0;
    if (lengthMs <= 0) lengthMs = e.start.allDay ? DAY_MS : 30 * 60 * 1000;

    const starts: number[] = [];

    if (e.rrule && !e.recurrenceId) {
      const rule = parseRule(e.rrule, zone);
      if (rule) starts.push(...expand(e.start.ms, rule, opts.from - lengthMs, opts.to, cap));
    } else {
      starts.push(e.start.ms);
    }
    starts.push(...e.rDates);

    for (const s of starts) {
      if (e.exDates.includes(s)) continue;
      if (!e.recurrenceId && overridden.has(`${e.uid}@${s}`)) continue;

      const end = s + lengthMs;
      if (end <= opts.from || s >= opts.to) continue;
      raw.push({ start: Math.max(s, opts.from), end: Math.min(end, opts.to) });
    }
  }

  return mergeBusy(raw);
}

/** Sort and coalesce touching or overlapping intervals. */
export function mergeBusy(list: BusyInterval[]): BusyInterval[] {
  if (!list.length) return [];
  const sorted = list.slice().sort((a, b) => a.start - b.start);
  const out: BusyInterval[] = [{ ...sorted[0]! }];

  for (const next of sorted.slice(1)) {
    const last = out[out.length - 1]!;
    if (next.start <= last.end) last.end = Math.max(last.end, next.end);
    else out.push({ ...next });
  }
  return out;
}
