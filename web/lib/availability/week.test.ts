import { describe, expect, it } from "vitest";
import { zonedToUtc } from "../time/zone.js";
import { recommendStarts } from "./slots.js";
import { addWeeks, buildWeek, dayOpenShare, startsPossible, daySuggestions, lastRowForSlots, STARTS_PER_DAY, stretchStarts, timelineRange, recommendBestDays, TIME_RECOMMENDATION_RULES, weekStartOf, weekFromToday } from "./week.js";

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

  it("weekFromToday: this week starts today, later weeks whole weeks on (Emmett, November 15)", () => {
    const wed = at(11, 18, 9);
    expect(weekFromToday(at(11, 18, 15), wed)).toBe(at(11, 18, 0));
    expect(weekFromToday(at(11, 24, 23), wed)).toBe(at(11, 18, 0));
    expect(weekFromToday(at(11, 25, 1), wed)).toBe(at(11, 25, 0));
    // Never before today, and whole local days across the clock change.
    expect(weekFromToday(at(11, 10, 12), wed)).toBe(at(11, 18, 0));
    expect(weekFromToday(at(11, 3, 12), at(10, 28, 9))).toBe(at(10, 28, 0));
    expect(weekFromToday(at(11, 4, 12), at(10, 28, 9))).toBe(at(11, 4, 0));
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

describe("recommendBestDays (best times from the calendars, round 15)", () => {
  // Tuesday 17 November to Monday 23. Rush is within 3 days: Tue to Thu.
  const nowMs = at(11, 17, 7);
  const isRush = (ms: number) => ms < at(11, 20, 0);
  const days = [17, 18, 19, 20, 21, 22, 23];
  const every = (hours: number[]) => days.flatMap((d) => hours.map((h) => at(11, d, h)));
  // Kris works evenings, best at 6pm; Elijah days, best at 10am, 4pm and 6pm (not 6pm at weekends).
  const kris = { id: "kris", starts: every([17, 18, 19]), best: days.map((d) => at(11, d, 18)) };
  const weekend = (d: number) => d === 21 || d === 22;
  const elijahBest = days.flatMap((d) => (weekend(d) ? [10, 16] : [10, 16, 18]).map((h) => at(11, d, h)));
  const elijah = { id: "elijah", starts: every([9, 10, 11, 12, 13, 14, 15, 16, 18]), best: elijahBest };

  it("Soonest, then the first day past rush, then the weekend, each led by the first detailer's best time", () => {
    const picks = recommendBestDays({ members: [kris, elijah], travelGapMin: 60, isRush, nowMs, isPremium: () => false });
    expect(picks.slice(0, 3).map((p) => [p.reason, p.dayStart, p.ms, p.who])).toEqual([
      ["soonest", at(11, 17, 0), at(11, 17, 18), "kris"],
      ["afterRush", at(11, 20, 0), at(11, 20, 18), "kris"],
      ["weekend", at(11, 21, 0), at(11, 21, 18), "kris"],
    ]);
    expect(picks[1]!.daysAway).toBe(3);
  });

  it("a first no-rush day on a weekend is the weekend pick; the later weekend day is just 'also' (November 15)", () => {
    // Thursday 19: rush Thu and Fri, so the first no-rush day is Saturday.
    const thu = at(11, 19, 7);
    const rushToSat = (ms: number) => ms < at(11, 21, 0);
    const picks = recommendBestDays({ members: [kris, elijah], travelGapMin: 60, isRush: rushToSat, nowMs: thu, isPremium: () => false });
    expect(picks.slice(0, 3).map((p) => [p.reason, p.dayStart])).toEqual([
      ["soonest", at(11, 17, 0)],
      ["afterRushWeekend", at(11, 21, 0)],
      ["also", at(11, 22, 0)],
    ]);
    expect(TIME_RECOMMENDATION_RULES.version).toBe("best-2");
  });

  it("'This weekend' is only the coming weekend, and the next card follows it in date order (validation, November 15)", () => {
    const thu = at(11, 19, 7);
    const rushToSat = (ms: number) => ms < at(11, 21, 0);
    // Sunday full: the card after "This weekend" is Monday, not next Saturday.
    const noSun = { ...elijah, starts: elijah.starts.filter((ms) => ms < at(11, 22, 0) || ms >= at(11, 23, 0)), best: elijah.best.filter((ms) => ms < at(11, 22, 0) || ms >= at(11, 23, 0)) };
    const krisNoSun = { ...kris, starts: kris.starts.filter((ms) => ms < at(11, 22, 0) || ms >= at(11, 23, 0)), best: kris.best.filter((ms) => ms < at(11, 22, 0) || ms >= at(11, 23, 0)) };
    const picks = recommendBestDays({ members: [krisNoSun, noSun], travelGapMin: 60, isRush: rushToSat, nowMs: thu, isPremium: () => false });
    expect(picks.slice(1, 3).map((p) => [p.reason, p.dayStart])).toEqual([["afterRushWeekend", at(11, 21, 0)], ["also", at(11, 23, 0)]]);
    // A first no-rush weekend day a week or more away keeps "In N days".
    const far = recommendBestDays({ members: [kris, elijah], travelGapMin: 60, isRush: (ms) => ms < at(11, 21, 0), nowMs: at(11, 14, 7), isPremium: () => false });
    expect(far.find((p) => p.dayStart === at(11, 21, 0))?.reason).not.toBe("afterRushWeekend");
  });

  it("More times are the other detailers' best times that day, never every half hour", () => {
    const fri = recommendBestDays({ members: [kris, elijah], travelGapMin: 60, isRush, nowMs, isPremium: () => false })[1]!;
    // 6pm is Kris's, so Elijah's 6pm is not offered twice.
    expect(fri.more).toEqual([at(11, 20, 10), at(11, 20, 16)]);
  });

  it("a detailer not free at their best time hands the lead to the next one", () => {
    const busyKris = { ...kris, starts: kris.starts.filter((ms) => ms !== at(11, 17, 18)) };
    const tue = recommendBestDays({ members: [busyKris, elijah], travelGapMin: 60, isRush, nowMs, isPremium: () => false })[0]!;
    expect([tue.ms, tue.who]).toEqual([at(11, 17, 10), "elijah"]);
    expect(tue.more).toEqual([at(11, 17, 16), at(11, 17, 18)]);
  });

  it("prefers a best time with no early or late fee as the headline", () => {
    const onlyElijah = recommendBestDays({ members: [elijah], travelGapMin: 60, isRush, nowMs, isPremium: (ms) => ms === at(11, 17, 10) })[0]!;
    expect(onlyElijah.ms).toBe(at(11, 17, 16));
  });

  it("falls back to the day-packing suggestions for someone with no BEST events", () => {
    const plain = { id: "elijah", starts: [at(11, 20, 8), at(11, 20, 10), at(11, 20, 11), at(11, 20, 16)], best: null };
    const pick = recommendBestDays({ members: [plain], travelGapMin: 60, isRush, nowMs })[0]!;
    expect([pick.ms, ...pick.more]).toEqual([at(11, 20, 10), at(11, 20, 16)]);
  });

  it("shows three, and up to two more days when there is room", () => {
    const picks = recommendBestDays({ members: [kris, elijah], travelGapMin: 60, isRush, nowMs, isPremium: () => false });
    expect(picks).toHaveLength(TIME_RECOMMENDATION_RULES.shown + TIME_RECOMMENDATION_RULES.extraWhenRoom);
    expect(picks.slice(3).every((p) => p.reason === "also")).toBe(true);
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

describe("dayOpenShare (the day strip's bar, November 11)", () => {
  const cell = (n: number) => ({ hourMin: 600, starts: Array.from({ length: n }, (_, i) => i + 1), pick: n ? 1 : null, premium: false, suggested: false });
  const day = (...counts: number[]) => ({ dayStart: 0, weekday: 1, y: 2026, mo: 11, d: 13, rush: false, past: false, cells: counts.map(cell) });

  it("counts every half-hour start the window allows, 6am to 10pm", () => {
    expect(STARTS_PER_DAY).toBe(33);
  });
  it("is 0 for a day with nothing open and 1 for a day with every start", () => {
    expect(dayOpenShare(day(0, 0))).toBe(0);
    expect(dayOpenShare(day(...Array(16).fill(2), 1))).toBe(1);
  });
  it("is the share of starts left", () => {
    expect(dayOpenShare(day(2, 1))).toBeCloseTo(3 / 33);
  });
  it("measures against what a free day could offer this job (owner, November 11)", () => {
    // 4.5 hours must finish by midnight: last start 7:30pm, so 28 starts from 6am.
    expect(startsPossible(270)).toBe(28);
    // Exterior starts by 8pm: 29 starts for a 2-hour exterior job.
    expect(startsPossible(120, true)).toBe(29);
    // A free day for a long job is full, not 85%.
    expect(dayOpenShare(day(...Array(14).fill(2)), 270)).toBe(1);
    expect(dayOpenShare(day(...Array(7).fill(2)), 270)).toBeCloseTo(14 / 28);
  });
});

describe("stretchStarts (say the price once, November 11)", () => {
  it("marks the first row of each run of the same price", () => {
    expect(stretchStarts(["std", "std", "+$25", "+$25", "std"])).toEqual([true, false, true, false, true]);
  });
  it("says the price again after a time that can't be booked", () => {
    expect(stretchStarts(["std", null, "std"])).toEqual([true, false, true]);
  });
  it("starts a stretch on the first row shown", () => {
    expect(stretchStarts(["+$25"])).toEqual([true]);
    expect(stretchStarts([])).toEqual([]);
  });
});

describe("timelineRange (no dead grey rows, November 11)", () => {
  const REG = { from: 600, to: 1080 };
  const shut = { early: false, late: false };
  const h = (x: number) => x * 60;

  it("starts at the first time, not at 10am", () => {
    expect(timelineRange([h(13), h(14)], 120, shut, REG)).toEqual({ from: h(13), last: h(14), to: h(16) });
  });
  it("ends where the last job ends, not at 6pm", () => {
    expect(timelineRange([h(10), h(11)], 60, shut, REG)).toEqual({ from: h(10), last: h(11), to: h(12) });
  });
  it("keeps the rows a late-finishing job runs into, as its tail", () => {
    // Late starts folded: 6, 6:30 and 7pm sit in the tail but are not offered there.
    expect(timelineRange([h(17) + 30, h(18), h(19)], 120, shut, REG)).toEqual({ from: h(17) + 30, last: h(17) + 30, to: h(19) + 30 });
  });
  it("keeps a gap enclosed by times", () => {
    expect(timelineRange([h(10), h(15)], 60, shut, REG)).toEqual({ from: h(10), last: h(15), to: h(16) });
  });
  it("leaves folded early and late starts out until they are opened", () => {
    expect(timelineRange([h(8), h(12), h(21)], 60, shut, REG)).toEqual({ from: h(12), last: h(12), to: h(13) });
    expect(timelineRange([h(8), h(12), h(21)], 60, { early: true, late: true }, REG)).toEqual({ from: h(8), last: h(21), to: h(22) });
  });
  it("stops at midnight, and is null with nothing in view", () => {
    expect(timelineRange([h(22)], 180, { early: false, late: true }, REG)).toEqual({ from: h(22), last: h(22), to: h(24) });
    expect(timelineRange([h(8)], 60, shut, REG)).toBeNull();
  });
});

describe("calendar fix 4: a detailer's standard-price evening is standard in the week", () => {
  const weekStart = at(11, 15, 0);
  const now = at(11, 10, 9);
  // Kris on Tuesday: 6pm and 6:30pm, standard price on his calendar; 7pm has a fee.
  const slots = [at(11, 17, 18), at(11, 17, 18, 30), at(11, 17, 19)];
  const feeFrom7 = (ms: number) => ms >= at(11, 17, 19);

  it("the clock alone calls 6pm a fee and stars nothing", () => {
    const week = buildWeek({ slots, weekStart, travelGapMin: 60, nowMs: now, needsPriority: () => false });
    const six = week.days[2]!.cells.find((c) => c.hourMin === 18 * 60)!;
    expect(six.premium).toBe(true);
    expect(six.suggested).toBe(false);
  });

  it("with the calendar's fee, 6pm is standard and can be starred; 7pm keeps its fee", () => {
    const week = buildWeek({ slots, weekStart, travelGapMin: 60, nowMs: now, needsPriority: () => false, isPremium: feeFrom7 });
    const tue = week.days[2]!;
    const six = tue.cells.find((c) => c.hourMin === 18 * 60)!;
    const seven = tue.cells.find((c) => c.hourMin === 19 * 60)!;
    expect(six.premium).toBe(false);
    expect(six.suggested).toBe(true);
    expect(seven.premium).toBe(true);
    expect(seven.suggested).toBe(false);
  });

  it("the recommendation ranking takes the calendar's fee too, so a fee start never outranks a standard 6pm", () => {
    // 8am carries a fee on this calendar, 6pm doesn't. By the clock both are
    // fee starts, so the ranking fell back to all and could pick 8am.
    const starts = [at(11, 17, 8), at(11, 17, 18)];
    const fee = (ms: number) => ms === at(11, 17, 8);
    const picked = recommendStarts({ starts, travelGapMin: 60, isPremium: fee, limit: 2 }).map((r) => r.ms);
    expect(picked).toEqual([at(11, 17, 18)]);
  });

  it("the form folds by the fee, not by 10am to 6pm", () => {
    const src = require("node:fs").readFileSync(require("node:path").join(__dirname, "../../../js/funnel.js"), "utf8");
    expect(src).not.toMatch(/REG_FROM|REG_TO/);
    expect(src).toContain("isPremium: timeFeeApplies");
    const folds = src.slice(src.indexOf("function foldsOpen("), src.indexOf("function foldButton("));
    expect(folds).toContain("timeFeeApplies(");
  });
});
