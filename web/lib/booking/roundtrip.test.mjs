import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { measureRoundTrip, addressLine } from "../../../netlify/functions/_routes.mjs";

/**
 * The travel fee is built on an AVERAGE of two measured legs, and getting
 * either leg's time of day wrong changes what a customer pays. These stub the
 * Routes API and assert on the requests actually sent, because that is where
 * the mistake would live: a return leg measured at the start of the job, or
 * an outbound leg that never iterated to a real departure time.
 */

const BASE = "505 Somewhere, Cincinnati, OH";
const DEST = "5385 Haft Rd, Cincinnati, OH 45247";

/** Whatever the caller asks for, in the order given. Records every request. */
function stubRoutes(durations) {
  const calls = [];
  let i = 0;
  global.fetch = vi.fn(async (_url, init) => {
    const body = JSON.parse(init.body);
    calls.push(body);
    const mins = durations[Math.min(i++, durations.length - 1)];
    return {
      ok: true,
      json: async () => ({ routes: [{ duration: `${mins * 60}s`, distanceMeters: mins * 1000 }] }),
    };
  });
  return calls;
}

const isBase = (node) => node?.address === BASE;

beforeEach(() => {
  process.env.GOOGLE_MAPS_SERVER_KEY = "test-key";
  process.env.SHOP_ORIGIN_ADDRESS = BASE;
  delete process.env.SHOP_ORIGIN_PLACE_ID;
});

afterEach(() => {
  delete process.env.GOOGLE_MAPS_SERVER_KEY;
  delete process.env.SHOP_ORIGIN_ADDRESS;
  vi.restoreAllMocks();
});

describe("round trip measurement", () => {
  it("returns null when there is no key, so callers can fall back", async () => {
    delete process.env.GOOGLE_MAPS_SERVER_KEY;
    expect(await measureRoundTrip({ dest: { address: DEST }, slotMs: null })).toBeNull();
  });

  it("makes ONE call and uses it for both legs when no slot is chosen", async () => {
    const calls = stubRoutes([18]);
    const r = await measureRoundTrip({ dest: { address: `${DEST} A` }, slotMs: null, serviceMin: 240 });

    expect(calls).toHaveLength(1);
    expect(r.minutes).toBe(18);
    expect(r.outboundMin).toBe(18);
    expect(r.returnMin).toBe(18);
    // No time to measure against means no departureTime to send.
    expect(calls[0].departureTime).toBeUndefined();
  });

  it("averages the two legs rather than trusting either one", async () => {
    // Rough 12 (no iteration under 20), then the drive home at 40.
    const calls = stubRoutes([12, 40]);
    const slot = Date.now() + 3 * 86400000;
    const r = await measureRoundTrip({ dest: { address: `${DEST} B` }, slotMs: slot, serviceMin: 240 });

    expect(calls).toHaveLength(2);
    expect(r.outboundMin).toBe(12);
    expect(r.returnMin).toBe(40);
    expect(r.minutes).toBe(26); // (12 + 40) / 2
  });

  it("measures the drive home FROM the customer, at the time the job ends", async () => {
    const calls = stubRoutes([12, 30]);
    const slot = Date.now() + 3 * 86400000;
    const serviceMin = 240;
    await measureRoundTrip({ dest: { address: `${DEST} C` }, slotMs: slot, serviceMin });

    const home = calls[1];
    // Reversed: the customer is the origin and we are the destination.
    expect(isBase(home.destination)).toBe(true);
    expect(isBase(home.origin)).toBe(false);
    // Departing when the work finishes, not when it starts.
    expect(Date.parse(home.departureTime)).toBe(slot + serviceMin * 60_000);
  });

  it("iterates the outbound leg so it ARRIVES at the slot", async () => {
    // 60 minutes is well past the 20 minute threshold, so it re-measures
    // departing an hour earlier, which is a different traffic picture.
    const calls = stubRoutes([60, 55, 45]);
    const slot = Date.now() + 3 * 86400000;
    const r = await measureRoundTrip({ dest: { address: `${DEST} D` }, slotMs: slot, serviceMin: 120 });

    expect(calls).toHaveLength(3);
    expect(Date.parse(calls[0].departureTime)).toBe(slot);
    expect(Date.parse(calls[1].departureTime)).toBe(slot - 60 * 60_000);
    expect(r.outboundMin).toBe(55); // the second, better measurement
    expect(r.returnMin).toBe(45);
    expect(r.minutes).toBe(50);
  });

  it("does not spend a third call on a short drive", async () => {
    const calls = stubRoutes([15, 21]);
    const slot = Date.now() + 3 * 86400000;
    await measureRoundTrip({ dest: { address: `${DEST} E` }, slotMs: slot, serviceMin: 60 });
    expect(calls).toHaveLength(2);
  });

  it("ignores a slot in the past rather than sending a rejected departure", async () => {
    const calls = stubRoutes([20]);
    await measureRoundTrip({ dest: { address: `${DEST} F` }, slotMs: Date.now() - 86400000, serviceMin: 60 });
    expect(calls).toHaveLength(1);
    expect(calls[0].departureTime).toBeUndefined();
  });

  it("falls back to the outbound figure when the drive home cannot be routed", async () => {
    let i = 0;
    global.fetch = vi.fn(async () => {
      i++;
      if (i === 2) return { ok: true, json: async () => ({ routes: [] }) };
      return { ok: true, json: async () => ({ routes: [{ duration: "900s" }] }) };
    });
    const r = await measureRoundTrip({
      dest: { address: `${DEST} G` },
      slotMs: Date.now() + 3 * 86400000,
      serviceMin: 120,
    });
    expect(r.outboundMin).toBe(15);
    expect(r.returnMin).toBe(15);
    expect(r.minutes).toBe(15);
  });

  it("reports unreachable rather than inventing a number", async () => {
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ routes: [] }) }));
    const r = await measureRoundTrip({ dest: { address: `${DEST} H` }, slotMs: null });
    expect(r.reachable).toBe(false);
  });
});

describe("addressLine", () => {
  it("joins what is there and skips what is not", () => {
    expect(addressLine({ line1: "5385 Haft Rd", city: "Cincinnati", region: "OH", zip: "45247" }))
      .toBe("5385 Haft Rd, Cincinnati, OH, 45247");
    expect(addressLine({ line1: "5385 Haft Rd", city: "", region: "OH", zip: "45247" }))
      .toBe("5385 Haft Rd, OH, 45247");
    expect(addressLine(null)).toBe("");
  });
});
