/**
 * The master calendar, 513 All Jobs (docs/MASTER-CALENDAR-SETUP.md): the copy
 * written at booking time (send-confirmation.mjs) and the scheduled
 * reconciler (jobs-mirror.mjs), against a stand-in Google Calendar. Nothing
 * here reaches a real calendar.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fakeGoogle } from "./fake-gcal.js";
import { MASTER_CALENDAR, checkMasterCalendar, masterTitle, planMirror, sourceIdOf } from "./availability/masterCalendar.js";
import { localDayStart, localTimeOnDay } from "./time/zone.js";
import { priceFromWire, type WireCart } from "./server-entry.js";
// @ts-expect-error: plain ESM Netlify function, no types
import { bookingEvents, handler, redact } from "../../netlify/functions/send-confirmation.mjs";
// @ts-expect-error: plain ESM Netlify function, no types
import { reconcile, handler as mirrorHandler } from "../../netlify/functions/jobs-mirror.mjs";
// @ts-expect-error: plain ESM Netlify function, no types
import { copyBookingToMaster, lookupOriginal, masterClash, masterEventId, siteCalendars } from "../../netlify/functions/_mastercal.mjs";
import { resetRateLimits } from "../../netlify/functions/_ratelimit.mjs";

const TZ = "America/New_York";
const DAY = 86_400_000;
const MASTER = "master-all-jobs@group.calendar.google.com";
const OWNER_JOBS = "owner-jobs@group.calendar.google.com";
const KRIS_JOBS = "kris-jobs@group.calendar.google.com";
const KRIS_OPEN = "kris-open@group.calendar.google.com";

// The patterns JobsSync reads titles and descriptions with (jobs-sync-contract.test.ts).
const DETAILER = /^(?:SHORT NOTICE[^:]*:\s*)?([A-Z][a-z]+):/;
const CONTINUATION_DAY = /^(?:SHORT NOTICE[^:]*:\s*)?(?:[A-Z][a-z]+:\s*)?Day \d+ of \d+\b/;
const TOTAL = /TOTAL:\s*\$([\d,]+(?:\.\d\d)?)/i;

// A Tuesday well ahead, 1 pm: never short notice.
const D0 = (() => {
  let d = localDayStart(Date.now() + 10 * DAY, TZ);
  while (new Date(d + 12 * 3_600_000).getUTCDay() !== 2) d = localDayStart(d + DAY + 3_600_000, TZ);
  return d;
})();
const SLOT = localTimeOnDay(D0, 0, 13 * 60, TZ);

const ENV: Record<string, string | undefined> = {
  GOOGLE_OAUTH_CLIENT_ID: "id",
  GOOGLE_OAUTH_CLIENT_SECRET: "secret",
  GOOGLE_OAUTH_REFRESH_TOKEN: "refresh",
  GOOGLE_BOOKED_CALENDAR_ID: OWNER_JOBS,
  DETAILERS: JSON.stringify([{ name: "Kris", does: "interior", availability: KRIS_OPEN, bookings: KRIS_JOBS }]),
  RESEND_API_KEY: "re_fake",
  OWNER_EMAIL: "owner@example.com",
  // Cleared, so nothing reaches past the stand-in.
  ALL_JOBS_CALENDAR_ID: undefined,
  GOOGLE_SERVICE_ACCOUNT_JSON: undefined,
  GOOGLE_CALENDAR_ID: undefined,
  GOOGLE_OWNER_AVAILABILITY_ID: undefined,
  GOOGLE_BUSY_ONLY_CALENDAR_IDS: undefined,
  GOOGLE_CALENDAR_SERVER_KEY: undefined,
  GOOGLE_CALENDAR_API_KEY: undefined,
  GOOGLE_API_KEY: undefined,
  GOOGLE_MAPS_SERVER_KEY: undefined,
  TURNSTILE_SECRET_KEY: undefined,
  PERSONAL_CALENDAR_ICS: undefined,
};
const saved: Record<string, string | undefined> = {};
const setEnv = (k: string, v: string | undefined) => { if (v === undefined) delete process.env[k]; else process.env[k] = v; };

let logs: string[] = [];
beforeEach(() => {
  for (const [k, v] of Object.entries(ENV)) { saved[k] = process.env[k]; setEnv(k, v); }
  resetRateLimits();
  logs = [];
  const keep = (...a: unknown[]) => { logs.push(a.map(String).join(" ")); };
  vi.spyOn(console, "log").mockImplementation(keep);
  vi.spyOn(console, "warn").mockImplementation(keep);
  vi.spyOn(console, "error").mockImplementation(keep);
});
afterEach(() => {
  for (const k of Object.keys(ENV)) setEnv(k, saved[k]);
  vi.restoreAllMocks();
});

function google(opts = {}) {
  const g = fakeGoogle(opts);
  g.cal(OWNER_JOBS, "513 Auto Clean");
  g.cal(KRIS_JOBS, "513 Kris Bookings");
  g.cal(MASTER, "513 All Jobs");
  g.install();
  return g;
}

function payload(over: Record<string, unknown> = {}) {
  return {
    cart: {
      vehicles: [{ sizeId: "small", packageIds: ["basic-interior"] }],
      address: { line1: "1 Main St", city: "Cincinnati", region: "OH", zip: "45220" },
      slot: SLOT,
    },
    contact: { name: "Ada Test", phone: "5135551212", email: "ada@example.com" },
    mode: "card_only",
    detailer: "kris",
    idempotencyKey: "key-1",
    ...over,
  };
}
const book = (p = payload()) => {
  resetRateLimits();
  return handler({ httpMethod: "POST", headers: {}, body: JSON.stringify(p) }) as Promise<{ statusCode: number; body: string }>;
};
const mailTo = (g: ReturnType<typeof fakeGoogle>, to: string) => g.emails.find((e) => e.to.includes(to));
const masterLines = () => logs.filter((l) => l.startsWith("[master-cal]"));

/* ------------------------------------------------------------------ */

describe("the settings, config/master-calendar.json", () => {
  it("load, and a bad value fails the build", () => {
    expect(MASTER_CALENDAR.cancelMode).toBe("mark");
    expect(MASTER_CALENDAR.maxCancelsPerRun).toBe(10);
    expect(MASTER_CALENDAR.colors["elijah"]).toBe("7");
    const raw = JSON.parse(fs.readFileSync(path.join(__dirname, "../../config/master-calendar.json"), "utf8"));
    expect(() => checkMasterCalendar({ ...raw, cancelMode: "erase" })).toThrow(/cancelMode/);
    expect(() => checkMasterCalendar({ ...raw, cancelledColor: "12" })).toThrow(/cancelledColor/);
    expect(() => checkMasterCalendar({ ...raw, maxCancelsPerRun: -1 })).toThrow(/maxCancelsPerRun/);
  });
});

