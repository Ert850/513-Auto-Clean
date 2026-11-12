/**
 * The calendar backend review's findings (A2P follow-up, November 13, 2026;
 * docs/SESSION-CHANGES-a2p.md, T5). One test per fix.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { findMultiDayStarts, multiDayEvents, multiDayStillFits, planDays, type DayPlan } from "./multiDay.js";
import { localDayStart, localTimeOnDay } from "../time/zone.js";
import { loadWindow, openFeeBp, readCalendars, resolveWindow } from "../google/publicCalendar.js";
// @ts-expect-error: plain ESM Netlify function, no types
import { bookingEvents } from "../../../netlify/functions/send-confirmation.mjs";
// @ts-expect-error: plain ESM Netlify function, no types
import { blockFeeFor, ownerFeeCalendars } from "../../../netlify/functions/_detailers.mjs";
import { priceFromWire, type WireCart } from "../server-entry.js";

const TZ = "America/New_York";
const H = 3_600_000;
const SAT = localDayStart(Date.UTC(2026, 10, 14, 17), TZ); // Saturday, November 14, 2026
const at = (day: number, min: number) => localTimeOnDay(SAT, day, min, TZ);
const open = (from: number, to: number, days: number[]) => days.map((d) => ({ start: at(d, from), end: at(d, to) }));

function plan(minutes: number, drive: number): DayPlan {
  const p = planDays({ serviceMinutes: minutes, travelBeforeMin: drive, travelAfterMin: drive });
  if (!p.ok) throw new Error(p.reason);
  return p;
}

describe("1. a multi-day time is checked the way it was offered", () => {
  it("an option on an empty OPEN window is still free", () => {
    const p = plan(1200, 30);
    const openBlocks = open(6 * 60, 24 * 60, [0, 1]);
    const [opt] = findMultiDayStarts({ plan: p, openBlocks, busy: [], notBefore: SAT, notAfter: SAT + 1 });
    expect(opt, "offered").toBeDefined();
    expect(multiDayStillFits({ plan: p, startMs: opt!.startMs, openBlocks, busy: [] })).toBe(true);
    // And a job since booked on day 2 makes it taken.
    expect(multiDayStillFits({ plan: p, startMs: opt!.startMs, openBlocks, busy: [{ start: at(1, 12 * 60), end: at(1, 13 * 60) }] })).toBe(false);
  });

  it("verifySlot uses that check for a job past one day", () => {
    const src = fs.readFileSync(path.join(__dirname, "../../../js/funnel.js"), "utf8");
    const fn = src.slice(src.indexOf("function verifySlot()"), src.indexOf("function checkThenAdvance()"));
    expect(fn).toContain("P.multiDayStillFits(");
  });
});

describe("2. a multi-day job is one event per working day", () => {
  const cart: WireCart = {
    vehicles: [{ sizeId: "small", packageIds: ["full-interior"], addons: [] }],
    zip: "45040",
    address: { line1: "5555 Tylersville Rd", city: "Mason", region: "OH", zip: "45040" },
    slot: at(0, 8 * 60),
    kind: "booking",
    payInFull: false,
  };
  const priced = { ...priceFromWire(cart, { nowMs: SAT - 5 * 86_400_000 }), serviceDurationMin: 1200 };
  const events = (detailer: { name: string } | null) => bookingEvents({
    contact: { name: "Test Customer", phone: "5135550100", email: "" },
    cart, priced, payInFull: false, kind: "booking", detailer,
    extras: { source: "google", heard: "Google search" }, nowMs: SAT - 5 * 86_400_000, measuredMin: 30,
  });

  it("the helper plans Saturday and Sunday 8am to 6pm, not one event into Sunday morning", () => {
    expect(multiDayEvents({ slotMs: at(0, 480), serviceMinutes: 1200, travelMin: 30 })).toEqual([
      { startMs: at(0, 480), endMs: at(0, 1080) },
      { startMs: at(1, 480), endMs: at(1, 1080) },
    ]);
    expect(multiDayEvents({ slotMs: at(0, 480), serviceMinutes: 240, travelMin: 30 }), "a one day job").toBeNull();
  });

  it("day 1 carries the total and the blocks JobsSync reads; day 2 is titled Day 2 of 2 and has no total", () => {
    const ev = events({ name: "Kris" });
    expect(ev).toHaveLength(2);
    expect(ev[0].description).toMatch(/TOTAL:\s*\$/);
    expect(ev[0].description).toMatch(/\nSOURCE\n/);
    expect(ev[1].summary).toBe("Kris: Day 2 of 2, Full Interior, Test Customer");
    expect(ev[1].description).not.toMatch(/TOTAL/);
    expect([ev[1].startMs, ev[1].endMs]).toEqual([at(1, 480), at(1, 1080)]);
    expect(events(null)[1].summary).toBe("Day 2 of 2, Full Interior, Test Customer");
  });
});

describe("3. a multi-day start needs only the work inside OPEN", () => {
  it("OPEN from 8am still offers an 8am start with a 30 minute drive", () => {
    const found = findMultiDayStarts({ plan: plan(1200, 30), openBlocks: open(8 * 60, 24 * 60, [0, 1]), busy: [], notBefore: SAT, notAfter: SAT + 1 });
    expect(found.map((o) => o.startMs)).toEqual([at(0, 480)]);
  });

  it("a busy hour in the drive still clashes", () => {
    const found = findMultiDayStarts({ plan: plan(1200, 30), openBlocks: open(8 * 60, 24 * 60, [0, 1]),
      busy: [{ start: at(0, 7 * 60 + 40), end: at(0, 7 * 60 + 50) }], notBefore: SAT, notAfter: SAT + 1 });
    expect(found).toEqual([]);
  });
});

describe("5. weekday rule on every day of a multi-day job", () => {
  it("a weekend-only job can start Saturday, not Sunday (it would run into Monday)", () => {
    const found = findMultiDayStarts({ plan: plan(1200, 30), openBlocks: open(6 * 60, 24 * 60, [0, 1, 2]), busy: [],
      notBefore: SAT, notAfter: at(2, 0), allowedWeekdays: [0, 6] });
    expect(found.map((o) => o.startMs)).toEqual([at(0, 480)]);
  });
});

describe("4. the owner's fee is read from every calendar the booking form reads", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it("lists 513 Auto Clean and 513 Availability, minus busy-only ones", () => {
    expect(ownerFeeCalendars({ GOOGLE_CALENDAR_ID: "jobs@x", GOOGLE_OWNER_AVAILABILITY_ID: "avail@x" })).toEqual(["jobs@x", "avail@x"]);
    expect(ownerFeeCalendars({ GOOGLE_CALENDAR_ID: "jobs@x", GOOGLE_OWNER_AVAILABILITY_ID: "avail@x", GOOGLE_BUSY_ONLY_CALENDAR_IDS: "jobs@x" })).toEqual(["avail@x"]);
  });

  it("charges an OPEN +20% that lives on 513 Auto Clean, as the form quotes it", async () => {
    vi.stubEnv("GOOGLE_CALENDAR_API_KEY", "k");
    const day = "2026-11-17";
    vi.stubGlobal("fetch", async (url: string) => {
      const avail = String(url).includes(encodeURIComponent("9f26a370ac8629b6df3f7f4e8181aa1086f3acb2b47866e01a1b868cd4ab8161@group.calendar.google.com"));
      return new Response(JSON.stringify({ items: avail
        ? [{ summary: "OPEN", start: { dateTime: `${day}T11:00:00Z` }, end: { dateTime: `2026-11-18T05:00:00Z` } }]
        : [{ summary: "OPEN +20%", transparency: "transparent", start: { dateTime: `${day}T11:00:00Z` }, end: { dateTime: `${day}T15:00:00Z` } }] }));
    });
    expect(await blockFeeFor(null, Date.parse(`${day}T13:00:00Z`), 0)).toBe(2000);
  });
});

describe("lower-confidence items", () => {
  afterEach(() => vi.unstubAllGlobals());
  const from = Date.parse("2026-11-17T05:00:00Z");
  const to = Date.parse("2026-11-18T05:00:00Z");

  it("one calendar failing fails the pooled read, instead of dropping its jobs", async () => {
    vi.stubGlobal("fetch", async (url: string) => String(url).includes("jobs%40x")
      ? new Response("nope", { status: 404 })
      : new Response(JSON.stringify({ items: [] })));
    await expect(readCalendars({ calendarId: "open@x", extraCalendarIds: ["jobs@x"], apiKey: "k" }, from, to)).rejects.toThrow(/404/);
  });

  it("an all-day DNS blocks the day even when Google has it as Free", () => {
    const w = resolveWindow([
      { summary: "OPEN", start: from + 6 * H, end: from + 22 * H, allDay: false, transparent: false },
      { summary: "DNS", start: from, end: to, allDay: true, transparent: true },
      { summary: "Birthday", start: from, end: to, allDay: true, transparent: true },
    ], from, to);
    expect(w.busy).toEqual([{ start: from, end: to }]);
  });

  it("OPEN 20% and OPEN (+20%) mean OPEN +20%", () => {
    expect(openFeeBp("OPEN 20%")).toBe(2000);
    expect(openFeeBp("OPEN (+20%)")).toBe(2000);
    expect(openFeeBp("OPEN +20%")).toBe(2000);
    expect(openFeeBp("OPEN")).toBe(0);
  });

  it("reads every page of a long calendar", async () => {
    const seen: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      seen.push(String(url));
      const second = String(url).includes("pageToken=p2");
      return new Response(JSON.stringify({
        items: [{ summary: second ? "Job" : "OPEN", start: { dateTime: "2026-11-17T15:00:00Z" }, end: { dateTime: "2026-11-17T17:00:00Z" } }],
        ...(second ? {} : { nextPageToken: "p2" }),
      }));
    });
    const w = await loadWindow({ calendarId: "open@x", apiKey: "k" }, from, to);
    expect(seen).toHaveLength(2);
    expect(w.busy).toHaveLength(1);
  });
});
