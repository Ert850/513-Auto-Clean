/**
 * Calendar fix 1 (November 14): the server checks the time is still free
 * just before it writes the job, with the same check the booking form runs.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { checkRange, slotStillFree, type StillFreeJob } from "./stillFree.js";
import { localDayStart, localTimeOnDay } from "../time/zone.js";
// @ts-expect-error: plain ESM Netlify function, no types
import { inTime, slotStatus } from "../../../netlify/functions/_detailers.mjs";
// @ts-expect-error: plain ESM Netlify function, no types
import { handler } from "../../../netlify/functions/send-confirmation.mjs";
// @ts-expect-error: plain ESM Netlify function, no types
import { resetRateLimits } from "../../../netlify/functions/_ratelimit.mjs";

const TZ = "America/New_York";
const DAY = 86_400_000;
// A Tuesday well ahead, so a booking is never short notice.
const D0 = (() => {
  let d = localDayStart(Date.now() + 10 * DAY, TZ);
  while (new Date(d + 12 * 3_600_000).getUTCDay() !== 2) d = localDayStart(d + DAY + 3_600_000, TZ);
  return d;
})();
const at = (min: number) => localTimeOnDay(D0, 0, min, TZ);
const OPEN = [{ start: at(6 * 60), end: at(22 * 60) }];
const job = (over: Partial<StillFreeJob> = {}): StillFreeJob => ({
  slotMs: at(13 * 60), serviceMin: 180, driveMin: 20, hasExterior: false, correction: false, arrivalWindowMin: 60, ...over,
});

describe("slotStillFree: the one check, form and server", () => {
  it("free on an open day; taken by a job over it, or one ending inside the drive", () => {
    expect(slotStillFree(job(), { open: OPEN, busy: [] }).free).toBe(true);
    expect(slotStillFree(job(), { open: OPEN, busy: [{ start: at(14 * 60), end: at(15 * 60) }] }).free).toBe(false);
    // A job ending at 12:30 leaves 30 minutes for a drive that needs the hour,
    // but the arrival window absorbs it: the start stays, arriving late.
    const r = slotStillFree(job(), { open: OPEN, busy: [{ start: at(10 * 60), end: at(12 * 60 + 30) }] });
    expect(r).toEqual({ free: true, lateMin: 30 });
    // Ending at 1pm, no window can absorb it.
    expect(slotStillFree(job({ arrivalWindowMin: 0 }), { open: OPEN, busy: [{ start: at(10 * 60), end: at(13 * 60) }] }).free).toBe(false);
  });

  it("paint correction keeps its own start times and days in the one-day check (validation cycle 2)", () => {
    // Saturday after D0 (a Tuesday), open all day.
    const sat = (min: number) => localTimeOnDay(D0, 4, min, TZ);
    const open = [{ start: sat(6 * 60), end: sat(22 * 60) }, ...OPEN];
    const c = (slotMs: number) => slotStillFree(job({ slotMs, correction: true, serviceMin: 180 }), { open, busy: [] }).free;
    expect(c(sat(8 * 60))).toBe(true);
    expect(c(sat(15 * 60))).toBe(false); // not one of correction's starts
    expect(c(at(8 * 60))).toBe(false); // a Tuesday
    // Other jobs are unchanged.
    expect(slotStillFree(job({ slotMs: at(15 * 60) }), { open: OPEN, busy: [] }).free).toBe(true);
  });

  it("taken outside the hours", () => {
    expect(slotStillFree(job({ slotMs: at(21 * 60) }), { open: OPEN, busy: [] }).free).toBe(false);
  });

  it("reads Cincinnati days, whatever the clock it runs on", () => {
    expect(checkRange(job())).toEqual({ from: D0 - DAY, to: D0 + 2 * DAY });
  });

  it("the booking form runs this same check", () => {
    const src = fs.readFileSync(path.join(__dirname, "../../../js/funnel.js"), "utf8");
    const fn = src.slice(src.indexOf("function verifySlot()"), src.indexOf("function checkThenAdvance()"));
    expect(fn).toContain("P.slotStillFree(");
    expect(fn).toContain("P.checkRange(");
    expect(fn).not.toContain("setHours(");
  });
});

/** Google stubbed: 513 Availability has OPEN 6am to 10pm; `jobs` are on 513 Auto Clean. */
function stubGoogle(jobs: { start: number; end: number }[], opts: { fail?: boolean; findStatus?: number } = {}) {
  const writes: string[] = [];
  const bodies: { end?: { dateTime: string } }[] = [];
  const mail: string[] = [];
  const html: string[] = [];
  vi.stubGlobal("fetch", async (url: string, o: { method?: string; body?: string } = {}) => {
    const u = String(url);
    if (u.includes("oauth2.googleapis.com/token")) return new Response(JSON.stringify({ access_token: "t", expires_in: 3600 }));
    if (u.includes("api.resend.com")) { const b = JSON.parse(o.body ?? "{}"); mail.push(b.subject); html.push(b.html); return new Response("{}"); }
    if (o.method === "POST" && u.includes("/events")) { writes.push(u); bodies.push(JSON.parse(o.body ?? "{}")); return new Response(JSON.stringify({ id: "new1" })); }
    // The retry check (by booking key): nothing there yet, or Google failing.
    if (u.includes("privateExtendedProperty")) {
      return opts.findStatus ? new Response("down", { status: opts.findStatus }) : new Response(JSON.stringify({ items: [] }));
    }
    if (u.includes("/events?")) {
      if (opts.fail) return new Response("down", { status: 503 });
      const avail = u.includes(encodeURIComponent("avail@x"));
      const items = avail
        ? [{ summary: "OPEN", start: { dateTime: new Date(OPEN[0]!.start).toISOString() }, end: { dateTime: new Date(OPEN[0]!.end).toISOString() } }]
        : jobs.map((j) => ({ summary: "Job", start: { dateTime: new Date(j.start).toISOString() }, end: { dateTime: new Date(j.end).toISOString() } }));
      return new Response(JSON.stringify({ items }));
    }
    return new Response("no", { status: 500 });
  });
  return { writes, bodies, mail, html };
}