describe("the copy's title, read as JobsSync reads titles", () => {
  it("names the detailer first, Elijah too, after any SHORT NOTICE prefix", () => {
    expect(masterTitle("Full Interior, Jane Doe", "Elijah")).toBe("Elijah: Full Interior, Jane Doe");
    expect(masterTitle("Kris: Full Interior, Jane Doe", "Kris")).toBe("Kris: Full Interior, Jane Doe");
    const short = masterTitle("SHORT NOTICE, accept or decline: Full Interior, Jane Doe", "Elijah");
    expect(short).toBe("SHORT NOTICE, accept or decline: Elijah: Full Interior, Jane Doe");
    expect(short.match(DETAILER)?.[1]).toBe("Elijah");
    const day2 = masterTitle("Day 2 of 2, Paint Correction, Jane Doe", "Elijah");
    expect(CONTINUATION_DAY.test(day2)).toBe(true);
    expect(day2.match(DETAILER)?.[1]).toBe("Elijah");
    // A name already in the title wins over the calendar's detailer, as in JobsSync.
    expect(masterTitle("Kris: Full Interior, Jane Doe", "Elijah")).toBe("Kris: Full Interior, Jane Doe");
    expect(masterTitle("SHORT NOTICE, accept or decline: Kris: Full Interior, Jane Doe", "Elijah")).toBe("SHORT NOTICE, accept or decline: Kris: Full Interior, Jane Doe");
  });
});

/* ------------------------------------------------------------------ */

