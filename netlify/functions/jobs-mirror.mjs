import { MASTER_CALENDAR, cancelledPatch, isJob, masterCopy, parseDetailers, planMirror, sameCopy, splitSourceId } from "./_pricing.mjs";
import { bookedCalendarId, gcalConfigured } from "./_gcal.mjs";
import { inTime } from "./_detailers.mjs";
import { deleteCopy, listWindow, lookupOriginal, masterCalendarId, masterClash, masterEventId, mlog, mwarn, patchCopy, updateCopy, writeCopy } from "./_mastercal.mjs";
import { send } from "./send-confirmation.mjs";

/**
 * Keeps the master calendar, 513 All Jobs, matching the detailers' bookings
 * calendars (docs/MASTER-CALENDAR-SETUP.md). Every 10 minutes
 * (netlify.toml [functions."jobs-mirror"]); scheduled functions run only on
 * the published site, never on a preview.
 *
 * send-confirmation copies each job the moment it is booked. This catches the
 * rest: jobs typed in by hand (key "manual:<event id>"), moves, edits,
 * reassignments to another detailer's calendar, deletes and restores, and a
 * copy changed or deleted on the master by hand, which is put back as the
 * original says. The originals are the truth; the master is only written.
 *
 * SAFEGUARDS, as JobsSync's (docs/ONE-CALENDAR-SPEC.md):
 *  - every list comes first, and one failure means nothing is written that
 *    run; a look-up that fails means no copy is marked cancelled that run;
 *  - a copy is marked cancelled only after a direct look-up finds its original
 *    deleted (status cancelled, or 404 on a calendar read this run); a copy
 *    whose bookings calendar wasn't read this run (a detailer taken out of
 *    DETAILERS, say) is never looked up and never marked;
 *  - more than maxCancelsPerRun (config/master-calendar.json) looking deleted
 *    at once means something else is wrong: none are marked, and Elijah is
 *    emailed once;
 *  - it writes to the master calendar and nowhere else, and never to a master
 *    that is also a calendar the site reads (masterClash);
 *  - TIME: every Google call ends at runBudgetMs from the start (aborted if
 *    Google hasn't answered), and nothing new starts after it. Look-ups cut
 *    short mean no cancels that run. A run finishes inside Netlify's limit for
 *    scheduled functions, and the next run carries on. Copies come before
 *    look-ups, so slow look-ups can't hold up new jobs.
 *
 * Events made on the master by GHL (no sourceId) are left alone and logged:
 * the site never reads the master, so a time GHL books there could be sold
 * again (phase 2, open question 4 of the spec).
 */

const DAY = 86_400_000;

/** Each detailer's bookings calendar, in crew order, never an availability calendar. */
export function bookingsCalendars(env = process.env) {
  const out = [];
  for (const d of parseDetailers(env.DETAILERS).crew) {
    const calendarId = d.owner ? bookedCalendarId() : d.bookingsCalendarId;
    if (calendarId && !out.some((c) => c.calendarId === calendarId)) out.push({ calendarId, detailer: d.name });
  }
  return out;
}

export function heldEmail(n, max) {
  return {
    subject: `CHECK: ${n} jobs look deleted, 513 All Jobs left as it was`,
    html:
      `<p>The 513 All Jobs copy found ${n} jobs whose events are gone from the detailers' bookings calendars. ` +
      `That is more than the ${max} it marks cancelled in one run, which usually means something else is wrong ` +
      `(a bookings calendar changed in DETAILERS, say), so none were marked.</p>` +
      `<p>If they really were cancelled, mark their copies on 513 All Jobs by hand, or raise maxCancelsPerRun in ` +
      `config/master-calendar.json for one deploy. This email comes once for these jobs.</p>`,
  };
}

/**
 * One run. `mail(msg)` sends Elijah an email (false when it couldn't).
 * Returns the counts, also logged as one line.
 */
