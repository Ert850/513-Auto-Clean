/**
 * booking-followup.mjs: the "Help us get ready" answers onto the booking's
 * own calendar event (November 11), with every Google call stubbed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimits } from "../../netlify/functions/_ratelimit.mjs";
import { followupSection, withSection, handler } from "../../netlify/functions/booking-followup.mjs";

const ENV = { GOOGLE_OAUTH_CLIENT_ID: "id", GOOGLE_OAUTH_CLIENT_SECRET: "secret", GOOGLE_OAUTH_REFRESH_TOKEN: "refresh" };
const SLOT = Date.parse("2026-11-13T15:00:00Z");
const post = (body: unknown) => handler({ httpMethod: "POST", headers: {}, body: JSON.stringify(body) });
const ok = { key: "bk_abc123xyz", phone: "(513) 555-1212", slot: SLOT, access: { water: "unsure", parking: "Left of the garage" }, notes: "Dog hair", labels: ["Grey Civic"] };

let patched: { url: string; body: { description: string } }[] = [];
let event: Record<string, unknown> | null = null;

beforeEach(() => {
  resetRateLimits();
  Object.assign(process.env, ENV);
  patched = [];
  event = {
    id: "ev1",
    created: new Date().toISOString(),
    description: "WHO  Ada  5135551212",
    extendedProperties: { private: { bookingKey: "bk_abc123xyz", phone: "5135551212" } },
  };
  vi.stubGlobal("fetch", async (url: string, o: { method?: string; body?: string } = {}) => {
    const u = String(url);
    if (u.includes("oauth2.googleapis.com/token")) return new Response(JSON.stringify({ access_token: "t", expires_in: 3600 }));
    if (o.method === "PATCH") { patched.push({ url: u, body: JSON.parse(o.body ?? "{}") }); return new Response("{}"); }
    if (u.includes("/events?")) return new Response(JSON.stringify({ items: event ? [event] : [] }));
    return new Response("no", { status: 500 });
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  for (const k of Object.keys(ENV)) delete process.env[k];
});

describe("booking-followup", () => {
  it("writes only what was answered, in plain words", () => {
    const s = followupSection(ok);
    expect(s).toContain("Outdoor tap: not sure");
    expect(s).not.toContain("Outdoor outlet");
    expect(s).toContain("Parking: Left of the garage");
    expect(s).toContain("Vehicle: Grey Civic");
    expect(s).toContain("Notes: Dog hair");
    expect(followupSection({ access: {}, labels: [""] })).toBe("");
  });

  it("replaces an earlier section instead of repeating it", () => {
    const once = withSection("WHO  Ada", followupSection(ok));
    const twice = withSection(once, followupSection({ ...ok, notes: "Changed" }));
    expect(twice.match(/AFTER BOOKING/g)).toHaveLength(1);
    expect(twice).toContain("Notes: Changed");
    expect(twice.startsWith("WHO  Ada")).toBe(true);
  });

  it("adds the answers to the event booked under that key and phone", async () => {
    const r = JSON.parse((await post(ok)).body);
    expect(r).toEqual({ saved: true });
    expect(patched).toHaveLength(1);
    expect(patched[0]!.url).toContain("/events/ev1");
    expect(patched[0]!.body.description).toContain("WHO  Ada");
    expect(patched[0]!.body.description).toContain("Outdoor tap: not sure");
  });

  it("touches nothing for a different phone, an old booking, or no event, and says the same each time", async () => {
    expect(JSON.parse((await post({ ...ok, phone: "5135559999" })).body)).toEqual({ saved: false, reason: "not_found" });
    event!.created = new Date(Date.now() - 4 * 86_400_000).toISOString();
    expect(JSON.parse((await post(ok)).body)).toEqual({ saved: false, reason: "not_found" });
    event = null;
    expect(JSON.parse((await post(ok)).body)).toEqual({ saved: false, reason: "not_found" });
    expect(patched).toHaveLength(0);
  });

  it("refuses malformed requests and does nothing without the Google sign-in", async () => {
    expect((await handler({ httpMethod: "GET" })).statusCode).toBe(405);
    expect((await post({ ...ok, key: "x" })).statusCode).toBe(400);
    expect((await post({ ...ok, phone: "123" })).statusCode).toBe(400);
    expect(JSON.parse((await post({ ...ok, access: {}, notes: "", labels: [] })).body).reason).toBe("nothing_to_add");
    for (const k of Object.keys(ENV)) delete process.env[k];
    expect(JSON.parse((await post(ok)).body)).toEqual({ saved: false, reason: "unconfigured" });
  });
});