describe("the copy at booking time (send-confirmation)", () => {
  async function run(master: string | undefined, setup: (g: ReturnType<typeof fakeGoogle>) => void = () => {}) {
    const g = google();
    setup(g);
    setEnv("ALL_JOBS_CALENDAR_ID", master);
    const t0 = Date.now();
    try {
      const r = await book();
      return { r, g, ms: Date.now() - t0, calls: g.calls.filter((c) => !c.url.startsWith("https://oauth2.")) };
    } finally {
      g.restore();
    }
  }
  const notMaster = (calls: { calendarId: string | null }[]) => calls.filter((c) => c.calendarId !== MASTER);

  it("off (unset, empty or blank): the same calls, the same reply, nothing near the master", async () => {
    const unset = await run(undefined);
    const empty = await run("");
    const blank = await run("   ");
    expect(unset.r.statusCode).toBe(200);
    // The booking did its usual work: the retry look-up, the event, both emails.
    expect(unset.calls.map((c) => `${c.method} ${c.calendarId ?? new URL(c.url).host}`)).toEqual([
      `GET ${KRIS_JOBS}`, `POST ${KRIS_JOBS}`, "POST api.resend.com", "POST api.resend.com",
    ]);
    expect(empty.calls).toEqual(unset.calls);
    expect(blank.calls).toEqual(unset.calls);
    expect(empty.r).toEqual(unset.r);
    expect(blank.r).toEqual(unset.r);
    expect(unset.calls.some((c) => c.calendarId === MASTER)).toBe(false);
    expect(unset.g.live(MASTER)).toHaveLength(0);
    expect(masterLines().filter((l) => !l.includes('"off"'))).toEqual([]);
  });

  it("on, failing or hanging: the reply, the calendar writes and both emails are exactly as when off, and the copy comes after both emails", async () => {
    const off = await run(undefined);
    const cases = {
      on: await run(MASTER),
      failing: await run(MASTER, (g) => { g.cal(MASTER).failWrite = true; }),
      hanging: await run(MASTER, (g) => { g.cal(MASTER).hang = true; }),
    };
    for (const [name, c] of Object.entries(cases)) {
      expect(c.r, name).toEqual(off.r);
      // Every call but the master's, Resend's bodies (both emails) included, in the same order.
      expect(notMaster(c.calls), name).toEqual(off.calls);
      expect(c.g.emails, name).toEqual(off.g.emails);
      expect(c.g.live(KRIS_JOBS).map((e) => ({ ...e, id: "", created: "" })), name).toEqual(off.g.live(KRIS_JOBS).map((e) => ({ ...e, id: "", created: "" })));
      // The master's one call is the last one, after the second email.
      const i = c.calls.findIndex((x) => x.calendarId === MASTER);
      expect(i, name).toBe(c.calls.length - 1);
      expect(c.calls.slice(0, i).filter((x) => x.url.includes("api.resend.com")), name).toHaveLength(2);
      expect(c.calls[i]!.method, name).toBe("POST");
      expect(c.r.body, name).not.toMatch(/master|all jobs/i);
      for (const e of c.g.emails) expect(e.html, name).not.toMatch(/all jobs|NOT ON 513/i);
    }
    expect(cases.on.g.live(MASTER)).toHaveLength(1);
    // A master that never answers costs at most writeTimeoutMs.
    expect(cases.hanging.ms).toBeLessThan(MASTER_CALENDAR.writeTimeoutMs + 1500);
  }, 20_000);

  it("writes the copy straight away: detailer named, header then the original word for word, its colour, the same key; the reconciler then writes the calendar's name", async () => {
    const g = google();
    setEnv("ALL_JOBS_CALENDAR_ID", MASTER);
    try {
      await book();
      const [orig] = g.live(KRIS_JOBS);
      const [copy] = g.live(MASTER);
      expect(g.live(MASTER)).toHaveLength(1);
      // One POST, nothing looked up first.
      expect(g.calls.filter((c) => c.calendarId === MASTER).map((c) => c.method)).toEqual(["POST"]);
      expect(copy!.id).toBe(masterEventId("key-1"));
      expect(copy!.summary).toBe(orig!.summary);
      expect(copy!.summary).toMatch(/^Kris: /);
      expect(copy!.description).toBe(
        `Status: Booked\nDetailer: Kris\nBooking key: key-1\nSource calendar: ${KRIS_JOBS}\n---\n${orig!.description}`,
      );
      expect(copy!.description).toMatch(TOTAL);
      expect(copy!.location).toBe(orig!.location);
      expect(copy!.location).toMatch(/45220$/);
      expect(Date.parse(copy!.start!.dateTime!)).toBe(SLOT);
      expect(copy!.end).toEqual(orig!.end);
      expect(copy!.transparency).toBe("opaque");
      expect(copy!.colorId).toBe("10");
      expect(copy!.extendedProperties?.private).toEqual({ bookingKey: "key-1", sourceId: `${KRIS_JOBS}|${orig!.id}` });
      // Only the key and the source: the original's private phone is not copied.
      expect(JSON.stringify(copy!.extendedProperties)).not.toContain("5135551212");
      // Logged by key, never by name, phone or email.
      expect(masterLines().some((l) => l.includes('"copy"') && l.includes("key-1"))).toBe(true);
      expect(logs.join("\n")).not.toMatch(/5135551212|ada@example\.com|Ada Test/);

      expect(await reconcile({ nowMs: Date.now() })).toMatchObject({ created: 0, updated: 1, failed: 0 });
      expect(g.live(MASTER)[0]!.description).toBe(
        `Status: Booked\nDetailer: Kris\nBooking key: key-1\nSource calendar: 513 Kris Bookings\n---\n${orig!.description}`,
      );
      expect(g.live(MASTER)).toHaveLength(1);
    } finally { g.restore(); }
  });

  it("an owner's job is titled Elijah: and takes his colour", async () => {
    const g = google();
    setEnv("ALL_JOBS_CALENDAR_ID", MASTER);
    try {
      await book(payload({ detailer: "" }));
    } finally { g.restore(); }
    const [orig] = g.live(OWNER_JOBS);
    const [copy] = g.live(MASTER);
    expect(orig!.summary).not.toMatch(DETAILER);
    expect(copy!.summary).toBe(`Elijah: ${orig!.summary}`);
    expect(copy!.summary!.match(DETAILER)?.[1]).toBe("Elijah");
    expect(copy!.colorId).toBe("7");
    expect(copy!.description).toMatch(new RegExp(`^Status: Booked\nDetailer: Elijah\nBooking key: key-1\nSource calendar: ${OWNER_JOBS.replace(/\./g, "\\.")}\n---\n`));
  });

  it("a retry never makes a second copy, and after the reconciler's one label fix there is nothing to change", async () => {
    const g = google();
    setEnv("ALL_JOBS_CALENDAR_ID", MASTER);
    try {
      await book();
      const again = await book();
      expect(JSON.parse(again.body).duplicate).toBe(true);
      expect(g.live(MASTER)).toHaveLength(1);
      expect(await reconcile({ nowMs: Date.now() })).toMatchObject({ created: 0, updated: 1, cancelled: 0, failed: 0 });
      const before = g.writes().length;
      expect(await reconcile({ nowMs: Date.now() })).toMatchObject({ created: 0, updated: 0, cancelled: 0, failed: 0 });
      expect(g.writes().length).toBe(before);
      expect(g.live(MASTER)).toHaveLength(1);
    } finally { g.restore(); }
  });

  it("the same copy written twice directly is one copy (409 is 'already there')", async () => {
    const g = google();
    setEnv("ALL_JOBS_CALENDAR_ID", MASTER);
    try {
      const written = [{ summary: "Kris: Basic Interior, Ada", description: "d", location: "x, 45220", startMs: SLOT, endMs: SLOT + 3_600_000, key: "k9", id: "o9" }];
      const a = await copyBookingToMaster({ written, calendarId: KRIS_JOBS, detailerName: "Kris" });
      const b = await copyBookingToMaster({ written, calendarId: KRIS_JOBS, detailerName: "Kris" });
      expect(a.ok && b.ok).toBe(true);
      expect(g.live(MASTER)).toHaveLength(1);
      expect(masterLines().some((l) => l.includes('"copy-exists"'))).toBe(true);
    } finally { g.restore(); }
  });

  it("a master that fails: logged only, by key; the reconciler copies the job on its next run", async () => {
    const g = google();
    g.cal(MASTER).failWrite = true;
    setEnv("ALL_JOBS_CALENDAR_ID", MASTER);
    try {
      const r = await book();
      expect(r.statusCode).toBe(200);
      expect(g.live(MASTER)).toHaveLength(0);
      expect(masterLines().some((l) => l.includes('"copy-failed"') && l.includes("key-1") && l.includes("http_503"))).toBe(true);
      expect(logs.join("\n")).not.toMatch(/5135551212|ada@example\.com|Ada Test/);
      g.cal(MASTER).failWrite = false;
      expect(await reconcile({ nowMs: Date.now() })).toMatchObject({ created: 1, failed: 0 });
      expect(g.live(MASTER)[0]!.id).toBe(masterEventId("key-1"));
    } finally { g.restore(); }
  });

  it("a job over several days: one copy per day, all at once, day 2 skipped by JobsSync's pattern, its own key", async () => {
    const g = google();
    setEnv("ALL_JOBS_CALENDAR_ID", MASTER);
    try {
      const cart: WireCart = {
        vehicles: [{ sizeId: "small", packageIds: ["full-interior"] }],
        zip: "45040",
        address: { line1: "5555 Tylersville Rd", city: "Mason", region: "OH", zip: "45040" },
        slot: SLOT, kind: "booking", payInFull: false,
      };
      const priced = priceFromWire(cart, { nowMs: Date.now() });
      const events = bookingEvents({
        contact: { name: "Test Customer", phone: "5135550100", email: "" },
        cart, priced: { ...priced, serviceDurationMin: 1200 }, payInFull: false, kind: "booking", detailer: { name: "Kris" },
        extras: {}, nowMs: Date.now(), measuredMin: 30,
      }) as { summary: string; description: string; location: string; startMs: number; endMs: number }[];
      expect(events.length).toBeGreaterThan(1);
      const written = events.map((e, i) => ({ ...e, key: i ? `km:day${i + 1}` : "km", id: `o${i}` }));
      // Each answer takes a while: all days together take about one.
      g.cal(MASTER).delayMs = 300;
      const t0 = Date.now();
      const r = await copyBookingToMaster({ written, calendarId: KRIS_JOBS, detailerName: "Kris" });
      expect(Date.now() - t0).toBeLessThan(300 * events.length);
      expect(r.ok).toBe(true);
      const copies = g.live(MASTER).sort((a, b) => Date.parse(a.start!.dateTime!) - Date.parse(b.start!.dateTime!));
      expect(copies).toHaveLength(events.length);
      expect(CONTINUATION_DAY.test(copies[0]!.summary!)).toBe(false);
      expect(copies[0]!.description).toMatch(TOTAL);
      expect(copies[1]!.summary).toMatch(/^Kris: Day 2 of /);
      expect(CONTINUATION_DAY.test(copies[1]!.summary!)).toBe(true);
      expect(copies[1]!.description).not.toMatch(TOTAL);
      // No WHO line on day 2: the original carries none.
      expect(copies[1]!.description).not.toMatch(/^WHO /m);
      expect(copies[1]!.extendedProperties?.private?.["bookingKey"]).toBe("km:day2");
    } finally { g.restore(); }
  });
});

