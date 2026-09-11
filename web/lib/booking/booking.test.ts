import { describe, expect, it } from "vitest";
import { blockedReason, displaceableBookings, evaluateSlot } from "./provisional.js";
import { DEFAULT_RULES as R } from "../pricing/rules.js";
import { computeSurcharge } from "../pricing/surcharge.js";
import {
  IGNORE_RETURN_AFTER_MIN,
  TIME_BANDS,
  bandOf,
  groupIntoBands,
  travelBufferMin,
  computeSlots,
  localMinutesOfDay,
  mergeIntervals,
  subtractIntervals,
  type Interval,
} from "../availability/slots.js";

const MIN = 60_000;
const at = (h: number, m = 0, day = 1) => new Date(2026, 8, day, h, m).getTime();
const iv = (a: number, b: number): Interval => ({ start: a, end: b });

/** "6am", "2pm": minutes past local midnight in the words the page uses. */
const clockOf = (min: number) => {
  const h = Math.floor(min / 60) % 24;
  return `${((h + 11) % 12) + 1}${h < 12 ? "am" : "pm"}`;
};

describe("provisional slots", () => {
  const base = { depositPaidCents: 0, hoursUntilStart: 200, displacedByDeposit: false };

  it("locks the slot as soon as a deposit is paid", () => {
    const v = evaluateSlot({ ...base, depositPaidCents: 9750 });
    expect(v.standing).toBe("confirmed_by_deposit");
    expect(v.locked).toBe(true);
    expect(v.displaceable).toBe(false);
  });

  it("leaves an undeposited booking takeable", () => {
    const v = evaluateSlot(base);
    expect(v.standing).toBe("provisional");
    expect(v.displaceable).toBe(true);
    expect(v.locked).toBe(false);
  });

  it("firms up on its own inside 48 hours", () => {
    expect(evaluateSlot({ ...base, hoursUntilStart: 49 }).standing).toBe("provisional");
    expect(evaluateSlot({ ...base, hoursUntilStart: 48 }).standing).toBe("confirmed_by_time");
    expect(evaluateSlot({ ...base, hoursUntilStart: 12 }).locked).toBe(true);
  });

  it("reports a displaced booking clearly", () => {
    const v = evaluateSlot({ ...base, displacedByDeposit: true });
    expect(v.standing).toBe("displaced");
    expect(v.locked).toBe(false);
  });

  it("only offers up genuinely displaceable bookings", () => {
    const rows = [
      { id: "paid", ...base, depositPaidCents: 5000 },
      { id: "firm", ...base, hoursUntilStart: 10 },
      { id: "takeable", ...base },
    ];
    expect(displaceableBookings(rows).map((r) => r.id)).toEqual(["takeable"]);
  });

  it("blocks anyone from taking a paid slot, deposit or not", () => {
    const paid = [{ ...base, depositPaidCents: 5000 }];
    expect(blockedReason(9750, paid)).toMatch(/already been reserved/);
    expect(blockedReason(0, paid)).toMatch(/already been reserved/);
  });

  it("lets a deposit take a provisional slot, but not another no-deposit booking", () => {
    const held = [base];
    expect(blockedReason(9750, held)).toBe(null); // deposit wins it
    expect(blockedReason(0, held)).toMatch(/Place a deposit/);
  });
});

describe("interval maths", () => {
  it("merges overlapping and touching blocks", () => {
    const m = mergeIntervals([iv(at(9), at(11)), iv(at(10), at(12)), iv(at(12), at(13))]);
    expect(m).toHaveLength(1);
    expect(m[0]).toEqual(iv(at(9), at(13)));
  });

  it("subtracts a busy block from the middle, leaving two", () => {
    const free = subtractIntervals([iv(at(9), at(17))], [iv(at(12), at(13))]);
    expect(free).toEqual([iv(at(9), at(12)), iv(at(13), at(17))]);
  });

  it("removes a fully covered block", () => {
    expect(subtractIntervals([iv(at(9), at(11))], [iv(at(8), at(12))])).toEqual([]);
  });
});

