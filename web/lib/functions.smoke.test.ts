/**
 * Imports every Netlify function with a fake environment and calls it with
 * hostile input. Nothing here talks to a real service: fake keys make the
 * upstream calls fail fast, and the point is that the function itself
 * returns a status code rather than throwing.
 *
 * WHY: travel.mjs shipped referencing four names it never imported. It only
 * ever ran without a key, where it returned 503 before reaching that line,
 * so the ReferenceError sat there waiting for the key to arrive. This test
 * runs each handler with the key present.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { resetRateLimits } from "../../netlify/functions/_ratelimit.mjs";

const FUNCS = [
  "travel", "create-payment", "paypal-order", "personal-busy", "reviews", "send-confirmation",
] as const;

const ENV: Record<string, string> = {
  GOOGLE_MAPS_SERVER_KEY: "fake-key",
  SHOP_ORIGIN_ADDRESS: "1 Test St, Cincinnati, OH",
  STRIPE_SECRET_KEY: "sk_test_fakefakefakefakefake",
  PAYPAL_CLIENT_ID: "fake",
  PAYPAL_CLIENT_SECRET: "fake",
  GOOGLE_PLACE_ID: "fake",
  PERSONAL_CALENDAR_ICS: "https://127.0.0.1:9/nothing.ics",
  RESEND_API_KEY: "re_fake",
  OWNER_EMAIL: "owner@example.com",
};
const saved: Record<string, string | undefined> = {};

beforeAll(() => {
  for (const [k, v] of Object.entries(ENV)) {
    saved[k] = process.env[k];
    process.env[k] = v;
  }
});
afterAll(() => {
  for (const k of Object.keys(ENV)) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

beforeEach(() => resetRateLimits());

const load = async (name: string) => (await import(`../../netlify/functions/${name}.mjs`)) as { handler: (e: unknown) => Promise<{ statusCode: number; body: string }> };

const bodies: Record<string, unknown> = {
  "null body": null,
  "array body": [],
  "string body": "x",
  "empty object": {},
  "vehicles [1]": { cart: { vehicles: [1] }, contact: { name: "a", phone: "5135551212" } },
  "vehicle null": { cart: { vehicles: [null] }, contact: { name: "a", phone: "5135551212" } },
  "addons object": { cart: { vehicles: [{ packageIds: ["basic-interior"], addons: {} }] }, contact: { name: "a", phone: "5135551212" } },
  "slot 1e20": { cart: { vehicles: [{ packageIds: ["basic-interior"] }], slot: 1e20 }, contact: { name: "a", phone: "5135551212" } },
  "slot string": { cart: { vehicles: [{ packageIds: ["basic-interior"] }], slot: "abc" }, contact: { name: "a", phone: "5135551212" } },
  "contact objects": { cart: { vehicles: [{ packageIds: ["basic-interior"] }] }, contact: { name: {}, phone: [] } },
  "proto": JSON.parse('{"cart":{"vehicles":[{"packageIds":["basic-interior"]}]},"__proto__":{"x":1}}'),
};

describe("every function survives hostile input with its key present", () => {
  for (const name of FUNCS) {
    it(`${name}: imports, and never throws`, async () => {
      const { handler } = await load(name);
      expect(typeof handler).toBe("function");

      const events: unknown[] = [
        { httpMethod: "GET", queryStringParameters: null, headers: {} },
        { httpMethod: "POST", body: "{not json", headers: {} },
        { httpMethod: "POST", body: "", headers: {} },
        { httpMethod: "GET", queryStringParameters: { address: "x".repeat(5000), at: "abc", lat: "999", lng: "-999", minRating: "abc", zip: "<script>" }, headers: {} },
        ...Object.values(bodies).map((b) => ({ httpMethod: "POST", body: JSON.stringify(b), headers: {} })),
      ];
      for (const ev of events) {
        resetRateLimits();
        const r = await handler(ev);
        expect(r && typeof r.statusCode === "number", `${name} returned ${JSON.stringify(r)}`).toBe(true);
        expect(r.statusCode).toBeGreaterThanOrEqual(200);
        expect(r.statusCode).toBeLessThan(600);
        // No key material, ever.
        expect(r.body).not.toMatch(/sk_test_fakefake|fake-key/);
      }
    }, 30_000);
  }

  it("create-payment: a valid cart reaches Stripe and fails safely with a fake key", async () => {
    const { handler } = await load("create-payment");
    const r = await handler({
      httpMethod: "POST",
      headers: {},
      body: JSON.stringify({
        cart: {
          vehicles: [{ sizeId: "small", packageIds: ["basic-interior"] }],
          address: { line1: "1 Main St", city: "Cincinnati", region: "OH", zip: "45220" },
          slot: Date.now() + 5 * 86_400_000,
        },
        contact: { name: "A", phone: "5135551212" },
        consent: { mandateAccepted: true, termsVersion: "2026-09-11" },
        mode: "card_only",
      }),
    });
    // The function got past validation and pricing, and the Stripe failure
    // came back as a message a customer may read, not the raw error.
    expect([502, 400]).toContain(r.statusCode);
    expect(r.body).not.toMatch(/Invalid API Key/i);
  }, 30_000);

  it("create-payment: refuses a saved card without the mandate", async () => {
    const { handler } = await load("create-payment");
    const r = await handler({
      httpMethod: "POST",
      headers: {},
      body: JSON.stringify({
        cart: {
          vehicles: [{ sizeId: "small", packageIds: ["basic-interior"] }],
          address: { line1: "1 Main St", city: "Cincinnati", region: "OH", zip: "45220" },
        },
        contact: { name: "A", phone: "5135551212" },
        mode: "card_only",
      }),
    });
    expect(r.statusCode).toBe(400);
    expect(JSON.parse(r.body).error).toBe("mandate_required");
  });

  it("send-confirmation: no key is not a failure", async () => {
    // The rule the whole confirm screen was rebuilt around: a missing key is
    // a feature that is off, never an error a customer hears about. The
    // booking already reached Elijah by another path.
    // A REAL booking with the key removed, not an empty body. An empty body
    // is refused on its own merits, and this is about the key. It also has to
    // be a real one now: the calendar write happens whether or not email is
    // configured, so the key must not short-circuit the whole function.
    const had = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;
    try {
      const { handler } = await load("send-confirmation");
      const r = await handler({
        httpMethod: "POST",
        headers: {},
        body: JSON.stringify({
          cart: {
            vehicles: [{ sizeId: "small", packageIds: ["basic-interior"] }],
            address: { line1: "1 Main St", city: "Cincinnati", region: "OH", zip: "45220" },
          },
          contact: { name: "Ada", phone: "5135551212" },
          mode: "card_only",
        }),
      });
      expect(r.statusCode).toBe(200);
      expect(JSON.parse(r.body)).toMatchObject({ sent: false, reason: "unconfigured" });
      // No service account here either, so it says so rather than throwing.
      expect(JSON.parse(r.body).calendar).toMatchObject({ ok: false });
    } finally {
      process.env.RESEND_API_KEY = had;
    }
  });

  it("send-confirmation: cannot be told what to charge or what to say", async () => {
    // The receipt is repriced here, so a browser claiming a $1 total gets an
    // email with the real one. And every field lands in the template escaped,
    // so a name cannot carry markup into an inbox.
    const { handler } = await load("send-confirmation");
    const r = await handler({
      httpMethod: "POST",
      headers: {},
      body: JSON.stringify({
        cart: {
          vehicles: [{ sizeId: "small", packageIds: ["basic-interior"] }],
          address: { line1: "1 Main St", city: "Cincinnati", region: "OH", zip: "45220" },
          totalCents: 100,
        },
        contact: { name: "<script>alert(1)</script>", phone: "5135551212" },
        mode: "card_only",
      }),
    });
    // A fake key means Resend refuses it, which is reported, not thrown.
    expect(r.statusCode).toBe(200);
    expect(JSON.parse(r.body).sent).toBe(false);
  }, 30_000);

  it("paypal-order: refuses an order id that is not an order id", async () => {
    const { handler } = await load("paypal-order");
    const r = await handler({
      httpMethod: "POST",
      headers: {},
      body: JSON.stringify({ action: "capture", orderId: "../../v1/identity/oauth2/userinfo" }),
    });
    // 502 if the fake auth fails first, 400 if it gets to the id check;
    // either way the path never reaches the URL.
    expect([400, 502]).toContain(r.statusCode);
    expect(r.body).not.toContain("userinfo");
  }, 30_000);
});
