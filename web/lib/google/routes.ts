/**
 * Drive time via the Routes API.
 *
 * The fee is the average of the two REAL legs at their actual times: out at
 * the time you must leave to arrive, back at the time you actually finish.
 *
 * `arrivalTime` is TRANSIT-only in the Routes API, driving accepts only
 * `departureTime`, so the outbound leg needs one iteration: estimate with
 * departureTime = slot start, then recompute with departureTime = slot start
 * minus that estimate. It matters, because a 60 minute drive means leaving an
 * hour earlier, which can be an entirely different traffic picture.
 */

const ENDPOINT = "https://routes.googleapis.com/directions/v2:computeRoutes";

export type RoutingPreference = "TRAFFIC_UNAWARE" | "TRAFFIC_AWARE";

export interface LegRequest {
  originPlaceId: string;
  destinationPlaceId: string;
  departureTime?: Date;
  routingPreference: RoutingPreference;
}

export class RoutesUnavailableError extends Error {}

function apiKey(env: NodeJS.ProcessEnv = process.env): string | null {
  return env.GOOGLE_MAPS_SERVER_KEY ?? null;
}

export function isConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(apiKey(env) && env.SHOP_ORIGIN_PLACE_ID);
}

/** One leg, in minutes. */
export async function driveMinutes(
  req: LegRequest,
  env: NodeJS.ProcessEnv = process.env,
): Promise<number> {
  const key = apiKey(env);
  if (!key) throw new RoutesUnavailableError("GOOGLE_MAPS_SERVER_KEY is not set");

  const body: Record<string, unknown> = {
    origin: { placeId: req.originPlaceId },
    destination: { placeId: req.destinationPlaceId },
    travelMode: "DRIVE",
    routingPreference: req.routingPreference,
  };
  // departureTime is only meaningful, and only accepted, for traffic-aware.
  if (req.routingPreference === "TRAFFIC_AWARE" && req.departureTime) {
    body.departureTime = req.departureTime.toISOString();
  }

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      // Keep the mask minimal: a wider mask moves the call into a pricier SKU.
      "X-Goog-FieldMask": "routes.duration",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new RoutesUnavailableError(`Routes API ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as { routes?: { duration?: string }[] };
  const duration = json.routes?.[0]?.duration; // e.g. "1633s"
  if (!duration) throw new RoutesUnavailableError("Routes API returned no duration");
  return Math.round(parseInt(duration.replace("s", ""), 10) / 60);
}

export interface RoundTripResult {
  outboundMinutes: number;
  returnMinutes: number;
  /** The average, which is what the fee ladder consumes. */
  oneWayMinutes: number;
  apiCalls: number;
}

/**
 * Both legs for a specific appointment.
 *
 * Iterating the outbound leg only above `iterateAboveMin` keeps the common
 * short-drive case to two calls instead of three.
 */
export async function roundTripMinutes(
  destinationPlaceId: string,
  arriveAt: Date,
  jobDurationMin: number,
  env: NodeJS.ProcessEnv = process.env,
  iterateAboveMin = 20,
): Promise<RoundTripResult> {
  const originPlaceId = env.SHOP_ORIGIN_PLACE_ID;
  if (!originPlaceId) throw new RoutesUnavailableError("SHOP_ORIGIN_PLACE_ID is not set");

  let calls = 0;

  // Outbound, first pass: depart at the appointment time as a rough anchor.
  let outbound = await driveMinutes(
    { originPlaceId, destinationPlaceId, departureTime: arriveAt, routingPreference: "TRAFFIC_AWARE" },
    env,
  );
  calls++;

  // Second pass: leave early enough to actually arrive on time.
  if (outbound > iterateAboveMin) {
    const departAt = new Date(arriveAt.getTime() - outbound * 60_000);
    outbound = await driveMinutes(
      { originPlaceId, destinationPlaceId, departureTime: departAt, routingPreference: "TRAFFIC_AWARE" },
      env,
    );
    calls++;
  }

  // Return leg departs when the work finishes.
  const finishAt = new Date(arriveAt.getTime() + jobDurationMin * 60_000);
  const returnMinutes = await driveMinutes(
    {
      originPlaceId: destinationPlaceId,
      destinationPlaceId: originPlaceId,
      departureTime: finishAt,
      routingPreference: "TRAFFIC_AWARE",
    },
    env,
  );
  calls++;

  return {
    outboundMinutes: outbound,
    returnMinutes,
    oneWayMinutes: (outbound + returnMinutes) / 2,
    apiCalls: calls,
  };
}

/**
 * Cheap, slot-independent estimate for the address step, before any time is
 * chosen. Traffic-unaware keeps it in the Essentials tier and inside the free
 * monthly cap, and the funnel labels it as an estimate rather than a quote.
 */
export async function estimateOneWayMinutes(
  destinationPlaceId: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<number> {
  const originPlaceId = env.SHOP_ORIGIN_PLACE_ID;
  if (!originPlaceId) throw new RoutesUnavailableError("SHOP_ORIGIN_PLACE_ID is not set");
  return driveMinutes(
    { originPlaceId, destinationPlaceId, routingPreference: "TRAFFIC_UNAWARE" },
    env,
  );
}

/** Weekly-repeating cache key. This is what keeps traffic-aware affordable. */
export function cacheKey(placeId: string, when: Date, timeZone = "America/New_York") {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(when);
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    parts.find((p) => p.type === "weekday")?.value ?? "Sun",
  );
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0") % 24;
  return { placeId, weekday: wd, hourBucket: hour };
}
