import { describe, expect, it } from "vitest";
import {
  LONGEST_DAY,
  MAX_DOOR_TO_DOOR_MIN,
  dayCapacityMin,
  describePlan,
  fitsOneDay,
  planDays,
  splitEvenly,
} from "./multiDay.js";

const H = 60;
const ok = (r: ReturnType<typeof planDays>) => {
  if (!r.ok) throw new Error("expected a plan, got: " + r.reason);
  return r;
};

describe("day capacity", () => {
  it("is sixteen hours with no drive", () => {
    expect(dayCapacityMin()).toBe(16 * H);
  });

  it("shrinks once the commute makes the door to door day too long", () => {
    // 16 hrs of work plus 40 mins each way is a 17hr 20min day, past the
    // limit, so the day can only hold 15hrs 40mins of work.
    expect(dayCapacityMin(LONGEST_DAY, 40, 40)).toBe(MAX_DOOR_TO_DOOR_MIN - 80);
  });

  it("never goes negative on an absurd drive", () => {
    expect(dayCapacityMin(LONGEST_DAY, 10 * H, 10 * H)).toBe(0);
  });
});

describe("what fits in one day", () => {
  it("keeps a 14 hour detail on one day", () => {
    expect(fitsOneDay(14 * H)).toBe(true);
  });

  it("keeps a 16 hour detail on one day, exactly", () => {
    expect(fitsOneDay(16 * H)).toBe(true);
    expect(fitsOneDay(16 * H + 1)).toBe(false);
  });
});

describe("splitting evenly", () => {
  it("splits 20 hours as 10 and 10, not 16 and 4", () => {
    expect(splitEvenly(20 * H, 2)).toEqual([10 * H, 10 * H]);
  });

  it("puts the remainder on the early days, leaving the last one short", () => {
    expect(splitEvenly(61, 2)).toEqual([31, 30]);
    expect(splitEvenly(10, 3)).toEqual([4, 3, 3]);
  });
});

describe("planning a single day", () => {
  it("starts a 14 hour detail at 8am, and cannot start later than 10am", () => {
    // 8am is the right answer when it is available: finishing at 10pm beats
    // finishing at midnight for the same work.
    const p = ok(planDays({ serviceMinutes: 14 * H }));
    expect(p.totalDays).toBe(1);
    expect(p.days[0]!.startMin).toBe(8 * H);
    expect(p.days[0]!.endMin).toBe(22 * H);

    // 10am is the LATEST that fits, which is midnight minus the work, and it
    // is taken when 8am is not on offer.
    const later = ok(planDays({ serviceMinutes: 14 * H, preferredStartsMin: [10 * H, 12 * H] }));
    expect(later.days[0]!.startMin).toBe(10 * H);
    expect(later.days[0]!.endMin).toBe(24 * H);

    // Noon does not fit at all, so it falls back to the start of the day
    // rather than promising a finish after midnight.
    const tooLate = ok(planDays({ serviceMinutes: 14 * H, preferredStartsMin: [12 * H] }));
    expect(tooLate.days[0]!.startMin).toBe(8 * H);
    expect(tooLate.days[0]!.endMin).toBeLessThanOrEqual(24 * H);
  });

  it("starts a 16 hour detail at 8am, the only time it fits", () => {
    const p = ok(planDays({ serviceMinutes: 16 * H }));
    expect(p.totalDays).toBe(1);
    expect(p.days[0]!.startMin).toBe(8 * H);
    expect(p.days[0]!.endMin).toBe(24 * H);
  });

  it("still starts a short job early, because a long day wants the morning", () => {
    const p = ok(planDays({ serviceMinutes: 5 * H }));
    expect(p.days[0]!.startMin).toBe(8 * H);
  });

  it("puts the commute outside the working window", () => {
    const p = ok(planDays({ serviceMinutes: 6 * H, travelBeforeMin: 30, travelAfterMin: 45 }));
    const d = p.days[0]!;
    expect(d.startMin).toBe(8 * H);
    expect(d.blockStartMin).toBe(8 * H - 30);
    expect(d.blockEndMin).toBe(8 * H + 6 * H + 45);
  });
});

