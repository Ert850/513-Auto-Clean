import { MASTER_CALENDAR, NOT_A_JOB, cancelledPatch, masterCopy, parseDetailers, planMirror, sameCopy, splitSourceId } from "./_pricing.mjs";
import { bookedCalendarId, gcalConfigured } from "./_gcal.mjs";
import { deleteCopy, listWindow, lookupOriginal, masterCalendarId, masterClash, mlog, mwarn, patchCopy, putCopy, writeCopy } from "./_mastercal.mjs";
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
 *  - every read comes first, and one failure means nothing is written that run;
 *  - a copy is marked cancelled only after a direct look-up finds its original
 *    deleted (status cancelled, or 404);
 *  - more than maxCancelsPerRun (config/master-calendar.json) looking deleted
 *    at once means something else is wrong: none are marked, and Elijah is
 *    emailed once;
 *  - it writes to the master calendar and nowhere else, and never to a master
 *    that is also a calendar the site reads (masterClash).
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

  const crewNames = parseDetailers(process.env.DETAILERS).crew.map((d) => d.name);
  const from = nowMs - settings.daysBack * DAY;
  const to = nowMs + settings.daysAhead * DAY;
  const abort = (read, reason) => { mwarn("abort", { read, reason }); return { aborted: true, read, reason }; };

  // READS FIRST, all of them, every page. One failure and nothing is written.
  const sources = [];
  for (const c of bookingsCalendars()) {
    const r = await listWindow(c.calendarId, from, to);
    if (!r.ok) return abort(`${c.detailer} bookings`, r.reason);
    sources.push({ calendarId: c.calendarId, label: r.label || c.calendarId, detailer: c.detailer, events: r.events });
  }
  const master = await listWindow(masterId, from, to);
  if (!master.ok) return abort("master", master.reason);

  const plan = planMirror(sources, master.events, crewNames, settings);

  // A copy whose original wasn't in the reads: looked up directly. Moved out
  // of the window or still there: the copy follows it. Gone: a cancellation.
  const gone = [];
  for (const x of plan.missing) {
    const src = splitSourceId(x.copy.extendedProperties?.private?.sourceId);
    if (!src) continue;
    const l = await lookupOriginal(src.calendarId, src.eventId);
    if (l.state === "error") return abort(`look-up ${x.id}`, l.reason);
    if (l.state === "gone") { gone.push(x); continue; }
    const s = sources.find((c) => c.calendarId === src.calendarId);
    if (!s || NOT_A_JOB.test(String(l.event.summary ?? "").trim())) { mlog("kept", { id: x.id, key: x.key }); continue; }
    const want = masterCopy({ original: l.event, key: x.key, calendarId: s.calendarId, label: s.label, detailer: s.detailer, crewNames, settings });
    if (!sameCopy(x.copy, want)) plan.updates.push({ id: x.id, key: x.key, body: want, restore: false });
  }

  const out = { created: 0, updated: 0, restored: 0, putBack: 0, cancelled: 0, held: 0, failed: 0, foreign: plan.foreign.length, duplicates: plan.duplicates.length, skipped: plan.skipped, stopped: false };
  const late = () => Date.now() - startMs > settings.runBudgetMs;
  const failed = (action, key, reason) => { out.failed++; mwarn(`${action}-failed`, { key, reason }); };

  if (plan.foreign.length) mwarn("not-ours", { count: plan.foreign.length, ids: plan.foreign.slice(0, 20) });
  if (plan.duplicates.length) mwarn("duplicate-copy", { count: plan.duplicates.length, ids: plan.duplicates.slice(0, 20) });

  for (const c of plan.creates) {
    if (late()) { out.stopped = true; break; }
    const r = await writeCopy(masterId, c.key, c.body, { overwrite: true });
    if (!r.ok) { failed("create", c.key, r.reason); continue; }
    if (r.action === "exists") continue;
    if (r.action === "created") out.created++;
    else if (r.action === "put-back") out.putBack++;
    else out.updated++;
    mlog(r.action, { key: c.key, id: r.id });
  }

  for (const u of plan.updates) {
    if (late()) { out.stopped = true; break; }
    const r = await putCopy(masterId, u.id, u.body);
    if (!r.ok) { failed(u.restore ? "restore" : "update", u.key, r.reason); continue; }
    if (u.restore) out.restored++;
    else out.updated++;
    mlog(u.restore ? "restore" : "update", { key: u.key, id: u.id });
  }

  if (gone.length > settings.maxCancelsPerRun) {
    out.held = gone.length;
    mwarn("cancel-cap", { gone: gone.length, max: settings.maxCancelsPerRun });
    // Once: each held copy is tagged after Elijah has been told about it.
    const fresh = gone.filter((x) => x.copy.extendedProperties?.private?.cancelHeld !== "1");
    if (fresh.length && mail && (await mail(heldEmail(gone.length, settings.maxCancelsPerRun)))) {
      mlog("cancel-cap-emailed", { gone: gone.length });
      for (const x of fresh) await patchCopy(masterId, x.id, { extendedProperties: { private: { cancelHeld: "1" } } });
    }
  } else {
    for (const x of gone) {
      if (late()) { out.stopped = true; break; }
      const r = settings.cancelMode === "delete"
        ? await deleteCopy(masterId, x.id)
        : await patchCopy(masterId, x.id, cancelledPatch(x.copy, settings));
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
