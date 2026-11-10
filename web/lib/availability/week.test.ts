import { describe, expect, it } from "vitest";
import { zonedToUtc } from "../time/zone.js";
import { addWeeks, buildWeek, daySuggestions, lastRowForSlots, recommendPicks, TIME_RECOMMENDATION_RULES, weekStartOf } from "./week.js";

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

describe("recommendPicks", () => {
  // Tue 17 to Sat 21 November, then Monday 23 (the next week).
  const slots = [
    at(11, 17, 8), at(11, 17, 10), at(11, 17, 11), at(11, 17, 16),
    at(11, 18, 10), at(11, 18, 16),
    at(11, 19, 10), at(11, 19, 16),
    at(11, 20, 10),
    at(11, 21, 10), at(11, 21, 13), at(11, 21, 16),
    at(11, 23, 10), at(11, 23, 16),
  ];
  const nowMs = at(11, 17, 7);
  const rushThrough = (day: number) => (ms: number) => ms < at(11, day + 1, 0);
  const brief = (p: { ms: number; reason: string }[]) => p.map((x) => [x.reason, x.ms]);

  it("explains a jump: the soonest (with its fee), then the first day at the standard price", () => {
    const picks = recommendPicks({ slots, travelGapMin: 60, isFee: rushThrough(19), nowMs });
    expect(brief(picks)).toEqual([
      ["soonest", at(11, 17, 10)],
      ["standard", at(11, 20, 10)],
      ["weekend", at(11, 21, 10)],
      // every pick so far is a morning, so an afternoon on a standard day
      ["afternoon", at(11, 23, 16)],
    ]);
    expect(picks.filter((p) => p.fee)).toHaveLength(1);
  });

  it("skips 'first at the standard price' when the soonest already is, and fills with the next days", () => {
    const picks = recommendPicks({ slots, travelGapMin: 60, nowMs });
    expect(picks.map((p) => p.reason)).toEqual(["soonest", "weekend", "afternoon", "nextWeek", "also"]);
    expect(picks.map((p) => p.dayStart)).toEqual([at(11, 17, 0), at(11, 21, 0), at(11, 18, 0), at(11, 23, 0), at(11, 19, 0)]);
    expect(picks).toHaveLength(TIME_RECOMMENDATION_RULES.shown + TIME_RECOMMENDATION_RULES.extraWhenRoom);
  });

  it("never offers more than one fee, and fee days only when nothing else is open", () => {
    const allFee = recommendPicks({ slots, travelGapMin: 60, isFee: () => true, nowMs });
    expect(allFee).toHaveLength(TIME_RECOMMENDATION_RULES.shown);
    expect(allFee.map((p) => p.reason)).toEqual(["soonest", "also", "also"]);
    const rules = { ...TIME_RECOMMENDATION_RULES, maxFeePicks: 0 };
    expect(recommendPicks({ slots, travelGapMin: 60, isFee: rushThrough(19), nowMs, rules })[0]!.reason).toBe("standard");
  });

  it("never suggests an early or late start, unless that detailer charges no fee for it", () => {
    const evening = [at(11, 17, 18), at(11, 17, 20)];
    expect(recommendPicks({ slots: evening, travelGapMin: 60, nowMs })).toEqual([]);
    const isPremium = (ms: number) => ms !== at(11, 17, 18);
    expect(recommendPicks({ slots: evening, travelGapMin: 60, isPremium, nowMs })[0]!.ms).toBe(at(11, 17, 18));
  });

  it("prefers the first-choice detailer within a day, and lets a score reorder a day", () => {
    expect(recommendPicks({ slots, travelGapMin: 60, preferred: new Set([at(11, 17, 11)]), nowMs })[0]!.ms).toBe(at(11, 17, 11));
    // scoreFor reorders the day's suggestions; "soonest" still takes the earliest of them.
    const scoreFor = (ms: number) => (ms === at(11, 21, 16) ? 1 : 0);
    const weekend = recommendPicks({ slots, travelGapMin: 60, scoreFor, nowMs }).find((p) => p.reason === "weekend");
    expect(weekend!.ms).toBe(at(11, 21, 16));
  });
});

describe("daySuggestions", () => {
  it("keeps a day packable and skips early and late starts", () => {
    expect(daySuggestions({ starts: [at(11, 17, 8), at(11, 17, 10), at(11, 17, 11), at(11, 17, 16)], travelGapMin: 60 }))
      .toEqual([at(11, 17, 10), at(11, 17, 16)]);
    expect(daySuggestions({ starts: [], travelGapMin: 60 })).toEqual([]);
  });
});

describe("lastRowForSlots", () => {
  it("keeps 10pm when no offered job runs later", () => {
    expect(lastRowForSlots([at(11, 17, 10), at(11, 17, 20)], 120)).toBe(22 * 60); // 8pm to 10pm
    expect(lastRowForSlots([], 120)).toBe(22 * 60);
  });

  it("adds the 11pm row only when an offered job runs into it", () => {
    expect(lastRowForSlots([at(11, 17, 22)], 120)).toBe(23 * 60); // 10pm to midnight
    expect(lastRowForSlots([at(11, 17, 22)], 75)).toBe(23 * 60); // 10pm to 11:15
  });

  it("no unreachable 11pm row for a 7 hour job whose latest start is 4pm (owner, November 10)", () => {
    // 5pm was never offered: 5pm + 7 hours + the drive home runs past midnight.
    expect(lastRowForSlots([at(11, 23, 10), at(11, 23, 16)], 420)).toBe(22 * 60);
    expect(lastRowForSlots([at(11, 23, 16, 30)], 420)).toBe(23 * 60); // ends 11:30pm
  });

  it("never draws past midnight", () => {
    expect(lastRowForSlots([at(11, 17, 20)], 900)).toBe(23 * 60);
  });
});