describe("the booking's own log lines (send-confirmation)", () => {
  const bookingLines = () => logs.filter((l) => l.startsWith("[booking]"));

  it("one [booking] line per booking: key, detailer, days, calendar, both emails, and no customer data", async () => {
    const g = google();
    try {
      await book();
      await book(payload({ idempotencyKey: "key-2", cart: { ...payload().cart, slot: undefined } }));
    } finally { g.restore(); }
    expect(bookingLines()).toEqual([
      "[booking] ok key=key-1 detailer=Kris days=1 calendar=written owner=sent customer=sent",
      "[booking] ok key=key-2 detailer=Kris days=0 calendar=request owner=sent customer=sent",
    ]);
    expect(logs.join("\n")).not.toMatch(/5135551212|ada@example\.com|Ada Test|Main St/);
  });

  it("a customer email Resend refuses: the line says check, and Resend's answer is logged without the address or phone", async () => {
    const g = google();
    g.refuseMailTo.add("ada@example.com");
    let r;
    try { r = await book(); } finally { g.restore(); }
    expect(JSON.parse(r!.body)).toMatchObject({ owner: true, customer: false });
    expect(bookingLines()).toEqual(["[booking] check key=key-1 detailer=Kris days=1 calendar=written owner=sent customer=failed"]);
    const resend = logs.filter((l) => l.startsWith("resend 422"));
    expect(resend).toHaveLength(1);
    expect(resend[0]).toContain("[email]");
    expect(logs.join("\n")).not.toMatch(/ada@example\.com|owner@example\.com|555 1212|5135551212/);
  });

  it("redact takes out email addresses and phone numbers, and nothing else", () => {
    expect(redact('{"message":"Invalid `to` field: ada.test+x@example.co.uk, call (513) 555-1212 or +1 513 555 1212","statusCode":422}'))
      .toBe('{"message":"Invalid `to` field: [email], call [phone] or [phone]","statusCode":422}');
    expect(redact("http 429 rate limited, retry in 2 seconds")).toBe("http 429 rate limited, retry in 2 seconds");
  });
});

/* ------------------------------------------------------------------ */

