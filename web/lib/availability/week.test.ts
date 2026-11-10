import { describe, expect, it } from "vitest";
import { zonedToUtc } from "../time/zone.js";
import { addWeeks, buildWeek, recommendTimes, weekStartOf } from "./week.js";

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

  it("always shows every bookable hour, 6am to 10pm, open or not", () => {
    expect(week.rows[0]).toBe(6 * 60);
    expect(week.rows[week.rows.length - 1]).toBe(22 * 60);
    expect(week.rows.length).toBe(17);
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

describe("recommendTimes", () => {
  const slots = [
    // Tuesday 17th: plenty
    at(11, 17, 8), at(11, 17, 10), at(11, 17, 11), at(11, 17, 16),
    // Wednesday 18th
    at(11, 18, 10), at(11, 18, 16),
    // Thursday 19th
    at(11, 19, 10),
  ];

  it("gives the three soonest packing starts, two a day at most, never early or late", () => {
    expect(recommendTimes({ slots, travelGapMin: 60 })).toEqual([at(11, 17, 10), at(11, 17, 16), at(11, 18, 10)]);
  });

  it("prefers a start the first-choice detailer can take, on the same day", () => {
    const preferred = new Set([at(11, 17, 11)]);
    const recs = recommendTimes({ slots, travelGapMin: 60, preferred });
    expect(recs[0]).toBe(at(11, 17, 11));
    expect(recs).toHaveLength(3);
  });

  it("returns what there is when the week is thin", () => {
    expect(recommendTimes({ slots: [at(11, 19, 10), at(11, 19, 7)], travelGapMin: 60 })).toEqual([at(11, 19, 10)]);
    expect(recommendTimes({ slots: [], travelGapMin: 60 })).toEqual([]);
  });
});
