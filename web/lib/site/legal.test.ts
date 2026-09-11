/**
 * The legal pages cannot change without their version changing.
 *
 * terms.test.ts checks the terms agree with the rules. This checks that
 * whenever the WORDING of either page moves, somebody bumped the date in
 * lib/site/legal.ts, because that date is what the funnel records against
 * every booking as "the terms you agreed to".
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LEGAL } from "./legal.js";
import { legalFingerprint } from "./legalFingerprint.js";

const root = path.resolve(__dirname, "../../..");
const read = (f: string) => fs.readFileSync(path.join(root, f), "utf8");
const lock = JSON.parse(read("web/legal.lock.json")) as {
  terms: { version: string; fingerprint: string };
  privacy: { version: string; fingerprint: string };
};

const advice = (page: string) =>
  `${page} wording changed. If that was deliberate, bump the date in web/lib/site/legal.ts and run \`npm run lock:legal\`.`;

describe("legal page versions", () => {
  it("dates are ISO and not in the future", () => {
    for (const d of [LEGAL.termsEffective, LEGAL.privacyEffective]) {
      expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Date.parse(d)).toBeLessThanOrEqual(Date.now() + 86_400_000);
    }
  });

  it("terms.html carries its version and matches the lock", () => {
    const html = read("terms.html");
    expect(html).toContain(`Version ${LEGAL.termsEffective}`);
    const fp = legalFingerprint(html);
    if (fp !== lock.terms.fingerprint) {
      expect(LEGAL.termsEffective, advice("terms.html")).not.toBe(lock.terms.version);
    }
  });

  it("privacy.html carries its version and matches the lock", () => {
    const html = read("privacy.html");
    expect(html).toContain(`Version ${LEGAL.privacyEffective}`);
    const fp = legalFingerprint(html);
    if (fp !== lock.privacy.fingerprint) {
      expect(LEGAL.privacyEffective, advice("privacy.html")).not.toBe(lock.privacy.version);
    }
  });

  it("the fingerprint ignores markup, whitespace and the date line", () => {
    const a = legalFingerprint("<p>Hello   <b>world</b></p><p class=\"eff\">Effective September 11, 2026 &middot; Version 2026-09-11</p>");
    const b = legalFingerprint("<div>Hello world</div> <p>Effective January 1, 2027 · Version 2027-01-01</p>");
    expect(a).toBe(b);
    expect(legalFingerprint("<p>Hello there world</p>")).not.toBe(a);
  });
});
