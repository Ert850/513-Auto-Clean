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
      // data-exp-words names the test, so a version called "words" would read the test id as its HTML.
      if (name === "words") bad(where, 'a version can\'t be called "words"');
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

/**
 * Every page that shows a test has to match the file (validation, November 16):
 * a version added in config without its words on the page would be recorded
 * under its own name while its visitors saw the control, and nothing would say so.
 *   data-exp="test:version"   the test and the version exist;
 *   data-exp-words="test"     the test exists, and every version but the control
 *                             (whose words are the element's own) has a
 *                             data-exp-<version> attribute, and no other.
 * pages: { "index.html": "<html>..." }. Throws naming the page and the test.
 */
export function checkExperimentPages(tests, pages) {
  const byId = new Map(tests.map((t) => [t.id, t]));
  const bad = (file, what) => {
    throw new Error(`${file}: ${what} (config/experiments.json, docs/AB-TESTING.md)`);
  };
  for (const [file, html] of Object.entries(pages)) {
    for (const m of html.matchAll(/\bdata-exp="([^"]*)"/g)) {
      const [id, v] = m[1].split(":");
      const t = byId.get(id);
      if (!t) bad(file, `data-exp="${m[1]}" names no test`);
      if (!t.versions.some(([name]) => name === v)) bad(file, `data-exp="${m[1]}": "${v}" is not a version of ${id}`);
    }
    for (const m of html.matchAll(/<[a-zA-Z][^>]*\bdata-exp-words="([^"]*)"[^>]*>/g)) {
      const id = m[1];
      const t = byId.get(id);
      if (!t) bad(file, `data-exp-words="${id}" names no test`);
      const has = new Set([...m[0].matchAll(/\bdata-exp-([a-z0-9-]+)=/g)].map((a) => a[1]).filter((a) => a !== "words"));
      const need = t.versions.slice(1).map(([name]) => name);
      for (const v of need) if (!has.has(v)) bad(file, `${id}: no data-exp-${v} words for version "${v}"`);
      for (const v of has) if (!need.includes(v)) bad(file, `${id}: data-exp-${v} is not a version other than the control`);
    }
  }
}
