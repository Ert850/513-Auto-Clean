import crypto from "node:crypto";
import { MASTER_CALENDAR, copyPatch, isJob, masterCopy, parseDetailers, sameCopy } from "./_pricing.mjs";
import { bookedCalendarId, bookingEventBody, gcalRequest } from "./_gcal.mjs";
import { ownerFeeCalendars } from "./_detailers.mjs";

/**
 * The master calendar, 513 All Jobs: the reading and writing half
 * (web/lib/availability/masterCalendar.ts is the half with no network).
 *
 * Two writers keep it: send-confirmation copies each job the moment it is
 * booked, and jobs-mirror.mjs, every few minutes, makes the master match the
 * detailers' bookings calendars (hand-typed jobs, moves, edits, deletes).
 * Both name a copy by its booking key, so neither ever makes a second one.
 *
 * OFF until ALL_JOBS_CALENDAR_ID is set in Netlify (the id lives only there:
 * the repo is public). Nothing on the site ever READS the master: it is not
 * an availability calendar, and JobsSync must never list it (every job would
 * count twice). docs/MASTER-CALENDAR-SETUP.md.
 */

/** The master calendar's id, or "" for off. */
export function masterCalendarId(env = process.env) {
  return String(env.ALL_JOBS_CALENDAR_ID ?? "").trim();
}

/** One line per action. Ids and keys only: titles and descriptions carry customers' names and numbers. */
export function mlog(action, fields = {}) {
  console.log("[master-cal]", JSON.stringify({ action, ...fields }));
}
export function mwarn(action, fields = {}) {
  console.warn("[master-cal]", JSON.stringify({ action, ...fields }));
}

const list = (v) => String(v ?? "").split(",").map((x) => x.trim()).filter(Boolean);

/**
 * Every calendar the site reads for open time or writes jobs to. The master
 * must be none of them: the build fails if it is (render-config.mjs), and
 * neither writer touches it.
 */
export function siteCalendars(env = process.env) {
  const { crew } = parseDetailers(env.DETAILERS);
  return [...new Set([
    ...ownerFeeCalendars(env),
    ...ownerFeeCalendars({}),
    ...list(env.GOOGLE_BUSY_ONLY_CALENDAR_IDS),
    // The bookings calendar's own setting and its fallbacks (_gcal.mjs bookedCalendarId).
    env.GOOGLE_BOOKED_CALENDAR_ID, env.GOOGLE_CALENDAR_ID, env.GOOGLE_OWNER_AVAILABILITY_ID,
    ...crew.flatMap((d) => [d.availabilityCalendarId, d.bookingsCalendarId]),
  ].map((x) => String(x ?? "").trim()).filter(Boolean))];
}

export function masterClash(env = process.env) {
  const id = masterCalendarId(env);
  return Boolean(id) && siteCalendars(env).includes(id);
}

/**
 * The copy's own event id, from its booking key. Google lets a writer choose
 * an id (letters a to v and digits); a hex digest is that. Two writers racing
 * on one booking then can't both insert: the second gets 409.
 */
export function masterEventId(key) {
  return crypto.createHash("sha256").update(`513-all-jobs:${key}`).digest("hex");
}

/**
 * Write one copy for the reconciler, idempotent by its key: looked up first,
 * by the id the key names. There and live: left as it is (`overwrite`: put
 * right if it differs). Deleted on the master: put back. Not there: inserted.
 */
export async function writeCopy(masterId, key, body, { overwrite = false, signal } = {}) {
  const id = masterEventId(key);
  const got = await gcalRequest("GET", masterId, `/${id}`, { signal });
  if (got.ok && got.data && got.data.status !== "cancelled") {
    if (!overwrite || sameCopy(got.data, body)) return { ok: true, id, action: "exists" };
    const r = await updateCopy(masterId, id, got.data, body, { signal });
    return r.ok ? { ok: true, id, action: "updated" } : { ok: false, id, reason: `update: ${r.reason}` };
  }
  if (got.ok && got.data?.status === "cancelled") {
    const put = await putCopy(masterId, id, body, { signal });
    return put.ok ? { ok: true, id, action: "put-back" } : { ok: false, id, reason: `put back: ${put.reason}` };
  }
  if (got.status !== 404 && got.status !== 410) return { ok: false, id, reason: got.reason || "lookup failed" };
  const ins = await gcalRequest("POST", masterId, "", { body: { ...body, id }, signal });
  if (ins.ok) return { ok: true, id, action: "created" };
  if (ins.status === 409) {
    // Not found, yet the id is taken: a copy deleted long enough ago that a
    // look-up no longer returns it (or the booking's copy landed just now).
    // Put it back as it should be; a failure is a failure, never "exists".
    const put = await putCopy(masterId, id, body, { signal });
    return put.ok ? { ok: true, id, action: "put-back" } : { ok: false, id, reason: `id taken (409), put back failed: ${put.reason}` };
  }
  return { ok: false, id, reason: ins.reason };
}

