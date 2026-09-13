/**
 * Writing a booking onto the calendar.
 *
 * The signing and the network are Google's problem. What is ours, and what
 * this covers, is the handful of decisions that would be silently wrong:
 * whether we think we are configured, and whether a job can accidentally be
 * written as an availability block.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// A plain import: every env read in this module happens inside a function, at
// call time, so there is nothing to bust a module cache for.
// @ts-expect-error untyped .mjs function module
import * as gcal from "../../netlify/functions/_gcal.mjs";

const load = async () =>
  gcal as unknown as {
    gcalConfigured: () => boolean;
    createBookingEvent: (e: Record<string, unknown>) => Promise<{ ok: boolean; reason?: string }>;
    TIME_ZONE: string;
  };

const KEYS = ["GOOGLE_SERVICE_ACCOUNT_JSON", "GOOGLE_BOOKED_CALENDAR_ID"] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => { for (const k of KEYS) { saved[k] = process.env[k]; delete process.env[k]; } });
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("do we have what we need to write a booking", () => {
  it("says no with no service account", async () => {
    const { gcalConfigured } = await load();
    expect(gcalConfigured()).toBe(false);
  });

  it("says no when the JSON is not JSON", async () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = "{not json";
    const { gcalConfigured } = await load();
    expect(gcalConfigured()).toBe(false);
  });

  it("says no when the JSON parses but carries no key", async () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({ client_email: "a@b.iam.gserviceaccount.com" });
    const { gcalConfigured } = await load();
    expect(gcalConfigured()).toBe(false);
  });

  it("says yes with both halves, falling back to the calendar we already read", async () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({
      client_email: "a@b.iam.gserviceaccount.com",
      private_key: "-----BEGIN PRIVATE KEY-----\\nx\\n-----END PRIVATE KEY-----\\n",
    });
    const { gcalConfigured } = await load();
    expect(gcalConfigured()).toBe(true);
  });
});

describe("a booking that cannot be written", () => {
  it("reports unconfigured rather than throwing", async () => {
    const { createBookingEvent } = await load();
    const r = await createBookingEvent({
      summary: "Basic Interior, Ada", startMs: Date.now(), endMs: Date.now() + 3600_000,
    });
    expect(r).toEqual({ ok: false, reason: "unconfigured" });
  });

  it("refuses times that make no sense, before spending a token on them", async () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({
      client_email: "a@b.iam.gserviceaccount.com", private_key: "x",
    });
    const { createBookingEvent } = await load();
    const now = Date.now();
    expect((await createBookingEvent({ summary: "x", startMs: now, endMs: now })).reason).toBe("bad_times");
    expect((await createBookingEvent({ summary: "x", startMs: 0, endMs: now })).reason).toBe("bad_times");
  });
});

describe("the one title that must never be written", () => {
  it("is documented as OPEN, which the scheduler reads as bookable time", async () => {
    /*
     * A job titled "Open Interior Detail" would be read by the availability
     * parser as an OPEN block: the event that closes an afternoon would
     * instead declare it open. The prefix is rewritten rather than trusted,
     * and this is the test that says so, because the failure is invisible
     * until somebody double books.
     */
    const src = (await import("node:fs")).readFileSync(
      new URL("../../netlify/functions/_gcal.mjs", import.meta.url), "utf8",
    );
    expect(src, "nothing stops a job being titled OPEN").toMatch(/\/\^open\/i/);
    expect(src, "a busy event must be explicitly opaque").toContain('transparency: "opaque"');
  });
});
