/**
 * Real drive time to an arbitrary point, for the service area map.
 *
 * Runs server side for two reasons. The Routes API does not send CORS
 * headers, and the origin is Elijah's home address, which must never reach a
 * browser. The browser sends a destination and gets back a duration and a
 * fee. It never learns where the drive started.
 *
 * The fee is computed here from the SAME ladder the funnel and the payment
 * functions use, so a number shown on the map cannot differ from the one
 * charged at checkout.
 *
 * Unconfigured (no key yet) returns 503 and the page falls back to its own
 * estimate from the ZIP bands, clearly labelled. That is the whole point of
 * the fallback: the map works today and gets sharper the day the key lands.
 */
import { DEFAULT_RULES, MAX_ONE_WAY_MINUTES, mileageFeeCents } from "./_pricing.mjs";

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

/** Cheap in-process memo. Warm containers answer repeat pins for free. */
const memo = new Map();
const MEMO_MAX = 500;

/**
 * Round the destination before caching, because two pins a few metres apart
 * are the same drive. Three decimals is about 100 metres.
 */
const memoKey = (lat, lng) => `${lat.toFixed(3)},${lng.toFixed(3)}`;

export async function handler(event) {
  const key = process.env.GOOGLE_MAPS_SERVER_KEY;
  const originAddress = process.env.SHOP_ORIGIN_ADDRESS;
  const originPlaceId = process.env.SHOP_ORIGIN_PLACE_ID;

  const lat = Number(event.queryStringParameters?.lat);
  const lng = Number(event.queryStringParameters?.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return json(400, { error: "bad_coordinates" }, false);
  }

  if (!key || (!originAddress && !originPlaceId)) {
    return json(503, { error: "unconfigured" }, false);
  }

  const cached = memo.get(memoKey(lat, lng));
  if (cached) return json(200, cached, true);

  try {
    const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        // Narrow mask keeps this in the cheaper SKU. We only want a duration.
        "X-Goog-FieldMask": "routes.duration,routes.distanceMeters",
      },
      body: JSON.stringify({
        origin: originPlaceId ? { placeId: originPlaceId } : { address: originAddress },
        destination: { location: { latLng: { latitude: lat, longitude: lng } } },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
        units: "IMPERIAL",
      }),
    });

    if (!res.ok) {
      return json(502, { error: "routes_failed", status: res.status }, false);
    }

    const data = await res.json();
    const route = data.routes?.[0];

    // No route at all usually means water in the way, or a different
    // continent. Either way it is not a drive.
    if (!route?.duration) {
      return json(200, { reachable: false, tooFar: true }, true);
    }

    const minutes = Math.round(Number(String(route.duration).replace("s", "")) / 60);
    const miles = route.distanceMeters ? Math.round(route.distanceMeters / 1609.34) : null;

    const body =
      minutes > MAX_ONE_WAY_MINUTES
        ? { reachable: true, tooFar: true, minutes, miles, source: "routes" }
        : {
            reachable: true,
            tooFar: false,
            minutes,
            miles,
            feeCents: mileageFeeCents(minutes, DEFAULT_RULES.mileage),
            source: "routes",
          };

    if (memo.size >= MEMO_MAX) memo.clear();
    memo.set(memoKey(lat, lng), body);

    return json(200, body, true);
  } catch (err) {
    return json(502, { error: "routes_error" }, false);
  }
}
