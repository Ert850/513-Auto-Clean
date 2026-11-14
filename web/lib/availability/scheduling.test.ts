/**
 * Calendar fix 5 (November 14): the scheduling numbers live in
 * config/scheduling.json, read by the form and the server alike.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { SCHEDULING, checkScheduling } from "./scheduling.js";
import { ARRIVAL_WINDOW_MIN } from "./slots.js";
import { WIRE_LIMITS } from "../pricing/wire.js";

const read = (p: string) => fs.readFileSync(path.join(__dirname, "../../..", p), "utf8");

describe("config/scheduling.json", () => {
  it("holds today's numbers, so moving them changed nothing", () => {
    expect(SCHEDULING).toEqual({
      minNoticeMinutes: 60,
      shortNoticeHours: 24,
      arrivalWindowMinutes: 60,
      driveFallbackMinutes: 30,
      correctionWeekdays: [0, 6],
      bookAheadDays: 365,
      acceptAheadDays: 400,
    });
    expect(ARRIVAL_WINDOW_MIN).toBe(SCHEDULING.arrivalWindowMinutes);
    expect(WIRE_LIMITS.maxDaysAhead).toBe(SCHEDULING.acceptAheadDays);
  });

  it("refuses a bad value instead of shipping it", () => {
    const ok = { ...SCHEDULING };
    expect(() => checkScheduling({ ...ok, shortNoticeHours: -1 })).toThrow(/shortNoticeHours/);
    expect(() => checkScheduling({ ...ok, correctionWeekdays: [7] })).toThrow(/correctionWeekdays/);
    expect(() => checkScheduling({ ...ok, acceptAheadDays: 300 })).toThrow(/acceptAheadDays/);
    expect(() => checkScheduling({ ...ok, driveFallbackMinutes: "30" })).toThrow(/driveFallbackMinutes/);
  });

  it("no copy of these numbers is left typed into the form or the booking emails", () => {
    const funnel = read("js/funnel.js");
    expect(funnel).not.toMatch(/allowedWeekdays\s*[:=]\s*(corr \? )?\[0, 6\]/);
    expect(funnel).not.toMatch(/MAX_BOOK_DAYS = \d/);
    expect(funnel).not.toMatch(/MIN_NOTICE_MIN = \d|SHORT_NOTICE_HOURS = \d/);
    expect(funnel).not.toMatch(/endLabel\(m \+ 60\)/);
    const send = read("netlify/functions/send-confirmation.mjs");
    expect(send).not.toMatch(/24 \* 60 \* 60 \* 1000/);
    expect(send).not.toMatch(/measuredMin : 30\b/);
    expect(read("web/lib/availability/stillFree.ts")).not.toContain("[0, 6]");
  });
});
