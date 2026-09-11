import { describe, expect, it } from "vitest";
import {
  QUOTE_TTL_HOURS,
  QUOTE_VERSION,
  decodeQuote,
  encodeQuote,
  hoursRemaining,
  quoteUrl,
  type QuotePayload,
} from "./quoteLink.js";

const NOW = Date.UTC(2026, 8, 11, 12, 0, 0);
const secs = (ms: number) => Math.floor(ms / 1000);

const quote = (over: Partial<QuotePayload> = {}): QuotePayload => ({
  v: QUOTE_VERSION,
  ts: secs(NOW),
  vs: [{ z: "mid", i: "both", p: ["full-interior", "basic-exterior"], a: [["pet-hair", "std"]] }],
  ad: ["5385 Haft Rd", "Cincinnati", "OH", "45247"],
  ct: ["Dana Whitfield", "5135550147", "dana@example.com"],
  sl: NOW + 3 * 86_400_000,
  ...over,
});

describe("round trip", () => {
  it("survives encoding and decoding intact", () => {
    const q = quote();
    const back = decodeQuote(encodeQuote(q), NOW);
    expect(back.ok).toBe(true);
    expect(back.payload).toEqual(q);
  });

  it("keeps names with accents and punctuation", () => {
    const q = quote({ ct: ["Renée O'Connor-Smith", "5135550147", "r@example.com"] });
    expect(decodeQuote(encodeQuote(q), NOW).payload!.ct).toEqual(q.ct);
  });

  it("produces a URL-safe string with no padding", () => {
    const encoded = encodeQuote(quote());
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("stays short enough to put in a text message", () => {
    // A realistic quote with two vehicles, notes and everything filled in.
    const big = quote({
      vs: [
        { z: "lg", i: "both", p: ["full-interior", "full-exterior"], a: [["pet-hair", "std"], ["ozone", "std"]], l: "Blue F-150" },
        { z: "mid", i: "interior", p: ["basic-interior"], a: [], l: "Grey Civic" },
      ],
      nt: "Pet hair in the back, park on the street please",
      pc: "LIKENEW",
    });
    expect(quoteUrl(big).length).toBeLessThan(700);
  });

  it("builds a fragment link, so nothing reaches a server log", () => {
    const url = quoteUrl(quote());
    expect(url).toContain("#q=");
    expect(url.split("#")[0]).not.toContain("Dana");
  });
});

describe("expiry", () => {
  it("is good for 24 hours", () => {
    const q = quote();
    expect(decodeQuote(encodeQuote(q), NOW + 23 * 3_600_000).ok).toBe(true);
    expect(hoursRemaining(q, NOW + 23 * 3_600_000)).toBeCloseTo(1, 5);
  });

  it("refuses one that is a day old, and says why", () => {
    const back = decodeQuote(encodeQuote(quote()), NOW + 25 * 3_600_000);
    expect(back.ok).toBe(false);
    expect(back.reason).toMatch(/expired/i);
    expect(back.reason).toMatch(/ask us for a fresh one/i);
  });

  it("tolerates a device clock a little fast", () => {
    // An hour of skew is a phone, not an attack.
    expect(decodeQuote(encodeQuote(quote()), NOW - 3_600_000).ok).toBe(true);
  });

  it("refuses a clock that is wildly ahead", () => {
    expect(decodeQuote(encodeQuote(quote()), NOW - 10 * 3_600_000).ok).toBe(false);
  });

  it("reports the window it enforces", () => {
    expect(QUOTE_TTL_HOURS).toBe(24);
  });
});

describe("refusing what it cannot trust", () => {
  it("refuses an empty or damaged link without throwing", () => {
    for (const bad of ["", "!!!!", "notbase64", "YWJj"]) {
      const r = decodeQuote(bad, NOW);
      expect(r.ok, bad).toBe(false);
      expect(typeof r.reason).toBe("string");
    }
  });

  it("refuses a payload from a different version", () => {
    const r = decodeQuote(encodeQuote(quote({ v: 99 })), NOW);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/older version/i);
  });

  it("refuses a payload with no vehicles array", () => {
    const broken = encodeQuote({ v: QUOTE_VERSION, ts: secs(NOW) } as QuotePayload);
    expect(decodeQuote(broken, NOW).ok).toBe(false);
  });

  it("carries no prices at all, so a link cannot be edited into a cheap detail", () => {
    // Everything is recomputed from the catalog on open and again on the
    // server before charging. The link names things; it never values them.
    const json = JSON.stringify(decodeQuote(encodeQuote(quote()), NOW).payload);
    expect(json).not.toMatch(/cents|price|total|amount|discount|fee/i);
    // The only numbers in a quote are a timestamp, a slot and a phone number.
    const p = decodeQuote(encodeQuote(quote()), NOW).payload!;
    expect(Object.keys(p).sort()).toEqual(["ad", "ct", "sl", "ts", "v", "vs"]);
  });
});
