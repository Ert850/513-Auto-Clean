/**
 * The ?v= stamp of one script or stylesheet: a hash of its source plus a salt
 * (the published phone number and the clean-address page list, see
 * stamp-assets.mjs). One function, so the build and the live check
 * (check-live.mjs) can never disagree about what a stamp should be.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const assetHash = (root, rel, salt) =>
  // Line endings normalised before hashing. Git hands a Windows checkout CRLF
  // and the Linux build box LF, so without this the same file stamps
  // differently in the two places and every deploy looks like it changed
  // three assets nobody touched.
  crypto
    .createHash("sha256")
    .update(fs.readFileSync(path.join(root, rel)).toString("binary").replace(/\r\n/g, "\n"), "binary")
    // A BUSINESS_PHONE other than the repo's number is swapped into dist/js
    // after this hash is taken, so it has to change the hash too, or browsers
    // keep the old number for the year the scripts are cached. "" otherwise.
    .update(salt, "binary")
    .digest("hex")
    .slice(0, 10);