const ENV = {
  GOOGLE_CALENDAR_API_KEY: "k",
  GOOGLE_CALENDAR_ID: "jobs@x",
  GOOGLE_OWNER_AVAILABILITY_ID: "avail@x",
  GOOGLE_OAUTH_CLIENT_ID: "id",
  GOOGLE_OAUTH_CLIENT_SECRET: "secret",
  GOOGLE_OAUTH_REFRESH_TOKEN: "refresh",
  RESEND_API_KEY: "re_test",
  PERSONAL_CALENDAR_OFF: "1",
};

describe("slotStatus: the server reads the calendar again", () => {
  beforeEach(() => { for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v); });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it("free, taken, and unread when Google fails", async () => {
    stubGoogle([]);
    expect((await slotStatus(null, job())).status).toBe("free");
    stubGoogle([{ start: at(14 * 60), end: at(16 * 60) }]);
    expect((await slotStatus(null, job())).status).toBe("taken");
    stubGoogle([], { fail: true });
    expect((await slotStatus(null, job())).status).toBe("unread");
  });

  it("a read that hangs counts as unread, not as a wait past Netlify's limit (validation cycle 2)", async () => {
    await expect(inTime(new Promise(() => {}), 20)).rejects.toThrow(/timed out/);
    await expect(inTime(Promise.resolve(7), 20)).resolves.toBe(7);
  });

  it("nothing to check against without a key", async () => {
    vi.stubEnv("GOOGLE_CALENDAR_API_KEY", "");
    expect((await slotStatus(null, job())).status).toBe("unconfigured");
  });

  it("with several detailers, a time that clashes only on the longer timed drive is kept, on the form's own drive", async () => {
    // 70 minutes each way: an 85 minute buffer after a job ending 12:45 puts
    // the arrival past the hour's window, so it clashes. The form, with two
    // detailers, allowed for the drive measured with no time of day (40
    // minutes, inside the hour): arriving 1:45 fits, so the booking stands.
    vi.stubEnv("DETAILERS", JSON.stringify([{ name: "Kris", does: "interior", availability: "ka@x", bookings: "kb@x" }, { name: "Elijah", owner: true }]));
    stubGoogle([{ start: at(9 * 60), end: at(12 * 60 + 45) }]);
    expect(await slotStatus(null, job({ driveMin: 70 }), process.env, async () => 40)).toMatchObject({ status: "free", tight: true });
    // Never on a made-up drive: with no measurement, the clash stands.
    expect((await slotStatus(null, job({ driveMin: 70 }), process.env, async () => null)).status).toBe("taken");
  });

  it("with one detailer the form used the same timed drive, so a clash on it is a clash", async () => {
    stubGoogle([{ start: at(9 * 60), end: at(12 * 60 + 45) }]);
    expect((await slotStatus(null, job({ driveMin: 70 }), process.env, async () => 40)).status).toBe("taken");
  });
});

