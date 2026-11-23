/**
 * The payment code, for the day payments are switched back on (review,
 * November 23, P2 to P10; docs/SESSION-CHANGES-payments.md).
 *
 * Nothing here reaches Stripe, PayPal or anyone else: Stripe is replaced by a
 * recorder, fetch throws for anything not stubbed, and the browser functions
 * run from js/funnel.js's own source with stand-ins for what they touch.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimits } from "../../netlify/functions/_ratelimit.mjs";
// Through a template, as for _detailers.mjs: the bundle has no type file.
const { CAPABILITIES } = (await import(`../../netlify/functions/${"_pricing"}.mjs`)) as {
  CAPABILITIES: { id: string; live: boolean }[];
};

type Call = { what: string; params: Record<string, unknown>; opts: { idempotencyKey?: string } | undefined };
const stripeCalls: Call[] = [];

vi.mock("stripe", () => {
  const rec = (what: string, id: string) => async (params: Record<string, unknown>, opts?: { idempotencyKey?: string }) => {
    stripeCalls.push({ what, params, opts });
    return { id, client_secret: `${id}_secret`, data: [] };
  };
  return {
    default: class FakeStripe {
      customers = { create: rec("customers.create", "cus_1"), search: rec("customers.search", "search") };
      paymentIntents = { create: rec("paymentIntents.create", "pi_1") };
      setupIntents = { create: rec("setupIntents.create", "seti_1") };
    },
  };
});

const ROOT = path.join(__dirname, "../..");
const FUNNEL = fs.readFileSync(path.join(ROOT, "js/funnel.js"), "utf8");
const slice = (from: string, to: string) => {
  const a = FUNNEL.indexOf(from);
  const b = FUNNEL.indexOf(to, a);
  if (a < 0 || b < 0) throw new Error(`funnel.js moved: ${from}`);
  return FUNNEL.slice(a, b);
};

/* ---------------- switches and environment ---------------- */

const SWITCHES = ["cardOnFile", "payInFull", "digitalWallets"];
const wasLive = Object.fromEntries(SWITCHES.map((id) => [id, CAPABILITIES.find((c) => c.id === id)!.live]));
const setLive = (on: boolean) => {
  for (const id of SWITCHES) CAPABILITIES.find((c) => c.id === id)!.live = on;
};

const ENV = { STRIPE_SECRET_KEY: "sk_test_fake", PAYPAL_CLIENT_ID: "fake", PAYPAL_CLIENT_SECRET: "fake" };
const savedEnv: Record<string, string | undefined> = {};
const realFetch = globalThis.fetch;
let fetched: { url: string; init: RequestInit | undefined }[] = [];

beforeEach(() => {
  resetRateLimits();
  stripeCalls.length = 0;
  fetched = [];
  for (const k of [...Object.keys(ENV), "PAYPAL_ENV", "TURNSTILE_SECRET_KEY", "GOOGLE_MAPS_SERVER_KEY"]) savedEnv[k] = process.env[k];
  Object.assign(process.env, ENV);
  delete process.env.PAYPAL_ENV;
  delete process.env.TURNSTILE_SECRET_KEY;
  delete process.env.GOOGLE_MAPS_SERVER_KEY;
  globalThis.fetch = (async (url: string) => {
    throw new Error(`unexpected request to ${url}`);
  }) as typeof fetch;
});
afterEach(() => {
  for (const id of SWITCHES) CAPABILITIES.find((c) => c.id === id)!.live = wasLive[id]!;
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  globalThis.fetch = realFetch;
});

const load = async (name: string) =>
  (await import(`../../netlify/functions/${name}.mjs`)) as { handler: (e: unknown) => Promise<{ statusCode: number; body: string }> };

const SLOT = Date.now() + 5 * 86_400_000;
const booking = (over: Record<string, unknown> = {}, packageIds = ["basic-interior"]) => ({
  httpMethod: "POST",
  headers: {},
  body: JSON.stringify({
    cart: {
      vehicles: [{ sizeId: "small", packageIds }],
      address: { line1: "1 Main St", city: "Cincinnati", region: "OH", zip: "45220" },
      slot: SLOT,
    },
    contact: { name: "Ada", phone: "5135551212" },
    consent: { mandateAccepted: true, termsVersion: "2026-09-11" },
    mode: "card_only",
    idempotencyKey: "bk_test1234",
    ...over,
  }),
});

/* ---------------- P7: off means off ---------------- */