describe("planning across days", () => {
  it("balances 20 hours into two even days", () => {
    const p = ok(planDays({ serviceMinutes: 20 * H }));
    expect(p.totalDays).toBe(2);
    expect(p.days.map((d) => d.workMin)).toEqual([10 * H, 10 * H]);
    expect(p.balanced).toBe(true);
  });

  it("never fills the first day and dumps the scraps on the second", () => {
    const p = ok(planDays({ serviceMinutes: 18 * H }));
    // The lazy split would be 16 and 2. Nine and nine is the right answer.
    expect(p.days.map((d) => d.workMin)).toEqual([9 * H, 9 * H]);
  });

  it("takes three days for a 34 hour correction and keeps them even", () => {
    const p = ok(planDays({ serviceMinutes: 34 * H }));
    expect(p.totalDays).toBe(3);
    expect(p.balanced).toBe(true);
    const total = p.days.reduce((s, d) => s + d.workMin, 0);
    expect(total).toBeGreaterThanOrEqual(34 * H);
    for (const d of p.days) expect(d.workMin).toBeLessThanOrEqual(16 * H);
  });

  it("every day finishes by midnight", () => {
    for (const hrs of [17, 20, 22, 25, 30, 34, 40]) {
      const p = ok(planDays({ serviceMinutes: hrs * H }));
      for (const d of p.days) {
        expect(d.endMin, `${hrs}h day ${d.index}`).toBeLessThanOrEqual(24 * H);
        expect(d.startMin, `${hrs}h day ${d.index}`).toBeGreaterThanOrEqual(8 * H);
      }
    }
  });

  it("takes an extra day when the drive makes each one too long", () => {
    const near = planDays({ serviceMinutes: 30 * H });
    const far = planDays({ serviceMinutes: 30 * H, travelBeforeMin: 75, travelAfterMin: 75 });
    expect(ok(near).totalDays).toBe(2);
    // Two and a half hours of driving a day has to come out of somewhere.
    expect(ok(far).totalDays).toBe(3);
  });

  it("keeps the door to door day inside the limit once travel is counted", () => {
    const p = ok(planDays({ serviceMinutes: 30 * H, travelBeforeMin: 60, travelAfterMin: 60 }));
    expect(p.longestDoorToDoorMin).toBeLessThanOrEqual(MAX_DOOR_TO_DOOR_MIN);
  });

  it("refuses rather than planning a fortnight", () => {
    const r = planDays({ serviceMinutes: 200 * H, maxDays: 5 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/talk to us/i);
  });

  it("refuses when the drive alone fills the day", () => {
    const r = planDays({ serviceMinutes: 4 * H, travelBeforeMin: 9 * H, travelAfterMin: 9 * H });
    expect(r.ok).toBe(false);
  });
});

describe("telling the customer", () => {
  it("describes one day plainly", () => {
    expect(describePlan(ok(planDays({ serviceMinutes: 6 * H })))).toBe(
      "One day, about 6 hrs, starting at 8am.",
    );
  });

  it("describes two even days and the morning start", () => {
    expect(describePlan(ok(planDays({ serviceMinutes: 20 * H })))).toBe(
      "2 days back to back, about 10 hrs each, starting at 8am each morning.",
    );
  });

  it("names the hours when the days differ", () => {
    const text = describePlan(ok(planDays({ serviceMinutes: 17 * H })));
    expect(text).toContain("2 days back to back");
  });
});

/* ---------------- placing a plan on real days ---------------- */

import { findMultiDayStarts } from "./multiDay.js";
import { zonedToUtc } from "../time/zone.js";

const TZ = "America/New_York";
const at = (d: number, min: number) => zonedToUtc(2026, 10, d, 0, min, 0, TZ);
/** A wide open day, 6am to 2am the next morning. */
const openDay = (d: number) => ({ start: at(d, 6 * H), end: at(d + 1, 2 * H) });

const fmt = (ms: number) =>
  new Date(ms).toLocaleString("en-US", { timeZone: TZ, month: "short", day: "numeric", hour: "numeric" });

describe("finding consecutive free days", () => {
  const plan = ok(planDays({ serviceMinutes: 20 * H }));

  it("offers a first day only when EVERY day of the plan is free", () => {
    const found = findMultiDayStarts({
      plan,
      openBlocks: [openDay(3), openDay(4), openDay(5)],
      busy: [],
      notBefore: at(3, 0),
      notAfter: at(6, 0),
      timeZone: TZ,
    });
    // The 3rd works because the 4th is open too. The 5th has nothing after it.
    expect(found.map((f) => fmt(f.startMs))).toEqual(["Oct 3, 8 AM", "Oct 4, 8 AM"]);
  });

  it("refuses a start whose SECOND day is booked", () => {
    // One appointment in the middle of the 4th takes out BOTH candidates:
    // the 3rd needs the 4th as its second day, and the 4th needs it as its
    // first. A partially free day is not a free day for a job like this.
    const found = findMultiDayStarts({
      plan,
      openBlocks: [openDay(3), openDay(4), openDay(5)],
      busy: [{ start: at(4, 12 * H), end: at(4, 13 * H) }],
      notBefore: at(3, 0),
      notAfter: at(6, 0),
      timeZone: TZ,
    });
    expect(found).toEqual([]);
  });

  it("still offers the pair on the far side of a clash", () => {
    const found = findMultiDayStarts({
      plan,
      openBlocks: [openDay(3), openDay(4), openDay(5), openDay(6)],
      busy: [{ start: at(3, 12 * H), end: at(3, 13 * H) }],
      notBefore: at(3, 0),
      notAfter: at(7, 0),
      timeZone: TZ,
    });
    // The 3rd is out, but the 4th and 5th are a clean pair.
    expect(found.map((f) => fmt(f.startMs))).toEqual(["Oct 4, 8 AM", "Oct 5, 8 AM"]);
  });

  it("reserves a block for every day, travel included", () => {
    const withTravel = ok(planDays({ serviceMinutes: 20 * H, travelBeforeMin: 30, travelAfterMin: 30 }));
    const found = findMultiDayStarts({
      plan: withTravel,
      openBlocks: [openDay(3), openDay(4)],
      busy: [],
      notBefore: at(3, 0),
      notAfter: at(4, 0),
      timeZone: TZ,
    });
    expect(found).toHaveLength(1);
    expect(found[0]!.blocks).toHaveLength(withTravel.totalDays);
    // The block opens half an hour before the customer sees us arrive.
    expect(found[0]!.blocks[0]!.start).toBe(found[0]!.days[0]!.startMs - 30 * 60_000);
  });

  it("honours a weekend only rule on the first day", () => {
    // 3 October 2026 is a Saturday.
    const found = findMultiDayStarts({
      plan,
      openBlocks: [openDay(2), openDay(3), openDay(4), openDay(5)],
      busy: [],
      notBefore: at(2, 0),
      notAfter: at(5, 0),
      timeZone: TZ,
      allowedWeekdays: [0, 6],
    });
    for (const f of found) {
      const day = new Date(f.startMs).toLocaleDateString("en-US", { timeZone: TZ, weekday: "short" });
      expect(["Sat", "Sun"]).toContain(day);
    }
  });

  it("finds nothing rather than something partial", () => {
    const found = findMultiDayStarts({
      plan,
      openBlocks: [openDay(3)], // one day open, two needed
      busy: [],
      notBefore: at(3, 0),
      notAfter: at(5, 0),
      timeZone: TZ,
    });
    expect(found).toEqual([]);
  });
});
