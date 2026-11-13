/** The customer's "booked in" email, in Elijah's layout (November 13). */
import { describe, expect, it } from "vitest";
// @ts-expect-error: plain ESM Netlify function, no types
import { customerEmail, durationText } from "../../netlify/functions/send-confirmation.mjs";
import { priceFromWire, ARRIVAL_WINDOW_MIN, type WireCart } from "./server-entry.js";

const NOW = Date.now();
// Sunday 10:00 AM Cincinnati, at least a week out, so it is not short notice.
const d = new Date(NOW + 8 * 86_400_000);
const SLOT = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 15, 0);

function email(measured: number | null, detailer: unknown = null) {
  const cart: WireCart = {
    vehicles: [{ sizeId: "small", packageIds: ["basic-interior"], addons: [] }],
    zip: "45040",
    address: { line1: "1 Main St", city: "Mason", region: "OH", zip: "45040" },
    slot: SLOT, kind: "booking", payInFull: false,
  };
  const priced = priceFromWire(cart, { nowMs: NOW, ...(measured === null ? {} : { measuredOneWayMinutes: measured }) });
  process.env.LIVE_CALENDAR = process.env.LIVE_CALENDAR ?? "";
  return { priced, html: customerEmail({ contact: { name: "Elijah Thacker" }, when: "Sunday", priced, kind: "booking", slot: SLOT, cart, detailer, measured, textsOk: true }).html as string };
}
const text = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("the booking email", () => {
  it("shows travel as its own row with the exact price, and in the total", () => {
    const { html, priced } = email(40);
    const travel = priced.lines.find((l) => /travel/i.test(l.label));
    expect(travel && travel.amountCents).toBeGreaterThan(0);
    expect(text(html)).toMatch(/Travel \$\d+(\.\d\d)? /);
    expect(text(html)).not.toMatch(/added when we confirm/);
  });
  it("shows a drive inside the free minutes as Free, not as 'added later'", () => {
    const { html } = email(3);
    expect(text(html)).toMatch(/Travel Free Sales tax/);
    expect(text(html)).not.toMatch(/added when we confirm/);
  });
  it("gives the duration and the arrival window from the detailer's setting", () => {
    expect(text(email(3).html)).toMatch(/Duration About \d+(\.5)? hours?/);
    expect(text(email(3).html)).toContain(`between ${ARRIVAL_WINDOW_MIN === 60 ? "10 AM and 11 AM" : ""}`);
    expect(text(email(3, { arrivalWindowMin: 30 }).html)).toContain("between 10 AM and 10:30 AM");
  });
  it("has no dashes a customer would read as an em-dash", () => {
    expect(email(3).html).not.toMatch(/—| - /);
  });
  it("rounds the duration to the half hour", () => {
    expect(durationText(120)).toBe("About 2 hours");
    expect(durationText(255)).toBe("About 4.5 hours");
    expect(durationText(900, 2)).toBe("About 15 hours, over 2 days");
  });
});
