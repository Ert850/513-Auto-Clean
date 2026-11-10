import { describe, expect, it } from "vitest";
import { assignStarts, canDo, OWNER, parseDetailers, waivesTimeFee } from "./crew.js";

const KRIS = {
  name: "Kris",
  does: "interior",
  availability: "kris-open@group.calendar.google.com",
  bookings: "kris-jobs@group.calendar.google.com",
};

describe("parseDetailers", () => {
  it("is just the owner when nothing is set, so today's site is unchanged", () => {
    expect(parseDetailers("").crew).toEqual([OWNER]);
    expect(parseDetailers(undefined).problems).toEqual([]);
  });

  it("books in list order, owner last unless placed", () => {
    expect(parseDetailers(JSON.stringify([KRIS])).crew.map((d) => d.id)).toEqual(["kris", "owner"]);
    expect(parseDetailers(JSON.stringify([{ name: "Elijah", owner: true }, KRIS])).crew.map((d) => d.id))
      .toEqual(["owner", "kris"]);
  });

  it("reads both of a detailer's calendars and what work they do", () => {
    const kris = parseDetailers(JSON.stringify([KRIS])).crew[0]!;
    expect(kris.availabilityCalendarId).toBe(KRIS.availability);
    expect(kris.bookingsCalendarId).toBe(KRIS.bookings);
    expect(canDo(kris, ["interior"])).toBe(true);
    expect(canDo(kris, ["interior", "exterior"])).toBe(false);
    expect(canDo(OWNER, ["interior", "exterior", "correction", "coating"])).toBe(true);
  });

  it("drops a bad entry and says why, never the whole list", () => {
    const { crew, problems } = parseDetailers(JSON.stringify([{ name: "Sam", availability: "nope" }, KRIS, KRIS]));
    expect(crew.map((d) => d.id)).toEqual(["kris", "owner"]);
    expect(problems).toHaveLength(2);
    expect(parseDetailers("{not json").problems[0]).toMatch(/not valid JSON/);
    expect(parseDetailers("{not json").crew).toEqual([OWNER]);
  });
});

describe("assignStarts", () => {
  it("gives every start to the first detailer free for it, and lets them overlap", () => {
    const { starts, who } = assignStarts([
      { id: "kris", starts: [10, 30] },
      { id: "owner", starts: [10, 20] },
    ]);
    expect(starts).toEqual([10, 20, 30]);
    expect(who.get(10)).toBe("kris");
    expect(who.get(20)).toBe("owner");
  });
});

describe("noFeeStarts (Kris at 6 to 7pm)", () => {
  const kris = parseDetailers(JSON.stringify([{ ...KRIS, noFeeStarts: "18:00-19:00" }])).crew[0]!;

  it("waives the early or late fee for starts inside the range, inclusive", () => {
    expect(waivesTimeFee(kris, 18 * 60)).toBe(true);
    expect(waivesTimeFee(kris, 18 * 60 + 30)).toBe(true);
    expect(waivesTimeFee(kris, 19 * 60)).toBe(true);
    expect(waivesTimeFee(kris, 19 * 60 + 30)).toBe(false);
    expect(waivesTimeFee(OWNER, 18 * 60)).toBe(false);
  });

  it("flags a range it cannot read, and keeps the detailer", () => {
    const { crew, problems } = parseDetailers(JSON.stringify([{ ...KRIS, noFeeStarts: "6pm-7pm" }]));
    expect(crew[0]!.noFeeStarts).toBeNull();
    expect(problems[0]).toMatch(/noFeeStarts/);
  });

  it("can be limited to days, and listed (Kris waives 6 to 7pm on Tuesday to Saturday only)", () => {
    const k = parseDetailers(JSON.stringify([{ ...KRIS, noFeeStarts: "Tue-Sat 18:00-19:00" }])).crew[0]!;
    expect(waivesTimeFee(k, 18 * 60, 2), "Tuesday 6pm").toBe(true);
    expect(waivesTimeFee(k, 18 * 60, 6), "Saturday 6pm").toBe(true);
    expect(waivesTimeFee(k, 18 * 60, 0), "Sunday 6pm keeps its late fee").toBe(false);
    expect(waivesTimeFee(k, 18 * 60, 1), "Monday 6pm too").toBe(false);
    const two = parseDetailers(JSON.stringify([{ ...KRIS, noFeeStarts: "Sun,Mon 08:00-09:30; Tue-Sat 18:00-19:00" }])).crew[0]!;
    expect(waivesTimeFee(two, 8 * 60, 0)).toBe(true);
    expect(waivesTimeFee(two, 8 * 60, 3)).toBe(false);
    expect(waivesTimeFee(two, 19 * 60, 4)).toBe(true);
    const wrap = parseDetailers(JSON.stringify([{ ...KRIS, noFeeStarts: "Sat-Mon 18:00-19:00" }])).crew[0]!;
    expect([0, 1, 2, 3, 4, 5, 6].filter((d) => waivesTimeFee(wrap, 18 * 60, d))).toEqual([0, 1, 6]);
    const bad = parseDetailers(JSON.stringify([{ ...KRIS, noFeeStarts: "Tues-Funday 18:00-19:00" }]));
    expect(bad.crew[0]!.noFeeStarts).toBeNull();
    expect(bad.problems[0]).toMatch(/noFeeStarts/);
  });

  it("rejects day lists and times it would otherwise misread (engine check, November 10)", () => {
    for (const x of ["Sun Mon 18:00-19:00", "Mon Tue Wed 18:00-19:00", "Mon to Fri 18:00-19:00",
      "Tue-Sat-Sun 18:00-19:00", "18:00-18:99", "18:60-19:00", "Tu 18:00-19:00"]) {
      const r = parseDetailers(JSON.stringify([{ ...KRIS, noFeeStarts: x }]));
      expect(r.crew[0]!.noFeeStarts, x).toBeNull();
      expect(r.problems[0], x).toMatch(/noFeeStarts/);
    }
    const long = parseDetailers(JSON.stringify([{ ...KRIS, noFeeStarts: "Tuesday-Saturday 18:00-19:00; Tues 08:00-09:00" }]));
    expect(long.problems).toEqual([]);
    expect(waivesTimeFee(long.crew[0]!, 18 * 60, 6)).toBe(true);
    expect(waivesTimeFee(long.crew[0]!, 8 * 60, 2)).toBe(true);
  });
});

describe("does: any skills, as a word or a list", () => {
  it("reads one word, a list, or all", () => {
    const [a, b, c] = parseDetailers(JSON.stringify([
      { ...KRIS, name: "A", does: "Interior" },
      { ...KRIS, name: "B", does: ["interior", "correction"] },
      { name: "C", availability: KRIS.availability, bookings: KRIS.bookings },
    ])).crew;
    expect(a!.does).toEqual(["interior"]);
    expect(canDo(b!, ["interior", "correction"])).toBe(true);
    expect(canDo(b!, ["exterior"])).toBe(false);
    expect(canDo(c!, ["coating"]), "no 'does' means everything").toBe(true);
  });

  it("takes a new kind of work without code changes", () => {
    const [d] = parseDetailers(JSON.stringify([{ ...KRIS, does: ["interior", "boats"] }])).crew;
    expect(canDo(d!, ["boats"])).toBe(true);
  });
});
