/** The private test site's password gate (netlify/edge-functions/test-gate.js). */
import { describe, expect, it } from "vitest";
// @ts-expect-error plain ESM edge function
import gate, { allowed, sameText } from "../../../netlify/edge-functions/test-gate.js";

const basic = (user: string, pass: string) => "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
const withEnv = (value: string | undefined, fn: () => Promise<void>) => async () => {
  (globalThis as any).Netlify = { env: { get: (k: string) => (k === "TEST_SITE_PASSWORD" ? value : undefined) } };
  try { await fn(); } finally { delete (globalThis as any).Netlify; }
};
const next = { next: async () => new Response("the page", { status: 200, headers: { "Content-Type": "text/html" } }) };

describe("test site gate", () => {
  it("checks the password, whatever the user name", () => {
    expect(allowed(basic("anyone", "s3cret"), "s3cret")).toBe(true);
    expect(allowed(basic("anyone", "wrong"), "s3cret")).toBe(false);
    expect(allowed("", "s3cret")).toBe(false);
    expect(allowed("Bearer abc", "s3cret")).toBe(false);
    expect(allowed("Basic !!!not-base64", "s3cret")).toBe(false);
    expect(sameText("abc", "abc")).toBe(true);
    expect(sameText("abc", "abcd")).toBe(false);
  });
  it("on the live site (no password set) it does nothing at all", withEnv(undefined, async () => {
    expect(await gate(new Request("https://513autoclean.com/"), next)).toBeUndefined();
  }));
  it("on the test site it refuses without the password, and marks every page noindex", withEnv("s3cret", async () => {
    const no = await gate(new Request("https://test.example/"), next);
    expect(no.status).toBe(401);
    expect(no.headers.get("WWW-Authenticate")).toContain("Basic");
    expect(no.headers.get("X-Robots-Tag")).toContain("noindex");
    const yes = await gate(new Request("https://test.example/", { headers: { authorization: basic("x", "s3cret") } }), next);
    expect(yes.status).toBe(200);
    expect(await yes.text()).toBe("the page");
    expect(yes.headers.get("X-Robots-Tag")).toContain("noindex");
  }));
});
