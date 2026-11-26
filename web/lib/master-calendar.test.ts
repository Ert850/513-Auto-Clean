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
import { MASTER_CALENDAR, checkMasterCalendar, masterTitle } from "./availability/masterCalendar.js";
import { localDayStart, localTimeOnDay } from "./time/zone.js";
import { priceFromWire, type WireCart } from "./server-entry.js";
// @ts-expect-error: plain ESM Netlify function, no types
import { bookingEvents, handler, ownerEmail } from "../../netlify/functions/send-confirmation.mjs";
// @ts-expect-error: plain ESM Netlify function, no types
import { reconcile, handler as mirrorHandler } from "../../netlify/functions/jobs-mirror.mjs";
// @ts-expect-error: plain ESM Netlify function, no types
import { copyBookingToMaster, masterClash, masterEventId, siteCalendars } from "../../netlify/functions/_mastercal.mjs";
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
    expect(masterTitle("Kris: Full Interior, Jane Doe", "Kris", ["Kris", "Elijah"])).toBe("Kris: Full Interior, Jane Doe");
    const short = masterTitle("SHORT NOTICE, accept or decline: Full Interior, Jane Doe", "Elijah");
    expect(short).toBe("SHORT NOTICE, accept or decline: Elijah: Full Interior, Jane Doe");
    expect(short.match(DETAILER)?.[1]).toBe("Elijah");
    const day2 = masterTitle("Day 2 of 2, Paint Correction, Jane Doe", "Elijah");
    expect(CONTINUATION_DAY.test(day2)).toBe(true);
    expect(day2.match(DETAILER)?.[1]).toBe("Elijah");
    // Moved to Elijah's calendar: his job now.
    expect(masterTitle("Kris: Full Interior, Jane Doe", "Elijah", ["Kris", "Elijah"])).toBe("Elijah: Full Interior, Jane Doe");
  });
});

/* ------------------------------------------------------------------ */

