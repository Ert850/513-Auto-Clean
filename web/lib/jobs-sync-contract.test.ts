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
// @ts-expect-error: plain ESM Netlify function, no types
import { eventDescription, eventTitle } from "../../netlify/functions/send-confirmation.mjs";
import { priceFromWire, type WireCart } from "./server-entry.js";

/* ---- From JobsSync.gs (findMoney, findBlock, findZip, the detailer match) ---- */
const TOTAL = /TOTAL:\s*\$([\d,]+(?:\.\d\d)?)/i;
const TAX = /Sales tax[^:\n]*:\s*\$([\d,]+(?:\.\d\d)?)/i;
const block = (desc: string, heading: string) =>
  (String(desc).match(new RegExp("(?:^|\\n)" + heading + "\\n\\s+([^\\n]+)")) || [])[1]?.trim() ?? "";
const findZip = (s: string) => {
  const m = String(s).match(/\b(4[0-5]\d{3})(?:-\d{4})?\b/g);
  return m ? m[m.length - 1]!.slice(0, 5) : "";
};
const DETAILER = /^(?:SHORT NOTICE[^:]*:\s*)?([A-Z][a-z]+):/;
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
