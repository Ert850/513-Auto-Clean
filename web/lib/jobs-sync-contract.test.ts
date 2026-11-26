/**
 * Elijah's Accounting sheet reads every booking event (JobsSync.gs, an Apps
 * Script he installed November 11, 2026): one row per job in "Jobs (auto)",
 * and revenue by area in "Jobs by Area". He asked for the event format to
 * stay as it is, or to be told when it changes.
 *
 * The patterns below are copied from his script. If this test fails, the
 * sheet will mis-read new bookings: change the format only together with
 * him, and update these patterns to match his new script.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
// @ts-expect-error: plain ESM Netlify function, no types
import { bookingEvents, eventDescription, eventTitle } from "../../netlify/functions/send-confirmation.mjs";
import { priceFromWire, type WireCart } from "./server-entry.js";
import { JOBS_SYNC_DETAILER, JOBS_SYNC_OFFICE, JOBS_SYNC_SKIP_TITLE, isJob, notAJob, titleDetailer } from "./availability/masterCalendar.js";

/* ---- From JobsSync.gs (findMoney, findBlock, findZip, the detailer match) ---- */
const TOTAL = /TOTAL:\s*\$([\d,]+(?:\.\d\d)?)/i;
const TAX = /Sales tax[^:\n]*:\s*\$([\d,]+(?:\.\d\d)?)/i;
const block = (desc: string, heading: string) =>
  (String(desc).match(new RegExp("(?:^|\\n)" + heading + "\\n\\s+([^\\n]+)")) || [])[1]?.trim() ?? "";
const findZip = (s: string) => {
  const m = String(s).match(/\b(4[0-7]\d{3})(?:-\d{4})?\b/g);
  return m ? m[m.length - 1]!.slice(0, 5) : "";
};
const DETAILER = /^(?:SHORT NOTICE[^:]*:\s*)?([A-Z][a-z]+):/;
// tools/jobs-sync/JobsSync.gs: day 2 and on of a multi-day job, skipped.
const CONTINUATION_DAY = /^(?:SHORT NOTICE[^:]*:\s*)?(?:[A-Z][a-z]+:\s*)?Day \d+ of \d+\b/;
const num = (s: string) => Number(String(s).replace(/[$,]/g, ""));

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 11, 17, 0);

function booking() {
  const cart: WireCart = {
    vehicles: [{ sizeId: "small", packageIds: ["full-interior"], addons: [{ addonId: "steam", tierId: "std" }] }],
    zip: "45040",
    address: { line1: "5555 Tylersville Rd", city: "Mason", region: "OH", zip: "45040" },
    slot: NOW + 5 * DAY,
    kind: "booking",
    payInFull: false,
  };
  const priced = priceFromWire(cart, { nowMs: NOW });
  const desc: string = eventDescription({
    contact: { name: "Test Customer", phone: "5135550100", email: "test@example.com" },
    cart, priced, payInFull: false, kind: "booking",
    extras: { source: "golf / print / qr", heard: "Golf booklet" },
  });
  return { cart, priced, desc };
}

describe("the booking calendar event, as JobsSync reads it", () => {
  it("has the TOTAL and the sales tax, so the sheet gets the total and pre-tax", () => {
    const { priced, desc } = booking();
    const total = desc.match(TOTAL);
    const tax = desc.match(TAX);
    expect(total, "TOTAL: $x").not.toBeNull();
    expect(num(total![1]!)).toBeCloseTo(priced.totalCents / 100, 2);
    expect(tax, "Sales tax…: $x").not.toBeNull();
    expect(num(tax![1]!)).toBeGreaterThan(0);
  });

  it("has the SOURCE and HEARD ABOUT US blocks", () => {
    const { desc } = booking();
    expect(block(desc, "SOURCE")).toBe("golf / print / qr");
    expect(block(desc, "HEARD ABOUT US")).toBe("Golf booklet");
  });

  it("reads a Southeast Indiana ZIP (47xxx), which the site serves", () => {
    expect(findZip("1 Main St, Lawrenceburg, IN, 47025")).toBe("47025");
  });

  it("keeps the ZIP as the last ZIP in the location", () => {
    const { cart } = booking();
    const location = [cart.address?.line1, cart.address?.city, cart.address?.region, cart.address?.zip].filter(Boolean).join(", ");
    expect(findZip(location)).toBe("45040");
  });

  it("starts the title with the detailer's name, after any SHORT NOTICE prefix", () => {
    const names = ["Full Interior"];
    const kris = { name: "Kris" };
    expect(eventTitle({ kind: "booking", slotMs: NOW + 5 * DAY, nowMs: NOW, detailer: kris, names, contactName: "A B" }).match(DETAILER)?.[1]).toBe("Kris");
    expect(eventTitle({ kind: "booking", slotMs: NOW + 3_600_000, nowMs: NOW, detailer: kris, names, contactName: "A B" }).match(DETAILER)?.[1]).toBe("Kris");
    // The owner's own jobs carry no name: JobsSync shows them with a blank detailer.
    expect(eventTitle({ kind: "booking", slotMs: NOW + 5 * DAY, nowMs: NOW, detailer: null, names, contactName: "A B" }).match(DETAILER)).toBeNull();
  });
});