describe("payment functions refuse while their switches are off (P7)", () => {
  it("create-payment, both modes, with the Stripe key set", async () => {
    const { handler } = await load("create-payment");
    for (const mode of ["card_only", "pay_now"]) {
      const r = await handler(booking({ mode }));
      expect(r.statusCode, mode).toBe(503);
      expect(JSON.parse(r.body).error).toBe("off");
    }
    expect(stripeCalls).toEqual([]);
  });

  it("create-payment: a card needs cardOnFile, paying in full needs payInFull too", async () => {
    const { handler } = await load("create-payment");
    CAPABILITIES.find((c) => c.id === "cardOnFile")!.live = true;
    expect((await handler(booking({ mode: "card_only" }))).statusCode).toBe(200);
    expect((await handler(booking({ mode: "pay_now" }))).statusCode).toBe(503);
  });

  it("paypal-order, both actions, with the PayPal keys set", async () => {
    const { handler } = await load("paypal-order");
    process.env.PAYPAL_ENV = "sandbox";
    for (const body of [{ action: "create" }, { action: "capture", orderId: "ABCDEFGH1234" }]) {
      const r = await handler({ httpMethod: "POST", headers: {}, body: JSON.stringify(body) });
      expect(r.statusCode, body.action).toBe(503);
      expect(JSON.parse(r.body).error).toBe("off");
    }
    expect(fetched).toEqual([]);
  });
});

/* ---------------- P3, P4, P8: Stripe requests ---------------- */

describe("create-payment's Stripe requests (P3, P4, P8)", () => {
  beforeEach(() => setLive(true));

  const intentKey = () => stripeCalls.find((c) => c.what !== "customers.create")!.opts?.idempotencyKey;

  it("a retry keeps its key; a new mode or cart gets a new one", async () => {
    const { handler } = await load("create-payment");
    const keys: Record<string, string | undefined> = {};
    for (const [name, over, pkgs] of [
      ["later", { mode: "card_only" }, undefined],
      ["later again", { mode: "card_only" }, undefined],
      ["now", { mode: "pay_now" }, undefined],
      ["now, bigger cart", { mode: "pay_now" }, ["basic-interior", "full-exterior"]],
    ] as const) {
      stripeCalls.length = 0;
      const r = await handler(booking(over, pkgs ? [...pkgs] : undefined));
      expect(r.statusCode, name).toBe(200);
      keys[name] = intentKey();
    }
    expect(keys.later).toMatch(/^bk_test1234-setup-[0-9a-f]{32}$/);
    expect(keys["later again"]).toBe(keys.later);
    expect(keys.now).toMatch(/^bk_test1234-payment-/);
    expect(new Set(Object.values(keys)).size).toBe(3);
  });

  it("a new customer per booking, never one found by phone, created with a key", async () => {
    const { handler } = await load("create-payment");
    await handler(booking());
    expect(stripeCalls.some((c) => c.what === "customers.search")).toBe(false);
    const created = stripeCalls.filter((c) => c.what === "customers.create");
    expect(created).toHaveLength(1);
    expect(created[0]!.opts?.idempotencyKey).toMatch(/^bk_test1234-customer-/);
  });

  it("offers only methods that finish on the page", async () => {
    const { handler } = await load("create-payment");
    await handler(booking({ mode: "card_only" }));
    await handler(booking({ mode: "pay_now" }));
    const intents = stripeCalls.filter((c) => c.what !== "customers.create");
    expect(intents).toHaveLength(2);
    for (const c of intents) {
      expect(c.params.payment_method_types, c.what).toEqual(["card", "link"]);
      expect(c.params.automatic_payment_methods, c.what).toBeUndefined();
    }
  });
});

/* ---------------- P6: PayPal ---------------- */

describe("paypal-order (P6)", () => {
  beforeEach(() => setLive(true));

  const stubPaypal = () => {
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      fetched.push({ url: String(url), init });
      if (String(url).endsWith("/v1/oauth2/token")) return new Response(JSON.stringify({ access_token: "t" }));
      if (String(url).endsWith("/capture")) return new Response(JSON.stringify({ status: "COMPLETED" }));
      return new Response(JSON.stringify({ id: "ORDER1234" }));
    }) as typeof fetch;
  };
  const header = (i: number) => (fetched[i]!.init!.headers as Record<string, string>)["PayPal-Request-Id"];

  it("creates and captures with PayPal-Request-Id, stable on a retry", async () => {
    process.env.PAYPAL_ENV = "sandbox";
    stubPaypal();
    const { handler } = await load("paypal-order");
    const create = booking({ action: "create" });
    expect((await handler(create)).statusCode).toBe(200);
    expect((await handler(create)).statusCode).toBe(200);
    const orders = fetched.map((f, i) => [f.url, i] as const).filter(([u]) => u.endsWith("/v2/checkout/orders"));
    expect(orders).toHaveLength(2);
    expect(header(orders[0]![1])).toMatch(/^bk_test1234-order-[0-9a-f]{32}$/);
    expect(header(orders[1]![1])).toBe(header(orders[0]![1]));

    fetched = [];
    const r = await handler({ httpMethod: "POST", headers: {}, body: JSON.stringify({ action: "capture", orderId: "ORDER1234" }) });
    expect(r.statusCode).toBe(200);
    expect(header(fetched.length - 1)).toBe("capture-ORDER1234");
  });

  it("without PAYPAL_ENV it runs nowhere, rather than in the sandbox", async () => {
    stubPaypal();
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const { handler } = await load("paypal-order");
      const r = await handler(booking({ action: "create" }));
      expect(r.statusCode).toBe(502);
      expect(fetched).toEqual([]);
      expect(errors.mock.calls.flat().join(" ")).toContain("PAYPAL_ENV must be live or sandbox");
    } finally {
      errors.mockRestore();
    }
  });
});