describe("slot fitting", () => {
  const req = {
    openBlocks: [iv(at(9), at(17))],
    busy: [],
    serviceDurationMin: 240, // 4 hours
    travelBeforeMin: 30,
    travelAfterMin: 30,
    granularityMin: 30,
    notBefore: at(0),
    notAfter: at(23),
  };

  it("requires the whole commitment to fit, travel included", () => {
    // 9am to 5pm open, 4hr job + 1hr travel = 5hr commitment.
    // Earliest customer-facing start is 9:30 (drive out fits from 9:00),
    // latest is 12:30 (finishes 16:30, drive back ends 17:00).
    const slots = computeSlots(req);
    expect(slots[0]).toBe(at(9, 30));
    expect(slots[slots.length - 1]).toBe(at(12, 30));
  });

  it("offers fewer slots when the drive is longer", () => {
    const near = computeSlots({ ...req, travelBeforeMin: 5, travelAfterMin: 5 });
    const far = computeSlots({ ...req, travelBeforeMin: 60, travelAfterMin: 60 });
    expect(far.length).toBeLessThan(near.length);
  });

  it("returns nothing when the job cannot fit at all", () => {
    expect(computeSlots({ ...req, serviceDurationMin: 600 })).toEqual([]);
  });

  it("respects an existing booking, buffers and all", () => {
    const slots = computeSlots({ ...req, busy: [iv(at(11), at(15))] });
    // Only the 9:00 to 11:00 gap remains, too small for a 5 hour commitment.
    expect(slots).toEqual([]);
  });

  it("never starts before notBefore", () => {
    const slots = computeSlots({ ...req, notBefore: at(11) });
    expect(Math.min(...slots)).toBeGreaterThanOrEqual(at(11));
  });
});

describe("preferred start times", () => {
  // Mon 14 Sep 2026 is a weekday; Sat 19 Sep is not.
  const req = (day: number) => ({
    // 5am to 1am next day, mirroring DEFAULT_HOURS: wide enough for the drive
    // out before a 6am arrival and the drive home after a late finish.
    openBlocks: [iv(new Date(2026, 8, day, 5).getTime(), new Date(2026, 8, day + 1, 1).getTime())],
    busy: [],
    serviceDurationMin: 120,
    travelBeforeMin: 30,
    travelAfterMin: 30,
    granularityMin: 30,
    notBefore: new Date(2026, 8, day, 0).getTime(),
    notAfter: new Date(2026, 8, day, 23).getTime(),
  });

  const hours = (list: number[]) =>
    list.map((ms) => new Date(ms).getHours() + ":" + String(new Date(ms).getMinutes()).padStart(2, "0"));

  it("puts every offered start in exactly one band", () => {
    for (const ms of computeSlots(req(14))) {
      expect(bandOf(localMinutesOfDay(ms)), hours([ms])[0]).not.toBeNull();
    }
  });

  it("never charges a premium for a time sold as standard", () => {
    // The old arrangement offered 8am under a heading that read as ordinary
    // and then charged 20% for it. Band boundaries and surcharge boundaries
    // now have to agree, and this is what holds them together.
    for (const band of TIME_BANDS) {
      for (const min of [band.fromMin, band.preferMin, band.toMin - 1]) {
        const charged =
          computeSurcharge({ startMinutesLocal: min, priorityBooking: false }, R.surcharge)
            .appliedBp > 0;
        expect(charged, `${band.label} at ${min / 60}h`).toBe(band.premium);
      }
    }
  });

  it("suggests 10am at midday and 4pm in the afternoon", () => {
    const banded = groupIntoBands(computeSlots(req(120)));
    const find = (id: string) => banded.find((b) => b.band.id === id);
    expect(hours([find("midday")!.suggested])).toEqual(["10:00"]);
    expect(hours([find("afternoon")!.suggested])).toEqual(["16:00"]);
  });

  it("leans EARLY in the evening band, not late", () => {
    const banded = groupIntoBands(computeSlots(req(120)));
    const evening = banded.find((b) => b.band.id === "evening")!;
    expect(hours([evening.suggested])).toEqual(["18:00"]);
  });

  it("drops a band entirely rather than showing it empty", () => {
    const busyMorning = {
      ...req(14),
      busy: [iv(new Date(2026, 8, 14, 5).getTime(), new Date(2026, 8, 14, 13).getTime())],
    };
    const ids = groupIntoBands(computeSlots(busyMorning)).map((b) => b.band.id);
    expect(ids).not.toContain("early");
    expect(ids).toContain("afternoon");
  });
});

