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
  "travel", "create-payment", "paypal-order", "personal-busy", "reviews", "send-confirmation", "booking-followup",
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

  it("send-confirmation: writes a detailer's job to their own calendar, and only theirs", async () => {
    // DETAILERS is read here as well as in the browser. The browser names who
    // took the time; the server writes there only if that name is in its own
    // setting, so a sender cannot pick a calendar.
    const KRIS_JOBS = "kris-jobs@group.calendar.google.com";
    const env = {
      GOOGLE_OAUTH_CLIENT_ID: "id", GOOGLE_OAUTH_CLIENT_SECRET: "secret", GOOGLE_OAUTH_REFRESH_TOKEN: "refresh",
      DETAILERS: JSON.stringify([{ name: "Kris", does: "interior", noFeeStarts: "18:00-19:00",
        availability: "kris-open@group.calendar.google.com", bookings: KRIS_JOBS }]),
    };
    const before = Object.fromEntries(Object.keys(env).map((k) => [k, process.env[k]]));
    Object.assign(process.env, env);
    const writes: { url: string; summary: string }[] = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string, init?: { body?: string }) => {
      const u = String(url);
      if (u.startsWith("https://oauth2.googleapis.com/token")) {
        return new Response(JSON.stringify({ access_token: "t", expires_in: 3600 }), { status: 200 });
      }
      if (u.includes("googleapis.com/calendar/v3/calendars/")) {
        writes.push({ url: decodeURIComponent(u), summary: JSON.parse(String(init?.body ?? "{}")).summary });
        return new Response(JSON.stringify({ id: "e1" }), { status: 200 });
      }
      return new Response("{}", { status: 500 });
    }) as typeof fetch;
    try {
      const { handler } = await load("send-confirmation");
      const book = (detailer: string) => handler({
        httpMethod: "POST",
        headers: {},
        body: JSON.stringify({
          cart: {
            vehicles: [{ sizeId: "small", packageIds: ["basic-interior"] }],
            address: { line1: "1 Main St", city: "Cincinnati", region: "OH", zip: "45220" },
            slot: Date.now() + 5 * 86_400_000,
          },
          contact: { name: "Ada", phone: "5135551212" },
          mode: "card_only",
          detailer,
        }),
      });
      await book("kris");
      await book("somebody-else");
      expect(writes).toHaveLength(2);
      expect(writes[0]!.url).toContain(KRIS_JOBS);
      expect(writes[0]!.summary).toMatch(/^Kris: /);
      expect(writes[1]!.url, "an unknown name books the default calendar").not.toContain(KRIS_JOBS);
      expect(writes[1]!.summary).not.toMatch(/^Kris/);
    } finally {
      globalThis.fetch = realFetch;
      for (const [k, v] of Object.entries(before)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  }, 30_000);

  it("every booking function shares one view of detailers and their fee-free hours", async () => {
    // send-confirmation, create-payment and paypal-order all price through
    // _detailers.mjs, so a card charge cannot add a late fee the email waived.
    const before = process.env.DETAILERS;
    process.env.DETAILERS = JSON.stringify([{ name: "Kris", does: "interior", noFeeStarts: "18:00-19:00",
      availability: "a@group.calendar.google.com", bookings: "b@group.calendar.google.com" }]);
    try {
      const { detailerFor, timeFeeWaived } = (await import(`../../netlify/functions/${"_detailers"}.mjs`)) as {
        detailerFor: (id: unknown, cart?: unknown) => { id: string } | null;
        timeFeeWaived: (d: unknown, ms: number) => boolean;
      };
      const kris = detailerFor("kris");
      expect(kris?.id).toBe("kris");
      expect(detailerFor("owner"), "the owner is never a detailer entry").toBeNull();
      expect(detailerFor("someone-else")).toBeNull();
      expect(detailerFor({ id: "kris" }), "only a string id counts").toBeNull();
      // Only for a job he does: a request naming Kris for an exterior job
      // gets neither his calendar nor his fee-free 6pm (engine check, November 10).
      expect(detailerFor("kris", { vehicles: [{ packageIds: ["full-exterior"], addons: [] }] })).toBeNull();
      expect(detailerFor("kris", { vehicles: [{ packageIds: ["basic-interior"], addons: [] }] })?.id).toBe("kris");
      const at = (h: number, m = 0) => Date.parse(`2026-11-20T${String(h + 5).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`);
      expect(timeFeeWaived(kris, at(18, 30))).toBe(true);
      expect(timeFeeWaived(kris, at(19, 30))).toBe(false);
      expect(timeFeeWaived(null, at(18, 30))).toBe(false);
    } finally {
      if (before === undefined) delete process.env.DETAILERS;
      else process.env.DETAILERS = before;
    }
  });

  it("with no calendar to read, the server keeps the fee shown, never more than the clock rule", async () => {
    const before = { k: process.env.GOOGLE_CALENDAR_API_KEY, g: process.env.GOOGLE_API_KEY };
    delete process.env.GOOGLE_CALENDAR_API_KEY; delete process.env.GOOGLE_API_KEY;
    try {
      const { blockFeeFor } = (await import(`../../netlify/functions/${"_detailers"}.mjs`)) as {
        blockFeeFor: (d: unknown, ms: number, shown: unknown) => Promise<number | null>;
      };
      const at = (h: number) => Date.parse(`2026-11-20T${String(h + 5).padStart(2, "0")}:00:00Z`);
      expect(await blockFeeFor(null, at(19), 2000), "7pm, shown 20%").toBe(2000);
      expect(await blockFeeFor(null, at(19), 0), "7pm, shown standard").toBe(0);
      expect(await blockFeeFor(null, at(12), 2000), "noon: more than the clock, so the clock").toBeNull();
      expect(await blockFeeFor(null, at(19), "junk")).toBeNull();
    } finally {
      if (before.k !== undefined) process.env.GOOGLE_CALENDAR_API_KEY = before.k;
      if (before.g !== undefined) process.env.GOOGLE_API_KEY = before.g;
    }
  });

  it("each detailer drives from their own home, kept server-side in DETAILER_HOMES", async () => {
    const before = process.env.DETAILER_HOMES;
    process.env.DETAILER_HOMES = JSON.stringify({ Kris: "1 Test Rd, Mason, OH 45040" });
    try {
      const { homeFor } = (await import(`../../netlify/functions/${"_detailers"}.mjs`)) as { homeFor: (d: unknown) => string | null };
      expect(homeFor({ id: "kris", name: "Kris", owner: false })).toBe("1 Test Rd, Mason, OH 45040");
      expect(homeFor({ id: "owner", name: "Elijah", owner: true }), "the owner uses the shop address").toBeNull();
      expect(homeFor({ id: "sam", name: "Sam", owner: false }), "not listed: the shop address").toBeNull();
      process.env.DETAILER_HOMES = "not json";
      expect(homeFor({ id: "kris", name: "Kris", owner: false })).toBeNull();
    } finally {
      if (before === undefined) delete process.env.DETAILER_HOMES; else process.env.DETAILER_HOMES = before;
    }
  });

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

