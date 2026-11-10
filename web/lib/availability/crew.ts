/**
 * Who can take a job, and who gets it.
 *
 * Every detailer other than the owner is one entry in ONE setting, DETAILERS,
 * read by the browser (through js/config.js) and by the booking function
 * alike, so adding somebody is two Google calendars and one paste. The list
 * order is the booking order: the first detailer free for a time gets it.
 *
 *   [
 *     { "name": "Kris", "does": "interior",
 *       "availability": "abc...@group.calendar.google.com",
 *       "bookings": "def...@group.calendar.google.com" },
 *     { "name": "Elijah", "owner": true }
 *   ]
 *
 * - `availability`: OPEN blocks for their hours (busy events block too).
 *   Shared publicly with full details: it holds nothing private.
 * - `bookings`: where their jobs are written. Shared publicly as free/busy
 *   ONLY, and read through Google's free/busy endpoint, so customer names
 *   and addresses on it are never public.
 * - `does`: "interior", "exterior" or "all" (the default).
 * - The owner's own entry is optional and only sets his place in the order;
 *   his calendars stay the site's existing ones. Without it he books last.
 *
 * Detailers may overlap: each one's calendars are checked on their own.
 */

export type Work = "interior" | "exterior";

export interface Detailer {
  id: string;
  name: string;
  does: Work[];
  /** Their OPEN blocks, read in full. Empty for the owner. */
  availabilityCalendarId: string;
  /** Where this detailer's jobs are written. Empty for the owner (default calendar). */
  bookingsCalendarId: string;
  owner: boolean;
}

export const OWNER: Detailer = {
  id: "owner",
  name: "Elijah",
  does: ["interior", "exterior"],
  availabilityCalendarId: "",
  bookingsCalendarId: "",
  owner: true,
};

const CAL_ID = /^[\w.+-]+@[\w.-]+$/;

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30);
}

/**
 * The DETAILERS setting, as the ordered crew, owner included.
 *
 * Forgiving on purpose: a typo in one entry drops that entry (and says so in
 * `problems`), it never takes the booking form down with it.
 */
export function parseDetailers(raw: string | null | undefined): { crew: Detailer[]; problems: string[] } {
  const problems: string[] = [];
  let list: unknown[] = [];
  const text = String(raw ?? "").trim();
  if (text) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) list = parsed;
      else problems.push("DETAILERS must be a list, in [ square brackets ]");
    } catch {
      problems.push("DETAILERS is not valid JSON");
    }
  }

  const crew: Detailer[] = [];
  let ownerPlaced = false;
  const seen = new Set<string>();

  list.forEach((entry, i) => {
    const e = (entry ?? {}) as Record<string, unknown>;
    if (e["owner"] === true) {
      if (!ownerPlaced) crew.push({ ...OWNER, name: String(e["name"] || OWNER.name).slice(0, 40) });
      ownerPlaced = true;
      return;
    }
    const name = String(e["name"] ?? "").trim().slice(0, 40);
    const availability = String(e["availability"] ?? "").trim();
    const bookings = String(e["bookings"] ?? "").trim();
    const id = slug(name);
    if (!name || !id) return problems.push(`entry ${i + 1} has no name`);
    if (id === OWNER.id || seen.has(id)) return problems.push(`${name} is listed twice`);
    if (!CAL_ID.test(availability) || !CAL_ID.test(bookings)) {
      return problems.push(`${name} needs both an availability and a bookings calendar id`);
    }
    const does = String(e["does"] ?? "all").toLowerCase();
    seen.add(id);
    crew.push({
      id,
      name,
      does: does === "interior" ? ["interior"] : does === "exterior" ? ["exterior"] : ["interior", "exterior"],
      availabilityCalendarId: availability,
      bookingsCalendarId: bookings,
      owner: false,
    });
  });

  if (!ownerPlaced) crew.push(OWNER);
  return { crew, problems };
}

/** Can this detailer do every part of the job? */
export function canDo(d: Detailer, needs: { interior: boolean; exterior: boolean }): boolean {
  return (!needs.interior || d.does.includes("interior")) && (!needs.exterior || d.does.includes("exterior"));
}

/**
 * Every start anyone can take, and who takes it: the first in crew order.
 * `free` holds each detailer's own valid starts, in crew order.
 */
export function assignStarts(free: { id: string; starts: number[] }[]): { starts: number[]; who: Map<number, string> } {
  const who = new Map<number, string>();
  for (const d of free) {
    for (const ms of d.starts) if (!who.has(ms)) who.set(ms, d.id);
  }
  return { starts: [...who.keys()].sort((a, b) => a - b), who };
}
