/**
 * Measured drive time, via the Google Routes API.
 *
 * Shared by /api/travel (what the customer is shown) and by the payment
 * functions (what the customer is charged). One implementation, so those two
 * numbers cannot disagree, which is the entire reason this file exists rather
 * than the call being written twice.
 *
 * The origin is Elijah's home address and lives only in the environment. A
 * caller passes a destination and receives a duration. It never learns where
 * the drive started.
 */

/**
 * Rounded so two requests for the same place hit the same cache entry.
 * Three decimals is about 100 metres; addresses are trimmed and upper-cased.
 */
function keyFor(dest) {
  const where = dest.address
    ? "a:" + dest.address.trim().toUpperCase().replace(/\s+/g, " ")
    : `c:${dest.lat.toFixed(3)},${dest.lng.toFixed(3)}`;
  // The departure hour is part of the identity of a drive. Same address at
  // 8am and at 5pm is not the same journey, and caching them together would
  // throw away the traffic awareness we are paying for.
  const when = dest.departureMs ? "@" + new Date(dest.departureMs).toISOString().slice(0, 13) : "";
  return where + when + (dest.reverse ? "|back" : "");
}

const memo = new Map();
const MEMO_MAX = 500;
const MEMO_TTL_MS = 6 * 60 * 60 * 1000;

export function routesConfigured() {
  return Boolean(
    process.env.GOOGLE_MAPS_SERVER_KEY &&
      (process.env.SHOP_ORIGIN_ADDRESS || process.env.SHOP_ORIGIN_PLACE_ID),
  );
}

/**
 * One-way drive time to a destination.
 *
 * `dest` is either `{ address }` or `{ lat, lng }`. An address goes straight
 * to the Routes API rather than being geocoded first: it resolves the address
 * as part of routing, which is one call instead of two and one less place for
 * the answer to drift.
 *
 * Returns null when the key is missing, so callers can fall back rather than
 * having to distinguish "not set up" from "failed".
 */
export async function measureDrive(dest) {
  if (!routesConfigured()) return null;

  const key = keyFor(dest);
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < MEMO_TTL_MS) return hit.value;

  const originPlaceId = process.env.SHOP_ORIGIN_PLACE_ID;
  const originAddress = process.env.SHOP_ORIGIN_ADDRESS;

  const customer = dest.address
    ? { address: dest.address }
    : { location: { latLng: { latitude: dest.lat, longitude: dest.lng } } };

  const base = originPlaceId ? { placeId: originPlaceId } : { address: originAddress };

  // The drive home is a different journey from the drive out, at a different
  // time of day and often on the other side of a rush hour.
  const origin = dest.reverse ? customer : base;
  const destination = dest.reverse ? base : customer;

  const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": process.env.GOOGLE_MAPS_SERVER_KEY,
      // Narrow mask keeps this in the cheaper SKU. Only a duration is wanted.
      "X-Goog-FieldMask": "routes.duration,routes.distanceMeters",
    },
    body: JSON.stringify({
      origin,
      destination,
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
      units: "IMPERIAL",
      // Traffic at the time of the appointment, not traffic right now. The
      // API rejects a departure in the past, so anything not comfortably in
      // the future is dropped and it prices from now instead.
      ...(dest.departureMs && dest.departureMs > Date.now() + 60_000
        ? { departureTime: new Date(dest.departureMs).toISOString() }
        : {}),
    }),
  });

  if (!res.ok) throw new Error("routes_" + res.status);

  const data = await res.json();
  const route = data.routes?.[0];

  // No route usually means water in the way, or a different continent.
  const value = route?.duration
    ? {
        minutes: Math.round(Number(String(route.duration).replace("s", "")) / 60),
        miles: route.distanceMeters ? Math.round(route.distanceMeters / 1609.34) : null,
        reachable: true,
      }
    : { minutes: null, miles: null, reachable: false };

  if (memo.size >= MEMO_MAX) memo.clear();
  memo.set(key, { at: Date.now(), value });
  return value;
}

/** Build the one-line address string the Routes API resolves best. */
export function addressLine(a) {
  if (!a) return "";
  return [a.line1, a.city, a.region, a.zip]
    .map((s) => String(s ?? "").trim())
    .filter(Boolean)
    .join(", ");
}

/**
 * The round trip, which is what the fee is actually built on.
 *
 * Two legs, each measured at the time it will really be driven:
 *
 *   out    leave in time to ARRIVE at the slot
 *   back   leave when the job actually finishes
 *
 * Then average them, per averageOneWayMinutes in lib/pricing/mileage.ts. One
 * leg would be a lie in either direction: a job that starts at 7am and ends
 * at 11am is measured against an empty road out and a clear road back, while
 * a 2pm start comes home through rush hour.
 *
 * The outbound leg needs an iteration, because the Routes API takes a
 * DEPARTURE time and we know the ARRIVAL time. Estimate with a departure at
 * the slot, then re-measure departing that long before it. Only worth doing
 * past twenty minutes; below that the traffic picture does not move enough to
 * pay for another call.
 */
export async function measureRoundTrip({ dest, slotMs, serviceMin }) {
  if (!routesConfigured()) return null;

  // No slot yet means no times to measure against, so it is one plain drive.
  if (!slotMs || slotMs <= Date.now()) {
    const one = await measureDrive(dest);
    if (!one || !one.reachable) return one;
    return { ...one, outboundMin: one.minutes, returnMin: one.minutes, legs: 1 };
  }

  const rough = await measureDrive({ ...dest, departureMs: slotMs });
  if (!rough || !rough.reachable) return rough;

  const out =
    rough.minutes > 20
      ? (await measureDrive({ ...dest, departureMs: slotMs - rough.minutes * 60_000 })) ?? rough
      : rough;

  const outboundMin = out.reachable ? out.minutes : rough.minutes;

  const finishMs = slotMs + Math.max(0, Number(serviceMin) || 0) * 60_000;
  const back = await measureDrive({ ...dest, departureMs: finishMs, reverse: true });
  const returnMin = back && back.reachable ? back.minutes : outboundMin;

  return {
    reachable: true,
    minutes: Math.round((outboundMin + returnMin) / 2),
    outboundMin,
    returnMin,
    miles: out.miles ?? rough.miles ?? null,
    legs: back && back.reachable ? (out === rough ? 2 : 3) : 2,
  };
}
