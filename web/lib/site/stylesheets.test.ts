/**
 * Every brace in the stylesheets closes something.
 *
 * A stray "}" is not an error a browser reports: it swallows the rule after
 * it. An edit to the bottom-bar rules in book.css (November 10) cut a media
 * block at its last rule's brace instead of its own, the orphaned "}" ate
 * `.bk-wk-fine`, and the calendar's fine print fell back to body text.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
// @ts-expect-error: plain ESM build script, no types
import { root } from "../../scripts/chrome.mjs";

/** Lines with a "}" that closes nothing, and how many blocks never close. */
function braceProblems(css: string): { stray: number[]; unclosed: number } {
  // Comments and strings out, keeping their line breaks so line numbers hold.
  const clean = css
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "))
    .replace(/"[^"\n]*"|'[^'\n]*'/g, (c) => c.replace(/./g, " "));
  const stray: number[] = [];
  let depth = 0;
  let line = 1;
  for (const ch of clean) {
    if (ch === "\n") line++;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      if (depth === 0) stray.push(line);
      else depth--;
    }
  }
  return { stray, unclosed: depth };
}

describe("stylesheets", () => {
  for (const file of ["book.css", "styles.css"]) {
    it(`${file}: every brace closes something`, () => {
      const css = fs.readFileSync(path.join(root, file), "utf8");
      expect(braceProblems(css)).toEqual({ stray: [], unclosed: 0 });
    });
  }

  it("catches the stray brace that hid the fine print", () => {
    expect(braceProblems("@media (x) {\n  .a { b: c; }\n}\n}\n.d { e: f; }").stray).toEqual([4]);
  });
});
