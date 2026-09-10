/**
 * Measured drive time for the booking funnel and the service area map.
 *
 * Takes either a full address (`?address=...`, what the funnel sends once the
 * customer has typed one) or a coordinate (`?lat=&lng=`, what a dropped pin
 * sends). Returns a duration and the fee that duration earns, computed from
 * the SAME ladder the payment functions use.
 *
 * The origin never reaches the browser. It sends a destination and gets back
 * a number of minutes.
 *
 * Unconfigured returns 503 and the caller falls back to its own estimate,
 * clearly labelled. That is the point of the fallback: the site works today
 * and gets exact the day the key lands.
 */
import { DEFAULT_RULES, MAX_ONE_WAY_MINUTES, mileageFeeCents } from "./_pricing.mjs";
import { measureDrive, routesConfigured } from "./_routes.mjs";

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
  const q = event.queryStringParameters ?? {};
  const address = (q.address ?? "").trim();
  const lat = Number(q.lat);
  const lng = Number(q.lng);
  // Epoch ms of the appointment, so the drive is priced in that hour's
  // traffic rather than in an average of every hour.
  const at = Number(q.at);
  const departureMs = Number.isFinite(at) && at > Date.now() ? at : null;

  const hasCoords =
    Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

  if (!address && !hasCoords) return json(400, { error: "no_destination" }, false);
  if (!routesConfigured()) return json(503, { error: "unconfigured" }, false);

  try {
    const drive = await measureDrive(
      address ? { address, departureMs } : { lat, lng, departureMs },
    );

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
        miles: drive.miles,
        feeCents: mileageFeeCents(drive.minutes, DEFAULT_RULES.mileage),
        source: "routes",
        trafficAt: departureMs,
      },
      true,
    );
  } catch (err) {
    return json(502, { error: "routes_error" }, false);
  }
}
