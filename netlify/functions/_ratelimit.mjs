/**
 * A small token bucket per client, per function.
 *
 * It lives in the memory of one warm function instance, so it is a speed
 * bump rather than a wall: a determined attacker spread across instances
 * gets through. The walls are the daily quotas set on each Google API in
 * Cloud Console and the amount ceiling in the payment functions. This
 * exists so that a single misbehaving client, a retry loop, or a scraper
 * cannot run up a bill from one place.
 *
 * `limit` is requests per minute. Buckets refill continuously.
 */
const buckets = new Map();
const MAX_BUCKETS = 5000;

function clientKey(event, name) {
  const h = event?.headers ?? {};
  const ip =
    h["x-nf-client-connection-ip"] ||
    h["X-Nf-Client-Connection-Ip"] ||
    (h["x-forwarded-for"] || h["X-Forwarded-For"] || "").split(",")[0].trim() ||
    "unknown";
  return `${name}|${ip}`;
}

export function limited(event, name, perMinute) {
  const key = clientKey(event, name);
  const now = Date.now();
  let b = buckets.get(key);
  if (!b) {
    if (buckets.size >= MAX_BUCKETS) buckets.clear();
    b = { tokens: perMinute, at: now };
    buckets.set(key, b);
  }
  // Refill.
  const refill = ((now - b.at) / 60_000) * perMinute;
  b.tokens = Math.min(perMinute, b.tokens + refill);
  b.at = now;
  if (b.tokens < 1) return true;
  b.tokens -= 1;
  return false;
}

/** For tests. */
export function resetRateLimits() {
  buckets.clear();
}
