/**
 * Who a booking was given to, as THIS deploy knows them.
 *
 * Shared by every function that prices or records a booking
 * (send-confirmation, create-payment, paypal-order), so they cannot disagree
 * about a detailer or about the fee-free hours they work (DETAILERS
 * `noFeeStarts`, e.g. Kris at 6 to 7pm). One copy here; it used to live in
 * send-confirmation alone, and the payment functions charged the late fee
 * the booking email had waived (November 10).
 *
 * Only a name in this deploy's own DETAILERS setting counts, and only for a
 * job they do, so a request cannot pick a calendar or claim a waiver.
 * Anything else is the owner.
 */
import { parseDetailers, waivesFeeAt, canDo, wireNeeds, loadWindow, blockFeeAt, localMinutesOfDay, DEFAULT_RULES, checkRange, slotStillFree } from "./_pricing.mjs";
import { readPersonal } from "./personal-busy.mjs";

/** Elijah's OPEN blocks live on 513 Availability (as js/config.template.js). */
const OWNER_AVAILABILITY = process.env.GOOGLE_OWNER_AVAILABILITY_ID ||
  "9f26a370ac8629b6df3f7f4e8181aa1086f3acb2b47866e01a1b868cd4ab8161@group.calendar.google.com";
/** 513 Auto Clean, the browser's googleCalendarId (the same default as render-config.mjs). */
const OWNER_CALENDAR = process.env.GOOGLE_CALENDAR_ID ||
  "75726fed82aa92a27201386beda7b3a15f550a3a5691e5e6cfc51382f0f0b9cf@group.calendar.google.com";

/**
 * The calendars the owner's fee is read from: every one the booking form
 * reads in full (calendarCfgFor in js/funnel.js), so the fee charged is the
 * fee quoted wherever an OPEN block lives. Only 513 Availability was read,
 * so an "OPEN +20%" on 513 Auto Clean was quoted and never charged (review,
 * November 13). Busy-only calendars are skipped: they hold jobs, not OPEN
 * blocks, and can't be read in full.
 */
export function ownerFeeCalendars(env = process.env) {
  const busyOnly = String(env.GOOGLE_BUSY_ONLY_CALENDAR_IDS || "").split(",").map((x) => x.trim()).filter(Boolean);
  const ids = [env.GOOGLE_CALENDAR_ID || OWNER_CALENDAR, env.GOOGLE_OWNER_AVAILABILITY_ID || OWNER_AVAILABILITY];
  return ids.filter((id, i) => id && !busyOnly.includes(id) && ids.indexOf(id) === i);
}

/**
 * The detailer for an id from a request body, or null for the owner.
 *
 * With the cart, only a detailer who does every part of that job: a request
 * naming Kris for an exterior job used to get his fee-free 6pm and his
 * calendar (engine check, November 10). The booking form never sends that;
 * only an edited request does.
 */
export function detailerFor(raw, cart) {
  const id = typeof raw === "string" ? raw.trim().slice(0, 40) : "";
  if (!id) return null;
  const { crew } = parseDetailers(process.env.DETAILERS);
  const d = crew.find((x) => x.id === id && !x.owner) ?? null;
  if (d && cart && !canDo(d, wireNeeds(cart))) return null;
  return d;
}

/**
 * The early or late fee for this start, from the calendar of whoever takes
 * it (fee standard B, owner, November 10): the OPEN block it starts in,
 * "OPEN" for none, "OPEN +20%" for 20%. Returned as basis points for
 * priceFromWire's `blockFeeBp`, or null for the clock rule (no OPEN blocks).
 *
 * If the calendar cannot be read right now, the fee the customer was shown
 * stands, as long as it is no more than the clock rule would charge: a
 * Google outage never costs a booking, and never charges more than was seen.
 */
export async function blockFeeFor(detailer, slotMs, shownBp) {
  if (!slotMs) return null;
  // A server-only key first: the browser key can then be locked to the site's
  // own pages (an HTTP-referrer restriction), which a function call never
  // passes. Without one, the browser key is used, as before.
  const apiKey = process.env.GOOGLE_CALENDAR_SERVER_KEY || process.env.GOOGLE_CALENDAR_API_KEY || process.env.GOOGLE_API_KEY;
  const ids = detailer ? [detailer.availabilityCalendarId].filter(Boolean) : ownerFeeCalendars();
  if (apiKey && ids.length) {
    try {
      const win = await loadWindow({ calendarId: ids[0], extraCalendarIds: ids.slice(1), apiKey }, slotMs - 12 * 3600_000, slotMs + 12 * 3600_000);
      const fee = blockFeeAt(win, slotMs);
      if (fee !== null) return fee;
      // Read fine, but no OPEN block holds this start: the detailer is not
      // working then (Kris on a Friday since November 12), so there is no
      // fee-free start to honour. The plain clock rule, never the
      // `noFeeStarts` waiver, which only stands in when the calendar cannot
      // be read (audit, November 12: an edited request naming Kris for a
      // Friday 6pm got 0% late fee).
      const mm = localMinutesOfDay(slotMs);
      const rr = DEFAULT_RULES.surcharge;
      return mm < rr.earlyBeforeMinutes || mm >= rr.lateFromMinutes ? rr.timeOfDayBp : 0;
    } catch (e) {
      console.error("fee calendar", String(e).slice(0, 200));
    }
  }
  const m = localMinutesOfDay(slotMs);
  const r = DEFAULT_RULES.surcharge;
  const clock = (m < r.earlyBeforeMinutes || m >= r.lateFromMinutes) && !timeFeeWaived(detailer, slotMs) ? r.timeOfDayBp : 0;
  const shown = Number(shownBp);
  return Number.isFinite(shown) && shown >= 0 && shown <= clock ? Math.round(shown) : null;
}

