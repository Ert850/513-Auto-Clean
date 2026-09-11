/**
 * Cloudflare Turnstile, verified server side.
 *
 * Off until TURNSTILE_SECRET_KEY exists, so the site works without it. Once
 * it is set, the payment functions refuse a request that does not carry a
 * valid token, which is what stops a script from creating a Stripe customer
 * a thousand times a minute. The site key goes in AC_CONFIG.turnstileSiteKey
 * and the funnel renders the widget when it sees one.
 */
export function turnstileConfigured() {
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

/** Returns null when fine, or an error code string. */
export async function verifyTurnstile(token, event) {
  if (!turnstileConfigured()) return null;
  if (typeof token !== "string" || !token || token.length > 2048) return "turnstile_missing";

  const ip = event?.headers?.["x-nf-client-connection-ip"] ?? "";
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: process.env.TURNSTILE_SECRET_KEY,
        response: token,
        ...(ip ? { remoteip: ip } : {}),
      }),
    });
    const data = await res.json();
    return data?.success ? null : "turnstile_failed";
  } catch {
    // Cloudflare unreachable is not the customer's fault. Let it through
    // and let the rate limiter and the amount ceiling do their jobs.
    return null;
  }
}
