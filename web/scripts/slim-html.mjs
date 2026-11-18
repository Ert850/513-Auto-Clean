/**
 * Slims a published page: drops HTML comments and the indentation between
 * tags, leaving everything a visitor sees exactly as it was (Imperion audit,
 * November 18: Contact's text was 10% of its HTML, the line where Semrush
 * flags "low text to HTML ratio").
 *
 * Why the ratio was low: the source pages are written for people. Comments
 * that explain owner decisions and deep indentation are about a fifth of
 * every page, and they were copied into dist/ unchanged while the scripts
 * were already minified. A page with little text (Contact, About) fell under
 * the line.
 *
 * Safe by construction:
 * - <script>, <style>, <pre> and <textarea> are left byte for byte (JSON-LD,
 *   whitespace that shows, a textarea's default value).
 * - A run of whitespace that holds a line break becomes one line break, which
 *   renders as the same single space it rendered as before. Whitespace on one
 *   line is left alone.
 * - Comments render nothing, so removing one changes nothing on screen.
 *
 * Runs on dist/ only (build-dist.mjs). The source keeps its comments and the
 * CHROME, CATALOG and other markers the generators need.
 */
// One left-to-right pass: whichever starts first wins, so a comment that
// mentions "<script" is still just a comment, and "<!--" inside a script
// string stays in the script.
const TOKEN = /<!--[\s\S]*?-->|<(script|style|pre|textarea)\b[^>]*>[\s\S]*?<\/\1>/gi;

export function slimHtml(html) {
  const kept = [];
  const held = html.replace(TOKEN, (m, tag) => (tag ? `\u0000${kept.push(m) - 1}\u0000` : ""));
  return held.replace(/[ \t]*\n\s*/g, "\n").replace(/\u0000(\d+)\u0000/g, (_, i) => kept[Number(i)]);
}