describe("send-confirmation: a taken time is refused, nothing written or sent", () => {
  beforeEach(() => { resetRateLimits(); for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v); });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  const post = (extra: Record<string, unknown> = {}) => handler({
    httpMethod: "POST",
    headers: {},
    body: JSON.stringify({
      ...extra,
      cart: {
        vehicles: [{ sizeId: "small", packageIds: ["basic-interior"], addons: [] }],
        address: { line1: "1 Main St", city: "Cincinnati", region: "OH", zip: "45220" },
        zip: "45220",
        slot: at(13 * 60),
      },
      contact: { name: "Test Customer", phone: "5135550100", email: "test@example.com" },
      idempotencyKey: "bk_test_still_free",
    }),
  });

  it("taken: 409, no event, no email", async () => {
    const g = stubGoogle([{ start: at(13 * 60), end: at(15 * 60) }]);
    const r = await post();
    expect(r.statusCode).toBe(409);
    expect(JSON.parse(r.body)).toMatchObject({ taken: true });
    expect(g.writes).toHaveLength(0);
    expect(g.mail).toHaveLength(0);
  });

  it("a browser saying it paid, while paying in full is off, is refused like any booking (review, November 23)", async () => {
    const g = stubGoogle([{ start: at(13 * 60), end: at(15 * 60) }]);
    const r = await post({ mode: "pay_now" });
    expect(r.statusCode).toBe(409);
    expect(g.writes).toHaveLength(0);
  });

  // A booking really paid in full would also go through as a request here, but
  // payInFull is off until the server checks the payment (functions.smoke.test.ts).
  it("standard hours (the browser could not read the calendar): a request, nothing written onto the taken time", async () => {
    for (const extra of [{ standardHours: true }]) {
      resetRateLimits();
      const g = stubGoogle([{ start: at(13 * 60), end: at(15 * 60) }]);
      const r = await post(extra);
      expect(r.statusCode).toBe(200);
      expect(g.writes).toHaveLength(0);
      expect(g.mail.some((s) => /^NOT ON THE CALENDAR, /.test(s))).toBe(true);
      expect(g.mail.some((s) => /^Confirmed:/.test(s))).toBe(false);
    }
  });

  it("free: written and confirmed as before", async () => {
    const g = stubGoogle([]);
    const r = await post();
    expect(r.statusCode).toBe(200);
    expect(g.writes).toHaveLength(1);
    expect(g.mail.some((s) => /^BOOKING, /.test(s))).toBe(true);
  });

  it("a retry whose key lookup fails is not told its own first try took the time (validation cycle 2, November 16)", async () => {
    // The first try's event is at 1pm; Google fails the lookup by booking key.
    const g = stubGoogle([{ start: at(13 * 60), end: at(15 * 60) }], { findStatus: 503 });
    const r = await post();
    expect(r.statusCode).toBe(200);
    expect(g.writes).toHaveLength(0);
    expect(g.mail.some((s) => /^NOT ON THE CALENDAR, /.test(s))).toBe(true);
  });

  it("the event ends at the arrival the server just found, not the form's older one (validation cycle 2)", async () => {
    // A job ending 12:30, booked after the form checked: the 1pm start stands, arriving 30 minutes late.
    const g = stubGoogle([{ start: at(10 * 60), end: at(12 * 60 + 30) }]);
    const r = await post();
    expect(r.statusCode).toBe(200);
    const { priceFromWire } = await import("../server-entry.js");
    const minutes = priceFromWire({ vehicles: [{ sizeId: "small", packageIds: ["basic-interior"], addons: [] }], zip: "45220", slot: at(13 * 60) } as never, { nowMs: Date.now() }).serviceDurationMin;
    expect(Date.parse(g.bodies[0]!.end!.dateTime)).toBe(at(13 * 60) + (30 + minutes) * 60_000);
  });

  it("the owner email names the source, the answer to where they heard of us, and the A/B test versions (validation cycle 2)", async () => {
    const g = stubGoogle([]);
    await post({ experiments: "hero-headline: the-513", source: "golf / print / qr", heard: "Google" });
    const owner = g.html[g.mail.findIndex((s) => /^BOOKING, /.test(s))]!;
    expect(owner).toContain("hero-headline: the-513");
    expect(owner).toContain("golf / print / qr");
    expect(owner).toContain("Heard about us");
  });

  it("unread: written, but the owner is told to check and the customer is not told it is confirmed", async () => {
    const g = stubGoogle([], { fail: true });
    const r = await post();
    expect(r.statusCode).toBe(200);
    expect(g.writes).toHaveLength(1);
    expect(g.mail.some((s) => /^CHECK THE TIME, BOOKING, /.test(s))).toBe(true);
    expect(g.mail.some((s) => /^Confirmed:/.test(s))).toBe(false);
  });
});

