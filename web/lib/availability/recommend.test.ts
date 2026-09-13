/**
 * Two decisions that shape every day Elijah works.
 *
 * WHICH START TO RECOMMEND. A customer picking freely from forty half hours
 * picks the one that suits them and leaves the day in pieces: a 1pm start
 * makes both 10am and 4pm impossible, so one booking costs two. Two good
 * starts up front, everything else one tap away.
 *
 * WHETHER THE DRIVE OUT EATS THE FIRST HOUR. An OPEN block from 6am was not
 * offering 6am, because the hour of drive time had to fit inside it. Nobody
 * is waiting on that drive: he leaves home earlier and arrives at six.
 */
import { describe, expect, it } from "vitest";
import {
  DAY_ANCHORS_MIN,
  IGNORE_OUTBOUND_BEFORE_MIN,
  computeSlots,
  localMinutesOfDay,
  recommendStarts,
} from "./slots.js";

const MIN = 60_000;
const HOUR = 60 * MIN;

/** A Monday, 6am local, so weekday anchors apply. */
function monday6am(): number {
  const d = new Date(2026, 8, 14, 6, 0, 0, 0);
  return d.getTime();
}
/** A Saturday, 6am local. */
function saturday6am(): number {
  const d = new Date(2026, 8, 19, 6, 0, 0, 0);
  return d.getTime();
}

const hhmm = (ms: number) => localMinutesOfDay(ms);
const at = (base: number, hours: number) => base + hours * HOUR;

function day(base: number, opts: Partial<Parameters<typeof computeSlots>[0]> = {}) {
  return computeSlots({
    openBlocks: [{ start: base, end: base + 18 * HOUR }],
    busy: [],
    serviceDurationMin: 150,
    travelBeforeMin: 60,
    travelAfterMin: 60,
    granularityMin: 30,
    notBefore: base - HOUR,
    notAfter: base + 20 * HOUR,
    hasExterior: false,
    ...opts,
  });
}

describe("the first hour of the day is bookable", () => {
  it("does not offer 6am while the drive out has to fit inside the day", () => {
    const starts = day(monday6am());
    expect(hhmm(starts[0]!), "7am, an hour of drive eaten out of the morning").toBe(7 * 60);
  });

  it("offers 6am and 6:30 once the drive out is allowed to happen first", () => {
    const starts = day(monday6am(), { ignoreOutboundBeforeMin: IGNORE_OUTBOUND_BEFORE_MIN });
    expect(starts.map(hhmm).slice(0, 3)).toEqual([6 * 60, 6 * 60 + 30, 7 * 60]);
  });

  it("still makes the drive fit into a gap that opens mid morning", () => {
    // A job from 9 to 11:30 means the next free interval BEGINS at 11:30.
    // That is not the start of the day, so the drive to it is real and has to
    // fit: without this, two jobs could be booked with no time to drive
    // between them.
    const base = monday6am();
    const starts = day(base, {
      busy: [{ start: at(base, 3), end: at(base, 5.5) }],
      ignoreOutboundBeforeMin: IGNORE_OUTBOUND_BEFORE_MIN,
    });
    expect(hhmm(starts[0]!), "11:30 plus an hour to get there").toBe(12 * 60 + 30);
  });
});

describe("which starts get recommended", () => {
  const gap = 60;

  it("puts the day's anchors first on a weekday", () => {
    const base = monday6am();
    const starts = day(base, { ignoreOutboundBeforeMin: IGNORE_OUTBOUND_BEFORE_MIN });
    const recs = recommendStarts({ starts, travelGapMin: gap });
    expect(recs.map((r) => hhmm(r.ms))).toEqual([...DAY_ANCHORS_MIN.weekday]);
    expect(recs[0]!.why).toBe("Our usual start time");
  });

  it("uses the weekend anchors on a weekend", () => {
    const base = saturday6am();
    const starts = day(base, { ignoreOutboundBeforeMin: IGNORE_OUTBOUND_BEFORE_MIN });
    const recs = recommendStarts({ starts, travelGapMin: gap, limit: 3 });
    expect(recs.map((r) => hhmm(r.ms))).toEqual([...DAY_ANCHORS_MIN.weekend]);
  });

  it("prefers the slot straight after an existing job, which is what condenses a day", () => {
    // Booked 10am to 2pm. The next start that wastes nothing is 3pm: two
    // o'clock finish plus an hour to drive.
    const base = monday6am();
    const busy = [{ start: at(base, 4), end: at(base, 8) }];
    const starts = day(base, { busy, ignoreOutboundBeforeMin: IGNORE_OUTBOUND_BEFORE_MIN });
    const recs = recommendStarts({ starts, busy, travelGapMin: gap });

    const three = recs.find((r) => hhmm(r.ms) === 15 * 60);
    expect(three, "3pm should be recommended, it is the one that wastes nothing").toBeTruthy();
    expect(three!.why).toBe("Fits neatly into this day");
  });

  it("never recommends a premium hour while a standard one exists", () => {
    // Early mornings and late evenings carry 20%. They stay bookable, one tap
    // away. Putting one at the top of the screen as OUR recommendation is
    // steering a customer into a surcharge to suit our day.
    const base = monday6am();
    const starts = day(base, { ignoreOutboundBeforeMin: IGNORE_OUTBOUND_BEFORE_MIN });
    const recs = recommendStarts({ starts, travelGapMin: gap, limit: 4 });
    for (const r of recs) {
      const m = hhmm(r.ms);
      expect(m >= 10 * 60 && m < 18 * 60, `${m} minutes past midnight is a premium hour`).toBe(true);
    }
  });

  it("falls back to a premium hour when that is genuinely all there is", () => {
    const base = monday6am();
    // Everything booked except the late evening.
    const busy = [{ start: base, end: at(base, 12) }];
    const starts = day(base, { busy, ignoreOutboundBeforeMin: IGNORE_OUTBOUND_BEFORE_MIN });
    const recs = recommendStarts({ starts, busy, travelGapMin: gap });
    expect(starts.length, "there should still be evening slots").toBeGreaterThan(0);
    expect(recs.length, "something has to be offered").toBeGreaterThan(0);
  });

  it("recommends nothing when there is nothing", () => {
    expect(recommendStarts({ starts: [], travelGapMin: gap })).toEqual([]);
  });

  it("only ever recommends a time that is actually bookable", () => {
    const base = monday6am();
    const busy = [{ start: at(base, 4), end: at(base, 8) }];
    const starts = day(base, { busy, ignoreOutboundBeforeMin: IGNORE_OUTBOUND_BEFORE_MIN });
    const recs = recommendStarts({ starts, busy, travelGapMin: gap, limit: 3 });
    for (const r of recs) expect(starts).toContain(r.ms);
  });
});
