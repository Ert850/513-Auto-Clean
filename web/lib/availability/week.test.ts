import { describe, expect, it } from "vitest";
import { zonedToUtc } from "../time/zone.js";
import { addWeeks, buildWeek, lastRowFor, recommendDays, weekStartOf } from "./week.js";

const TZ = "America/New_York";
const at = (mo: number, d: number, h: number, mi = 0) => zonedToUtc(2026, mo, d, h, mi, 0, TZ);

describe("weekStartOf / addWeeks", () => {
  it("lands on Sunday midnight in Cincinnati", () => {
    // Wednesday 18 November 2026, 3pm
    expect(weekStartOf(at(11, 18, 15))).toBe(at(11, 15, 0));
    // Sunday itself, just after midnight
    expect(weekStartOf(at(11, 15, 0, 5))).toBe(at(11, 15, 0));
    // Saturday 11:59pm still belongs to the week before
    expect(weekStartOf(at(11, 21, 23, 59))).toBe(at(11, 15, 0));
  });

  it("steps whole weeks across the clock change (DST ends 1 Nov 2026)", () => {
    expect(addWeeks(at(10, 25, 0), 1)).toBe(at(11, 1, 0));
    expect(addWeeks(at(11, 1, 0), -1)).toBe(at(10, 25, 0));
  });
});

