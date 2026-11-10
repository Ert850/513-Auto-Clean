/**
 * Weather rules for the work, per kind of job (owner, November 10).
 *
 *   Kind        Coldest   Rain stops it      Clear sun and hotter than
 *   interior    any       over 20 mm/h       (never)
 *   exterior    40°F      over 4 mm/h        100°F
 *   correction  50°F      any rain           85°F   (polishing and paint correction)
 *   coating     60°F      any rain           85°F   (ceramic coating)
 *
 * - A garage or covered spot (the customer's optional tick box) lifts the
 *   rain and the sun rules, never the cold: a cold garage is still cold.
 * - "Clear sun" is under 30% cloud in the forecast, so mornings and evenings
 *   stay open on a hot day, which is when correction naturally gets done.
 * - DESIGN CHOICE (owner, November 10): correction and polishing can be done
 *   colder than a coating, "to some extent"; 50°F is the line chosen, halfway
 *   between exterior work (40) and coating (60). Change it here.
 * - Coating never blocks a booking (owner: "correction books anyway"). When a
 *   day suits the rest of the job but not the coating, the time is still
 *   offered and the coating moves to a warmer, drier day. The funnel says so.
 *
 * Inside the forecast (the National Weather Service gives about 7 days,
 * hourly, free for any use) every hour of the job is checked, so a warm spell
 * in winter is bookable. Past the forecast nobody knows, so the season
 * decides. With no forecast at all, the season decides everything.
 */
import { localParts } from "../time/zone.js";

const TZ = "America/New_York";
const HOUR_MS = 3_600_000;

export type WeatherKind = "interior" | "exterior" | "correction" | "coating";

export interface WeatherRule {
  /** Below this, no. Null for work that does not care. */
  minTempF: number | null;
  /** A rain rate above this, no (unless covered). */
  maxRainMmPerHour: number;
  /** Clear sun and hotter than this, no (unless covered). Null for never. */
  maxSunTempF: number | null;
  /** Months (1 to 12) open past the forecast. */
  seasonMonths: readonly number[];
}

const ALL_YEAR = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

export const WEATHER_RULES: Record<WeatherKind, WeatherRule> = {
  interior: { minTempF: null, maxRainMmPerHour: 20, maxSunTempF: null, seasonMonths: ALL_YEAR },
  // "Light peppering is fine (like a mist or intermittent)": 4 mm an hour is
  // well past a drizzle.
  exterior: { minTempF: 40, maxRainMmPerHour: 4, maxSunTempF: 100, seasonMonths: [3, 4, 5, 6, 7, 8, 9, 10] },
  // "Can't do in rain": anything measurable.
  correction: { minTempF: 50, maxRainMmPerHour: 0.25, maxSunTempF: 85, seasonMonths: [4, 5, 6, 7, 8, 9, 10] },
  coating: { minTempF: 60, maxRainMmPerHour: 0.25, maxSunTempF: 85, seasonMonths: [5, 6, 7, 8, 9] },
};

/** Clear sun: less cloud than this, in percent. */
export const CLEAR_SKY_MAX_COVER = 30;

/** One value over a span of time, as the forecast gives it. */
export interface ForecastSpan {
  start: number;
  end: number;
  value: number;
}

export interface Forecast {
  tempF: ForecastSpan[];
  /** Millimetres of rain expected over each span. */
  rainMm: ForecastSpan[];
  /** Cloud cover, percent. */
  skyCover: ForecastSpan[];
  /** Nothing is known after this. */
  until: number;
}

export type WeatherVerdict = { ok: true } | { ok: false; reason: "cold" | "rain" | "heat" | "season" };

/** "PT6H", "P1DT3H", "PT30M" as milliseconds. */
export function isoDurationMs(text: string): number {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/.exec(text);
  if (!m) return 0;
  return ((Number(m[1] ?? 0) * 24 + Number(m[2] ?? 0)) * 60 + Number(m[3] ?? 0)) * 60_000;
}

/**
 * The NWS gridpoint reply (api.weather.gov/gridpoints/ILN/36,38), reduced to
 * what the rules need. Temperatures arrive in °C, rain in mm per span, cloud
 * in percent.
 */
export function parseGridpoint(json: unknown): Forecast | null {
  const props = (json as { properties?: Record<string, unknown> } | null)?.properties;
  if (!props) return null;
  const spans = (key: string, convert: (v: number) => number): ForecastSpan[] => {
    const layer = props[key] as { values?: { validTime: string; value: number | null }[] } | undefined;
    return (layer?.values ?? [])
      .filter((v) => typeof v.value === "number")
      .map((v) => {
        const [at, dur] = v.validTime.split("/");
        const start = Date.parse(at ?? "");
        return { start, end: start + isoDurationMs(dur ?? ""), value: convert(v.value as number) };
      })
      .filter((s) => Number.isFinite(s.start) && s.end > s.start);
  };
  const tempF = spans("temperature", (c) => (c * 9) / 5 + 32);
  const rainMm = spans("quantitativePrecipitation", (mm) => mm);
  const skyCover = spans("skyCover", (pct) => pct);
  if (!tempF.length) return null;
  // Trust only what both the temperature and the rain cover.
  const until = Math.min(
    Math.max(...tempF.map((s) => s.end)),
    rainMm.length ? Math.max(...rainMm.map((s) => s.end)) : Infinity,
  );
  return { tempF, rainMm, skyCover, until };
}

/** May this kind of work be booked at this start, weather-wise? */
export function weatherVerdict(req: {
  startMs: number;
  durationMin: number;
  kind: WeatherKind;
  forecast: Forecast | null;
  /** A garage or covered spot: lifts the rain and the sun rules, not the cold. */
  covered?: boolean;
  timeZone?: string;
}): WeatherVerdict {
  const rule = WEATHER_RULES[req.kind];
  const end = req.startMs + req.durationMin * 60_000;
  const f = req.forecast;

  if (!f || end > f.until) {
    const month = localParts(req.startMs, req.timeZone ?? TZ).mo;
    return rule.seasonMonths.includes(month) ? { ok: true } : { ok: false, reason: "season" };
  }

  const during = (s: ForecastSpan) => s.end > req.startMs && s.start < end;
  if (rule.minTempF !== null && f.tempF.some((s) => during(s) && s.value < rule.minTempF!)) {
    return { ok: false, reason: "cold" };
  }
  if (!req.covered) {
    if (f.rainMm.some((s) => during(s) && s.value / ((s.end - s.start) / HOUR_MS) > rule.maxRainMmPerHour)) {
      return { ok: false, reason: "rain" };
    }
    if (rule.maxSunTempF !== null) {
      // Hot AND clear in the same hour: a hot overcast hour, or a clear cool
      // one, is workable.
      const hot = f.tempF.filter((s) => during(s) && s.value > rule.maxSunTempF!);
      const clear = (t: ForecastSpan) =>
        // ...and during the job: the forecast merges equal hours into long
        // spans, so a 101°F span to 6pm met a clear 4 to 6pm and failed a
        // 10am job under cloud (engine check, November 10).
        f.skyCover.some((c) => Math.max(c.start, t.start, req.startMs) < Math.min(c.end, t.end, end) && c.value < CLEAR_SKY_MAX_COVER);
      if (hot.some(clear)) return { ok: false, reason: "heat" };
    }
  }
  return { ok: true };
}