describe("how much clearance a booking needs", () => {
  it("asks for a whole hour, not the raw drive", () => {
    expect(travelBufferMin(10)).toBe(60);
    expect(travelBufferMin(30)).toBe(60);
  });

  it("still gives an hour at 45 minutes of driving, which is the point", () => {
    // Elijah would rather take the job and work a little faster than have
    // the scheduler refuse it for him.
    expect(travelBufferMin(45)).toBe(60);
  });

  it("lets a longer drive set its own buffer", () => {
    expect(travelBufferMin(46)).toBe(61);
    expect(travelBufferMin(90)).toBe(105);
  });

  it("handles nonsense without producing a negative buffer", () => {
    expect(travelBufferMin(0)).toBe(60);
    expect(travelBufferMin(-5)).toBe(60);
  });
});

describe("daylight and end of day limits", () => {
  const day = (h: number, m = 0) => new Date(2026, 8, 14, h, m).getTime();
  const base = (durationMin: number) => ({
    openBlocks: [iv(day(0), new Date(2026, 8, 15, 2).getTime())],
    busy: [],
    serviceDurationMin: durationMin,
    travelBeforeMin: 60,
    travelAfterMin: 60,
    granularityMin: 60,
    notBefore: day(0),
    notAfter: day(23),
    ignoreReturnAfterMin: IGNORE_RETURN_AFTER_MIN,
  });
  const hrs = (l: number[]) => l.map((ms) => new Date(ms).getHours());

  it("offers a 10pm start for a two hour job", () => {
    expect(hrs(computeSlots(base(120)))).toContain(22);
  });

  it("refuses 10pm for anything longer, because it would run past midnight", () => {
    // No separate rule for this: serviceEndByMin already says it.
    expect(hrs(computeSlots(base(150)))).not.toContain(22);
    expect(hrs(computeSlots(base(240)))).not.toContain(22);
  });

  it("stops exterior work at 8pm, because you cannot wash what you cannot see", () => {
    const late = computeSlots({ ...base(120), hasExterior: true });
    expect(hrs(late)).not.toContain(22);
    expect(hrs(late)).not.toContain(21);
    expect(hrs(late)).toContain(20);
  });

  it("leaves interior work alone after dark", () => {
    expect(hrs(computeSlots({ ...base(120), hasExterior: false }))).toContain(22);
  });
});

describe("bookable window, 6am to 8pm ending by midnight", () => {
  const day = (h: number, m = 0) => new Date(2026, 8, 14, h, m).getTime();
  const req = (durationMin: number) => ({
    // Spans past midnight, mirroring DEFAULT_HOURS, so the drive home fits.
    openBlocks: [iv(day(0), new Date(2026, 8, 15, 1).getTime())],
    busy: [],
    serviceDurationMin: durationMin,
    travelBeforeMin: 30,
    travelAfterMin: 30,
    granularityMin: 60,
    notBefore: day(0),
    notAfter: day(23),
  });
  const hrs = (l: number[]) => l.map((ms) => new Date(ms).getHours());

  it("opens at 6am, not earlier", () => {
    expect(Math.min(...hrs(computeSlots(req(120))))).toBe(6);
  });

  it("lets a 4 hour job start as late as 8pm", () => {
    // 8pm + 4h lands exactly on midnight.
    expect(hrs(computeSlots(req(240)))).toContain(20);
  });

  it("caps a 6 hour job at a 6pm start", () => {
    const h = hrs(computeSlots(req(360)));
    expect(h).toContain(18);
    expect(Math.max(...h)).toBe(18); // 8pm would run to 2am
  });

  it("derives the in-between cases from the same midnight rule", () => {
    // A 5 hour job should reach 7pm and no further.
    expect(Math.max(...hrs(computeSlots(req(300))))).toBe(19);
  });

  it("offers up to 10pm for a short job, and no later", () => {
    // The ceiling used to be 8pm for everything. A half hour job at 10pm is
    // done by 10:30, so there was no reason to refuse it.
    expect(Math.max(...hrs(computeSlots(req(30))))).toBe(22);
  });
});

