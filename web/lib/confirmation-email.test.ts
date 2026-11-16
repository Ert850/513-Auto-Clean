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
    expect(text(email(3).html)).toContain(`between ${ARRIVAL_WINDOW_MIN === 60 ? "10am and 11am" : ""}`);
    expect(text(email(3, { arrivalWindowMin: 30 }).html)).toContain("between 10am and 10:30am");
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

describe("validation pass 4 (November 16)", () => {
  // @ts-expect-error: plain ESM Netlify function, no types
  const load = () => import("../../netlify/functions/send-confirmation.mjs");
  const cart: WireCart = {
    vehicles: [{ sizeId: "small", packageIds: ["basic-interior"], addons: [] }],
    zip: "45220",
    address: { line1: "1 Main St", city: "Cincinnati", region: "OH", zip: "45220" },
    slot: SLOT, kind: "advice", payInFull: false,
  };
  const priced = priceFromWire(cart, { nowMs: NOW });

  it("Help me decide holds at least the advice block, even with a package on it (an older tab)", async () => {
    const { bookingEvents, stillFreeJob } = await load();
    const { ADVICE_HOLD_MIN } = await import("./server-entry.js");
    expect(priced.serviceDurationMin).toBeLessThan(ADVICE_HOLD_MIN);
    const [ev] = bookingEvents({ contact: { name: "Ada" }, cart, priced, extras: {}, payInFull: false, kind: "advice", detailer: null, nowMs: NOW, measuredMin: null });
    expect((ev.endMs - ev.startMs) / 60_000).toBeGreaterThanOrEqual(ADVICE_HOLD_MIN);
    expect(stillFreeJob({ cart, priced, kind: "advice", measuredMin: null }).serviceMin).toBe(ADVICE_HOLD_MIN);
    // A booking keeps its own length.
    expect(stillFreeJob({ cart, priced, kind: "booking", measuredMin: null }).serviceMin).toBe(priced.serviceDurationMin);
  });

  it("tells Elijah when a vehicle with nothing chosen was left out, in the subject and the body", async () => {
    const { ownerEmail } = await load();
    const base = { contact: { name: "Ada", phone: "+15135551212", email: "a@example.com" }, when: "Sunday", priced, kind: "booking", cart: { ...cart, kind: "booking" }, detailer: null, asked: "", notes: "" };
    const flagged = ownerEmail({ ...base, dropped: [2] });
    expect(flagged.subject).toMatch(/^CHECK THE PRICE, /);
    expect(text(flagged.html)).toMatch(/vehicle 2 had nothing chosen, so it was left out/);
    const plain = ownerEmail(base);
    expect(plain.subject).not.toMatch(/CHECK THE PRICE/);
    expect(text(plain.html)).not.toMatch(/left out/);
  });
});