/**
 * The instant copy, at booking time: one per event the booking wrote (one
 * per working day), all at once, each POSTed straight away with the id its
 * key names. 409 means it is already there (a retry, or the reconciler got
 * there first). No other look-ups: the "Source calendar:" line says the
 * calendar's id until the reconciler's next run writes its name.
 *
 * Best effort and never throws. The caller runs it after both emails have
 * gone and bounds it (`signal`, writeTimeoutMs); a failure is logged here
 * and nowhere else, and the reconciler copies the job on its next run.
 */
export async function copyBookingToMaster({ written, calendarId, detailerName, signal }) {
  const masterId = masterCalendarId();
  if (!masterId) return { ok: true, off: true };
  try {
    if (masterClash()) {
      mwarn("clash", {});
      return { ok: false, reason: "clash" };
    }
    const source = calendarId || bookedCalendarId();
    const copies = written
      .map((ev) => ({ key: ev.key || `manual:${ev.id}`, original: { ...bookingEventBody(ev), id: ev.id } }))
      .filter((c) => isJob(c.original));
    const done = await Promise.all(copies.map(async ({ key, original }) => {
      const id = masterEventId(key);
      const body = masterCopy({ original, key, calendarId: source, label: source, detailer: detailerName });
      const r = await gcalRequest("POST", masterId, "", { body: { ...body, id }, signal });
      if (r.ok || r.status === 409) { mlog(r.ok ? "copy" : "copy-exists", { key, id }); return ""; }
      mwarn("copy-failed", { key, reason: r.reason });
      return r.reason || "write failed";
    }));
    const failed = done.filter(Boolean);
    return failed.length ? { ok: false, reason: failed[0] } : { ok: true };
  } catch (e) {
    mwarn("copy-failed", { reason: String(e?.message || e).slice(0, 200) });
    return { ok: false, reason: "threw" };
  }
}

/**
 * Every event on a calendar in a window, every page, or {ok:false}. The
 * calendar's own name comes with it (events.list `summary`).
 */
export async function listWindow(calendarId, timeMinMs, timeMaxMs, { signal } = {}) {
  const events = [];
  let label = "";
  let pageToken = "";
  for (let page = 0; page < 50; page++) {
    const r = await gcalRequest("GET", calendarId, "", {
      query: {
        timeMin: new Date(timeMinMs).toISOString(),
        timeMax: new Date(timeMaxMs).toISOString(),
        singleEvents: "true",
        maxResults: "250",
        ...(pageToken ? { pageToken } : {}),
      },
      signal,
    });
    if (!r.ok || !r.data) return { ok: false, reason: r.reason || "no body" };
    if (!label && typeof r.data.summary === "string") label = r.data.summary;
    events.push(...(r.data.items ?? []));
    pageToken = r.data.nextPageToken || "";
    if (!pageToken) return { ok: true, events, label };
  }
  return { ok: false, reason: "too many pages" };
}

/**
 * Is an original really gone? A direct look-up: "gone" only for status
 * cancelled, or 404/410 on a calendar this run read without an error (Google
 * answers 404 for a calendar it can't open as well as for a missing event,
 * so on any other calendar a 404 proves nothing). "alive" with the event,
 * "error" for anything else.
 */
export async function lookupOriginal(calendarId, eventId, { readThisRun = false, signal } = {}) {
  const r = await gcalRequest("GET", calendarId, `/${encodeURIComponent(eventId)}`, { signal });
  if (r.status === 404 || r.status === 410) return readThisRun ? { state: "gone" } : { state: "error", reason: `http_${r.status} on a calendar not read this run` };
  if (r.ok && r.data?.status === "cancelled") return { state: "gone" };
  if (r.ok && r.data) return { state: "alive", event: r.data };
  return { state: "error", reason: r.reason || "lookup failed" };
}

export async function putCopy(masterId, id, body, { signal } = {}) {
  return gcalRequest("PUT", masterId, `/${encodeURIComponent(id)}`, { body: { ...body, id, status: "confirmed" }, signal });
}
export async function patchCopy(masterId, id, body, { signal } = {}) {
  return gcalRequest("PATCH", masterId, `/${encodeURIComponent(id)}`, { body, signal });
}
/**
 * Put a live copy right: a PATCH of the fields the mirror owns, so whatever
 * else is on it (GHL's fields, guests) stays. A PUT only when a PATCH can't
 * (copyPatch: all-day turned timed, or back).
 */
export async function updateCopy(masterId, id, have, want, { signal } = {}) {
  const patch = copyPatch(have, want);
  return patch ? patchCopy(masterId, id, patch, { signal }) : putCopy(masterId, id, want, { signal });
}
export async function deleteCopy(masterId, id, { signal } = {}) {
  const r = await gcalRequest("DELETE", masterId, `/${encodeURIComponent(id)}`, { signal });
  return r.status === 410 ? { ...r, ok: true } : r;
}

export { MASTER_CALENDAR };
