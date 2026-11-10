/**
 * Weather rules for outdoor work (owner, November 10).
 *
 *   Exterior work:              not below 40°F, not in heavy rain.
 *   Paint correction, coatings: not below 60°F, not in any rain.
 *   Interior work:              any weather.
 *
 * Inside the forecast (the National Weather Service gives about 7 days,
 * hourly, free for any use) every hour of the job is checked. Past the
 * forecast nobody knows, so the season decides: exterior work is open from
 * March to October, correction and coatings from May to September. With no
 * forecast at all, the season decides everything, which in winter is the
 * owner's "lock exterior out until March".
 */
import { localParts } from "../time/zone.js";

const TZ = "America/New_York";
const HOUR_MS = 3_600_000;

export type WeatherKind = "none" | "exterior" | "coating";

export const WEATHER_RULES = {
  exterior: {
    minTempF: 40,
    // "Heavy rain". Forecast rain comes as an amount over a period, so this
    // is the hourly rate: 4 mm an hour is well past a drizzle. Tune here.
    maxRainMmPerHour: 4,
    /** Months (1 to 12) open past the forecast. */
    seasonMonths: [3, 4, 5, 6, 7, 8, 9, 10],
  },
  coating: {
    minTempF: 60,
    // "Can't do in rain": anything measurable.
    maxRainMmPerHour: 0.25,
    seasonMonths: [5, 6, 7, 8, 9],
  },
} as const;

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
  /** Nothing is known after this. */
  until: number;
}

export type WeatherVerdict = { ok: true } | { ok: false; reason: "cold" | "rain" | "season" };

/** "PT6H", "P1DT3H", "PT30M" as milliseconds. */
export function isoDurationMs(text: string): number {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/.exec(text);
  if (!m) return 0;
  return ((Number(m[1] ?? 0) * 24 + Number(m[2] ?? 0)) * 60 + Number(m[3] ?? 0)) * 60_000;
}

/**
 * The NWS gridpoint reply (api.weather.gov/gridpoints/ILN/36,38), reduced to
 * what the rules need. Temperatures arrive in °C; rain in mm per span.
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
  if (!tempF.length) return null;
  // Trust only what both layers cover.
  const until = Math.min(
    Math.max(...tempF.map((s) => s.end)),
    rainMm.length ? Math.max(...rainMm.map((s) => s.end)) : Infinity,
  );
  return { tempF, rainMm, until };
}

/** May this job be booked at this start, weather-wise? */
export function weatherVerdict(req: {
  startMs: number;
  durationMin: number;
  kind: WeatherKind;
  forecast: Forecast | null;
  timeZone?: string;
}): WeatherVerdict {
  if (req.kind === "none") return { ok: true };
  const rule = WEATHER_RULES[req.kind];
  const end = req.startMs + req.durationMin * 60_000;
  const f = req.forecast;

  if (!f || end > f.until) {
    const month = localParts(req.startMs, req.timeZone ?? TZ).mo;
    return (rule.seasonMonths as readonly number[]).includes(month) ? { ok: true } : { ok: false, reason: "season" };
  }

  const during = (s: ForecastSpan) => s.end > req.startMs && s.start < end;
  if (f.tempF.some((s) => during(s) && s.value < rule.minTempF)) return { ok: false, reason: "cold" };
  if (f.rainMm.some((s) => during(s) && s.value / ((s.end - s.start) / HOUR_MS) > rule.maxRainMmPerHour)) {
    return { ok: false, reason: "rain" };
  }
  return { ok: true };
}
