import { describe, expect, it } from "vitest";
import { assignStarts, canDo, OWNER, parseDetailers } from "./crew.js";

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
    expect(canDo(kris, { interior: true, exterior: false })).toBe(true);
    expect(canDo(kris, { interior: true, exterior: true })).toBe(false);
    expect(canDo(OWNER, { interior: true, exterior: true })).toBe(true);
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