describe("calendar fix 2: every booking date is a Cincinnati date", () => {
  it("the form takes no date from the visitor's own clock", () => {
    const src = fs.readFileSync(path.join(__dirname, "../../../js/funnel.js"), "utf8");
    // getFullYear/getMonth/getDate/setHours read the visitor's time zone: a
    // parent booking from California saw request days a day off near midnight.
    expect(src).not.toMatch(/\.(getFullYear|getMonth|getDate|getDay|getHours|setHours)\(/);
    expect(src).not.toMatch(/new Date\(\s*Number\(/);
  });
});

describe("calendar fix 3: the drive home is measured at the finish, on screen and on the receipt", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it("both send the job's length, and both get the same minutes", async () => {
    vi.stubEnv("GOOGLE_MAPS_SERVER_KEY", "maps");
    vi.stubEnv("SHOP_ORIGIN_ADDRESS", "1 Shop St, Cincinnati, OH 45202");
    const legs: { reverse: boolean; departure: number }[] = [];
    vi.stubGlobal("fetch", async (url: string, o: { body?: string } = {}) => {
      const b = JSON.parse(o.body ?? "{}");
      const reverse = Boolean(b.origin?.address?.startsWith("9 Test"));
      const departure = b.departureTime ? Date.parse(b.departureTime) : 0;
      legs.push({ reverse, departure });
      // Rush hour home from 5pm: 50 minutes, otherwise 25.
      const evening = departure && new Date(departure).getUTCHours() >= 21;
      return new Response(JSON.stringify({ routes: [{ duration: `${(reverse && evening ? 50 : 25) * 60}s`, distanceMeters: 20000 }] }));
    });
    const { handler: travel } = await import("../../../netlify/functions/travel.mjs");
    const { measuredOneWayMinutes, jobMinutes } = await import("../../../netlify/functions/_routes.mjs");
    const { priceFromWire } = await import("../server-entry.js");
    // A Full Interior starting 1pm finishes into rush hour.
    const cart = {
      vehicles: [{ sizeId: "small", packageIds: ["full-interior"], addons: [] }],
      address: { line1: "9 Test Rd", city: "Cincinnati", region: "OH", zip: "45220" },
      zip: "45220",
      slot: at(13 * 60),
    };
    const minutes = priceFromWire(cart as never, { nowMs: Date.now() }).serviceDurationMin;
    expect(jobMinutes(cart)).toBe(minutes);

    resetRateLimits();
    const screen = JSON.parse((await travel({
      httpMethod: "GET", headers: {},
      queryStringParameters: { address: "9 Test Rd, Cincinnati, OH, 45220", at: String(cart.slot), serviceMin: String(minutes), zip: "45220" },
    })).body);
    const receipt = await measuredOneWayMinutes(cart, null);
    expect(receipt).toBe(screen.minutes);
    // The drive home left at the finish, not the start.
    const home = legs.filter((l) => l.reverse).map((l) => l.departure);
    expect(home).toContain(cart.slot + minutes * 60_000);
    expect(home).not.toContain(cart.slot);
  });

  it("the form sends the length under the name the server reads", () => {
    const src = fs.readFileSync(path.join(__dirname, "../../../js/funnel.js"), "utf8");
    expect(src).not.toContain("'&service='");
    expect(src.match(/'&serviceMin='/g)).toHaveLength(2);
  });
});