/* ---------------- P2, P5: the booking form ---------------- */

type Mount = { innerHTML: string; isConnected: boolean; querySelector: () => object; closest: () => null };
const newMount = (): Mount => ({ innerHTML: "", isConnected: true, querySelector: () => ({}), closest: () => null });

describe("the booking form's payment form (P2)", () => {
  it("a full redraw gets a new card form, not the one that left the page", () => {
    const make = new Function(
      "root", "state", "mountTurnstile", "mountPayPal", "mountStripe",
      slice("function mountPayment()", "/**\n   * Stripe Payment Element") + "\nreturn mountPayment;",
    );
    const oldMount = newMount();
    const fresh = newMount();
    const root = { _stripe: { mount: oldMount } as unknown, querySelector: () => fresh };
    const mounted: Mount[] = [];
    const mountPayment = make(root, { mandate: true, payInFull: true, payMethod: "card" }, () => {}, () => {}, (m: Mount) => mounted.push(m));
    mountPayment();
    expect(mounted, "the new mount gets its own form").toEqual([fresh]);
    expect(root._stripe).toBeNull();

    // And one already in this mount is left alone.
    root._stripe = { mount: fresh };
    mountPayment();
    expect(mounted).toHaveLength(1);
  });

  it("an answer that arrives after a redraw never becomes the form Confirm uses", async () => {
    const answers: ((v: unknown) => void)[] = [];
    const reply = { ok: true, json: async () => ({ clientSecret: "seti_x", kind: "setup" }) };
    const fakeFetch = () => new Promise((ok) => answers.push(ok));
    const win = { Stripe: () => ({ elements: () => ({ create: () => ({ mount() {} }) }) }) };
    const root: { _stripe: { mount?: Mount } | null } = { _stripe: null };
    const make = new Function(
      "root", "state", "CFG", "window", "fetch", "loadScript", "noCardMessage", "stripeMode", "wireCart",
      "consentPayload", "bookingKey", "detailerParam", "shownTimeFeeBp", "spendTurnstile", "q",
      slice("/** Which payment form request is the current one", "var PAYPAL_OFF") + "\nreturn mountStripe;",
    );
    const mountStripe = make(
      root, { payInFull: false, contact: {} }, { stripePublishableKey: "pk_test_x" }, win, fakeFetch,
      null, null, () => "test", () => ({}), () => ({}), () => "bk_x", () => null, () => 0, () => {}, () => ({ totalCents: 1 }),
    );
    const first = newMount();
    const second = newMount();
    mountStripe(first);
    first.isConnected = false; // render() replaced it
    mountStripe(second);
    answers[1]!(reply);
    await new Promise((r) => setTimeout(r, 0));
    answers[0]!(reply);
    await new Promise((r) => setTimeout(r, 0));
    expect(root._stripe?.mount).toBe(second);
  });
});

describe("the booking form's Confirm (P5)", () => {
  const run = async (result: unknown) => {
    const make = new Function(
      "root", "state", "el", "record", "renderTotal", "location",
      slice("function submit()", "/**\n   * The confirmation email") + "\nreturn submit;",
    );
    const msg = { className: "", textContent: "" };
    const state: Record<string, unknown> = { payInFull: true, payState: null };
    const root = {
      querySelector: () => msg,
      _stripe: {
        kind: "payment",
        elements: { submit: async () => ({}) },
        stripe: { confirmPayment: async () => result, confirmSetup: async () => result },
      },
    };
    let recorded = 0;
    make(root, state, () => ({ disabled: false }), () => recorded++, () => {}, { origin: "https://x.test" })();
    await new Promise((r) => setTimeout(r, 0));
    return { recorded, state, msg };
  };

  it("a payment still processing is not recorded as paid", async () => {
    const r = await run({ paymentIntent: { status: "processing" } });
    expect(r.recorded).toBe(0);
    expect(r.state.payState).not.toBe("paid");
    expect(r.msg.className).toContain("err");
  });

  it("a payment that succeeded is", async () => {
    const r = await run({ paymentIntent: { status: "succeeded" } });
    expect(r.recorded).toBe(1);
    expect(r.state.payState).toBe("paid");
  });
});

/* ---------------- P10: the publishable key ---------------- */

describe("render-config refuses a secret key in the publishable slot (P10)", () => {
  it("fails the build without printing the key, and writes nothing", () => {
    const out = path.join(ROOT, "js/config.js");
    const before = fs.existsSync(out) ? fs.statSync(out).mtimeMs : null;
    const secret = "sk_live_" + "x".repeat(24);
    const r = spawnSync(process.execPath, [path.join(ROOT, "web/scripts/render-config.mjs")], {
      env: { ...process.env, STRIPE_PUBLISHABLE_KEY: secret },
      encoding: "utf8",
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("STRIPE_PUBLISHABLE_KEY");
    expect(r.stderr).toContain("SECRET");
    expect(r.stdout + r.stderr).not.toContain(secret.slice(0, 10));
    expect(fs.existsSync(out) ? fs.statSync(out).mtimeMs : null).toBe(before);
  });
});