describe("last job of the day", () => {
  const day = (h: number, m = 0) => new Date(2026, 8, 14, h, m).getTime();
  // Closes at midnight, with no room for a drive home afterwards.
  const req = (durationMin: number) => ({
    openBlocks: [iv(day(5), new Date(2026, 8, 15, 0).getTime())],
    busy: [],
    serviceDurationMin: durationMin,
    travelBeforeMin: 30,
    travelAfterMin: 30,
    granularityMin: 60,
    notBefore: day(0),
    notAfter: day(23),
  });
  const hrs = (l: number[]) => l.map((ms) => new Date(ms).getHours());

  it("cannot reach 8pm while the drive home still has to fit", () => {
    expect(hrs(computeSlots(req(240)))).not.toContain(20);
  });

  it("reaches 8pm once the return drive is ignored from 6pm", () => {
    const slots = computeSlots({ ...req(240), ignoreReturnAfterMin: IGNORE_RETURN_AFTER_MIN });
    expect(hrs(slots)).toContain(20);
  });

  it("still bounds the service itself by midnight", () => {
    // 6 hours from 8pm would run to 2am, drive home or not.
    const slots = computeSlots({ ...req(360), ignoreReturnAfterMin: IGNORE_RETURN_AFTER_MIN });
    expect(Math.max(...hrs(slots))).toBe(18);
  });

  it("keeps counting the return drive for daytime bookings", () => {
    const noReturn = computeSlots({ ...req(240), ignoreReturnAfterMin: IGNORE_RETURN_AFTER_MIN });
    // 10am is unaffected either way: the rule only lifts from 6pm.
    expect(hrs(noReturn)).toContain(10);
  });
});

describe("grouping starts into bands", () => {
  it("puts each start in the band that owns that hour", () => {
    const banded = groupIntoBands([at(7), at(11), at(15), at(19)]);
    expect(banded.map((b) => b.band.id)).toEqual(["early", "midday", "afternoon", "evening"]);
  });

  it("marks only the outer two bands as premium", () => {
    expect(TIME_BANDS.filter((b) => b.premium).map((b) => b.id)).toEqual(["early", "evening"]);
  });

  it("is exactly the four bands, at the hours the site advertises", () => {
    expect(
      TIME_BANDS.map((b) => `${b.fromMin / 60}-${b.premium ? "P" : "S"}`),
    ).toEqual(["6-P", "10-S", "14-S", "18-P"]);
    expect(TIME_BANDS.map((b) => b.range)).toEqual([
      "6am to 10am",
      "10am to 2pm",
      "2pm to 6pm",
      "6pm to 10pm",
    ]);
    // The written range and the arithmetic have to be the same hours, or the
    // page advertises one thing and the engine offers another.
    for (const b of TIME_BANDS) {
      // The evening band ends a minute past 10pm so a 10pm start is included.
      const endMin = b.toMin % 60 === 0 ? b.toMin : b.toMin - 1;
      expect(b.range, b.id).toBe(`${clockOf(b.fromMin)} to ${clockOf(endMin)}`);
      expect(b.preferMin, `${b.id} default start`).toBeGreaterThanOrEqual(b.fromMin);
      expect(b.preferMin, `${b.id} default start`).toBeLessThan(b.toMin);
    }
  });

  it("band edges are the surcharge edges, walked quarter hour by quarter hour", () => {
    for (let m = 6 * 60; m <= 22 * 60; m += 15) {
      const band = bandOf(m);
      expect(band, `${m / 60}h has no band`).not.toBeNull();
      const charged = computeSurcharge(
        { startMinutesLocal: m, priorityBooking: false },
        R.surcharge,
      );
      expect(
        band!.premium,
        `${clockOf(m)} sits in the ${band!.label} band but is billed ${charged.appliedBp / 100}%`,
      ).toBe(charged.appliedBp > 0);
    }
  });

  it("the two standard bands run back to back with no premium gap", () => {
    const standard = TIME_BANDS.filter((b) => !b.premium);
    expect(standard.map((b) => b.id)).toEqual(["midday", "afternoon"]);
    expect(standard[0]!.toMin).toBe(standard[1]!.fromMin);
    expect(standard[0]!.fromMin).toBe(R.surcharge.earlyBeforeMinutes);
    expect(standard[1]!.toMin).toBe(R.surcharge.lateFromMinutes);
  });

  it("leaves no gap between bands for a start to fall through", () => {
    for (let m = 6 * 60; m <= 22 * 60; m += 15) {
      expect(bandOf(m), `${m / 60}h`).not.toBeNull();
    }
  });
});
