/**
 * A stable fingerprint of what a legal page SAYS.
 *
 * Tags, whitespace, asset hashes and the effective-date line are stripped
 * first, so only a change to the words moves it.
 */
export function legalFingerprint(html: string): string {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/Effective [A-Z][a-z]+ \d{1,2}, \d{4}(?: &middot; | · )(?:Version|Last updated) [\w, -]+/g, " ")
    .replace(/&[a-z]+;|&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // FNV-1a, 32 bit, twice with different seeds. Enough to notice an edit,
  // no crypto needed, and it runs in the browser bundle without Node.
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c, 0x811c9dc5) >>> 0;
  }
  return a.toString(16).padStart(8, "0") + b.toString(16).padStart(8, "0");
}