describe("a job longer than one day, as JobsSync reads it (November 13)", () => {
  function multi(detailer: { name: string } | null) {
    const { cart, priced } = booking();
    return bookingEvents({
      contact: { name: "Test Customer", phone: "5135550100", email: "" },
      cart, priced: { ...priced, serviceDurationMin: 1200 }, payInFull: false, kind: "booking", detailer,
      extras: { source: "golf / print / qr", heard: "Golf booklet" }, nowMs: NOW, measuredMin: 30,
    }) as { summary: string; description: string }[];
  }

  it("day 1 is counted (TOTAL, detailer) and days 2+ are skipped (no TOTAL, Day N of M)", () => {
    for (const d of [{ name: "Kris" }, null]) {
      const [day1, day2] = multi(d);
      expect(CONTINUATION_DAY.test(day1!.summary), day1!.summary).toBe(false);
      expect(day1!.description).toMatch(TOTAL);
      expect(block(day1!.description, "SOURCE")).toBe("golf / print / qr");
      expect(CONTINUATION_DAY.test(day2!.summary), day2!.summary).toBe(true);
      expect(day2!.description).not.toMatch(TOTAL);
      expect(day2!.summary.match(DETAILER)?.[1] ?? null).toBe(d ? "Kris" : null);
    }
  });

  it("JobsSync.gs carries the same pattern", () => {
    const gs = fs.readFileSync(path.join(__dirname, "../../tools/jobs-sync/JobsSync.gs"), "utf8");
    expect(gs).toContain(CONTINUATION_DAY.source);
  });
});


describe("what counts as a job: 513 All Jobs copies exactly what JobsSync counts (November 26)", () => {
  const gs = fs.readFileSync(path.join(__dirname, "../../tools/jobs-sync/JobsSync.gs"), "utf8");
  /** A regular expression literal from JobsSync.gs, as written there. */
  const literal = (pattern: RegExp): RegExp => {
    const m = pattern.exec(gs);
    expect(m, String(pattern)).not.toBeNull();
    const src = m![1]!;
    const end = src.lastIndexOf("/");
    return new RegExp(src.slice(1, end), src.slice(end + 1));
  };

  it("uses JobsSync's own skipTitle, officeMatch and DETAILER patterns", () => {
    const same = (a: RegExp, b: RegExp) => { expect(a.source).toBe(b.source); expect(a.flags).toBe(b.flags); };
    same(JOBS_SYNC_SKIP_TITLE, literal(/skipTitle:\s*(\/.+?\/[a-z]*),/));
    same(JOBS_SYNC_OFFICE, literal(/officeMatch:\s*(\/.+?\/[a-z]*),/));
    same(JOBS_SYNC_DETAILER, literal(/const DETAILER = (\/.+\/[a-z]*);/));
  });

  it("skips what jobRow skips, in its order: deleted, Free, a skipped title, the office, all day with no $ amount", () => {
    // jobRow's own lines, so a new rule there fails here until notAJob has it too.
    const row = gs.slice(gs.indexOf("function jobRow("), gs.indexOf("const start = eventTime(ev.start);"));
    const rules = [...row.matchAll(/^\s*if \((.+?)\) return null;/gm)].map((m) => m[1]);
    expect(rules).toEqual([
      "ev.status === 'cancelled'",
      "ev.transparency === 'transparent'",
      "CONFIG.skipTitle.test(title.trim())",
      "CONTINUATION_DAY.test(title.trim())",
      "CONFIG.officeMatch.test(loc) || CONFIG.officeMatch.test(desc)",
      "allDay && !/\\$\\d/.test(title + desc)",
    ]);
    const at = { start: { dateTime: "2026-12-01T13:00:00-05:00" } };
    const day = { start: { date: "2026-12-01" } };
    expect(notAJob({ ...at, summary: "Full Interior, Ada", status: "cancelled" })).toBe("deleted");
    expect(notAJob({ ...at, summary: "Full Interior, Ada", transparency: "transparent" })).toBe("free");
    for (const t of ["OPEN", "OPEN +20%", "best", "DNS dentist", "Busy", "Blocked", "Unavailable", "Availability", "Hold", "personal"]) {
      expect(notAJob({ ...at, summary: t }), t).toBe("title");
    }
    expect(notAJob({ ...at, summary: "Pick up", location: "505 Sandheger Ct" })).toBe("office");
    expect(notAJob({ ...at, summary: "Errand", description: "at 505  Sandheger" })).toBe("office");
    expect(notAJob({ ...day, summary: "Vacation" })).toBe("all-day");
    expect(notAJob({ ...day, summary: "Fleet wash, $400" })).toBe("");
    // Counted by JobsSync once (day 1); copied every day, like the originals.
    expect(notAJob({ ...at, summary: "Kris: Day 2 of 2, Paint Correction, Ada" })).toBe("");
    expect(notAJob({ ...at, summary: "Openshaw: Full Interior" })).toBe("");
    expect(isJob({ ...at, summary: "Kris: Full Interior, Ada" })).toBe(true);
  });

  it("names the detailer as JobsSync does: a name in the title first, else the calendar's", () => {
    expect(titleDetailer("Kris: Full Interior, Ada", "Elijah")).toBe("Kris");
    expect(titleDetailer("SHORT NOTICE, accept or decline: Kris: Full Interior, Ada", "Elijah")).toBe("Kris");
    expect(titleDetailer("Full Interior, Ada", "Elijah")).toBe("Elijah");
    // JobsSync.gs: (title.match(DETAILER) || [])[1] || cal.detailer
    expect(gs).toContain("(title.match(DETAILER) || [])[1] || cal.detailer");
  });
});
