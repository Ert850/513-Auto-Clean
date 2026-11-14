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
import { slotStatus } from "../../../netlify/functions/_detailers.mjs";
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
function stubGoogle(jobs: { start: number; end: number }[], opts: { fail?: boolean } = {}) {
  const writes: string[] = [];
  const mail: string[] = [];
  vi.stubGlobal("fetch", async (url: string, o: { method?: string; body?: string } = {}) => {
    const u = String(url);
    if (u.includes("oauth2.googleapis.com/token")) return new Response(JSON.stringify({ access_token: "t", expires_in: 3600 }));
    if (u.includes("api.resend.com")) { mail.push(JSON.parse(o.body ?? "{}").subject); return new Response("{}"); }
    if (o.method === "POST" && u.includes("/events")) { writes.push(u); return new Response(JSON.stringify({ id: "new1" })); }
    // The retry check (by booking key): nothing there yet.
    if (u.includes("privateExtendedProperty")) return new Response(JSON.stringify({ items: [] }));
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
  return { writes, mail };
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

  it("nothing to check against without a key", async () => {
    vi.stubEnv("GOOGLE_CALENDAR_API_KEY", "");
    expect((await slotStatus(null, job())).status).toBe("unconfigured");
  });

  it("a longer drive measured at the appointment never turns away a time offered on the form's drive", async () => {
    // 70 minutes each way: an 85 minute buffer after a job ending 12:45 puts
    // the arrival past the hour's window, so it clashes; on the form's drive
    // (the hour) it arrives 1:45, inside the window, so the booking stands.
    stubGoogle([{ start: at(9 * 60), end: at(12 * 60 + 45) }]);
    const r = await slotStatus(null, job({ driveMin: 70 }));
    expect(r).toMatchObject({ status: "free", tight: true });
  });
});

describe("send-confirmation: a taken time is refused, nothing written or sent", () => {
  beforeEach(() => { resetRateLimits(); for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v); });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  const post = () => handler({
    httpMethod: "POST",
    headers: {},
    body: JSON.stringify({
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

  it("free: written and confirmed as before", async () => {
    const g = stubGoogle([]);
    const r = await post();
    expect(r.statusCode).toBe(200);
    expect(g.writes).toHaveLength(1);
    expect(g.mail.some((s) => /^BOOKING, /.test(s))).toBe(true);
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