describe("the reconciler (jobs-mirror)", () => {
  const T = SLOT;
  function setup(opts = {}) {
    setEnv("ALL_JOBS_CALENDAR_ID", MASTER);
    return google(opts);
  }
  const onlyMasterWrites = (g: ReturnType<typeof fakeGoogle>) =>
    expect(g.writes().filter((c) => c.calendarId !== MASTER), "never writes anywhere but the master").toEqual([]);

  it("off: one 'off' line, no calls at all", async () => {
    const g = google();
    try {
      const r = await mirrorHandler();
      expect(r.statusCode).toBe(200);
      expect(g.calls).toEqual([]);
      expect(masterLines()).toEqual(['[master-cal] {"action":"off"}']);
    } finally { g.restore(); }
  });

  it("copies a job typed in by hand (manual:<id>), skips what JobsSync skips, copies day 2 of a job, and keeps to the window", async () => {
    const g = setup();
    try {
      const job = g.add(OWNER_JOBS, { summary: "Full Exterior, Bob", description: "typed on a phone", location: "2 Oak St, Mason, OH 45040", startMs: T, endMs: T + 2 * 3_600_000 });
      const kris = g.add(KRIS_JOBS, { summary: "Kris: Basic Interior, Cy", startMs: T + DAY, endMs: T + DAY + 3_600_000 });
      for (const s of ["OPEN", "OPEN +20%", "BEST", "DNS", "dns dentist", "Busy", "Blocked", "Personal: dentist", "Hold for Bob", "Unavailable"]) g.add(OWNER_JOBS, { summary: s, startMs: T, endMs: T + 3_600_000 });
      g.add(OWNER_JOBS, { summary: "Fee block", transparency: "transparent", startMs: T, endMs: T + 3_600_000 });
      g.add(OWNER_JOBS, { summary: "Pick up supplies", location: "505 Sandheger Ct", startMs: T, endMs: T + 3_600_000 });
      const allDay = g.add(OWNER_JOBS, { summary: "Vacation", startMs: T, endMs: T + DAY });
      allDay.start = { date: new Date(T).toISOString().slice(0, 10) };
      allDay.end = { date: new Date(T + DAY).toISOString().slice(0, 10) };
      const day2 = g.add(OWNER_JOBS, { summary: "Day 2 of 2, Paint Correction, Bob", startMs: T + 2 * DAY, endMs: T + 2 * DAY + 3_600_000 });
      g.add(OWNER_JOBS, { summary: "Far off, Dee", startMs: Date.now() + 200 * DAY, endMs: Date.now() + 200 * DAY + 3_600_000 });
      const out = await reconcile({ nowMs: Date.now() });
      expect(out).toMatchObject({ created: 3, skipped: 13, failed: 0 });
      expect(g.cals.get(MASTER)!.events.get(masterEventId(`manual:${day2.id}`))!.summary).toBe("Elijah: Day 2 of 2, Paint Correction, Bob");
      const copy = g.cals.get(MASTER)!.events.get(masterEventId(`manual:${job.id}`))!;
      expect(copy.summary).toBe("Elijah: Full Exterior, Bob");
      expect(copy.description).toBe(`Status: Booked\nDetailer: Elijah\nBooking key: manual:${job.id}\nSource calendar: 513 Auto Clean\n---\ntyped on a phone`);
      expect(copy.colorId).toBe("7");
      expect(copy.location).toBe("2 Oak St, Mason, OH 45040");
      const kc = g.cals.get(MASTER)!.events.get(masterEventId(`manual:${kris.id}`))!;
      expect(kc.summary).toBe("Kris: Basic Interior, Cy");
      expect(kc.colorId).toBe("10");
      onlyMasterWrites(g);
      // A second run has nothing to do.
      const n = g.writes().length;
      expect(await reconcile({ nowMs: Date.now() })).toMatchObject({ created: 0, updated: 0 });
      expect(g.writes().length).toBe(n);
    } finally { g.restore(); }
  });

  it("follows an edit or a move, and puts back a copy changed or deleted on the master", async () => {
    const g = setup();
    try {
      const job = g.add(OWNER_JOBS, { summary: "Full Exterior, Bob", startMs: T, endMs: T + 3_600_000 });
      await reconcile({ nowMs: Date.now() });
      const id = masterEventId(`manual:${job.id}`);
      // Moved an hour later and renamed on the phone.
      Object.assign(g.cals.get(OWNER_JOBS)!.events.get(job.id)!, {
        summary: "Full Exterior + Wax, Bob",
        start: { dateTime: new Date(T + 3_600_000).toISOString() },
        end: { dateTime: new Date(T + 3 * 3_600_000).toISOString() },
      });
      expect(await reconcile({ nowMs: Date.now() })).toMatchObject({ updated: 1 });
      let copy = g.cals.get(MASTER)!.events.get(id)!;
      expect(copy.summary).toBe("Elijah: Full Exterior + Wax, Bob");
      expect(Date.parse(copy.start!.dateTime!)).toBe(T + 3_600_000);
      // Changed on the master by hand: put back.
      copy.summary = "something else";
      expect(await reconcile({ nowMs: Date.now() })).toMatchObject({ updated: 1 });
      expect(g.cals.get(MASTER)!.events.get(id)!.summary).toBe("Elijah: Full Exterior + Wax, Bob");
      // Deleted on the master by hand: put back.
      g.cals.get(MASTER)!.events.get(id)!.status = "cancelled";
      expect(await reconcile({ nowMs: Date.now() })).toMatchObject({ putBack: 1 });
      copy = g.cals.get(MASTER)!.events.get(id)!;
      expect(copy.status).toBe("confirmed");
      expect(copy.summary).toBe("Elijah: Full Exterior + Wax, Bob");
      onlyMasterWrites(g);
    } finally { g.restore(); }
  });

  it("a job moved to another detailer's calendar keeps one copy, now theirs", async () => {
    const g = setup();
    try {
      const job = g.add(OWNER_JOBS, { summary: "Basic Interior, Bob", startMs: T, endMs: T + 3_600_000 });
      await reconcile({ nowMs: Date.now() });
      // events.move keeps the id.
      g.cals.get(OWNER_JOBS)!.events.delete(job.id);
      g.cals.get(KRIS_JOBS)!.events.set(job.id, job);
      const out = await reconcile({ nowMs: Date.now() });
      expect(out).toMatchObject({ updated: 1, cancelled: 0 });
      expect(g.live(MASTER)).toHaveLength(1);
      const copy = g.live(MASTER)[0]!;
      expect(copy.summary).toBe("Kris: Basic Interior, Bob");
      expect(copy.colorId).toBe("10");
      expect(copy.description).toMatch(/^Status: Booked\nDetailer: Kris\n/);
      expect(copy.extendedProperties?.private?.["sourceId"]).toBe(`${KRIS_JOBS}|${job.id}`);
    } finally { g.restore(); }
  });

  it("a deleted original: looked up, then its copy marked CANCELLED, Free, graphite; restored, it is Booked again", async () => {
    const g = setup();
    try {
      const job = g.add(KRIS_JOBS, { summary: "Kris: Basic Interior, Cy", description: "orig", startMs: T, endMs: T + 3_600_000 });
      await reconcile({ nowMs: Date.now() });
      const id = masterEventId(`manual:${job.id}`);
      const booked = structuredClone(g.cals.get(MASTER)!.events.get(id)!);
      g.cals.get(KRIS_JOBS)!.events.get(job.id)!.status = "cancelled";
      expect(await reconcile({ nowMs: Date.now() })).toMatchObject({ cancelled: 1 });
      expect(g.calls.some((c) => c.method === "GET" && c.calendarId === KRIS_JOBS && c.url.endsWith(`/events/${job.id}`)), "the direct look-up").toBe(true);
      const copy = g.cals.get(MASTER)!.events.get(id)!;
      expect(copy.status).toBe("confirmed");
      expect(copy.summary).toBe("CANCELLED: Kris: Basic Interior, Cy");
      expect(copy.transparency).toBe("transparent");
      expect(copy.colorId).toBe("8");
      expect(copy.description).toMatch(/^Status: Cancelled\nDetailer: Kris\n/);
      expect(copy.description).toMatch(/---\norig$/);
      // Already marked: no look-up and no write next time.
      const calls = g.calls.length;
      expect(await reconcile({ nowMs: Date.now() })).toMatchObject({ cancelled: 0, updated: 0 });
      expect(g.calls.slice(calls).filter((c) => c.method !== "GET" || c.url.includes(`/events/${job.id}`))).toEqual([]);
      // Restored from Google Calendar's Trash.
      g.cals.get(KRIS_JOBS)!.events.get(job.id)!.status = "confirmed";
      expect(await reconcile({ nowMs: Date.now() })).toMatchObject({ restored: 1 });
      const back = g.cals.get(MASTER)!.events.get(id)!;
      expect({ ...back, status: undefined }).toEqual({ ...booked, status: undefined });
      onlyMasterWrites(g);
    } finally { g.restore(); }
  });

  it("an original gone for good (404) is marked; cancelMode delete deletes the copy instead", async () => {
    const g = setup();
    try {
      const a = g.add(OWNER_JOBS, { summary: "Job A", startMs: T, endMs: T + 3_600_000 });
      await reconcile({ nowMs: Date.now() });
      g.cals.get(OWNER_JOBS)!.events.delete(a.id);
      expect(await reconcile({ nowMs: Date.now() })).toMatchObject({ cancelled: 1 });
      expect(g.live(MASTER)[0]!.summary).toBe("CANCELLED: Elijah: Job A");

      const b = g.add(OWNER_JOBS, { summary: "Job B", startMs: T + DAY, endMs: T + DAY + 3_600_000 });
      await reconcile({ nowMs: Date.now() });
      g.cals.get(OWNER_JOBS)!.events.delete(b.id);
      expect(await reconcile({ nowMs: Date.now(), settings: { ...MASTER_CALENDAR, cancelMode: "delete" } })).toMatchObject({ cancelled: 1 });
      expect(g.cals.get(MASTER)!.events.get(masterEventId(`manual:${b.id}`))!.status).toBe("cancelled");
      onlyMasterWrites(g);
    } finally { g.restore(); }
  });

  it("an original moved out of the window is not a cancellation: the copy follows it", async () => {
    const g = setup();
    try {
      const job = g.add(OWNER_JOBS, { summary: "Job", startMs: T, endMs: T + 3_600_000 });
      await reconcile({ nowMs: Date.now() });
      const far = Date.now() + 200 * DAY;
      Object.assign(g.cals.get(OWNER_JOBS)!.events.get(job.id)!, {
        start: { dateTime: new Date(far).toISOString() }, end: { dateTime: new Date(far + 3_600_000).toISOString() },
      });
      expect(await reconcile({ nowMs: Date.now() })).toMatchObject({ cancelled: 0, updated: 1 });
      const copy = g.live(MASTER)[0]!;
      expect(copy.summary).toBe("Elijah: Job");
      expect(Date.parse(copy.start!.dateTime!)).toBe(far);
    } finally { g.restore(); }
  });

  it("a list that fails means nothing is written that run; a look-up that fails means nothing is cancelled", async () => {
    const g = setup();
    try {
      const job = g.add(OWNER_JOBS, { summary: "Job", startMs: T, endMs: T + 3_600_000 });
      await reconcile({ nowMs: Date.now() });
      g.add(OWNER_JOBS, { summary: "New job", startMs: T + DAY, endMs: T + DAY + 3_600_000 });
      g.cals.get(OWNER_JOBS)!.events.get(job.id)!.status = "cancelled";
      const before = g.writes().length;

      g.cals.get(KRIS_JOBS)!.failList = true;
      expect(await reconcile({ nowMs: Date.now() })).toMatchObject({ aborted: true, read: "Kris bookings" });
      g.cals.get(KRIS_JOBS)!.failList = false;

      g.cals.get(MASTER)!.failList = true;
      expect(await reconcile({ nowMs: Date.now() })).toMatchObject({ aborted: true, read: "master" });
      g.cals.get(MASTER)!.failList = false;

      expect(g.writes().length).toBe(before);
      expect(masterLines().filter((l) => l.includes('"abort"'))).toHaveLength(2);

      // A look-up that fails: the new job is still copied (the lists were whole), but nothing is marked cancelled.
      g.cals.get(OWNER_JOBS)!.failGet = true;
      expect(await reconcile({ nowMs: Date.now() })).toMatchObject({ created: 1, cancelled: 0 });
      g.cals.get(OWNER_JOBS)!.failGet = false;
      expect(masterLines().some((l) => l.includes('"abort-cancels"'))).toBe(true);
      expect(masterLines().some((l) => l.includes('"cancels-skipped"'))).toBe(true);
      expect(g.live(MASTER).every((e) => !e.summary!.startsWith("CANCELLED"))).toBe(true);
      // Once everything reads, the run does the rest.
      expect(await reconcile({ nowMs: Date.now() })).toMatchObject({ created: 0, cancelled: 1 });
    } finally { g.restore(); }
  });

  it("more cancellations than maxCancelsPerRun: none marked, and Elijah is emailed once", async () => {
    const g = setup();
    const mail = vi.fn(async () => true);
    try {
      const jobs = [0, 1, 2].map((i) => g.add(KRIS_JOBS, { summary: `Kris: Job ${i}`, startMs: T + i * DAY, endMs: T + i * DAY + 3_600_000 }));
      await reconcile({ nowMs: Date.now() });
      for (const j of jobs) g.cals.get(KRIS_JOBS)!.events.get(j.id)!.status = "cancelled";
      const settings = { ...MASTER_CALENDAR, maxCancelsPerRun: 2 };
      expect(await reconcile({ nowMs: Date.now(), settings, mail })).toMatchObject({ cancelled: 0, held: 3 });
      expect(await reconcile({ nowMs: Date.now(), settings, mail })).toMatchObject({ cancelled: 0, held: 3 });
      expect(mail).toHaveBeenCalledTimes(1);
      expect((mail.mock.calls[0] as unknown as [{ subject: string }])[0].subject).toMatch(/^CHECK: 3 jobs look deleted/);
      expect(g.live(MASTER).every((e) => !e.summary!.startsWith("CANCELLED"))).toBe(true);
      // Under the cap, they are marked.
      expect(await reconcile({ nowMs: Date.now(), settings: { ...settings, maxCancelsPerRun: 3 }, mail })).toMatchObject({ cancelled: 3 });
      onlyMasterWrites(g);
    } finally { g.restore(); }
  });

  it("leaves events GHL made on the master (no sourceId) alone, and logs a warning", async () => {
    const g = setup();
    try {
      const ghl = g.add(MASTER, { summary: "GHL appointment", startMs: T, endMs: T + 3_600_000 });
      const snapshot = structuredClone(ghl);
      const out = await reconcile({ nowMs: Date.now() });
      expect(out).toMatchObject({ foreign: 1, cancelled: 0, created: 0 });
      expect(g.cals.get(MASTER)!.events.get(ghl.id)).toEqual(snapshot);
      expect(g.writes()).toEqual([]);
      expect(masterLines().some((l) => l.includes('"not-ours"') && l.includes(ghl.id))).toBe(true);
    } finally { g.restore(); }
  });

  it("reads every page of a calendar", async () => {
    const g = setup({ pageSize: 2 });
    try {
      for (let i = 0; i < 5; i++) g.add(OWNER_JOBS, { summary: `Job ${i}`, startMs: T + i * 3_600_000, endMs: T + (i + 1) * 3_600_000 });
      expect(await reconcile({ nowMs: Date.now() })).toMatchObject({ created: 5 });
      expect(g.live(MASTER)).toHaveLength(5);
      expect(g.calls.some((c) => c.calendarId === OWNER_JOBS && c.url.includes("pageToken=4"))).toBe(true);
    } finally { g.restore(); }
  });

  it("a name already in the title wins over the calendar's detailer (as in JobsSync)", async () => {
    const g = setup();
    try {
      const job = g.add(OWNER_JOBS, { summary: "Kris: Full Interior, Cy", startMs: T, endMs: T + 3_600_000 });
      await reconcile({ nowMs: Date.now() });
      const copy = g.cals.get(MASTER)!.events.get(masterEventId(`manual:${job.id}`))!;
      expect(copy.summary).toBe("Kris: Full Interior, Cy");
      expect(copy.description).toMatch(/^Status: Booked\nDetailer: Kris\n/);
      expect(copy.description).toMatch(/\nSource calendar: 513 Auto Clean\n/);
      expect(copy.colorId).toBe("10");
    } finally { g.restore(); }
  });

  it("two originals with one booking key: the same one keeps the key whatever order Google lists them in", async () => {
    for (const order of ["first", "second"] as const) {
      const g = setup();
      try {
        const early = { summary: "Basic Interior, Ada", extendedProperties: { private: { bookingKey: "bk_dup" } }, created: "2026-11-01T10:00:00.000Z" };
        const late = { summary: "Basic Interior, Ada (copy)", extendedProperties: { private: { bookingKey: "bk_dup" } }, created: "2026-11-02T10:00:00.000Z" };
        // The list is sorted by start: whichever starts first comes back first.
        const [a, b] = order === "first"
          ? [g.add(OWNER_JOBS, { ...early, id: "zz-early", startMs: T, endMs: T + 3_600_000 }), g.add(OWNER_JOBS, { ...late, id: "aa-late", startMs: T + 3_600_000, endMs: T + 7_200_000 })]
          : [g.add(OWNER_JOBS, { ...early, id: "zz-early", startMs: T + 3_600_000, endMs: T + 7_200_000 }), g.add(OWNER_JOBS, { ...late, id: "aa-late", startMs: T, endMs: T + 3_600_000 })];
        await reconcile({ nowMs: Date.now() });
        const keyed = g.cals.get(MASTER)!.events.get(masterEventId("bk_dup"))!;
        expect(keyed.extendedProperties?.private?.["sourceId"], order).toBe(`${OWNER_JOBS}|${a.id}`);
        expect(g.cals.get(MASTER)!.events.get(masterEventId(`manual:${b.id}`)), order).toBeTruthy();
        // The copy's own original keeps the key even when a duplicate made earlier turns up later.
        g.add(OWNER_JOBS, { ...early, id: "mm-older", created: "2026-10-01T10:00:00.000Z", startMs: T - 3_600_000, endMs: T });
        const out = await reconcile({ nowMs: Date.now() });
        expect(out, order).toMatchObject({ created: 1, updated: 0, cancelled: 0 });
        expect(g.cals.get(MASTER)!.events.get(masterEventId("bk_dup"))!.extendedProperties?.private?.["sourceId"], order).toBe(`${OWNER_JOBS}|${a.id}`);
        expect(g.live(MASTER), order).toHaveLength(3);
      } finally { g.restore(); }
    }
  });

  it("a copy whose bookings calendar wasn't read this run (a detailer taken out of DETAILERS) is never looked up or marked: one warning with a count", async () => {
    const g = setup();
    const GONE = "former-detailer@group.calendar.google.com";
    try {
      for (const i of [1, 2]) {
        g.add(MASTER, { id: `c${i}`, summary: `Sam: Job ${i}`, startMs: T + i * 3_600_000, endMs: T + (i + 1) * 3_600_000, extendedProperties: { private: { bookingKey: `manual:s${i}`, sourceId: `${GONE}|s${i}` } } });
      }
      const out = await reconcile({ nowMs: Date.now() });
      expect(out).toMatchObject({ unread: 2, cancelled: 0, failed: 0 });
      expect(g.calls.some((c) => c.calendarId === GONE)).toBe(false);
      expect(g.writes()).toEqual([]);
      expect(masterLines().filter((l) => l.includes('"unread-source"'))).toEqual([expect.stringContaining('"count":2')]);
    } finally { g.restore(); }
  });

  it("a 404 means gone only on a calendar read this run", async () => {
    const g = setup();
    try {
      expect(await lookupOriginal(OWNER_JOBS, "nope", { readThisRun: true })).toEqual({ state: "gone" });
      expect((await lookupOriginal(OWNER_JOBS, "nope")).state).toBe("error");
      expect((await lookupOriginal("not-shared@group.calendar.google.com", "x")).state).toBe("error");
    } finally { g.restore(); }
  });

  it("out of time: look-ups stop, nothing is cancelled that run, and the run ends by runBudgetMs", async () => {
    const g = setup();
    try {
      const jobs = [0, 1, 2, 3, 4, 5].map((i) => g.add(OWNER_JOBS, { summary: `Job ${i}`, startMs: T + i * DAY, endMs: T + i * DAY + 3_600_000 }));
      await reconcile({ nowMs: Date.now() });
      for (const j of jobs) g.cals.get(OWNER_JOBS)!.events.get(j.id)!.status = "cancelled";
      g.add(OWNER_JOBS, { summary: "New job", startMs: T + 10 * DAY, endMs: T + 10 * DAY + 3_600_000 });
      g.cal(OWNER_JOBS).delayGetMs = 300;
      const settings = { ...MASTER_CALENDAR, runBudgetMs: 1000 };
      const t0 = Date.now();
      const out = await reconcile({ nowMs: Date.now(), startMs: t0, settings });
      expect(Date.now() - t0).toBeLessThan(settings.runBudgetMs + 300);
      // The new job was copied first; then the look-ups ran out of time.
      expect(out).toMatchObject({ created: 1, cancelled: 0, stopped: true });
      expect(g.live(MASTER).every((e) => !e.summary!.startsWith("CANCELLED"))).toBe(true);
      expect(masterLines().some((l) => l.includes('"cancels-skipped"'))).toBe(true);
      // A calendar that never answers: the run still ends by runBudgetMs, and writes nothing.
      g.cal(OWNER_JOBS).delayGetMs = 0;
      g.cal(KRIS_JOBS).hang = true;
      const before = g.writes().length;
      const t1 = Date.now();
      expect(await reconcile({ nowMs: Date.now(), startMs: t1, settings })).toMatchObject({ aborted: true, reason: "timed out" });
      expect(Date.now() - t1).toBeLessThan(settings.runBudgetMs + 300);
      expect(g.writes().length).toBe(before);
      // With time enough, the cancels go through.
      g.cal(KRIS_JOBS).hang = false;
      expect(await reconcile({ nowMs: Date.now() })).toMatchObject({ cancelled: 6 });
    } finally { g.restore(); }
  }, 15_000);

  it("a copy's id that a look-up no longer finds but Google won't reuse (409): put back; if that fails, counted and logged as failed", async () => {
    for (const putStatus of [200, 404]) {
      const g = setup();
      try {
        const job = g.add(OWNER_JOBS, { summary: "Job", startMs: T, endMs: T + 3_600_000 });
        await reconcile({ nowMs: Date.now() });
        const id = masterEventId(`manual:${job.id}`);
        g.purge(MASTER, id);
        g.cal(MASTER).purgedPutStatus = putStatus;
        const out = await reconcile({ nowMs: Date.now() });
        const methods = g.calls.filter((c) => c.calendarId === MASTER && c.url.includes(id)).slice(-2).map((c) => c.method);
        expect(methods, String(putStatus)).toEqual(["GET", "PUT"]);
        if (putStatus === 200) {
          expect(out).toMatchObject({ putBack: 1, failed: 0 });
          expect(g.live(MASTER)).toHaveLength(1);
        } else {
          expect(out).toMatchObject({ putBack: 0, created: 0, failed: 1 });
          expect(masterLines().some((l) => l.includes('"create-failed"') && l.includes("409") && l.includes("http_404"))).toBe(true);
        }
      } finally { g.restore(); }
    }
  });

  it("GHL's own changes to a copy: kept when the mirror's fields match; a changed field the mirror owns is patched back, the rest left alone", async () => {
    const g = setup();
    try {
      const job = g.add(OWNER_JOBS, { summary: "Full Exterior, Bob", startMs: T, endMs: T + 3_600_000 });
      await reconcile({ nowMs: Date.now() });
      const id = masterEventId(`manual:${job.id}`);
      const copy = g.cals.get(MASTER)!.events.get(id)!;
      copy["attendees"] = [{ email: "ghl-contact@example.com" }];
      copy.extendedProperties!.private!["ghlAppointmentId"] = "ghl-1";
      const n = g.writes().length;
      expect(await reconcile({ nowMs: Date.now() })).toMatchObject({ updated: 0 });
      expect(g.writes().length).toBe(n);
      // GHL renames it: the mirror owns the title, so it goes back, by a PATCH.
      copy.summary = "Bob's appointment";
      expect(await reconcile({ nowMs: Date.now() })).toMatchObject({ updated: 1 });
      expect(g.writes().slice(n).map((c) => c.method)).toEqual(["PATCH"]);
      const after = g.cals.get(MASTER)!.events.get(id)!;
      expect(after.summary).toBe("Elijah: Full Exterior, Bob");
      expect(after["attendees"]).toEqual([{ email: "ghl-contact@example.com" }]);
      expect(after.extendedProperties?.private?.["ghlAppointmentId"]).toBe("ghl-1");
      // An all-day original turned timed (or back) can't be patched: a PUT.
      const orig = g.cals.get(OWNER_JOBS)!.events.get(job.id)!;
      orig.summary = "Full Exterior, Bob, $150";
      orig.start = { date: new Date(T).toISOString().slice(0, 10) };
      orig.end = { date: new Date(T + DAY).toISOString().slice(0, 10) };
      const m = g.writes().length;
      expect(await reconcile({ nowMs: Date.now() })).toMatchObject({ updated: 1 });
      expect(g.writes().slice(m).map((c) => c.method)).toEqual(["PUT"]);
    } finally { g.restore(); }
  });

  it("never logs a customer's name, phone or email", async () => {
    const g = setup();
    try {
      g.add(OWNER_JOBS, { summary: "Full Interior, Ada Test", description: "WHO  Ada Test  5135551212  ada@example.com", startMs: T, endMs: T + 3_600_000 });
      await reconcile({ nowMs: Date.now() });
      expect(masterLines().length).toBeGreaterThan(0);
      expect(logs.join("\n")).not.toMatch(/Ada Test|5135551212|ada@example\.com/);
    } finally { g.restore(); }
  });
});