describe("cart-capture (a checkout left unfinished, round 15)", () => {
  const load = async () =>
    (await import(`../../netlify/functions/${"cart-capture"}.mjs`)) as {
      captureFrom: (p: unknown) => Record<string, string> | null;
      handler: (e: unknown) => Promise<{ statusCode: number; body: string }>;
    };

  it("needs a name and a way to reach them, and keeps what they picked", async () => {
    const { captureFrom } = await load();
    expect(captureFrom({ contact: { name: "Ada" } })).toBeNull();
    expect(captureFrom({ contact: { name: "", phone: "5135551212" } })).toBeNull();
    expect(captureFrom({ contact: { name: "Ada", phone: "123" } })).toBeNull();
    const c = captureFrom({ contact: { name: "Ada", phone: "+1 (513) 555-1212" }, summary: "Small, Basic Interior", heard: "Instagram" })!;
    expect(c.phone).toBe("5135551212");
    expect(c.picked).toBe("Small, Basic Interior");
    expect(c.heard).toBe("Instagram");
    expect(captureFrom({ contact: { name: "Ada", email: "ada@example.com" } })!.email).toBe("ada@example.com");
  });

  it("sends nothing without the email key, and only ever to the owner", async () => {
    const { handler } = await load();
    const prev = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;
    const r = await handler({ httpMethod: "POST", headers: {}, body: JSON.stringify({ contact: { name: "Ada", phone: "5135551212", email: "someone@else.com" } }) });
    expect(JSON.parse(r.body)).toEqual({ captured: false, reason: "unconfigured" });
    if (prev) process.env.RESEND_API_KEY = prev;
    const src = (await import("node:fs")).readFileSync(new URL("../../netlify/functions/cart-capture.mjs", import.meta.url), "utf8");
    expect(src, "the recipient is the owner's own address").toContain("to: [owner]");
    expect((await handler({ httpMethod: "GET" })).statusCode).toBe(405);
  });
});