describe("buildWeek", () => {
  const weekStart = at(11, 15, 0);
  const now = at(11, 10, 9); // Tuesday the week before
  const noRush = () => false;

  const slots = [
    // Tuesday 17th
    at(11, 17, 10), at(11, 17, 10, 30), at(11, 17, 11), at(11, 17, 13, 30), at(11, 17, 16),
    // Saturday 21st: an early start only
    at(11, 21, 8),
    // Next week: must be ignored
    at(11, 24, 10),
  ];

  const week = buildWeek({ slots, weekStart, travelGapMin: 60, nowMs: now, needsPriority: noRush });
  const tue = week.days[2]!;
  const sat = week.days[6]!;
  const cell = (day: typeof tue, h: number) => day.cells.find((c) => c.hourMin === h * 60)!;

  it("has seven days from Sunday, with every row on every day", () => {
    expect(week.days.map((d) => d.weekday)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(week.days.map((d) => d.d)).toEqual([15, 16, 17, 18, 19, 20, 21]);
    for (const d of week.days) expect(d.cells.map((c) => c.hourMin)).toEqual(week.rows);
  });

  it("shows every start hour, 6am to 10pm, by default", () => {
    expect(week.rows[0]).toBe(6 * 60);
    expect(week.rows[week.rows.length - 1]).toBe(22 * 60);
    expect(week.rows.length).toBe(17);
  });

  it("adds rows only for the hours this job can still be running in", () => {
    const longer = buildWeek({ slots, weekStart, travelGapMin: 60, nowMs: now, needsPriority: noRush, lastRowMin: 23 * 60 });
    expect(longer.rows[longer.rows.length - 1]).toBe(23 * 60);
    // Never a start, so always grey.
    expect(longer.days.every((d) => d.cells[d.cells.length - 1]!.pick === null)).toBe(true);
  });

  it("puts every start in its hour and leaves the rest unavailable", () => {
    expect(cell(tue, 10).starts).toEqual([at(11, 17, 10), at(11, 17, 10, 30)]);
    expect(cell(tue, 13).pick).toBe(at(11, 17, 13, 30));
    expect(cell(tue, 12).pick).toBeNull();
    expect(week.days[3]!.cells.every((c) => c.pick === null)).toBe(true);
    expect(week.openCount).toBe(5); // 10, 11, 13 and 16 on Tuesday, 8 on Saturday
  });

  it("suggests 10am and 4pm on a weekday, never a fee", () => {
    expect(cell(tue, 10).suggested).toBe(true);
    expect(cell(tue, 16).suggested).toBe(true);
    expect(cell(tue, 11).suggested).toBe(false);
    expect(cell(sat, 8).premium).toBe(true);
    expect(cell(sat, 8).suggested).toBe(false);
  });

  it("suggests the start right after an existing job", () => {
    const busy = [{ start: at(11, 17, 8), end: at(11, 17, 12) }];
    const w = buildWeek({
      slots: [at(11, 17, 13), at(11, 17, 13, 30), at(11, 17, 14), at(11, 17, 16)],
      weekStart, busy, travelGapMin: 60, nowMs: now, needsPriority: noRush,
    });
    const c13 = w.days[2]!.cells.find((c) => c.hourMin === 13 * 60)!;
    expect(c13.suggested).toBe(true);
    expect(c13.pick).toBe(at(11, 17, 13));
  });

  it("marks days before today as past", () => {
    const w = buildWeek({ slots: [], weekStart, travelGapMin: 60, nowMs: at(11, 18, 9), needsPriority: noRush });
    expect(w.days.map((d) => d.past)).toEqual([true, true, true, false, false, false, false]);
    expect(w.openCount).toBe(0);
    expect(w.rows.length).toBe(17);
  });
});

describe("recommendDays", () => {
  const slots = [
    at(11, 17, 8), at(11, 17, 10), at(11, 17, 11), at(11, 17, 16), // Tuesday
    at(11, 18, 10), at(11, 18, 16), // Wednesday
    at(11, 19, 10), at(11, 19, 16), // Thursday
    at(11, 20, 10), // Friday
  ];
  const rushThrough = (day: number) => (ms: number) => ms < at(11, day + 1, 0);

  it("gives three days, each with its two best starts, never early or late", () => {
    const days = recommendDays({ slots, travelGapMin: 60 });
    expect(days.map((d) => d.starts)).toEqual([
      [at(11, 17, 10), at(11, 17, 16)],
      [at(11, 18, 10), at(11, 18, 16)],
      [at(11, 19, 10), at(11, 19, 16)],
    ]);
  });

  it("shows at most one fee day; the rest are the soonest standard days", () => {
    const days = recommendDays({ slots, travelGapMin: 60, isFee: rushThrough(18) });
    expect(days.map((d) => [d.dayStart, d.fee])).toEqual([
      [at(11, 17, 0), true], [at(11, 19, 0), false], [at(11, 20, 0), false],
    ]);
  });

  it("falls back to fee days only when nothing else is open", () => {
    const days = recommendDays({ slots, travelGapMin: 60, isFee: () => true });
    expect(days).toHaveLength(3);
    expect(days.every((d) => d.fee)).toBe(true);
  });

  it("prefers the first-choice detailer's starts within a day", () => {
    const days = recommendDays({ slots, travelGapMin: 60, preferred: new Set([at(11, 17, 11)]) });
    expect(days[0]!.starts).toEqual([at(11, 17, 11)]);
  });

  it("recommends a late start when the detailer taking it charges no late fee", () => {
    const evening = [at(11, 17, 18), at(11, 17, 20)];
    expect(recommendDays({ slots: evening, travelGapMin: 60 })).toEqual([]);
    const isPremium = (ms: number) => ms !== at(11, 17, 18);
    expect(recommendDays({ slots: evening, travelGapMin: 60, isPremium })[0]!.starts).toEqual([at(11, 17, 18)]);
  });

  it("lets a score (from analytics, later) order the starts within a day", () => {
    const scoreFor = (ms: number) => (ms === at(11, 17, 16) ? 1 : 0);
    expect(recommendDays({ slots, travelGapMin: 60, scoreFor })[0]!.starts[0]).toBe(at(11, 17, 16));
  });

  it("can be tuned without touching the funnel", () => {
    const rules = { days: 2, timesPerDay: 1, maxFeeDays: 0 };
    const days = recommendDays({ slots, travelGapMin: 60, isFee: rushThrough(17), rules });
    expect(days.map((d) => d.starts)).toEqual([[at(11, 18, 10)], [at(11, 19, 10)]]);
  });
});

describe("lastRowFor", () => {
  it("keeps 10pm when the job cannot run later than that", () => {
    // Exterior work must start by 8pm: a 2 hour exterior ends by 10pm.
    expect(lastRowFor(120, true)).toBe(22 * 60);
    expect(lastRowFor(60, true)).toBe(22 * 60);
  });

  it("adds the 11pm row when a job can run toward midnight", () => {
    expect(lastRowFor(120)).toBe(23 * 60); // a 10pm start ends at midnight
    expect(lastRowFor(240)).toBe(23 * 60); // an 8pm start ends at midnight
    expect(lastRowFor(75)).toBe(23 * 60); // a 10pm start ends at 11:15
    expect(lastRowFor(240, true)).toBe(23 * 60); // an 8pm exterior ends at midnight
  });

  it("never draws past midnight, whatever the job", () => {
    expect(lastRowFor(900)).toBe(23 * 60);
  });
});
