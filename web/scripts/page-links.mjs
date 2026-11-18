/**
 * Every link TO a city or service page from the rest of the site, in one
 * place (owner's pick C, November 18; docs/CITY-SERVICE-LINKS.md).
 *
 * Why: a page that only one other page links to is what Semrush flags (the
 * Imperion audit), and checkDist() now fails the build on it. The city and
 * service pages were linked only from each other and from a "City guides"
 * list on Range & Travel, which had no place in that page's grid and would
 * have landed below "Get an exact quote".
 *
 * Where the links go, all from config, published pages only (a draft is
 * never linked; publishing one is its "status" alone):
 * - footer (every page): a Detailing column of service pages, and the city
 *   guides first under Service Areas (chrome.mjs fills the partial);
 * - Range & Travel: each state's card lists its city guides (render-locations);
 * - Services: a service page that "explains" a package tab gets a link in the
 *   tab row, shown with that tab; one that explains an add-on gets a link on
 *   that add-on's card (render-services, render-site).
 *
 * Links are written to the .html file, like every source link; the build
 * gives them the page's one address (site-urls.mjs). The links BETWEEN city
 * and service pages (NEARBY, SERVICE_LINKS, WHERE) stay in their generators,
 * written the same way (pageFile).
 */
import { pageFile } from "./locations.mjs";

export const isPublished = (p) => p.status !== "draft";
export const STATES = ["OH", "KY", "IN"];
export const TABS = ["interior", "exterior"];

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const link = (p, text = p.name, cls = "") => `<a${cls ? ` class="${cls}"` : ""} href="${pageFile(p)}">${esc(text)}</a>`;

/** A city page's state, from its areaServed ("Delhi Township, OH"). Throws if they disagree or name none. */
export function stateOf(loc) {
  const found = [...new Set((loc.areaServed ?? []).map((a) => /,\s*([A-Z]{2})$/.exec(a)?.[1] ?? "?"))];
  if (found.length !== 1 || !STATES.includes(found[0])) {
    throw new Error(`${loc.slug}: areaServed must name places in one of ${STATES.join(", ")} ("Town, OH"); got ${JSON.stringify(loc.areaServed)}`);
  }
  return found[0];
}

/**
 * Problems with the services' "explains" settings: which package tab or
 * add-on each page explains, and the link's words.
 * @param {object[]} services config/services/*.json
 * @param {(id: string) => unknown} findAddon from the catalog
 */
export function explainsProblems(services, findAddon) {
  const problems = [], taken = new Map();
  for (const s of services) {
    const e = s.explains;
    if (!e) continue;
    // A page set wrong claims nothing, so the next page isn't blamed for it.
    const where = e.tab && e.addon ? null : e.tab ? `tab ${e.tab}` : e.addon ? `add-on ${e.addon}` : null;
    if (!where) problems.push(`${s.slug}: explains needs exactly one of "tab" or "addon"`);
    if (e.tab && !TABS.includes(e.tab)) problems.push(`${s.slug}: explains.tab must be one of ${TABS.join(", ")}`);
    if (e.addon && !findAddon(e.addon)) problems.push(`${s.slug}: explains.addon "${e.addon}" is not an add-on in the catalog`);
    if (typeof e.link !== "string" || e.link.length < 3 || e.link.length > 40) problems.push(`${s.slug}: explains.link must be 3 to 40 characters`);
    else if (/\d/.test(e.link)) problems.push(`${s.slug}: explains.link carries a number; say it from the catalog, not in a link`);
    if (where && taken.has(where)) problems.push(`${s.slug}: ${where} is already explained by ${taken.get(where)}`);
    else if (where) taken.set(where, s.slug);
  }
  return problems;
}

/** Footer: the Detailing column (published service pages), or nothing. Goes after the Explore column. */
export function footerDetailing(services) {
  // Package pages (a tab) before add-on pages, as in the approved mockup.
  const live = services.filter(isPublished).sort((a, b) => Number(!a.explains?.tab) - Number(!b.explains?.tab));
  if (!live.length) return "";
  return `\n      <div class="f-detailing">\n        <h2>Detailing</h2>\n        <div class="f-links">\n${live.map((s) => `          ${link(s)}`).join("\n")}\n        </div>\n      </div>`;
}

/** Footer: the published city guides, first in Service Areas, or nothing. */
export function footerCities(locs) {
  return locs.filter(isPublished).map((l) => `${link(l)}\n          `).join("");
}

/** Range & Travel: one state card's city guides, or nothing. */
export function stateGuides(locs, state) {
  const live = locs.filter(isPublished).filter((l) => stateOf(l) === state);
  if (!live.length) return "";
  return `\n          <p class="area-sum area-guides">City guides: ${live.map((l) => link(l)).join(" &middot; ")}</p>\n          `;
}

/** Services tab row: one link per published page that explains a tab (CSS shows it with its tab). */
export function tabGuides(services) {
  const live = services.filter(isPublished).filter((s) => s.explains?.tab);
  if (!live.length) return "";
  return live.map((s) => `\n      <a class="svc-guide reveal" data-guide-for="${s.explains.tab}" href="${pageFile(s)}">${esc(s.explains.link)} <span aria-hidden="true">&rarr;</span></a>`).join("") + "\n      ";
}

/** An add-on card's link to the published page that explains it, or nothing. */
export function addonGuide(services, addonId) {
  const s = services.filter(isPublished).find((x) => x.explains?.addon === addonId);
  return s ? `<a class="addon-guide" href="${pageFile(s)}">${esc(s.explains.link)} <span aria-hidden="true">&rarr;</span></a>` : "";
}
