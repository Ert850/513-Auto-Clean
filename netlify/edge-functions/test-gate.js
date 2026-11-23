/**
 * Password gate for the PRIVATE test site (November 14).
 *
 * Runs only where TEST_SITE_PASSWORD is set: the Deploy Previews context of
 * the existing site (draft PR #13). Production never sets it, so there this
 * returns straight away and the request goes on untouched.
 *
 * On the test site every page, script, image and function call needs the
 * password (the browser remembers it for the visit), and every answer says
 * noindex, so nothing on it can be found, read or listed by anyone without
 * the password, a toll-free reviewer included.
 */
// Stripe's gift card webhook can't send a password; it carries Stripe's
// signature instead, which gift-webhook.mjs checks before doing anything.
export const config = { path: "/*", excludedPath: ["/api/gift-webhook", "/.netlify/functions/gift-webhook"] };

/** Same result for the same strings, and no early exit that leaks how much matched. */
export function sameText(a, b) {
  const x = new TextEncoder().encode(String(a));
  const y = new TextEncoder().encode(String(b));
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/** Does this Authorization header carry the password? Any user name is accepted. */
export function allowed(header, password) {
  const [scheme, b64] = String(header || "").split(" ");
  if (scheme !== "Basic" || !b64) return false;
  let decoded;
  try { decoded = atob(b64); } catch { return false; }
  const i = decoded.indexOf(":");
  return i >= 0 && sameText(decoded.slice(i + 1), password);
}

export default async (request, context) => {
  const password = globalThis.Netlify?.env?.get("TEST_SITE_PASSWORD");
  if (!password) return; // the live site: nothing to do
  if (!allowed(request.headers.get("authorization"), password)) {
    return new Response("513 Auto Clean private test site. Ask Emmett for the password.", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="513 Auto Clean test site", charset="UTF-8"',
        "X-Robots-Tag": "noindex, nofollow",
        "Cache-Control": "no-store",
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }
  const res = await context.next();
  const out = new Response(res.body, res);
  out.headers.set("X-Robots-Tag", "noindex, nofollow");
  return out;
};
