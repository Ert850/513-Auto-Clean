/**
 * Live Google reviews.
 *
 * Runs server side because the Places API does not send CORS headers for this
 * endpoint and, more importantly, because the key would otherwise sit in the
 * page for anyone to lift.
 *
 * Returns 5 star reviews first, newest within that, and the real rating and
 * count so the page never publishes a number that has drifted from Google.
 * Cached for an hour: reviews change slowly and the quota does not.
 */

const CACHE_SECONDS = 3600;

const json = (status, body, cacheable) => ({
  statusCode: status,
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": cacheable
      ? `public, max-age=${CACHE_SECONDS}, stale-while-revalidate=86400`
      : "no-store",
  },
  body: JSON.stringify(body),
});

export async function handler(event) {
  const key = process.env.GOOGLE_MAPS_SERVER_KEY;
  const placeId = process.env.GOOGLE_PLACE_ID;

  if (!key || !placeId) {
    // The page keeps its static fallback rather than showing an error.
    return json(503, { error: "unconfigured" }, false);
  }

  const minRating = Number(event.queryStringParameters?.minRating ?? 5);

  try {
    const res = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
      {
        headers: {
          "X-Goog-Api-Key": key,
          // Narrow mask keeps this in the cheaper SKU.
          "X-Goog-FieldMask":
            "id,displayName,rating,userRatingCount,googleMapsUri,reviews",
        },
      },
    );
    if (!res.ok) {
      // Google's own message, to the function log only. A bare 403 could be
      // the key, the API restrictions, the Place ID or billing, and guessing
      // between those cost an afternoon once. It must never reach a browser:
      // the message can name the key.
      console.error("places", res.status, (await res.text()).slice(0, 400));
      return json(502, { error: "places_error", status: res.status }, false);
    }
    const p = await res.json();

    const all = (p.reviews ?? []).map((r) => ({
      author: r.authorAttribution?.displayName ?? "Google user",
      photo: r.authorAttribution?.photoUri ?? null,
      rating: r.rating ?? 0,
      text: r.originalText?.text ?? r.text?.text ?? "",
      relative: r.relativePublishTimeDescription ?? "",
      time: r.publishTime ?? null,
      uri: r.googleMapsUri ?? null,
    }));

    const filtered = all
      .filter((r) => r.rating >= minRating && r.text.trim().length > 0)
      .sort((a, b) => (b.time ?? "").localeCompare(a.time ?? ""));

    return json(
      200,
      {
        rating: p.rating ?? null,
        total: p.userRatingCount ?? null,
        mapsUri: p.googleMapsUri ?? null,
        // If nobody has left a 5 star review with text yet, fall back to
        // everything rather than rendering an empty section.
        reviews: filtered.length ? filtered : all,
        filteredTo: filtered.length ? minRating : null,
      },
      true,
    );
  } catch (err) {
    return json(502, { error: "fetch_failed", message: err?.message }, false);
  }
}
