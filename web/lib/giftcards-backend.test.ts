/**
 * Gift card checkout, webhook, delivery, lookup and admin
 * (netlify/functions/gift-*.mjs). Stripe is an in-memory stand-in, Resend a
 * recorder: nothing here leaves the machine.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimits } from "../../netlify/functions/_ratelimit.mjs";

type Meta = Record<string, string>;
type PI = { id: string; amount: number; metadata: Meta };
type Session = { id: string; url: string; metadata: Meta; payment_status: string; amount_total: number; payment_intent: string; customer_details?: { email?: string } };

const db = { sessions: new Map<string, Session>(), pis: new Map<string, PI>(), calls: [] as { what: string; params: unknown; opts: unknown }[] };

vi.mock("stripe", () => ({
  default: class FakeStripe {
    checkout = {
      sessions: {
        create: async (params: { metadata: Meta; payment_intent_data: { metadata: Meta }; line_items: { price_data: { unit_amount: number } }[] }, opts: unknown) => {
          db.calls.push({ what: "sessions.create", params, opts });
          const n = db.sessions.size + 1;
          const id = `cs_test_${"a".repeat(20)}${n}`;
          const pi = { id: `pi_${n}`, amount: params.line_items[0]!.price_data.unit_amount, metadata: { ...params.payment_intent_data.metadata } };
          db.pis.set(pi.id, pi);
          const s = { id, url: `https://checkout.stripe.com/c/${id}`, metadata: { ...params.metadata }, payment_status: "unpaid", amount_total: pi.amount, payment_intent: pi.id, customer_details: { email: "buyer@example.com" } };
          db.sessions.set(id, s);
          return s;
        },
        retrieve: async (id: string, o?: { expand?: string[] }) => {
          const s = db.sessions.get(id);
          if (!s) throw Object.assign(new Error("No such session"), { statusCode: 404, code: "resource_missing" });
          return o?.expand?.includes("payment_intent") ? { ...s, payment_intent: structuredClone(db.pis.get(s.payment_intent)) } : { ...s };
        },
      },
    };
    paymentIntents = {
      retrieve: async (id: string) => structuredClone(db.pis.get(id)),
      update: async (id: string, p: { metadata: Meta }, opts: unknown) => {
        db.calls.push({ what: "pi.update", params: p, opts });
        const pi = db.pis.get(id)!;
        Object.assign(pi.metadata, p.metadata);
        return structuredClone(pi);
      },
      search: async ({ query }: { query: string }) => {
        const m = /metadata\['(\w+)'\]:'([^']*)'/.exec(query)!;
        return { data: [...db.pis.values()].filter((p) => p.metadata[m[1]!] === m[2]).map((p) => structuredClone(p)), has_more: false };
      },
    };
    webhooks = {
      constructEvent: (raw: string | Buffer, sig: string) => {
        if (sig !== "good") throw new Error("bad signature");
        return JSON.parse(String(raw));
      },
    };
  },
}));

const G = await import("../../netlify/functions/_giftcards.mjs");
const checkout = await import("../../netlify/functions/gift-checkout.mjs");
const webhook = await import("../../netlify/functions/gift-webhook.mjs");
const deliver = await import("../../netlify/functions/gift-deliver.mjs");
const card = await import("../../netlify/functions/gift-card.mjs");
const admin = await import("../../netlify/functions/gift-admin.mjs");
const { giftOffer, GIFT_CARDS } = (await import(`../../netlify/functions/${"_pricing"}.mjs`)) as {
  giftOffer: (v: unknown, now: number, cfg?: unknown) => { ok: boolean; valueCents?: number; payCents?: number; percentOff?: number; error?: string };
  GIFT_CARDS: { mode: string; tiers: { value: number }[]; custom: { min: number; max: number }; sale: { percentOff: number; starts: string; ends: string }; checkout: { enabled: boolean } };
};

const SECRET = "s".repeat(40);
const ENV = { STRIPE_SECRET_KEY: "sk_test_fake", STRIPE_WEBHOOK_SECRET: "whsec_fake", GIFT_CODE_SECRET: SECRET, GIFT_ADMIN_KEY: "k".repeat(24), RESEND_API_KEY: "re_fake", OWNER_EMAIL: "owner@example.com", URL: "https://513autoclean.com", CONTEXT: "production" };
const IN_SALE = Date.parse("2026-12-01T17:00:00Z");
let mail: { to: string; subject: string }[] = [];
let mailOk = true;
const realFetch = globalThis.fetch;

beforeEach(() => {
  resetRateLimits();
  db.sessions.clear(); db.pis.clear(); db.calls.length = 0;
  mail = []; mailOk = true;
  for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
  vi.useFakeTimers({ now: IN_SALE, toFake: ["Date"] });
  globalThis.fetch = (async (url: string, init?: { body?: string }) => {
    if (String(url) === "https://api.resend.com/emails") {
      const b = JSON.parse(String(init?.body));
      mail.push({ to: b.to[0], subject: b.subject });
      return new Response("{}", { status: mailOk ? 200 : 500 });
    }
    throw new Error("unexpected fetch " + url);
  }) as typeof fetch;
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); globalThis.fetch = realFetch; });

const post = (h: { handler: (e: unknown) => Promise<{ statusCode: number; body: string }> }, body: unknown, headers: Record<string, string> = {}) =>
  h.handler({ httpMethod: "POST", headers, body: JSON.stringify(body) });
const hook = (ev: unknown, sig = "good") => post(webhook, ev, { "stripe-signature": sig });
const buy = (extra: Record<string, unknown> = {}) => post(checkout, { value: 50, requestKey: "gc_testkey123", to: { name: "Sam", email: "sam@example.com" }, from: { name: "Alex" }, message: "Enjoy", ...extra });
const paidSession = async (extra: Record<string, unknown> = {}) => {
  await buy(extra);
  const s = [...db.sessions.values()].at(-1)!;
  s.payment_status = "paid";
  return s;
};

describe("card codes", () => {
  it("one code per session, the same every time, unguessable without the secret", () => {
    const a = G.codeFor("cs_test_one", SECRET);
    expect(a).toMatch(/^513-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
    expect(G.codeFor("cs_test_one", SECRET)).toBe(a);
    expect(G.codeFor("cs_test_two", SECRET)).not.toBe(a);
    expect(G.codeFor("cs_test_one", "t".repeat(40))).not.toBe(a);
  });

  it("finds a card however the code is typed", () => {
    const code = G.codeFor("cs_test_one", SECRET);
    const h = G.codeHash(code, SECRET);
    for (const typed of [code, code.toLowerCase(), code.replace(/-/g, " "), code.slice(4), code.replace(/0/g, "O").replace(/1/g, "l")]) {
      expect(G.codeHash(typed, SECRET), typed).toBe(h);
    }
    expect(G.codeHash("513-XXXX", SECRET)).toBeNull();
    expect(G.giftSecret({ GIFT_CODE_SECRET: "short" })).toBeNull();
  });

  it("keeps the newest history inside Stripe's 500 characters", () => {
    let log = "";
    for (let i = 0; i < 60; i++) log = G.appendLog(log, `2026-12-${String(i).padStart(2, "0")} used $10.00, left $1.00`);
    expect(log.length).toBeLessThanOrEqual(500);
    expect(log.endsWith("2026-12-59 used $10.00, left $1.00")).toBe(true);
  });
});

describe("the price, set by the server", () => {
  const cfg = { ...GIFT_CARDS, mode: "sale", sale: { percentOff: 20, starts: "2026-11-27", ends: "2026-12-25" } };
  it("20% off inside the sale's Cincinnati dates, full price outside", () => {
    expect(giftOffer(50, Date.parse("2026-12-01T17:00:00Z"), cfg)).toMatchObject({ ok: true, valueCents: 5000, payCents: 4000, percentOff: 20 });
    // 11:30 PM on the 25th in Cincinnati is the 26th in UTC: still the sale.
    expect(giftOffer(50, Date.parse("2026-12-26T04:30:00Z"), cfg)).toMatchObject({ payCents: 4000 });
    expect(giftOffer(50, Date.parse("2026-12-26T05:30:00Z"), cfg)).toMatchObject({ payCents: 5000, percentOff: 0 });
    expect(giftOffer(50, Date.parse("2026-11-26T12:00:00Z"), cfg)).toMatchObject({ payCents: 5000 });
    expect(giftOffer(50, IN_SALE, { ...cfg, mode: "regular" })).toMatchObject({ payCents: 5000 });
  });
  it("only the tiers or a whole amount in the custom range", () => {
    expect(giftOffer(37, IN_SALE, cfg)).toMatchObject({ ok: true, payCents: 2960 });
    for (const bad of [cfg.custom.min - 1, cfg.custom.max + 1, 12.5, "50", null, -50]) expect(giftOffer(bad, IN_SALE, cfg)).toMatchObject({ ok: false });
    expect(giftOffer(50, IN_SALE, { ...cfg, mode: "off" })).toEqual({ ok: false, error: "off" });
  });
});

describe("gift-checkout", () => {
  it("refuses, taking nothing, without its secrets", async () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    expect((await buy()).statusCode).toBe(503);
    expect(db.calls).toHaveLength(0);
  });

  it("opens Stripe at the server's price, never one from the browser", async () => {
    const r = await buy({ price: 1, payCents: 1 });
    expect(r.statusCode).toBe(200);
    expect(JSON.parse(r.body).url).toMatch(/^https:\/\/checkout\.stripe\.com\//);
    const c = db.calls[0]! as { params: { line_items: { price_data: { unit_amount: number } }[]; payment_method_types: string[]; success_url: string; metadata: Meta }; opts: { idempotencyKey?: string } };
    const expected = giftOffer(50, IN_SALE);
    expect(c.params.line_items[0]!.price_data.unit_amount).toBe(expected.payCents);
    expect(c.params.payment_method_types).toEqual(["card", "link"]);
    expect(c.params.success_url).toBe("https://513autoclean.com/gift-certificate#s={CHECKOUT_SESSION_ID}&new=1");
    expect(c.params.metadata).toMatchObject({ kind: "giftcard", gift_value_cents: "5000", gift_to_email: "sam@example.com", gift_send_on: "" });
    expect(c.opts?.idempotencyKey).toMatch(/^gc_testkey123-gift-session-/);
  });

  it("checks the gift details", async () => {
    const r = async (x: Record<string, unknown>) => JSON.parse((await buy(x)).body).error;
    expect(await r({ to: { email: "not-an-email" } })).toBe("bad_email");
    expect(await r({ sendOn: "2026-11-30" })).toBe("bad_date");
    expect(await r({ sendOn: "2027-03-01" })).toBe("bad_date");
    expect(await r({ sendOn: "2026-12-24", to: {} })).toBe("date_needs_email");
    expect(await r({ message: "x".repeat(301) })).toBe("bad_details");
    expect(await r({ value: 501 })).toBe("bad_amount");
  });
});

describe("gift-webhook", () => {
  const completed = (id: string) => ({ type: "checkout.session.completed", data: { object: { id } } });

  it("refuses an unsigned call", async () => {
    expect((await hook(completed("cs_x"), "forged")).statusCode).toBe(400);
  });

  it("issues once, emails the buyer, the person it's for and Elijah once, however often Stripe calls", async () => {
    const s = await paidSession();
    for (let i = 0; i < 3; i++) expect((await hook(completed(s.id))).statusCode).toBe(200);
    const pi = db.pis.get(s.payment_intent)!;
    expect(pi.metadata).toMatchObject({ gift_status: "active", gift_balance_cents: "5000", gift_deliver: "sent", gift_mail_buyer: "1", gift_mail_to: "1", gift_mail_owner: "1" });
    expect(pi.metadata.gift_code_hash).toBe(G.codeHash(G.codeFor(s.id, SECRET), SECRET));
    expect(mail.map((m) => m.to).sort()).toEqual(["buyer@example.com", "owner@example.com", "sam@example.com"]);
  });

  it("does nothing for a session that isn't paid", async () => {
    await buy();
    const s = [...db.sessions.values()].at(-1)!;
    await hook(completed(s.id));
    expect(db.pis.get(s.payment_intent)!.metadata.gift_code_hash).toBeUndefined();
    expect(mail).toHaveLength(0);
  });

  it("a scheduled card waits for its day, and a failed email is retried without repeating the others", async () => {
    const s = await paidSession({ sendOn: "2026-12-24" });
    mailOk = false;
    expect((await hook(completed(s.id))).statusCode).toBe(500);
    mailOk = true;
    expect((await hook(completed(s.id))).statusCode).toBe(200);
    const pi = db.pis.get(s.payment_intent)!;
    expect(pi.metadata.gift_deliver).toBe("pending");
    expect(mail.filter((m) => m.to === "sam@example.com")).toHaveLength(0);

    const d = await import("../../netlify/functions/gift-deliver.mjs");
    const send = async (to: string, msg: { subject: string }) => { mail.push({ to, subject: msg.subject }); return true; };
    expect(await d.deliverDue(new (await import("stripe")).default("x") as never, SECRET, Date.parse("2026-12-23T15:00:00Z"), send)).toMatchObject({ sent: 0, waiting: 1 });
    expect(await d.deliverDue(new (await import("stripe")).default("x") as never, SECRET, Date.parse("2026-12-24T15:00:00Z"), send)).toMatchObject({ sent: 1 });
    expect(pi.metadata.gift_deliver).toBe("sent");
    expect(mail.filter((m) => m.to === "sam@example.com")).toHaveLength(1);
  });

  it("a full refund voids the card; a dispute freezes it", async () => {
    const s = await paidSession();
    await hook(completed(s.id));
    await hook({ type: "charge.refunded", data: { object: { payment_intent: s.payment_intent, amount: 4000, amount_refunded: 4000 } } });
    expect(db.pis.get(s.payment_intent)!.metadata).toMatchObject({ gift_status: "void", gift_balance_cents: "0" });
    const t = await paidSession();
    await hook(completed(t.id));
    await hook({ type: "charge.dispute.created", data: { object: { payment_intent: t.payment_intent } } });
    expect(db.pis.get(t.payment_intent)!.metadata.gift_status).toBe("disputed");
  });
});

describe("gift-card (the certificate page's lookup)", () => {
  const get = (s: string) => card.handler({ httpMethod: "GET", queryStringParameters: { s } });
  it("shows the card once paid, and nothing about the buyer", async () => {
    await buy();
    const s = [...db.sessions.values()].at(-1)!;
    expect((await get(s.id)).statusCode).toBe(202);
    s.payment_status = "paid";
    const r = await get(s.id);
    expect(r.statusCode).toBe(200);
    const j = JSON.parse(r.body);
    expect(j).toMatchObject({ code: G.codeFor(s.id, SECRET), valueCents: 5000, balanceCents: 5000, toName: "Sam" });
    expect(r.body).not.toContain("buyer@example.com");
    expect(r.body).not.toContain("sam@example.com");
    expect((await get("cs_test_nope_nope_nope")).statusCode).toBe(404);
    expect((await get("../etc")).statusCode).toBe(404);
  });
});

describe("gift-admin", () => {
  const act = (body: Record<string, unknown>) => post(admin, { key: ENV.GIFT_ADMIN_KEY, ...body });
  it("needs the key", async () => {
    expect((await post(admin, { key: "wrong", action: "lookup", code: "x" })).statusCode).toBe(401);
  });
  it("looks a card up, takes amounts off once per tap, refuses more than is left", async () => {
    const s = await paidSession();
    await hook({ type: "checkout.session.completed", data: { object: { id: s.id } } });
    const code = G.codeFor(s.id, SECRET);
    expect(JSON.parse((await act({ action: "lookup", code: code.toLowerCase() })).body).card).toMatchObject({ balanceCents: 5000, status: "active" });
    const r1 = JSON.parse((await act({ action: "redeem", code, amountCents: 3000, note: "Jane, Dec 30", requestId: "req_aaaaaaaa" })).body);
    expect(r1.card).toMatchObject({ balanceCents: 2000, status: "active" });
    const upd = db.calls.filter((c) => c.what === "pi.update").at(-1)! as { opts: { idempotencyKey: string } };
    expect(upd.opts.idempotencyKey).toContain("req_aaaaaaaa");
    expect((await act({ action: "redeem", code, amountCents: 2500, requestId: "req_bbbbbbbb" })).statusCode).toBe(409);
    const r2 = JSON.parse((await act({ action: "redeem", code, amountCents: 2000, requestId: "req_cccccccc" })).body);
    expect(r2.card).toMatchObject({ balanceCents: 0, status: "used" });
    expect(r2.card.log).toContain("used $30 (Jane, Dec 30), left $20");
    expect((await act({ action: "lookup", code: "513-0000-0000-0000" })).statusCode).toBe(404);
  });
});

describe("the test site's login gate", () => {
  it("lets Stripe's signed webhook through, and nothing else", async () => {
    const { config } = await import("../../netlify/edge-functions/test-gate.js");
    expect(config.excludedPath).toEqual(["/api/gift-webhook", "/.netlify/functions/gift-webhook"]);
  });
});
