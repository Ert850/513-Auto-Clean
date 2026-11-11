/**
 * The printed QR codes keep working (owner, November 11, 2026).
 *
 * The golf booklet and Prestige Living carry QR codes for
 * 513autoclean.com/golf and /prestige, in print for about a year. A printed
 * code can never be changed, so these two addresses must always lead
 * somewhere: through a redirect in netlify.toml, or a page of the same name.
 * The redirect must stay a 302 so where it leads can still change: a browser
 * keeps a 301 for good. The files in marketing/qr must match what was sent.
 */
import { describe, expect, it } from "vitest";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
// @ts-expect-error: plain ESM build script, no types
import { root } from "../../scripts/chrome.mjs";

const PRINTED = ["golf", "prestige"];
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");

/** The [[redirects]] blocks of netlify.toml, as from, to and status. */
function redirects(): { from: string; to: string; status: number }[] {
  return read("netlify.toml")
    .split(/^\[\[redirects\]\]\s*$/m)
    .slice(1)
    .map((block) => ({
      from: /^\s*from\s*=\s*"([^"]+)"/m.exec(block)?.[1] ?? "",
      to: /^\s*to\s*=\s*"([^"]+)"/m.exec(block)?.[1] ?? "",
      status: Number(/^\s*status\s*=\s*(\d+)/m.exec(block)?.[1] ?? 301),
    }));
}

describe("printed QR codes", () => {
  for (const name of PRINTED) {
    it(`/${name} is still served`, () => {
      const page = fs.existsSync(path.join(root, `${name}.html`));
      const rule = redirects().find((r) => r.from === `/${name}`);
      expect(page || !!rule, `/${name} is printed on a QR code and must lead somewhere`).toBe(true);
      if (rule && !page) {
        expect(rule.status, "302, so where it leads can still change").toBe(302);
        expect(rule.to.startsWith("/")).toBe(true);
      }
    });
  }

  it("the generator encodes exactly the printed addresses", () => {
    const urls = [...read("marketing/qr/make_qr.py").matchAll(/"(https:\/\/[^"]+)"/g)].map((m) => m[1]);
    expect(urls).toEqual(PRINTED.map((n) => `https://513autoclean.com/${n}`));
  });

  it("the files match the checksums recorded when they were sent", () => {
    const readme = read("marketing/qr/README.md");
    const rows = [...readme.matchAll(/^\| `([^`]+)` \| `([0-9a-f]{64})` \|/gm)];
    expect(rows.length).toBeGreaterThanOrEqual(PRINTED.length * 5);
    for (const [, file, sum] of rows) {
      const got = crypto.createHash("sha256").update(fs.readFileSync(path.join(root, "marketing/qr", file!))).digest("hex");
      expect(got, file).toBe(sum);
    }
  });
});