export async function reconcile({ nowMs = Date.now(), startMs = Date.now(), settings = MASTER_CALENDAR, mail = null } = {}) {
  const masterId = masterCalendarId();
  if (!masterId) { mlog("off"); return { off: true }; }
  if (!gcalConfigured()) { mwarn("unconfigured"); return { off: true, reason: "unconfigured" }; }
  if (masterClash()) { mwarn("clash"); return { aborted: true, reason: "clash" }; }

  // Every Google call this run ends by the deadline (runBudgetMs from the
  // start), answered or not, and nothing new starts after it.
  const left = () => startMs + settings.runBudgetMs - Date.now();
  const signal = AbortSignal.timeout(Math.max(0, left()));
  const late = () => left() <= 0;

  const from = nowMs - settings.daysBack * DAY;
  const to = nowMs + settings.daysAhead * DAY;
  const abort = (read, reason) => { mwarn("abort", { read, reason }); return { aborted: true, read, reason }; };

  // READS FIRST, all of them, every page. One failure and nothing is written.
  const sources = [];
  for (const c of bookingsCalendars()) {
    const r = await listWindow(c.calendarId, from, to, { signal });
    if (!r.ok) return abort(`${c.detailer} bookings`, r.reason);
    sources.push({ calendarId: c.calendarId, label: r.label || c.calendarId, detailer: c.detailer, events: r.events });
  }
  const master = await listWindow(masterId, from, to, { signal });
  if (!master.ok) return abort("master", master.reason);

  const plan = planMirror(sources, master.events, settings, masterEventId);
  const out = { created: 0, updated: 0, restored: 0, putBack: 0, cancelled: 0, held: 0, failed: 0, foreign: plan.foreign.length, duplicates: plan.duplicates.length, skipped: plan.skipped, unread: 0, stopped: false };
  const failed = (action, key, reason) => { out.failed++; mwarn(`${action}-failed`, { key, reason }); };

  if (plan.foreign.length) mwarn("not-ours", { count: plan.foreign.length, ids: plan.foreign.slice(0, 20) });
  if (plan.duplicates.length) mwarn("duplicate-copy", { count: plan.duplicates.length, ids: plan.duplicates.slice(0, 20) });

  const updateAll = async (updates) => {
    for (const u of updates) {
      if (late()) { out.stopped = true; return; }
      const r = await updateCopy(masterId, u.id, u.have, u.body, { signal });
      if (!r.ok) { failed(u.restore ? "restore" : "update", u.key, r.reason); continue; }
      if (u.restore) out.restored++;
      else out.updated++;
      mlog(u.restore ? "restore" : "update", { key: u.key, id: u.id });
    }
  };

  // COPIES, from complete reads: new ones, then changed ones.
  for (const c of plan.creates) {
    if (late()) { out.stopped = true; break; }
    const r = await writeCopy(masterId, c.key, c.body, { overwrite: true, signal });
    if (!r.ok) { failed("create", c.key, r.reason); continue; }
    if (r.action === "exists") continue;
    if (r.action === "created") out.created++;
    else if (r.action === "put-back") out.putBack++;
    else out.updated++;
    mlog(r.action, { key: c.key, id: r.id });
  }
  await updateAll(plan.updates);

  // LOOK-UPS: a copy whose original wasn't in the reads. Moved out of the
  // window or still there: the copy follows it. Gone: a cancellation. Only
  // on a calendar read this run: a copy from any other (a detailer taken out
  // of DETAILERS) is never looked up and never marked.
  const read = new Set(sources.map((c) => c.calendarId));
  const gone = [];
  const follow = [];
  let lookupsDone = true;
  for (const x of plan.missing) {
    const src = splitSourceId(x.copy.extendedProperties?.private?.sourceId);
    if (!src) continue;
    if (!read.has(src.calendarId)) { out.unread++; continue; }
    if (late()) { lookupsDone = false; break; }
    const l = await lookupOriginal(src.calendarId, src.eventId, { readThisRun: true, signal });
    if (l.state === "error") {
      lookupsDone = false;
      if (late()) break;
      mwarn("abort-cancels", { read: `look-up ${x.id}`, reason: l.reason });
      break;
    }
    if (l.state === "gone") { gone.push(x); continue; }
    if (!isJob(l.event)) { mlog("kept", { id: x.id, key: x.key }); continue; }
    const s = sources.find((c) => c.calendarId === src.calendarId);
    const want = masterCopy({ original: l.event, key: x.key, calendarId: s.calendarId, label: s.label, detailer: s.detailer, settings });
    if (!sameCopy(x.copy, want)) follow.push({ id: x.id, key: x.key, have: x.copy, body: want, restore: false });
  }
  if (out.unread) mwarn("unread-source", { count: out.unread, note: "copies whose bookings calendar was not read this run: left as they are" });
  await updateAll(follow);

  // CANCELS: only when every look-up ran, so the count of jobs gone is known.
  if (!lookupsDone || late()) {
    out.stopped = out.stopped || late();
    mlog("cancels-skipped", { confirmed: gone.length, note: late() ? "out of time before every look-up ran" : "a look-up failed" });
  } else if (gone.length > settings.maxCancelsPerRun) {
    out.held = gone.length;
    mwarn("cancel-cap", { gone: gone.length, max: settings.maxCancelsPerRun });
    // Once: each held copy is tagged after Elijah has been told about it.
    const fresh = gone.filter((x) => x.copy.extendedProperties?.private?.cancelHeld !== "1");
    const told = fresh.length && mail
      ? await inTime(Promise.resolve(mail(heldEmail(gone.length, settings.maxCancelsPerRun))), Math.max(1, left())).catch(() => false)
      : false;
    if (told) {
      mlog("cancel-cap-emailed", { gone: gone.length });
      for (const x of fresh) {
        const r = await patchCopy(masterId, x.id, { extendedProperties: { private: { cancelHeld: "1" } } }, { signal });
        if (!r.ok) mwarn("cancel-cap-tag-failed", { key: x.key, reason: r.reason });
      }
    } else if (fresh.length) {
      mwarn("cancel-cap-email-failed", { gone: gone.length });
    }
  } else {
    for (const x of gone) {
      if (late()) { out.stopped = true; break; }
      const r = settings.cancelMode === "delete"
        ? await deleteCopy(masterId, x.id, { signal })
        : await patchCopy(masterId, x.id, cancelledPatch(x.copy, settings), { signal });
      if (!r.ok) { failed("cancel", x.key, r.reason); continue; }
      out.cancelled++;
      mlog(settings.cancelMode === "delete" ? "cancel-delete" : "cancel", { key: x.key, id: x.id });
    }
  }
  if (out.stopped) mlog("budget", { note: "out of time; the next run carries on" });
  return out;
}

export async function handler() {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM || "513 Auto Clean <onboarding@resend.dev>";
    const owner = process.env.OWNER_EMAIL || "elijahthackerllc@gmail.com";
    const mail = apiKey ? (msg) => send(apiKey, from, owner, msg) : null;
    const out = await reconcile({ mail });
    if (!out.off) mlog("run", out);
    return { statusCode: 200, body: "ok" };
  } catch (err) {
    mwarn("run-failed", { reason: String(err?.message || err).slice(0, 300) });
    return { statusCode: 500, body: "failed" };
  }
}