describe("the copy at booking time (send-confirmation)", () => {
  async function run(master: string | undefined) {
    const g = google();
    setEnv("ALL_JOBS_CALENDAR_ID", master);
    try {
      const r = await book();
      return { r, g, calls: g.calls.filter((c) => !c.url.startsWith("https://oauth2.")) };
    } finally {
      g.restore();
    }
  }

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

  it("on: the booking's own calls and reply are exactly as when off", async () => {
    const off = await run(undefined);
    const on = await run(MASTER);
    // Leaving out the master's calls and the one read of the source calendar's name.
    const rest = on.calls.filter((c) => c.calendarId !== MASTER && !c.url.includes("fields=summary"));
    expect(rest).toEqual(off.calls);
    expect(on.r).toEqual(off.r);
    expect(on.r.body).not.toMatch(/master|all jobs/i);
  });

  it("ownerEmail with no master failure is the email it was", () => {
    const ctx = { contact: { name: "Ada", phone: "5135551212", email: "" }, when: "Tue", priced: { totalCents: 1000, lines: [] }, kind: "booking", cart: { slot: SLOT, address: {} }, detailer: null };
    expect(ownerEmail({ ...ctx, masterFail: "" })).toEqual(ownerEmail(ctx));
  });

  it("writes the copy: detailer named, header then the original word for word, its colour, the same key", async () => {
    const { g } = await run(MASTER);
    const [orig] = g.live(KRIS_JOBS);
    const [copy] = g.live(MASTER);
    expect(g.live(MASTER)).toHaveLength(1);
    expect(copy!.id).toBe(masterEventId("key-1"));
    expect(copy!.summary).toBe(orig!.summary);
    expect(copy!.summary).toMatch(/^Kris: /);
    expect(copy!.description).toBe(
      `Status: Booked\nDetailer: Kris\nBooking key: key-1\nSource calendar: 513 Kris Bookings\n---\n${orig!.description}`,
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
    expect(logs.join("\n")).not.toMatch(/5135551212|ada@example\.com/);
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
    expect(copy!.description).toMatch(/^Status: Booked\nDetailer: Elijah\nBooking key: key-1\nSource calendar: 513 Auto Clean\n---\n/);
  });

  it("a retry never makes a second copy, and the reconciler finds nothing to change", async () => {
    const g = google();
    setEnv("ALL_JOBS_CALENDAR_ID", MASTER);
    try {
      await book();
      const again = await book();
      expect(JSON.parse(again.body).duplicate).toBe(true);
      expect(g.live(MASTER)).toHaveLength(1);
      // The same copy written twice (the reconciler raced it, say): still one.
      const before = g.writes().length;
      const out = await reconcile({ nowMs: Date.now() });
      expect(out).toMatchObject({ created: 0, updated: 0, cancelled: 0, failed: 0 });
      expect(g.writes().length).toBe(before);
      expect(g.live(MASTER)).toHaveLength(1);
    } finally { g.restore(); }
  });

  it("the same copy written twice directly is one copy", async () => {
    const g = google();
    setEnv("ALL_JOBS_CALENDAR_ID", MASTER);
    try {
      const written = [{ summary: "Kris: Basic Interior, Ada", description: "d", location: "x, 45220", startMs: SLOT, endMs: SLOT + 3_600_000, key: "k9", id: "o9" }];
      const a = await copyBookingToMaster({ written, calendarId: KRIS_JOBS, detailerName: "Kris", crewNames: ["Kris", "Elijah"] });
      const b = await copyBookingToMaster({ written, calendarId: KRIS_JOBS, detailerName: "Kris", crewNames: ["Kris", "Elijah"] });
      expect(a.ok && b.ok).toBe(true);
      expect(g.live(MASTER)).toHaveLength(1);
      expect(masterLines().some((l) => l.includes('"copy-exists"'))).toBe(true);
    } finally { g.restore(); }
  });

  it("a master that fails: the booking still goes through, Elijah's email says so on its own line, the customer's never does", async () => {
    const g = google();
    g.cal(MASTER).failWrite = true;
    setEnv("ALL_JOBS_CALENDAR_ID", MASTER);
    let r;
    try { r = await book(); } finally { g.restore(); }
    expect(r!.statusCode).toBe(200);
    const body = JSON.parse(r!.body);
    expect(body.calendar.ok).toBe(true);
    expect(body.owner && body.customer).toBe(true);
    expect(r!.body).not.toMatch(/master|all jobs/i);
    expect(g.live(KRIS_JOBS)).toHaveLength(1);
    const owner = mailTo(g, "owner@example.com")!;
    expect(owner.html).toContain("NOT ON 513 ALL JOBS");
    expect(owner.html).toContain("http_503");
    expect(owner.subject).toMatch(/^BOOKING, /);
    expect(owner.html).not.toContain("NOT ON THE CALENDAR");
    const customer = mailTo(g, "ada@example.com")!;
    expect(customer.subject).toMatch(/^Confirmed|^We have your booking/);
    expect(customer.html).not.toMatch(/all jobs|master/i);
    expect(masterLines().some((l) => l.includes('"copy-failed"'))).toBe(true);
  });

  it("a master that hangs costs at most writeTimeoutMs, and is reported", async () => {
    const g = google();
    g.cal(MASTER).hang = true;
    setEnv("ALL_JOBS_CALENDAR_ID", MASTER);
    const t0 = Date.now();
    let r;
    try { r = await book(); } finally { g.restore(); }
    expect(Date.now() - t0).toBeLessThan(MASTER_CALENDAR.writeTimeoutMs + 2000);
    expect(r!.statusCode).toBe(200);
    expect(mailTo(g, "owner@example.com")!.html).toMatch(/NOT ON 513 ALL JOBS<\/strong> \(timed out/);
  }, 15_000);

  it("a job over several days: one copy per day, day 2 skipped by JobsSync's pattern, its own key", async () => {
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
      const r = await copyBookingToMaster({ written, calendarId: KRIS_JOBS, detailerName: "Kris", crewNames: ["Kris", "Elijah"] });
      expect(r.ok).toBe(true);
      const copies = g.live(MASTER).sort((a, b) => Date.parse(a.start!.dateTime!) - Date.parse(b.start!.dateTime!));
      expect(copies).toHaveLength(events.length);
      expect(CONTINUATION_DAY.test(copies[0]!.summary!)).toBe(false);
      expect(copies[0]!.description).toMatch(TOTAL);
      expect(copies[1]!.summary).toMatch(/^Kris: Day 2 of /);
      expect(CONTINUATION_DAY.test(copies[1]!.summary!)).toBe(true);
      expect(copies[1]!.description).not.toMatch(TOTAL);
      expect(copies[1]!.extendedProperties?.private?.["bookingKey"]).toBe("km:day2");
    } finally { g.restore(); }
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

  it("copies a job typed in by hand (manual:<id>), skips OPEN, BEST and DNS, and keeps to the window", async () => {
    const g = setup();
    try {
      const job = g.add(OWNER_JOBS, { summary: "Full Exterior, Bob", description: "typed on a phone", location: "2 Oak St, Mason, OH 45040", startMs: T, endMs: T + 2 * 3_600_000 });
      const kris = g.add(KRIS_JOBS, { summary: "Kris: Basic Interior, Cy", startMs: T + DAY, endMs: T + DAY + 3_600_000 });
      for (const s of ["OPEN", "OPEN +20%", "BEST", "DNS", "dns dentist"]) g.add(OWNER_JOBS, { summary: s, startMs: T, endMs: T + 3_600_000 });
      g.add(OWNER_JOBS, { summary: "Far off, Dee", startMs: Date.now() + 200 * DAY, endMs: Date.now() + 200 * DAY + 3_600_000 });
      const out = await reconcile({ nowMs: Date.now() });
      expect(out).toMatchObject({ created: 2, skipped: 5, failed: 0 });
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

  it("any read that fails, a list or a look-up, means nothing is written that run", async () => {
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

      g.cals.get(OWNER_JOBS)!.failGet = true;
      expect(await reconcile({ nowMs: Date.now() })).toMatchObject({ aborted: true });
      g.cals.get(OWNER_JOBS)!.failGet = false;

      expect(g.writes().length).toBe(before);
      expect(masterLines().filter((l) => l.includes('"abort"'))).toHaveLength(3);
      // Once everything reads, the run does it all.
      expect(await reconcile({ nowMs: Date.now() })).toMatchObject({ created: 1, cancelled: 1 });
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
      expect(mailTo(g, "owner@example.com")!.html).toContain("NOT ON 513 ALL JOBS");
    } finally { g.restore(); }
  });
});