/** The server-only calendar key first, else the browser key (see blockFeeFor). */
function calendarKey(env = process.env) {
  return env.GOOGLE_CALENDAR_SERVER_KEY || env.GOOGLE_CALENDAR_API_KEY || env.GOOGLE_API_KEY || "";
}

/**
 * Is this start still free for whoever was given it, on the calendar as it
 * is right now (calendar fix 1, November 14)? The same calendars the booking
 * form reads for them (calendarCfgFor in js/funnel.js) and the same check
 * (slotStillFree), so the two cannot disagree about what is free.
 *
 * "free", "taken", "unread" (a calendar failed: the booking goes through as
 * a request, never silently onto a taken time), or "unconfigured" (nothing
 * to check against, as in the form).
 *
 * The drive: with one detailer the form allows for the drive measured at the
 * appointment, as `job.driveMin` is here. With several, it allows for each
 * one's drive measured with no time of day (measureEachDetailer), which
 * `plainDrive()` measures the same way. When only the longer drive makes the
 * time fail, it was offered in good faith and is kept (`tight`); a refusal
 * is only for a real clash on the form's own terms (review, November 14:
 * a zero-minute retry let a real clash through).
 */
export async function slotStatus(detailer, job, env = process.env, plainDrive = null) {
  const apiKey = calendarKey(env);
  const busyOnly = String(env.GOOGLE_BUSY_ONLY_CALENDAR_IDS || "").split(",").map((x) => x.trim()).filter(Boolean);
  const cfg = detailer
    ? { calendarId: detailer.availabilityCalendarId, busyOnlyIds: [detailer.bookingsCalendarId].filter(Boolean), apiKey }
    : { calendarId: env.GOOGLE_CALENDAR_ID || OWNER_CALENDAR, extraCalendarIds: [env.GOOGLE_OWNER_AVAILABILITY_ID || OWNER_AVAILABILITY], busyOnlyIds: busyOnly, apiKey };
  // The arrival window of whoever has the time, as the form uses it.
  const who = detailer ?? parseDetailers(env.DETAILERS).crew.find((x) => x.owner);
  job = { ...job, arrivalWindowMin: who?.arrivalWindowMin };
  const range = checkRange(job);
  if (!apiKey || !cfg.calendarId || !range) return { status: "unconfigured" };
  try {
    const [win, personal] = await Promise.all([
      loadWindow(cfg, range.from, range.to),
      // Elijah's personal calendar, on his times only. As in the form, its
      // failing never blocks a booking.
      detailer ? { body: { busy: [] } } : readPersonal().catch(() => ({})),
    ]);
    const cal = { open: win.open, busy: [...(win.busy || []), ...(personal.body?.busy || [])] };
    const res = slotStillFree(job, cal);
    if (res.free) return { status: "free", lateMin: res.lateMin };
    if (plainDrive && parseDetailers(env.DETAILERS).crew.length > 1) {
      const formDrive = await plainDrive().catch(() => null);
      if (Number.isFinite(formDrive) && formDrive < job.driveMin) {
        const lenient = slotStillFree({ ...job, driveMin: formDrive }, cal);
        if (lenient.free) return { status: "free", lateMin: lenient.lateMin, tight: true };
      }
    }
    return { status: "taken" };
  } catch (e) {
    console.error("still free", String(e).slice(0, 200));
    return { status: "unread" };
  }
}

/**
 * Where a detailer drives from: DETAILER_HOMES in Netlify, a server-only
 * setting (never written into the page, unlike DETAILERS, because it holds
 * home addresses), as JSON by name, any number of detailers:
 *   {"Kris": "123 Main St, Cincinnati, OH 45202"}
 * Null for the owner, or anyone not listed: the shop address
 * (SHOP_ORIGIN_ADDRESS), as before.
 */
export function homeFor(detailer) {
  if (!detailer || detailer.owner) return null;
  let homes;
  try { homes = JSON.parse(process.env.DETAILER_HOMES || "{}"); } catch { return null; }
  if (!homes || typeof homes !== "object") return null;
  for (const [k, v] of Object.entries(homes)) {
    const key = String(k).trim().toLowerCase();
    if ((key === detailer.id || key === String(detailer.name || "").trim().toLowerCase()) && typeof v === "string" && v.trim()) {
      return v.trim().slice(0, 200);
    }
  }
  return null;
}

/** No early or late fee for this start, because this detailer works it anyway. */
export function timeFeeWaived(detailer, slotMs) {
  return Boolean(detailer && slotMs && waivesFeeAt(detailer, slotMs));
}
