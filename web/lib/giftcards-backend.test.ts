/**
 * Gift card checkout, webhook, delivery, lookup and admin
 * (netlify/functions/gift-*.mjs). Stripe is an in-memory stand-in, Resend a
 * recorder: nothing here leaves the machine.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimits } from "../../netlify/functions/_ratelimit.mjs";

type Meta = Record<string, string>;
type PI = { id: string; amount: number; metadata: Meta };
type Session = { id: string; url: string; metadata: Meta; payment_status: string; amount_total: number; payment_intent: string; created: number; customer_details?: { email?: string } };

const db = {
  sessions: new Map<string, Session>(), pis: new Map<string, PI>(), calls: [] as { what: string; params: unknown; opts: unknown }[], failNegation: false, refuseMethod: "",
  // Stripe's idempotency: the same key and body give the first answer again, another body an error, and a key still being written a 409.
  idem: new Map<string, { body: string; result?: PI; busy: boolean }>(),
  // Holds every keyed update open until released, to put a second request in the middle of the first.
  hold: null as null | Promise<void>,
  // The next n writes marking a card "sent" fail; the next n reads of a payment fail.
  failSent: 0, failRetrieve: 0,
  // The next keyed write is made, but its answer is lost (a timeout after Stripe wrote it).
  loseAnswer: false,
};

vi.mock("stripe", () => ({
  default: class FakeStripe {
    checkout = {
      sessions: {
        create: async (params: { metadata: Meta; payment_intent_data: { metadata: Meta }; line_items: { price_data: { unit_amount: number } }[] }, opts: unknown) => {
          db.calls.push({ what: "sessions.create", params, opts });
          const types = (params as { payment_method_types?: string[] }).payment_method_types || [];
          if (db.refuseMethod && types.includes(db.refuseMethod)) {
            throw Object.assign(new Error(`The payment method type provided: ${db.refuseMethod} is invalid. Please ensure the provided type is activated in your dashboard.`), { type: "StripeInvalidRequestError", param: "payment_method_types" });
          }
          const n = db.sessions.size + 1;
          const id = `cs_test_${"a".repeat(20)}${n}`;
          const pi = { id: `pi_${n}`, amount: params.line_items[0]!.price_data.unit_amount, metadata: { ...params.payment_intent_data.metadata } };
          db.pis.set(pi.id, pi);
          const s = { id, url: `https://checkout.stripe.com/c/${id}`, metadata: { ...params.metadata }, payment_status: "unpaid", amount_total: pi.amount, payment_intent: pi.id, created: Math.floor(Date.now() / 1000), customer_details: { email: "buyer@example.com" } };
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
      retrieve: async (id: string) => {
        if (db.failRetrieve > 0) { db.failRetrieve--; throw Object.assign(new Error("timeout"), { type: "StripeConnectionError" }); }
        return structuredClone(db.pis.get(id));
      },
      update: async (id: string, p: { metadata: Meta }, opts?: { idempotencyKey?: string }) => {
        const key = opts?.idempotencyKey;
        const body = JSON.stringify([id, p]);
        if (key) {
          const seen = db.idem.get(key);
          if (seen?.busy) throw Object.assign(new Error("There is currently another in-progress request using this Idempotent Key."), { statusCode: 409, code: "idempotency_key_in_use", type: "StripeInvalidRequestError" });
          if (seen && seen.body !== body) throw Object.assign(new Error("Keys for idempotent requests can only be used with the same parameters they were first used with."), { type: "StripeIdempotencyError", rawType: "idempotency_error" });
          if (seen) return structuredClone(seen.result!);
          db.idem.set(key, { body, busy: true });
          if (db.hold) await db.hold;
        }
        if (p.metadata.gift_deliver === "sent" && db.failSent > 0) { db.failSent--; throw Object.assign(new Error("timeout"), { type: "StripeConnectionError" }); }
        db.calls.push({ what: "pi.update", params: p, opts });
        const pi = db.pis.get(id)!;
        Object.assign(pi.metadata, p.metadata);
        if (key) db.idem.set(key, { body, result: structuredClone(pi), busy: false });
        if (key && db.loseAnswer) { db.loseAnswer = false; throw Object.assign(new Error("timeout"), { type: "StripeConnectionError" }); }
        return structuredClone(pi);
      },
      search: async ({ query }: { query: string }) => {
        if (db.failNegation && query.includes("-metadata")) throw new Error("search refused");
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
const sender = await import("../../netlify/functions/gift-send.mjs");
const { giftOffer, GIFT_CARDS } = (await import(`../../netlify/functions/${"_pricing"}.mjs`)) as {
  giftOffer: (v: unknown, now: number, cfg?: unknown) => { ok: boolean; valueCents?: number; payCents?: number; percentOff?: number; error?: string };
  GIFT_CARDS: { mode: string; tiers: { value: number }[]; custom: { min: number; max: number }; sale: { percentOff: number; starts: string; ends: string }; checkout: { enabled: boolean; methods: string[] }; expiryYears: number; sendWindowHours: number; scheduleDays: number };
};

const SECRET = "s".repeat(40);
const ENV = { STRIPE_SECRET_KEY: "sk_test_fake", STRIPE_WEBHOOK_SECRET: "whsec_fake", GIFT_CODE_SECRET: SECRET, GIFT_ADMIN_KEY: "k".repeat(24), RESEND_API_KEY: "re_fake", OWNER_EMAIL: "owner@example.com", URL: "https://513autoclean.com", CONTEXT: "production" };
const IN_SALE = Date.parse("2026-12-01T17:00:00Z");
let mail: { to: string; subject: string }[] = [];
let mailOk = true;
const realFetch = globalThis.fetch;

beforeEach(() => {
  resetRateLimits();
  db.sessions.clear(); db.pis.clear(); db.calls.length = 0; db.failNegation = false; db.refuseMethod = "";
  db.idem.clear(); db.hold = null; db.failSent = 0; db.failRetrieve = 0; db.loseAnswer = false;
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
    expect(c.params.payment_method_types).toEqual(GIFT_CARDS.checkout.methods);
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
    // Elijah's email failing too: Stripe retries.
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
  const get = (s: string) => card.handler({ httpMethod: "POST", headers: {}, body: JSON.stringify({ s }) });
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
    expect(db.pis.get(s.payment_intent)!.metadata.gift_last_req).toBe("req_aaaaaaaa");
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

describe("validation pass 1 fixes", () => {
  const completed = (id: string) => ({ type: "checkout.session.completed", data: { object: { id } } });

  it("the certificate page records the card, so Elijah can find it even if the webhook never comes", async () => {
    const s = await paidSession();
    const r = await card.handler({ httpMethod: "POST", headers: {}, body: JSON.stringify({ s: s.id }) });
    expect(r.statusCode).toBe(200);
    const code = G.codeFor(s.id, SECRET);
    expect(db.pis.get(s.payment_intent)!.metadata.gift_code_hash).toBe(G.codeHash(code, SECRET));
    expect((await post(admin, { key: ENV.GIFT_ADMIN_KEY, action: "lookup", code })).statusCode).toBe(200);
    // No email from a page load: those stay the webhook's.
    expect(mail).toHaveLength(0);
    // And the webhook later still sends them, once.
    await hook(completed(s.id));
    await hook(completed(s.id));
    expect(mail.map((m) => m.to).sort()).toEqual(["buyer@example.com", "owner@example.com", "sam@example.com"]);
  });

  it("a card paid on its send day goes out now, not at tomorrow's run", async () => {
    const s = await paidSession({ sendOn: "2026-12-02" });
    vi.setSystemTime(Date.parse("2026-12-02T20:00:00Z"));
    await hook(completed(s.id));
    expect(db.pis.get(s.payment_intent)!.metadata.gift_deliver).toBe("sent");
    expect(mail.some((m) => m.to === "sam@example.com")).toBe(true);
  });

  it("a scheduled email that keeps failing gives up after three tries", async () => {
    const s = await paidSession({ sendOn: "2026-12-24" });
    await hook(completed(s.id));
    const stripe = new (await import("stripe")).default("x") as never;
    const fail = async () => false;
    for (let i = 0; i < 3; i++) await deliver.deliverDue(stripe, SECRET, Date.parse("2026-12-24T15:00:00Z"), fail);
    expect(db.pis.get(s.payment_intent)!.metadata).toMatchObject({ gift_deliver: "failed", gift_deliver_tries: "3" });
    const again = await deliver.deliverDue(stripe, SECRET, Date.parse("2026-12-24T16:00:00Z"), fail);
    expect(again.failed).toBe(0);
  });

  it("a redeem retried after a lost answer changes nothing the second time", async () => {
    const s = await paidSession();
    await hook(completed(s.id));
    const code = G.codeFor(s.id, SECRET);
    const redeem = () => post(admin, { key: ENV.GIFT_ADMIN_KEY, action: "redeem", code, amountCents: 1000, requestId: "req_same_one" });
    await redeem();
    const r = JSON.parse((await redeem()).body);
    expect(r).toMatchObject({ repeated: true, card: { balanceCents: 4000 } });
  });

  it("resending to the person it's for counts as delivered", async () => {
    const s = await paidSession({ sendOn: "2026-12-24" });
    await hook(completed(s.id));
    await post(admin, { key: ENV.GIFT_ADMIN_KEY, action: "resend", to: "recipient", code: G.codeFor(s.id, SECRET), requestId: "req_resend_1" });
    expect(db.pis.get(s.payment_intent)!.metadata.gift_deliver).toBe("sent");
  });

  it("a dispute freezes the card; won, it works again; the same event twice is applied once", async () => {
    const s = await paidSession();
    await hook(completed(s.id));
    const ev = (type: string, id: string, extra = {}) => ({ id, type, data: { object: { payment_intent: s.payment_intent, ...extra } } });
    await hook(ev("charge.dispute.created", "evt_1"));
    expect(db.pis.get(s.payment_intent)!.metadata.gift_status).toBe("disputed");
    const before = mail.length;
    await hook(ev("charge.dispute.created", "evt_1"));
    expect(mail.length).toBe(before);
    await hook(ev("charge.dispute.closed", "evt_2", { status: "won" }));
    expect(db.pis.get(s.payment_intent)!.metadata.gift_status).toBe("active");
    await hook(ev("charge.dispute.closed", "evt_3", { status: "lost" }));
    expect(db.pis.get(s.payment_intent)!.metadata).toMatchObject({ gift_status: "void", gift_balance_cents: "0" });
  });

  it("links name the live domain on the live site, and a Deploy Preview's own address there", () => {
    expect(G.siteUrl({ URL: "https://513autoclean.com", DEPLOY_PRIME_URL: "https://main--513-auto-clean.netlify.app" })).toBe("https://513autoclean.com");
    expect(G.siteUrl({ URL: "https://513autoclean.com", DEPLOY_PRIME_URL: "https://deploy-preview-13--513-auto-clean.netlify.app" })).toBe("https://deploy-preview-13--513-auto-clean.netlify.app");
  });

  it("names can't carry hidden direction marks into an email", async () => {
    await buy({ from: { name: "Al‮ex" } });
    expect([...db.sessions.values()].at(-1)!.metadata.gift_from_name).toBe("Alex");
  });

  it("the checkout page expires within the hour, and asks for no bot check", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "x".repeat(30));
    expect((await buy()).statusCode).toBe(200);
    const c = db.calls[0]! as { params: { expires_at: number } };
    expect(c.params.expires_at - Math.floor(IN_SALE / 1000)).toBe(3600);
  });

  it("rebuilds only on the sale's first day and the day after it ends", async () => {
    const { rebuildDue } = await import("../../netlify/functions/gift-rebuild.mjs");
    const cfg = { mode: "sale", sale: { percentOff: 20, starts: "2026-11-27", ends: "2026-12-25" } };
    expect(rebuildDue(cfg, Date.parse("2026-11-27T05:15:00Z"))).toBe(true);
    expect(rebuildDue(cfg, Date.parse("2026-12-26T05:15:00Z"))).toBe(true);
    expect(rebuildDue(cfg, Date.parse("2026-12-25T05:15:00Z"))).toBe(false);
    expect(rebuildDue({ ...cfg, mode: "regular" }, Date.parse("2026-11-27T05:15:00Z"))).toBe(false);
  });
});

describe("validation pass 2 fixes", () => {
  const completed = (id: string) => ({ type: "checkout.session.completed", data: { object: { id } } });
  // Exactly what js/giftcards.js sends when every box in the form is left empty.
  const emptyForm = { value: 50, to: { name: "", email: "" }, from: { name: "" }, message: "", sendOn: "", requestKey: "gc_emptyform1" };

  it("a purchase on a Deploy Preview comes back there and its emails link there; no other host can steer it (November 26)", async () => {
    const PREV = "deploy-preview-13--513-auto-clean.netlify.app";
    expect(G.siteUrl(ENV, PREV)).toBe(`https://${PREV}`);
    expect(G.siteUrl(ENV, "evil.example")).toBe("https://513autoclean.com");
    expect(G.siteUrl(ENV, "deploy-preview-13--other-site.netlify.app")).toBe("https://513autoclean.com");
    expect(G.siteUrl(ENV, "513autoclean.com")).toBe("https://513autoclean.com");
    const html: string[] = [];
    globalThis.fetch = (async (_u: string, init?: { body?: string }) => { html.push(JSON.parse(String(init?.body)).html); return new Response("{}", { status: 200 }); }) as typeof fetch;
    expect((await post(checkout, emptyForm, { host: PREV })).statusCode).toBe(200);
    const c = db.calls[0] as { params: { success_url: string; cancel_url: string } };
    expect(c.params.success_url).toBe(`https://${PREV}/gift-certificate#s={CHECKOUT_SESSION_ID}&new=1`);
    expect(c.params.cancel_url).toBe(`https://${PREV}/gift-cards`);
    const s = [...db.sessions.values()].at(-1)!;
    s.payment_status = "paid";
    expect((await post(webhook, completed(s.id), { "stripe-signature": "good", host: PREV })).statusCode).toBe(200);
    expect(html.length).toBeGreaterThan(0);
    for (const h of html) expect(h).not.toContain("https://513autoclean.com/gift-certificate");
    expect(html.some((h) => h.includes(`https://${PREV}/gift-certificate#s=`))).toBe(true);
  });

  it("a buyer who fills in nothing still gets a working card, emailed to them (Emmett, November 26)", async () => {
    expect((await post(checkout, emptyForm)).statusCode).toBe(200);
    const s = [...db.sessions.values()].at(-1)!;
    s.payment_status = "paid";
    expect((await hook(completed(s.id))).statusCode).toBe(200);
    const pi = db.pis.get(s.payment_intent)!;
    expect(pi.metadata).toMatchObject({ gift_status: "active", gift_balance_cents: "5000", gift_to_email: "", gift_to_name: "", gift_from_name: "", gift_message: "", gift_mail_buyer: "1", gift_mail_owner: "1" });
    expect(mail.map((m) => m.to).sort()).toEqual(["buyer@example.com", "owner@example.com"]);
    const page = JSON.parse((await card.handler({ httpMethod: "POST", headers: {}, body: JSON.stringify({ s: s.id }) })).body);
    expect(page).toMatchObject({ balanceCents: 5000 });
  });

  it("a dispute closed as a warning keeps the card; only a lost one cancels it", async () => {
    const s = await paidSession();
    await hook(completed(s.id));
    const ev = (type: string, id: string, extra = {}) => ({ id, type, data: { object: { payment_intent: s.payment_intent, ...extra } } });
    await hook(ev("charge.dispute.created", "evt_a"));
    await hook(ev("charge.dispute.closed", "evt_b", { status: "warning_closed" }));
    expect(db.pis.get(s.payment_intent)!.metadata).toMatchObject({ gift_status: "active", gift_balance_cents: "5000" });
  });

  it("a recipient address the mail service refuses goes to the hourly run, not to days of Stripe retries", async () => {
    const s = await paidSession();
    const realOk = () => true;
    globalThis.fetch = (async (url: string, init?: { body?: string }) => {
      const b = JSON.parse(String(init?.body));
      mail.push({ to: b.to[0], subject: b.subject });
      return new Response("{}", { status: b.to[0] === "sam@example.com" ? 422 : realOk() ? 200 : 500 });
    }) as typeof fetch;
    expect((await hook(completed(s.id))).statusCode).toBe(200);
    expect(db.pis.get(s.payment_intent)!.metadata).toMatchObject({ gift_deliver: "pending", gift_send_on: "2026-12-01", gift_mail_owner: "1" });
  });

  it("a send-now card that the webhook never emailed is picked up by the hourly run", async () => {
    const s = await paidSession();
    // Only the certificate page ran (ensureIssued): recorded, never emailed.
    await card.handler({ httpMethod: "POST", headers: {}, body: JSON.stringify({ s: s.id }) });
    const pi = db.pis.get(s.payment_intent)! as PI & { created?: number };
    expect(pi.metadata.gift_deliver).toBe("now");
    pi.created = Math.floor(IN_SALE / 1000) - 3600;
    const sent: string[] = [];
    const out = await deliver.deliverDue(new (await import("stripe")).default("x") as never, SECRET, IN_SALE, async (to: string) => { sent.push(to); return true; });
    expect(out.sent).toBe(1);
    expect(sent).toEqual(["sam@example.com"]);
    expect(pi.metadata.gift_deliver).toBe("sent");
  });

  it("a disputed scheduled card waits rather than being cancelled", async () => {
    const s = await paidSession({ sendOn: "2026-12-24" });
    await hook(completed(s.id));
    await hook({ id: "evt_d", type: "charge.dispute.created", data: { object: { payment_intent: s.payment_intent } } });
    const out = await deliver.deliverDue(new (await import("stripe")).default("x") as never, SECRET, Date.parse("2026-12-24T15:00:00Z"), async () => true);
    expect(out).toMatchObject({ sent: 0, waiting: 1 });
    expect(db.pis.get(s.payment_intent)!.metadata.gift_deliver).toBe("pending");
  });

  it("a card paid on its send day: the buyer's email doesn't promise it for later", async () => {
    const subjects: string[] = [];
    const bodies: string[] = [];
    globalThis.fetch = (async (_u: string, init?: { body?: string }) => {
      const b = JSON.parse(String(init?.body)); subjects.push(b.subject); bodies.push(b.html); mail.push({ to: b.to[0], subject: b.subject });
      return new Response("{}", { status: 200 });
    }) as typeof fetch;
    const s = await paidSession({ sendOn: "2026-12-02" });
    vi.setSystemTime(Date.parse("2026-12-02T20:00:00Z"));
    await hook(completed(s.id));
    const buyerHtml = bodies[subjects.findIndex((x) => x.startsWith("Your "))]!;
    expect(buyerHtml).not.toContain("on Wednesday");
    expect(buyerHtml).toContain("emailed it to Sam");
  });
});

describe("validation pass 3 fixes", () => {
  const completed = (id: string) => ({ type: "checkout.session.completed", data: { object: { id } } });

  it("a lost card is found by its Stripe payment id", async () => {
    const s = await paidSession();
    await hook(completed(s.id));
    // Stripe's ids are pi_ and 8 or more characters; the stand-in's are short, so copy it under a real-looking id.
    const { findCard } = admin as unknown as { findCard: (st: unknown, c: string, sec: string) => Promise<{ pi?: PI; error?: string }> };
    db.pis.set("pi_abcdefgh123", { ...db.pis.get(s.payment_intent)!, id: "pi_abcdefgh123" });
    const hit = await findCard(new (await import("stripe")).default("x"), "pi_abcdefgh123", SECRET);
    expect(hit.pi?.metadata.gift_status).toBe("active");
    expect((await findCard(new (await import("stripe")).default("x"), "pi_nothere0000", SECRET)).error).toBe("not_found");
  });

  it("a card refunded before it was ever issued stays cancelled and sends no code", async () => {
    const s = await paidSession();
    await hook({ id: "evt_r", type: "charge.refunded", data: { object: { payment_intent: s.payment_intent, amount: 4000, amount_refunded: 4000 } } });
    mail = [];
    await hook(completed(s.id));
    expect(db.pis.get(s.payment_intent)!.metadata).toMatchObject({ gift_status: "void", gift_balance_cents: "0" });
    expect(mail).toHaveLength(0);
  });

  it("the buyer's email says where the card went, with the address", async () => {
    const bodies: { to: string; html: string }[] = [];
    globalThis.fetch = (async (_u: string, init?: { body?: string }) => {
      const b = JSON.parse(String(init?.body)); bodies.push({ to: b.to[0], html: b.html });
      return new Response("{}", { status: b.to[0] === "sam@example.com" ? 422 : 200 });
    }) as typeof fetch;
    const s = await paidSession();
    await hook(completed(s.id));
    const order = bodies.map((b) => b.to);
    expect(order.indexOf("sam@example.com")).toBeLessThan(order.indexOf("buyer@example.com"));
    const buyerHtml = bodies.find((b) => b.to === "buyer@example.com")!.html;
    expect(buyerHtml).toContain("(sam@example.com)");
    expect(buyerHtml).not.toContain("emailed it to");
  });

  it("a rate-limited email waits and tries again, and Resend being busy doesn't count against the card", async () => {
    const { sendMail } = await import("../../netlify/functions/_giftmail.mjs");
    let n = 0;
    globalThis.fetch = (async () => new Response("{}", { status: ++n === 1 ? 429 : 200 })) as typeof fetch;
    expect(await sendMail("k", "f", "to@example.com", { subject: "s", html: "h" })).toBe("ok");
    globalThis.fetch = (async () => new Response("{}", { status: 503 })) as typeof fetch;
    expect(await sendMail("k", "f", "to@example.com", { subject: "s", html: "h" })).toBe("busy");
    globalThis.fetch = (async () => new Response("{}", { status: 422 })) as typeof fetch;
    expect(await sendMail("k", "f", "to@example.com", { subject: "s", html: "h" })).toBe("refused");

    const s = await paidSession({ sendOn: "2026-12-24" });
    globalThis.fetch = (async () => new Response("{}", { status: 200 })) as typeof fetch;
    await hook(completed(s.id));
    const out = await deliver.deliverDue(new (await import("stripe")).default("x") as never, SECRET, Date.parse("2026-12-24T15:00:00Z"), async () => "busy");
    expect(out).toMatchObject({ busy: 1, failed: 0 });
    expect(db.pis.get(s.payment_intent)!.metadata.gift_deliver_tries).toBeUndefined();
  }, 15_000);
});

describe("pre-merge fixes", () => {
  it("a card the webhook never handled gets its emails from the hourly run, and Elijah is told to check the webhook", async () => {
    const bodies: { to: string; html: string }[] = [];
    globalThis.fetch = (async (_u: string, init?: { body?: string }) => {
      const b = JSON.parse(String(init?.body)); bodies.push({ to: b.to[0], html: b.html });
      return new Response("{}", { status: 200 });
    }) as typeof fetch;
    const s = await paidSession();
    await card.handler({ httpMethod: "POST", headers: {}, body: JSON.stringify({ s: s.id }) });
    (db.pis.get(s.payment_intent) as PI & { created?: number }).created = Math.floor(IN_SALE / 1000) - 3600;
    const stripe = new (await import("stripe")).default("x") as never;
    expect(await deliver.catchUp(stripe, SECRET, IN_SALE)).toBe(1);
    expect(bodies.map((b) => b.to).sort()).toEqual(["buyer@example.com", "owner@example.com", "sam@example.com"]);
    expect(bodies.find((b) => b.to === "owner@example.com")!.html).toContain("STRIPE_WEBHOOK_SECRET");
    // Once only.
    expect(await deliver.catchUp(stripe, SECRET, IN_SALE)).toBe(0);
  });

  it("a double tap a second later still opens one checkout", async () => {
    await buy();
    vi.setSystemTime(IN_SALE + 1500);
    await buy();
    const keys = db.calls.filter((c) => c.what === "sessions.create").map((c) => (c.opts as { idempotencyKey: string }).idempotencyKey);
    expect(keys[0]).toBe(keys[1]);
  });
});

describe("final pre-merge fixes", () => {
  it("a catch-up search that fails doesn't stop the scheduled sends", async () => {
    const s = await paidSession({ sendOn: "2026-12-24" });
    await hook({ type: "checkout.session.completed", data: { object: { id: s.id } } });
    vi.setSystemTime(Date.parse("2026-12-24T15:00:00Z"));
    db.failNegation = true;
    mail = [];
    const r = await deliver.handler();
    expect(r.statusCode).toBe(200);
    expect(mail.map((m) => m.to)).toContain("sam@example.com");
    expect(db.pis.get(s.payment_intent)!.metadata.gift_deliver).toBe("sent");
  });

  it("Back then Continue within a few minutes is the same request to Stripe", async () => {
    await buy();
    vi.setSystemTime(IN_SALE + 60_000);
    await buy();
    const [a, b] = db.calls.filter((c) => c.what === "sessions.create") as { params: unknown; opts: { idempotencyKey: string } }[];
    expect(b!.params).toEqual(a!.params);
    expect(b!.opts.idempotencyKey).toBe(a!.opts.idempotencyKey);
  });
});

describe("Elijah's answers (November 23)", () => {
  const cfg = { ...GIFT_CARDS, mode: "sale", sale: { percentOff: 20, starts: "2026-11-27", ends: "2026-12-25" } };
  const act = (body: Record<string, unknown>) => post(admin, { key: ENV.GIFT_ADMIN_KEY, ...body });

  it("any amount to the cent in the custom range ($119.13), priced by the server", () => {
    expect(giftOffer(119.13, IN_SALE, cfg)).toMatchObject({ ok: true, valueCents: 11913, payCents: 9530 });
    expect(giftOffer(cfg.custom.max, IN_SALE, cfg)).toMatchObject({ ok: true });
    expect(giftOffer(cfg.custom.min, IN_SALE, cfg)).toMatchObject({ ok: true });
    for (const bad of [119.135, cfg.custom.min - 0.01, cfg.custom.max + 0.01, Number.NaN, Infinity]) expect(giftOffer(bad, IN_SALE, cfg), String(bad)).toMatchObject({ ok: false });
  });

  it("a card bought for $119.13 carries that value", async () => {
    await buy({ value: 119.13 });
    const c = db.calls[0]! as { params: { metadata: Meta } };
    expect(c.params.metadata.gift_value_cents).toBe("11913");
  });

  it("pays with the setting's methods (Amazon Pay added), and falls back to card and Link if Stripe refuses one", async () => {
    expect(GIFT_CARDS.checkout.methods).toEqual(["card", "link", "amazon_pay"]);
    db.refuseMethod = "amazon_pay";
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await buy();
    errors.mockRestore();
    expect(r.statusCode).toBe(200);
    const creates = db.calls.filter((c) => c.what === "sessions.create") as { params: { payment_method_types: string[] }; opts: { idempotencyKey: string } }[];
    expect(creates.map((c) => c.params.payment_method_types)).toEqual([["card", "link", "amazon_pay"], ["card", "link"]]);
    // Its own key: Stripe answers a reused key with different parameters with an error.
    expect(creates[1]!.opts.idempotencyKey).not.toBe(creates[0]!.opts.idempotencyKey);
  });

  it("a card is good for the setting's years from the day it's bought, and the admin page refuses it after", async () => {
    const s = await paidSession();
    await hook({ type: "checkout.session.completed", data: { object: { id: s.id } } });
    const meta = db.pis.get(s.payment_intent)!.metadata;
    expect(meta.gift_issued).toBe("2026-12-01");
    expect(meta.gift_expires).toBe(`${2026 + GIFT_CARDS.expiryYears}-12-01`);
    const code = G.codeFor(s.id, SECRET);
    // The certificate page says it.
    const page = JSON.parse((await card.handler({ httpMethod: "POST", headers: {}, body: JSON.stringify({ s: s.id }) })).body);
    expect(page).toMatchObject({ expires: meta.gift_expires, expired: false });
    // Its last day still works; the day after doesn't.
    vi.setSystemTime(Date.parse(`${meta.gift_expires}T17:00:00Z`));
    expect(JSON.parse((await act({ action: "redeem", code, amountCents: 100, requestId: "req_lastday1" })).body).card).toMatchObject({ balanceCents: 4900, expired: false });
    vi.setSystemTime(Date.parse(`${meta.gift_expires}T17:00:00Z`) + 86_400_000);
    const r = await act({ action: "redeem", code, amountCents: 100, requestId: "req_tooLate1" });
    expect(r.statusCode).toBe(409);
    expect(JSON.parse(r.body)).toMatchObject({ error: "expired", card: { expired: true, balanceCents: 4900 } });
  });

  it("February 29 lasts to March 1, never less than the years", async () => {
    const { expiresOn } = (await import(`../../netlify/functions/${"_pricing"}.mjs`)) as { expiresOn: (d: string, y: number) => string };
    expect(expiresOn("2028-02-29", 5)).toBe("2033-03-01");
    expect(expiresOn("2026-11-23", 5)).toBe("2031-11-23");
    expect(expiresOn("2032-02-29", 4)).toBe("2036-02-29");
  });

  it("the emails say how to use it (show it when you pay) and its date, never the booking form's notes box", async () => {
    const s = await paidSession();
    const bodies: string[] = [];
    globalThis.fetch = (async (url: string, init?: { body?: string }) => {
      if (String(url) === "https://api.resend.com/emails") { bodies.push(JSON.parse(String(init?.body)).html); return new Response("{}", { status: 200 }); }
      throw new Error("unexpected fetch " + url);
    }) as typeof fetch;
    await hook({ type: "checkout.session.completed", data: { object: { id: s.id } } });
    const forPeople = bodies.filter((h) => h.includes("To use it"));
    expect(forPeople.length).toBeGreaterThanOrEqual(2);
    for (const h of forPeople) {
      expect(h).toContain("show the card when you pay");
      expect(h).toContain(`Good through December 1, ${2026 + GIFT_CARDS.expiryYears}`);
      expect(h).not.toContain("Anything else");
      expect(h).not.toMatch(/never expires/i);
    }
  });
});

describe("gift-send: sending the card after paying (one-click buying, November 26)", () => {
  const completed = (id: string) => ({ type: "checkout.session.completed", data: { object: { id } } });
  // What js/giftcards.js sends now: the value and a key, nothing about who it's for.
  const oneClick = async () => {
    expect((await post(checkout, { value: 50, requestKey: "gc_oneclick01" })).statusCode).toBe(200);
    const s = [...db.sessions.values()].at(-1)!;
    s.payment_status = "paid";
    return s;
  };
  const sendIt = (s: string, extra: Record<string, unknown> = {}, headers: Record<string, string> = {}) =>
    post(sender, { s, to: { name: "Sam", email: "Sam@Example.com" }, from: { name: "Alex" }, message: "Enjoy", sendOn: "", requestKey: "gs_request0001", ...extra }, headers);
  const bodies: { to: string; subject: string; html: string }[] = [];
  beforeEach(() => {
    bodies.length = 0;
    globalThis.fetch = (async (url: string, init?: { body?: string }) => {
      if (String(url) !== "https://api.resend.com/emails") throw new Error("unexpected fetch " + url);
      const b = JSON.parse(String(init?.body));
      bodies.push({ to: b.to[0], subject: b.subject, html: b.html });
      mail.push({ to: b.to[0], subject: b.subject });
      return new Response("{}", { status: mailOk ? 200 : 500 });
    }) as typeof fetch;
  });

  it("a one-click card is issued with no one to send it to, and the buyer's email says it can be sent from its page", async () => {
    const s = await oneClick();
    expect((await hook(completed(s.id))).statusCode).toBe(200);
    expect(db.pis.get(s.payment_intent)!.metadata).toMatchObject({ gift_deliver: "none", gift_to_email: "" });
    const buyer = bodies.find((b) => b.to === "buyer@example.com")!.html;
    expect(buyer).toContain("Send it to someone");
    expect(buyer).toContain(`https://513autoclean.com/gift-certificate#s=${s.id}`);
    expect(bodies.find((b) => b.to === "owner@example.com")!.html).toContain("Not sent to anyone yet");
    // The page offers it.
    const page = JSON.parse((await card.handler({ httpMethod: "POST", headers: {}, body: JSON.stringify({ s: s.id }) })).body);
    expect(page.canSend).toBe(true);
  });

  it("sends now: writes who it's for on the payment, emails them once, and the page stops offering it", async () => {
    const s = await oneClick();
    await hook(completed(s.id));
    mail = []; bodies.length = 0;
    const r = await sendIt(s.id);
    expect(r.statusCode).toBe(200);
    expect(JSON.parse(r.body)).toEqual({ ok: true, to: "sam@example.com", sendOn: "" });
    expect(db.pis.get(s.payment_intent)!.metadata).toMatchObject({ gift_to_name: "Sam", gift_to_email: "sam@example.com", gift_from_name: "Alex", gift_message: "Enjoy", gift_deliver: "sent", gift_mail_to: "1", gift_send_req: "gs_request0001" });
    expect(db.pis.get(s.payment_intent)!.metadata.gift_log).toContain("emailed to them");
    expect(mail.map((m) => m.to)).toEqual(["sam@example.com"]);
    expect(bodies[0]!.subject).toBe("Alex sent you a $50 gift card from 513 Auto Clean");
    expect(bodies[0]!.html).toContain(G.codeFor(s.id, SECRET));
    const page = JSON.parse((await card.handler({ httpMethod: "POST", headers: {}, body: JSON.stringify({ s: s.id }) })).body);
    expect(page).toMatchObject({ canSend: false, toName: "Sam" });
    // Nothing more goes out: not the webhook again, not the hourly run.
    await hook(completed(s.id));
    const pi = db.pis.get(s.payment_intent)! as PI & { created?: number };
    pi.created = Math.floor(IN_SALE / 1000) - 3600;
    const out = await deliver.deliverDue(new (await import("stripe")).default("x") as never, SECRET, IN_SALE + 3_600_000, async () => true);
    expect(out.sent).toBe(0);
    expect(mail.map((m) => m.to)).toEqual(["sam@example.com"]);
  });

  it("works before the webhook has run, and the webhook then emails the buyer and Elijah without sending it twice", async () => {
    const s = await oneClick();
    expect((await sendIt(s.id)).statusCode).toBe(200);
    await hook(completed(s.id));
    expect(mail.map((m) => m.to).sort()).toEqual(["buyer@example.com", "owner@example.com", "sam@example.com"]);
    expect(bodies.find((b) => b.to === "buyer@example.com")!.html).toContain("emailed it to Sam");
  });

  it("schedules for a date: nothing now, and the hourly run sends it on the day, once", async () => {
    const s = await oneClick();
    await hook(completed(s.id));
    mail = [];
    const r = await sendIt(s.id, { sendOn: "2026-12-24" });
    expect(JSON.parse(r.body)).toEqual({ ok: true, to: "sam@example.com", sendOn: "2026-12-24" });
    expect(db.pis.get(s.payment_intent)!.metadata).toMatchObject({ gift_deliver: "pending", gift_send_on: "2026-12-24" });
    expect(mail).toHaveLength(0);
    // The card's page says when, to the buyer and to Sam alike.
    const page = JSON.parse((await card.handler({ httpMethod: "POST", headers: {}, body: JSON.stringify({ s: s.id }) })).body);
    expect(page).toMatchObject({ sendOn: "2026-12-24", canSend: false });
    const stripe = new (await import("stripe")).default("x") as never;
    const sent: string[] = [];
    const send = async (to: string) => { sent.push(to); return true; };
    expect(await deliver.deliverDue(stripe, SECRET, Date.parse("2026-12-23T15:00:00Z"), send)).toMatchObject({ sent: 0, waiting: 1 });
    expect(await deliver.deliverDue(stripe, SECRET, Date.parse("2026-12-24T15:00:00Z"), send)).toMatchObject({ sent: 1 });
    expect(await deliver.deliverDue(stripe, SECRET, Date.parse("2026-12-24T16:00:00Z"), send)).toMatchObject({ sent: 0 });
    expect(sent).toEqual(["sam@example.com"]);
  });

  it("today's date is now, and a failed email goes to the hourly run instead", async () => {
    const s = await oneClick();
    mailOk = false;
    const r = JSON.parse((await sendIt(s.id, { sendOn: "2026-12-01" })).body);
    expect(r).toMatchObject({ ok: true, retrying: true, sendOn: "" });
    expect(db.pis.get(s.payment_intent)!.metadata).toMatchObject({ gift_deliver: "pending", gift_send_on: "2026-12-01" });
    expect(db.pis.get(s.payment_intent)!.metadata.gift_mail_to).toBeUndefined();
  });

  it("the same request twice changes nothing the second time", async () => {
    const s = await oneClick();
    await sendIt(s.id);
    const updates = db.calls.filter((c) => c.what === "pi.update").length;
    const r = JSON.parse((await sendIt(s.id)).body);
    expect(r).toMatchObject({ ok: true, repeated: true, to: "sam@example.com" });
    expect(db.calls.filter((c) => c.what === "pi.update").length).toBe(updates);
    expect(mail.filter((m) => m.to === "sam@example.com")).toHaveLength(1);
  });

  it("only once: a second send (another request, another address) is refused and changes nothing", async () => {
    const s = await oneClick();
    await sendIt(s.id);
    const before = { ...db.pis.get(s.payment_intent)!.metadata };
    const r = await sendIt(s.id, { to: { email: "someone-else@example.com" }, requestKey: "gs_request0002" });
    expect(r.statusCode).toBe(409);
    expect(JSON.parse(r.body)).toEqual({ error: "already_sent" });
    expect(db.pis.get(s.payment_intent)!.metadata).toEqual(before);
    expect(mail.some((m) => m.to === "someone-else@example.com")).toBe(false);
  });

  it("a card bought with someone already (the old form, or the API) can't be sent again", async () => {
    const s = await paidSession();
    await hook(completed(s.id));
    expect(JSON.parse((await sendIt(s.id, { requestKey: "gs_request0003" })).body)).toEqual({ error: "already_sent" });
    expect(JSON.parse((await card.handler({ httpMethod: "POST", headers: {}, body: JSON.stringify({ s: s.id }) })).body).canSend).toBe(false);
  });

  it("refuses an unpaid, void, disputed, expired or too-old card, and changes nothing", async () => {
    const unpaid = await oneClick();
    unpaid.payment_status = "unpaid";
    expect(JSON.parse((await sendIt(unpaid.id)).body)).toEqual({ error: "not_paid" });

    const check = async (set: (s: Session) => void, error: string) => {
      const s = await oneClick();
      await hook(completed(s.id));
      set(s);
      const before = { ...db.pis.get(s.payment_intent)!.metadata };
      mail = [];
      const r = await sendIt(s.id);
      expect(JSON.parse(r.body), error).toEqual({ error });
      expect(r.statusCode).toBe(409);
      expect(db.pis.get(s.payment_intent)!.metadata).toEqual(before);
      expect(mail).toHaveLength(0);
      expect(JSON.parse((await card.handler({ httpMethod: "POST", headers: {}, body: JSON.stringify({ s: s.id }) })).body).canSend).toBe(false);
    };
    await check((s) => { db.pis.get(s.payment_intent)!.metadata.gift_status = "void"; }, "not_active");
    await check((s) => { db.pis.get(s.payment_intent)!.metadata.gift_status = "disputed"; }, "not_active");
    await check((s) => { db.pis.get(s.payment_intent)!.metadata.gift_expires = "2026-11-30"; }, "expired");
    // Outside the setting's window after buying: a link forwarded later can't send it.
    await check((s) => { s.created = Math.floor(IN_SALE / 1000) - GIFT_CARDS.sendWindowHours * 3600 - 60; }, "too_late");
    // Just inside it still works.
    const s = await oneClick();
    s.created = Math.floor(IN_SALE / 1000) - GIFT_CARDS.sendWindowHours * 3600 + 60;
    expect((await sendIt(s.id)).statusCode).toBe(200);
  });

  it("checks what it's given: an email is required here, a real one, and a day inside the setting's range", async () => {
    const s = await oneClick();
    const err = async (x: Record<string, unknown>) => JSON.parse((await sendIt(s.id, x)).body).error;
    expect(await err({ to: { name: "Sam" } })).toBe("need_email");
    expect(await err({ to: { email: "" } })).toBe("need_email");
    expect(await err({ to: { email: "not-an-email" } })).toBe("bad_email");
    expect(await err({ sendOn: "2026-11-30" })).toBe("bad_date");
    expect(await err({ sendOn: "2026-13-01" })).toBe("bad_date");
    expect(await err({ sendOn: "2027-12-01" })).toBe("bad_date");
    expect(await err({ message: "x".repeat(301) })).toBe("bad_details");
    expect(await err({ requestKey: "x" })).toBe("bad_request");
    expect(await err({ s: "cs_test_nope_nope_nope" })).toBe("not_found");
    expect(await err({ s: "../etc" })).toBe("not_found");
    // None of those touched the card.
    expect(db.pis.get(s.payment_intent)!.metadata.gift_to_email).toBe("");
    expect(mail).toHaveLength(0);
  });

  it("takes no price or value from the browser, and never returns the buyer's email", async () => {
    const s = await oneClick();
    const r = await sendIt(s.id, { value: 500, valueCents: 50000, balanceCents: 1, price: 1 });
    expect(r.body).not.toContain("buyer@example.com");
    expect(db.pis.get(s.payment_intent)!.metadata).toMatchObject({ gift_value_cents: "5000", gift_balance_cents: "5000" });
    for (const body of [r.body, (await sendIt(s.id)).body, (await sendIt(s.id, { requestKey: "gs_request0009" })).body]) expect(body).not.toContain("buyer@example.com");
  });

  it("refuses while unconfigured, and is rate limited", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const s = await oneClick();
    expect((await sendIt(s.id)).statusCode).toBe(503);
    expect(JSON.parse((await card.handler({ httpMethod: "POST", headers: {}, body: JSON.stringify({ s: s.id }) })).body).canSend).toBe(false);
    vi.stubEnv("RESEND_API_KEY", "re_fake");
    let last = 0;
    for (let i = 0; i < 12; i++) last = (await sendIt(s.id, { requestKey: `gs_ratelimit${i}0` })).statusCode;
    expect(last).toBe(429);
  });

  it("links in its email use the Deploy Preview it was called from", async () => {
    const PREV = "deploy-preview-13--513-auto-clean.netlify.app";
    const s = await oneClick();
    expect((await sendIt(s.id, {}, { host: PREV })).statusCode).toBe(200);
    expect(bodies[0]!.html).toContain(`https://${PREV}/gift-certificate#s=${s.id}`);
    expect(bodies[0]!.html).not.toContain("https://513autoclean.com/gift-certificate");
  });

  it("the setting refuses a send window that isn't a sensible whole number of hours", async () => {
    const { giftCardProblems } = (await import(`../../netlify/functions/${"_pricing"}.mjs`)) as { giftCardProblems: (c: unknown) => string[] };
    expect(giftCardProblems(GIFT_CARDS)).toEqual([]);
    for (const bad of [0, 1.5, -3, 10_000, undefined]) expect(giftCardProblems({ ...GIFT_CARDS, sendWindowHours: bad }).join(), String(bad)).toMatch(/sendWindowHours/);
  });

  describe("the claim is once per card even under races (review, November 26)", () => {
    const tick = () => new Promise((r) => setTimeout(r, 0));
    // Hold Stripe's first keyed write open, so a second request lands while the first is mid-claim.
    const holdFirstClaim = async (first: Promise<{ statusCode: number; body: string }>) => {
      let release!: () => void;
      db.hold = new Promise<void>((r) => (release = r));
      for (let i = 0; i < 200 && ![...db.idem.values()].some((v) => v.busy); i++) await tick();
      expect([...db.idem.values()].some((v) => v.busy)).toBe(true);
      return () => { release(); db.hold = null; return first; };
    };
    const status = async (r: Promise<{ statusCode: number; body: string }>) => { const x = await r; return { code: x.statusCode, ...JSON.parse(x.body) }; };

    it("two different sends that both checked before either wrote: one email, the other already_sent", async () => {
      const s = await oneClick();
      await hook(completed(s.id));
      mail = [];
      const [a, b] = await Promise.all([status(sendIt(s.id)), status(sendIt(s.id, { to: { email: "other@example.com" }, requestKey: "gs_request0002" }))]);
      expect([a, b].filter((x) => x.ok)).toHaveLength(1);
      expect([a, b].filter((x) => x.error === "already_sent")).toHaveLength(1);
      expect(mail).toHaveLength(1);
      expect(db.pis.get(s.payment_intent)!.metadata.gift_to_email).toBe(mail[0]!.to);
    });

    it("a second send that arrives while the first is still writing is told to wait, then refused", async () => {
      const s = await oneClick();
      await hook(completed(s.id));
      mail = [];
      const first = sendIt(s.id);
      const release = await holdFirstClaim(first);
      expect(await status(sendIt(s.id, { to: { email: "other@example.com" }, requestKey: "gs_request0002" }))).toEqual({ code: 409, error: "busy" });
      expect((await release()).statusCode).toBe(200);
      expect(await status(sendIt(s.id, { to: { email: "other@example.com" }, requestKey: "gs_request0002" }))).toEqual({ code: 409, error: "already_sent" });
      expect(mail.map((m) => m.to)).toEqual(["sam@example.com"]);
    });

    it("the same request twice at once (a double tap): one email, and the twin says it's the same send", async () => {
      const s = await oneClick();
      await hook(completed(s.id));
      mail = [];
      // Mid-claim: the twin waits.
      const first = sendIt(s.id);
      const release = await holdFirstClaim(first);
      expect(await status(sendIt(s.id))).toEqual({ code: 409, error: "busy" });
      expect(JSON.parse((await release()).body)).toEqual({ ok: true, to: "sam@example.com", sendOn: "" });
      expect(JSON.parse((await sendIt(s.id)).body)).toEqual({ ok: true, to: "sam@example.com", sendOn: "", repeated: true });
      // Both past the check before either wrote: Stripe refuses the twin's claim, and it answers from the card.
      const t = await oneClick();
      await hook(completed(t.id));
      const both = await Promise.all([status(sendIt(t.id)), status(sendIt(t.id))]);
      expect(both.every((x) => x.ok && x.to === "sam@example.com")).toBe(true);
      expect(both.filter((x) => x.repeated)).toHaveLength(1);
      // One email per card.
      expect(mail.filter((m) => m.to === "sam@example.com")).toHaveLength(2);
    });

    it("a claim written but never sent (the answer lost): a retry says it's on its way, never Sent, and the hourly run sends it once after the hold", async () => {
      const s = await oneClick();
      await hook(completed(s.id));
      mail = [];
      db.loseAnswer = true;
      expect((await sendIt(s.id)).statusCode).toBe(502);
      const again = JSON.parse((await sendIt(s.id)).body);
      expect(again).toMatchObject({ ok: true, to: "sam@example.com", retrying: true, repeated: true });
      expect(again.hours).toBe("8 AM to 6 PM");
      expect(mail).toHaveLength(0);
      const stripe = new (await import("stripe")).default("x") as never;
      const sent: string[] = [];
      const send = async (to: string) => { sent.push(to); return true; };
      // Within the hold the hourly run leaves it to the page; after it, it sends, once.
      expect(await deliver.deliverDue(stripe, SECRET, IN_SALE + G.SEND_CLAIM_HOLD_MS - 60_000, send)).toMatchObject({ sent: 0, waiting: 1 });
      expect(await deliver.deliverDue(stripe, SECRET, IN_SALE + G.SEND_CLAIM_HOLD_MS + 60_000, send)).toMatchObject({ sent: 1 });
      expect(await deliver.deliverDue(stripe, SECRET, IN_SALE + G.SEND_CLAIM_HOLD_MS + 3_600_000, send)).toMatchObject({ sent: 0 });
      expect(sent).toEqual(["sam@example.com"]);
      expect(JSON.parse((await sendIt(s.id)).body)).toEqual({ ok: true, to: "sam@example.com", sendOn: "", repeated: true });
    });

    it("emailed but not marked sent: the mark is tried again, and if that fails too the webhook and the hourly run hold off", async () => {
      const s = await oneClick();
      await hook(completed(s.id));
      db.failSent = 1;
      expect(JSON.parse((await sendIt(s.id)).body)).toEqual({ ok: true, to: "sam@example.com", sendOn: "" });
      expect(db.pis.get(s.payment_intent)!.metadata).toMatchObject({ gift_deliver: "sent", gift_mail_to: "1" });

      const t = await oneClick();
      mail = [];
      db.failSent = 2;
      const errors = vi.spyOn(console, "error").mockImplementation(() => {});
      expect(JSON.parse((await sendIt(t.id, { requestKey: "gs_request0005" })).body)).toEqual({ ok: true, to: "sam@example.com", sendOn: "" });
      errors.mockRestore();
      expect(db.pis.get(t.payment_intent)!.metadata.gift_deliver).toBe("now");
      // The webhook arriving now, and the hourly run inside the hold, don't email it again.
      await hook(completed(t.id));
      const stripe = new (await import("stripe")).default("x") as never;
      expect(await deliver.deliverDue(stripe, SECRET, IN_SALE + 60_000, async () => true)).toMatchObject({ sent: 0 });
      expect(mail.filter((m) => m.to === "sam@example.com")).toHaveLength(1);
    });

    it("the buyer's email says the deadline as a Cincinnati time and date, from the purchase and the setting", async () => {
      const s = await oneClick();
      await hook(completed(s.id));
      const by = G.sendDeadline(s);
      expect(by).toBe(IN_SALE + GIFT_CARDS.sendWindowHours * 3_600_000);
      const { sendByWords } = await import("../../netlify/functions/_giftmail.mjs");
      const buyer = bodies.find((b) => b.to === "buyer@example.com")!.html;
      expect(buyer).toContain(`by ${sendByWords(by)}.`);
      // Bought at noon on December 1 in Cincinnati: with 72 hours, noon on Friday, December 4.
      expect(sendByWords(Date.parse("2026-12-04T17:00:00Z"))).toBe("12 PM on Friday, December 4");
      expect(sendByWords(Date.parse("2026-12-04T17:59:00Z"))).toBe("12 PM on Friday, December 4");
      expect(buyer).not.toMatch(/hours|within \d/);
    });

    it("the hourly run's hours in the page's words match netlify.toml's schedule", async () => {
      const fs = await import("node:fs");
      const toml = fs.readFileSync(new URL("../../netlify.toml", import.meta.url), "utf8");
      const [from, to] = deliver.RUN_HOURS_UTC;
      expect(toml).toMatch(new RegExp(`\\[functions\\."gift-deliver"\\]\\s*schedule = "0 ${from}-${to} \\* \\* \\*"`));
      expect(deliver.runHoursWords(Date.parse("2026-12-01T17:00:00Z"))).toBe("8 AM to 6 PM");
      expect(deliver.runHoursWords(Date.parse("2027-07-01T17:00:00Z"))).toBe("9 AM to 7 PM");
    });
  });
});
