/**
 * Measured drive time for the booking funnel and the service area map.
 *
 * Takes either a full address (`?address=...`, what the funnel sends once the
 * customer has typed one) or a coordinate (`?lat=&lng=`, what a dropped pin
 * sends). Returns a duration and the fee that duration earns, computed from
 * the SAME ladder the payment functions use.
 *
 * Optional: `at` (epoch ms of the appointment) and `serviceMin`, so the
 * round trip is measured at the hours it will really be driven, and `zip`,
 * so a slow drive can be labelled as traffic rather than just presented.
 *
 * The origin never reaches the browser. It sends a destination and gets back
 * a number of minutes.
 *
 * Unconfigured returns 503 and the caller falls back to its own estimate,
 * clearly labelled. That is the point of the fallback: the site works today
 * and gets exact the day the key lands.
 *
 * HISTORY: the first version of this file referenced four names it never
 * imported and threw ReferenceError on every call. It was only ever run
 * without a key, where it returned 503 before reaching that line, so nobody
 * saw it. functions.smoke.test.ts now imports every function with a fake
 * key and calls it, so that class of bug cannot ship again.
 */
import { DEFAULT_RULES, MAX_ONE_WAY_MINUTES, estimateOneWayMinutes, mileageFeeCents } from "./_pricing.mjs";
import { measureRoundTrip, routesConfigured } from "./_routes.mjs";
import { limited } from "./_ratelimit.mjs";

const CACHE_SECONDS = 86400;

const json = (status, body, cacheable) => ({
  statusCode: status,
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": cacheable
      ? `public, max-age=${CACHE_SECONDS}, stale-while-revalidate=604800`
      : "no-store",
  },
  body: JSON.stringify(body),
});

export async function handler(event) {
  // Each hit here is up to three billed Routes calls, and the cache key
  // includes the address and the hour, so every hit is unique. Cheap to
  // abuse without this.
  if (limited(event, "travel", 30)) return json(429, { error: "slow_down" }, false);

  const q = event?.queryStringParameters ?? {};
  const address = String(q.address ?? "").trim().slice(0, 200);
  const lat = Number(q.lat);
  const lng = Number(q.lng);
  const zip = /^\d{5}$/.test(String(q.zip ?? "")) ? String(q.zip) : null;
  const serviceMin = Math.max(0, Math.min(60 * 24 * 5, Number(q.serviceMin) || 0));

  // Epoch ms of the appointment, so the drive is priced in that hour's
  // traffic rather than in an average of every hour.
  const at = Number(q.at);
  const departureMs = Number.isFinite(at) && at > Date.now() ? at : null;

  const hasCoords =
    Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

  if (!address && !hasCoords) return json(400, { error: "no_destination" }, false);
  if (!routesConfigured()) return json(503, { error: "unconfigured" }, false);

  // The band midpoint for this ZIP is our stand-in for a typical drive, so a
  // figure that came out high can be explained rather than just presented.
  const typical = zip ? estimateOneWayMinutes(zip) : null;

  try {
    const drive = await measureRoundTrip({
      dest: address ? { address } : { lat, lng },
      slotMs: departureMs,
      serviceMin,
    });

    if (!drive || !drive.reachable || drive.minutes === null) {
      return json(200, { reachable: false, tooFar: true, source: "routes" }, true);
    }

    if (drive.minutes > MAX_ONE_WAY_MINUTES) {
      return json(
        200,
        { reachable: true, tooFar: true, minutes: drive.minutes, miles: drive.miles, source: "routes" },
        true,
      );
    }

    return json(
      200,
      {
        reachable: true,
        tooFar: false,
        minutes: drive.minutes,
        outboundMin: drive.outboundMin ?? drive.minutes,
        returnMin: drive.returnMin ?? drive.minutes,
        miles: drive.miles,
        feeCents: mileageFeeCents(drive.minutes, DEFAULT_RULES.mileage),
        source: "routes",
        trafficAt: departureMs,
        typicalMin: typical,
        heavyTraffic:
          typical !== null && drive.minutes >= typical + 5 && drive.minutes >= typical * 1.25,
      },
      true,
    );
  } catch {
    return json(502, { error: "routes_error" }, false);
  }
}
