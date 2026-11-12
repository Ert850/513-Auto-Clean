/**
 * The business's phone number and hours, from config/business.json.
 *
 * The phone: the repo's pages, scripts and legal text are written with
 * today's number (config/business.json "phone"). A new number for texting
 * approval (A2P) was coming but not issued, so it is a Netlify variable,
 * BUSINESS_PHONE, swapped into the published files as the build writes
 * dist/ (web/scripts/phone-stamp.mjs), never into the source: the terms'
 * wording fingerprint stays the same whatever the number is. The booking
 * emails read the same variable on the server (businessPhone()).
 */
import raw from "../../../config/business.json" with { type: "json" };

export interface Phone {
  /** Ten digits, area code first: "5132792915". */
  digits: string;
  /** "(513) 279-2915" */
  display: string;
  /** "+15132792915", for tel: and sms: links. */
  e164: string;
}

/** Ten US digits from any way of writing them, or why not. */
export function parsePhone(input: unknown): { phone: Phone } | { error: string } {
  const text = String(input ?? "").trim();
  if (!text) return { error: "it is empty" };
  if (/[^\d\s().+-]/.test(text)) return { error: `"${text}" has characters a phone number does not` };
  let d = text.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  if (d.length !== 10) return { error: `"${text}" is not 10 US digits` };
  if (/^[01]/.test(d)) return { error: `"${text}" has an area code starting with ${d[0]}` };
  return {
    phone: { digits: d, display: `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`, e164: `+1${d}` },
  };
}

function mustParse(input: unknown, where: string): Phone {
  const r = parsePhone(input);
  if ("error" in r) throw new Error(`${where}: the phone number ${r.error}.`);
  return r.phone;
}

/** The number the repo is written with. */
export const REPO_PHONE: Phone = mustParse(raw.phone, "config/business.json phone");

/**
 * The number to publish: BUSINESS_PHONE when it is set, else the repo's.
 * A bad value throws with the reason, so a build stops instead of
 * publishing a broken number.
 */
export function businessPhone(env: string | undefined = process.env.BUSINESS_PHONE): Phone {
  return env === undefined || env.trim() === "" ? REPO_PHONE : mustParse(env, "BUSINESS_PHONE");
}

/**
 * Every way `from` is written in `text`, rewritten as `to` in the same
 * style: "(513) 279-2915", "(513)&nbsp;279-2915", "513-279-2915",
 * "513.279.2915", "5132792915", "+15132792915", "+1-513-279-2915".
 */
export function swapPhone(text: string, from: Phone, to: Phone): string {
  if (from.digits === to.digits) return text;
  const [a, b, c] = [from.digits.slice(0, 3), from.digits.slice(3, 6), from.digits.slice(6)];
  const [x, y, z] = [to.digits.slice(0, 3), to.digits.slice(3, 6), to.digits.slice(6)];
  const re = new RegExp(
    `(?<!\\d)(\\+?1[-. ]?)?(\\()?${a}(\\)(?: |&nbsp;|\\u00a0)?|[-. ])?${b}([-. ])?${c}(?!\\d)`,
    "g",
  );
  return text.replace(
    re,
    (_m, cc = "", open = "", mid = "", sep = "") => `${cc}${open}${x}${mid}${y}${sep}${z}`,
  );
}

/** Any trace of `p` left in `text`, in any of the formats above, or null. */
export function phoneTrace(text: string, p: Phone): string | null {
  const [a, b, c] = [p.digits.slice(0, 3), p.digits.slice(3, 6), p.digits.slice(6)];
  const m = text.match(new RegExp(`(?<!\\d)(?:1\\D{0,2})?(?:${a}\\D{0,7})?${b}\\D{0,2}${c}(?!\\d)`));
  return m ? m[0] : null;
}

/* ---------------- hours ---------------- */

export interface Hours {
  opens: string;
  closes: string;
}

const HHMM = /^([01]\d|2[0-4]):([0-5]\d)$/;

function hourWords(t: string): string {
  const m = HHMM.exec(t);
  if (!m) throw new Error(`config/business.json hours: "${t}" is not a 24-hour time like 06:00`);
  const h = Number(m[1]);
  const min = m[2]!;
  if (h === 24 || (h === 0 && min === "00")) return "midnight";
  if (h === 12 && min === "00") return "noon";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${min === "00" ? "" : ":" + min} ${h < 12 ? "AM" : "PM"}`;
}

export const HOURS: Hours = { opens: String(raw.hours?.opens), closes: String(raw.hours?.closes) };

/** "6 AM to midnight" */
export function hoursText(h: Hours = HOURS): string {
  return `${hourWords(h.opens)} to ${hourWords(h.closes)}`;
}
// Checked on load, so a mistake fails the build.
hoursText();
