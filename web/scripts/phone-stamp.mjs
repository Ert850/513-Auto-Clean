/**
 * The published phone number (A2P plan T1, November 12, 2026).
 *
 * Every page, script and legal text in the repo is written with today's
 * number (config/business.json). When the Netlify variable BUSINESS_PHONE is
 * set, build-dist swaps it into dist/ as the last step, in whatever format
 * each place wrote it, and then checks that no trace of the old number is
 * left anywhere. The source is never touched, so the terms' wording
 * fingerprint is the same whatever the number is.
 *
 * Unset (or set to today's number), nothing is rewritten: dist/ is byte for
 * byte what it would have been without this step.
 *
 * The scripts in dist/js are cached for a year under a ?v= hash of their
 * source, which a swap here does not change, so stamp-assets.mjs folds the
 * number into that hash (phoneHashSalt) whenever it is not the repo's.
 */
import fs from "node:fs";
import path from "node:path";
import { REPO_PHONE, businessPhone, phoneTrace, swapPhone } from "../../netlify/functions/_pricing.mjs";

const TEXT = /\.(html|js|mjs|css|json|xml|txt|webmanifest|svg)$/;

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (TEXT.test(e.name)) yield p;
  }
}

/** "" when the published number is the repo's, else something that changes with it. */
export function phoneHashSalt(env = process.env.BUSINESS_PHONE) {
  const to = businessPhone(env);
  return to.digits === REPO_PHONE.digits ? "" : `\0phone:${to.digits}`;
}

/** Rewrites the number in every text file under `dir`. Returns the files changed. */
export function stampPhone(dir, env = process.env.BUSINESS_PHONE) {
  const to = businessPhone(env); // throws on a bad value, with the reason
  if (to.digits === REPO_PHONE.digits) return { phone: to, changed: [] };
  const changed = [];
  for (const file of walk(dir)) {
    const before = fs.readFileSync(file, "utf8");
    const after = swapPhone(before, REPO_PHONE, to);
    if (after !== before) {
      fs.writeFileSync(file, after);
      changed.push(path.relative(dir, file));
    }
    const left = phoneTrace(after, REPO_PHONE);
    if (left) {
      throw new Error(
        `phone-stamp: ${path.relative(dir, file)} still has the old number ("${left}") in a format the swap does not know. ` +
          "Add the format to swapPhone in web/lib/site/business.ts.",
      );
    }
  }
  return { phone: to, changed };
}
