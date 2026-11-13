/**
 * config/experiments.json, checked and reduced to what the browser needs.
 *
 * render-config.mjs writes the result into js/config.js as
 * window.AC_EXPERIMENTS, and js/analytics.js runs the split. Every test reaches
 * the page, so an "off" one can still show its control version (the first),
 * but names and notes stay here.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** Throws with a message naming the test and the field. */
export function checkExperiments(input) {
  const bad = (where, what) => {
    throw new Error(`config/experiments.json: ${where}: ${what}`);
  };
  if (!input || typeof input !== "object" || Array.isArray(input)) bad("the file", "is not a JSON object");
  for (const k of Object.keys(input)) if (!["_read_me", "experiments"].includes(k)) bad("the file", `unknown key "${k}" (use experiments)`);
  const list = input.experiments;
  if (!Array.isArray(list)) bad("experiments", "must be a list (it can be empty: [])");
  const known = ["id", "name", "status", "sources", "versions", "winner", "note"];
  const ids = new Set();
  return list.map((x, i) => {
    if (!x || typeof x !== "object" || Array.isArray(x)) bad(`test ${i + 1}`, "must be an object");
    const id = x.id;
    const where = typeof id === "string" ? id : `test ${i + 1}`;
    if (typeof id !== "string" || !/^[a-z0-9][a-z0-9-]{0,29}$/.test(id)) {
      bad(where, "id must be lower case letters, digits and dashes, at most 30");
    }
    if (ids.has(id)) bad(where, "this id is used twice");
    ids.add(id);
    for (const k of Object.keys(x)) if (!known.includes(k)) bad(where, `unknown field "${k}" (use ${known.join(", ")})`);
    if (!["off", "running", "ended"].includes(x.status)) bad(where, 'status must be "off", "running" or "ended"');
    const v = x.versions;
    if (!v || typeof v !== "object" || Array.isArray(v)) bad(where, 'versions must look like {"a": 50, "b": 50}');
    const versions = Object.entries(v);
    if (versions.length < 2) bad(where, "needs at least two versions");
    for (const [name, share] of versions) {
      if (!/^[a-z0-9][a-z0-9-]{0,19}$/.test(name)) bad(where, `version "${name}": lower case letters, digits and dashes, at most 20`);
      if (!Number.isInteger(share) || share < 1) bad(where, `version "${name}": its share must be a whole number, 1 or more`);
    }
    if (x.sources !== undefined) {
      if (!Array.isArray(x.sources) || !x.sources.length || x.sources.some((s) => typeof s !== "string" || !s.trim())) {
        bad(where, 'sources must be a list like ["golf"]');
      }
    }
    if (x.status === "ended" && !(x.winner in v)) bad(where, "an ended test needs a winner that is one of its versions");
    if (x.winner !== undefined && !(x.winner in v)) bad(where, `winner "${x.winner}" is not one of its versions`);
    return {
      id,
      status: x.status,
      versions,
      ...(x.sources ? { sources: x.sources.map((s) => s.trim().toLowerCase()) } : {}),
      ...(x.status === "ended" ? { winner: x.winner } : {}),
    };
  });
}

/** What the page gets: every test, without names or notes. */
export function experimentsForPage(file = path.join(root, "config/experiments.json")) {
  return checkExperiments(JSON.parse(fs.readFileSync(file, "utf8")));
}