/* ------------------------------------------------------------------ */

describe("the master is never read for open time, and never by JobsSync", () => {
  it("JobsSync's CALENDARS lists no All Jobs calendar (every job would count twice)", () => {
    const gs = fs.readFileSync(path.join(__dirname, "../../tools/jobs-sync/JobsSync.gs"), "utf8");
    const block = gs.slice(gs.indexOf("const CALENDARS = ["), gs.indexOf("];", gs.indexOf("const CALENDARS = [")));
    const names = [...block.matchAll(/name:\s*'([^']+)'/g)].map((m) => m[1]);
    expect(names.length).toBeGreaterThan(0);
    expect(names.filter((n) => /all jobs/i.test(n!))).toEqual([]);
    expect(gs).not.toMatch(/ALL_JOBS/);
  });

  it("only _mastercal.mjs reads ALL_JOBS_CALENDAR_ID, and the browser's config never carries it", () => {
    const root = path.join(__dirname, "../..");
    const files = [
      ...fs.readdirSync(path.join(root, "netlify/functions")).map((f) => `netlify/functions/${f}`),
      ...fs.readdirSync(path.join(root, "js")).filter((f) => f.endsWith(".js")).map((f) => `js/${f}`),
      ...fs.readdirSync(path.join(root, "web/scripts")).map((f) => `web/scripts/${f}`),
    ].filter((f) => /\.(m?js|ts)$/.test(f));
    const readers = files.filter((f) => /env(?:\.|\[["'])ALL_JOBS_CALENDAR_ID/.test(fs.readFileSync(path.join(root, f), "utf8")));
    expect(readers).toEqual(["netlify/functions/_mastercal.mjs"]);
    expect(fs.readFileSync(path.join(root, "js/config.template.js"), "utf8")).not.toMatch(/ALL_JOBS/);
  });

  it("a master that is also a calendar the site reads is refused everywhere (the build fails on it too)", async () => {
    for (const [k, v] of [
      ["GOOGLE_CALENDAR_ID", MASTER],
      ["GOOGLE_OWNER_AVAILABILITY_ID", MASTER],
      ["GOOGLE_BUSY_ONLY_CALENDAR_IDS", `x@group.calendar.google.com, ${MASTER}`],
      ["GOOGLE_BOOKED_CALENDAR_ID", MASTER],
      ["DETAILERS", JSON.stringify([{ name: "Kris", availability: MASTER, bookings: KRIS_JOBS }])],
      ["DETAILERS", JSON.stringify([{ name: "Kris", availability: KRIS_OPEN, bookings: MASTER }])],
    ] as const) {
      const env = { ALL_JOBS_CALENDAR_ID: MASTER, [k]: v };
      expect(masterClash(env), k).toBe(true);
      expect(siteCalendars(env)).toContain(MASTER);
    }
    // The defaults the site falls back to count as well.
    expect(masterClash({ ALL_JOBS_CALENDAR_ID: siteCalendars({})[0] })).toBe(true);
    expect(masterClash({ ALL_JOBS_CALENDAR_ID: MASTER, DETAILERS: ENV.DETAILERS, GOOGLE_BOOKED_CALENDAR_ID: OWNER_JOBS })).toBe(false);

    // At run time: the reconciler stops before reading, the booking's copy is refused.
    setEnv("ALL_JOBS_CALENDAR_ID", KRIS_JOBS);
    const g = google();
    try {
      expect(await reconcile({ nowMs: Date.now() })).toMatchObject({ aborted: true, reason: "clash" });
      expect(g.calls.filter((c) => c.calendarId)).toEqual([]);
      const r = await book();
      expect(r.statusCode).toBe(200);
      expect(g.live(KRIS_JOBS)).toHaveLength(1);
      expect(g.live(MASTER)).toHaveLength(0);
      expect(mailTo(g, "owner@example.com")!.html).not.toMatch(/all jobs/i);
      expect(masterLines().some((l) => l.includes('"clash"'))).toBe(true);
    } finally { g.restore(); }
  });
});

describe("planMirror: duplicates and shared events (verification pass 4)", () => {
  const orig = (id: string, key?: string) => ({
    id, status: "confirmed", summary: "Full Interior, Test Person",
    start: { dateTime: "2026-12-01T10:00:00-05:00" }, end: { dateTime: "2026-12-01T13:00:00-05:00" },
    ...(key ? { extendedProperties: { private: { bookingKey: key } } } : {}),
  });
  const copy = (id: string, key: string, src: string) => ({
    id, status: "confirmed", summary: "Elijah: Full Interior, Test Person",
    extendedProperties: { private: { bookingKey: key, sourceId: sourceIdOf("cal-a", src) } },
  });

  it("of two copies of one key, the one at the key's own id is kept, in either list order", () => {
    const own = masterEventId("bk_1");
    const src = [{ calendarId: "cal-a", label: "A", detailer: "Elijah", events: [orig("o1", "bk_1")] }];
    for (const master of [[copy("stray", "bk_1", "o1"), copy(own, "bk_1", "o1")], [copy(own, "bk_1", "o1"), copy("stray", "bk_1", "o1")]]) {
      const plan = planMirror(src as never, master as never, MASTER_CALENDAR, masterEventId);
      expect(plan.duplicates).toEqual(["stray"]);
      expect([...plan.updates.map((u) => u.id)].every((id) => id === own)).toBe(true);
    }
  });

  it("one event on two read calendars is copied once, for the first detailer, every run", () => {
    const shared = orig("same-id");
    const sources = [
      { calendarId: "cal-a", label: "A", detailer: "Elijah", events: [shared] },
      { calendarId: "cal-b", label: "B", detailer: "Kris", events: [shared] },
    ];
    const plan = planMirror(sources as never, [], MASTER_CALENDAR, masterEventId);
    expect(plan.creates).toHaveLength(1);
    expect(plan.creates[0]!.key).toBe("manual:same-id");
    expect(JSON.stringify(plan.creates[0]!.body)).toContain("Elijah");
  });
});
