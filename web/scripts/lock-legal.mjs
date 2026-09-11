/**
 * Records the current wording of the legal pages.
 *
 * legal.test.ts compares each rendered page against this file. If the words
 * changed but the version date in lib/site/legal.ts did not, the test fails
 * and says so. Run this AFTER bumping the date, to accept the new wording:
 *
 *   npm run lock:legal
 *
 * The hash ignores the effective-date line itself and whitespace, so a
 * rebuild that changes nothing does not trip it.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LEGAL, legalFingerprint } from "../../netlify/functions/_pricing.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const LOCK = path.join(root, "web/legal.lock.json");

const lock = {
  _comment:
    "Fingerprints of the legal pages. If terms.html or privacy.html change and the matching date in lib/site/legal.ts does not, legal.test.ts fails. Bump the date, then run `npm run lock:legal`.",
  terms: { version: LEGAL.termsEffective, fingerprint: legalFingerprint(fs.readFileSync(path.join(root, "terms.html"), "utf8")) },
  privacy: { version: LEGAL.privacyEffective, fingerprint: legalFingerprint(fs.readFileSync(path.join(root, "privacy.html"), "utf8")) },
};

fs.writeFileSync(LOCK, JSON.stringify(lock, null, 2) + "\n");
console.log(`locked terms ${lock.terms.version} ${lock.terms.fingerprint}, privacy ${lock.privacy.version} ${lock.privacy.fingerprint}`);
