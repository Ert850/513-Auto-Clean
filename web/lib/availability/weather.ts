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
 * in winter is bookable. Past the forecast nobody knows:
 * - EXTERIOR goes by Cincinnati's typical temperature for each hour of the
 *   job (NOAA 1991-2020 hourly normals, normals-cvg.ts), tentatively (owner,
 *   November 11: "disable exterior based on weather"; it used to be a fixed
 *   March to October season, which closed every November, December and
 *   February day past the forecast however mild those usually are).
 *   Typically that means open until about December 20 and from about
 *   February 25. The same 40°F, the same every-hour rule.
 * - Correction and coating keep their seasons (both are coming soon).
 * With no forecast at all, the same past-the-forecast rules decide.
 */
import { localParts, localDayStart, localTimeOnDay } from "../time/zone.js";
import { CVG_HOURLY_NORMALS_F } from "./normals-cvg.js";

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
  /**
   * Past the forecast: months (1 to 12) that are open, or "normals" for the
   * typical temperature of every hour of the job (normals-cvg.ts).
   */
  pastForecast: readonly number[] | "normals";
}

const ALL_YEAR = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

export const WEATHER_RULES: Record<WeatherKind, WeatherRule> = {
  interior: { minTempF: null, maxRainMmPerHour: 20, maxSunTempF: null, pastForecast: ALL_YEAR },
  // "Light peppering is fine (like a mist or intermittent)": 4 mm an hour is
  // well past a drizzle.
  exterior: { minTempF: 40, maxRainMmPerHour: 4, maxSunTempF: 100, pastForecast: "normals" },
  // "Can't do in rain": anything measurable.
  correction: { minTempF: 50, maxRainMmPerHour: 0.25, maxSunTempF: 85, pastForecast: [4, 5, 6, 7, 8, 9, 10] },
  coating: { minTempF: 60, maxRainMmPerHour: 0.25, maxSunTempF: 85, pastForecast: [5, 6, 7, 8, 9] },
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

/**
 * "season": past the forecast, a month the work is closed. "typical": past
 * the forecast, an hour of the job is typically too cold (normals).
 */
export type WeatherVerdict = { ok: true } | { ok: false; reason: "cold" | "rain" | "heat" | "season" | "typical" };

const DAYS_BEFORE_MONTH = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

/**
 * Cincinnati's typical temperature at this instant, °F (NOAA hourly normals).
 * The table is in local standard time, so the clock is read at UTC-5 all
 * year; February 29 reads as February 28.
 */
export function typicalTempF(ms: number): number {
  const est = new Date(ms - 5 * HOUR_MS);
  const mo = est.getUTCMonth();
  const day = Math.min(est.getUTCDate(), mo === 1 ? 28 : 31);
  const index = (DAYS_BEFORE_MONTH[mo]! + day - 1) * 24 + est.getUTCHours();
  return CVG_HOURLY_NORMALS_F.charCodeAt(index) - 32;
}

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
    if (rule.pastForecast === "normals") {
      if (rule.minTempF === null) return { ok: true };
      // Every hour the job touches, start and end included.
      for (let t = req.startMs; t < end + HOUR_MS; t += HOUR_MS) {
        if (typicalTempF(Math.min(t, end)) < rule.minTempF) return { ok: false, reason: "typical" };
      }
      return { ok: true };
    }
    const month = localParts(req.startMs, req.timeZone ?? TZ).mo;
    return rule.pastForecast.includes(month) ? { ok: true } : { ok: false, reason: "season" };
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

/**
 * The first day, from today, with any start (8am to 5pm, every half hour) at
 * which this work is warm enough, judged on the cold alone: rain and sun move
 * a day's times about, but only the cold closes the work for weeks. Midnight
 * of that day, or null when nothing in `maxDays` qualifies.
 */
export function nextWarmEnoughDay(req: {
  kind: WeatherKind;
  durationMin: number;
  forecast: Forecast | null;
  nowMs: number;
  maxDays?: number;
  timeZone?: string;
}): number | null {
  const tz = req.timeZone ?? TZ;
  const day0 = localDayStart(req.nowMs, tz);
  for (let d = 0; d < (req.maxDays ?? 366); d++) {
    for (let min = 8 * 60; min <= 17 * 60; min += 30) {
      const startMs = localTimeOnDay(day0, d, min, tz);
      if (startMs < req.nowMs) continue;
      // covered: lifts the rain and sun rules, leaving the cold.
      if (weatherVerdict({ startMs, durationMin: req.durationMin, kind: req.kind, forecast: req.forecast, covered: true, timeZone: tz }).ok) {
        return localTimeOnDay(day0, d, 0, tz);
      }
    }
  }
  return null;
}

/**
 * Is this work paused by the cold for the next `horizonDays` (owner, November
 * 11: "if below 40 for next 2 weeks, show ... when it's expected to next be
 * available")? Null when a day inside the horizon is warm enough; otherwise
 * the next warm-enough day (midnight), tentative past the forecast.
 */
export function coldPause(req: {
  kind: WeatherKind;
  durationMin: number;
  forecast: Forecast | null;
  nowMs: number;
  horizonDays?: number;
  timeZone?: string;
}): { nextDayMs: number | null } | null {
  const tz = req.timeZone ?? TZ;
  const next = nextWarmEnoughDay(req);
  const horizonEnd = localTimeOnDay(localDayStart(req.nowMs, tz), req.horizonDays ?? 14, 0, tz);
  return next !== null && next < horizonEnd ? null : { nextDayMs: next };
}
