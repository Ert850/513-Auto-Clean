import { describe, expect, it } from "vitest";
import { zonedToUtc } from "../time/zone.js";
import { coldPause, isoDurationMs, nextWarmEnoughDay, parseGridpoint, typicalTempF, weatherVerdict, type Forecast, type WeatherKind } from "./weather.js";

const TZ = "America/New_York";
const at = (mo: number, d: number, h: number) => zonedToUtc(2026, mo, d, h, 0, 0, TZ);
const H = 3_600_000;

/** Hourly weather from 6am to 10pm on 17 November. */
function forecast(
  tempF: (h: number) => number,
  rain: { h: number; mmPer6h: number }[] = [],
  cloud: (h: number) => number = () => 80,
): Forecast {
  const tempSpans = [];
  const sky = [];
  for (let h = 6; h < 22; h++) {
    tempSpans.push({ start: at(11, 17, h), end: at(11, 17, h) + H, value: tempF(h) });
    sky.push({ start: at(11, 17, h), end: at(11, 17, h) + H, value: cloud(h) });
  }
  const rainMm = rain.map((r) => ({ start: at(11, 17, r.h), end: at(11, 17, r.h) + 6 * H, value: r.mmPer6h }));
  return { tempF: tempSpans, rainMm, skyCover: sky, until: at(11, 17, 22) };
}

const v = (kind: WeatherKind, startH: number, hours: number, f: Forecast, covered = false) =>
  weatherVerdict({ startMs: at(11, 17, startH), durationMin: hours * 60, kind, forecast: f, covered });

describe("weatherVerdict", () => {
  const mild = forecast((h) => (h < 10 ? 36 : 48));

  it("interior work ignores the cold, and stops only for a downpour without cover", () => {
    expect(v("interior", 7, 2, mild).ok).toBe(true);
    const storm = forecast(() => 50, [{ h: 12, mmPer6h: 150 }]); // 25 mm an hour
    const shower = forecast(() => 50, [{ h: 12, mmPer6h: 60 }]); // 10 mm an hour
    expect(v("interior", 12, 2, storm)).toEqual({ ok: false, reason: "rain" });
    expect(v("interior", 12, 2, shower).ok).toBe(true);
    expect(v("interior", 12, 2, storm, true).ok, "a garage makes the storm irrelevant").toBe(true);
  });

  it("exterior: not under 40°F, not over 4 mm/h, and a mist is fine", () => {
    expect(v("exterior", 8, 2, mild)).toEqual({ ok: false, reason: "cold" });
    expect(v("exterior", 10, 4, mild).ok).toBe(true);
    expect(v("exterior", 12, 2, forecast(() => 50, [{ h: 12, mmPer6h: 3 }])).ok).toBe(true);
    expect(v("exterior", 12, 2, forecast(() => 50, [{ h: 12, mmPer6h: 30 }]))).toEqual({ ok: false, reason: "rain" });
  });

  it("cover lifts rain and sun, never the cold", () => {
    expect(v("exterior", 12, 2, forecast(() => 50, [{ h: 12, mmPer6h: 30 }]), true).ok).toBe(true);
    expect(v("exterior", 8, 2, mild, true)).toEqual({ ok: false, reason: "cold" });
  });

  it("correction: 50°F (the design choice), no rain, not hot and clear", () => {
    expect(v("correction", 10, 3, forecast(() => 52)).ok).toBe(true);
    expect(v("correction", 10, 3, forecast(() => 48))).toEqual({ ok: false, reason: "cold" });
    expect(v("correction", 12, 2, forecast(() => 70, [{ h: 12, mmPer6h: 3 }]))).toEqual({ ok: false, reason: "rain" });
  });

  it("heat needs both: hot AND clear sun", () => {
    const summer = (h: number) => (h >= 11 && h < 17 ? 92 : 75);
    const clear = forecast(summer, [], () => 10);
    const cloudy = forecast(summer, [], () => 70);
    expect(v("correction", 12, 3, clear)).toEqual({ ok: false, reason: "heat" });
    expect(v("correction", 12, 3, cloudy).ok, "hot but overcast is workable").toBe(true);
    expect(v("correction", 7, 3, clear).ok, "the morning stays open").toBe(true);
    expect(v("correction", 12, 3, clear, true).ok, "inside, the sun does not matter").toBe(true);
    expect(v("exterior", 12, 3, clear).ok, "exterior allows up to 100°F").toBe(true);
    const scorch = forecast(() => 103, [], () => 5);
    expect(v("exterior", 12, 2, scorch)).toEqual({ ok: false, reason: "heat" });
  });

  it("coating needs 60°F even under cover", () => {
    expect(v("coating", 10, 3, forecast(() => 58), true)).toEqual({ ok: false, reason: "cold" });
    expect(v("coating", 10, 3, forecast(() => 64)).ok).toBe(true);
  });

  it("past the forecast: exterior goes by typical temperatures, correction and coating by season", () => {
    const later = (mo: number, d: number, h: number, kind: WeatherKind, hours = 2) =>
      weatherVerdict({ startMs: zonedToUtc(2027, mo, d, h, 0, 0, TZ), durationMin: hours * 60, kind, forecast: mild });
    // Exterior (owner, November 11): typical weather, not a calendar season.
    expect(later(1, 10, 11, "exterior")).toEqual({ ok: false, reason: "typical" }); // mid-January: mid 30s
    expect(later(3, 10, 11, "exterior").ok).toBe(true);
    expect(later(11, 25, 11, "exterior").ok, "late November midday was closed by the old season").toBe(true);
    expect(later(12, 1, 8, "exterior").ok, "a 1 December 8am start is typically below 40").toBe(false);
    expect(later(12, 1, 12, "exterior").ok, "...noon is typically 42 to 45").toBe(true);
    // The others keep their seasons.
    expect(later(4, 10, 10, "correction").ok).toBe(true);
    expect(later(4, 10, 10, "coating")).toEqual({ ok: false, reason: "season" });
    expect(later(6, 10, 10, "coating").ok).toBe(true);
    expect(later(1, 10, 10, "interior").ok).toBe(true);
    expect(weatherVerdict({ startMs: zonedToUtc(2027, 1, 20, 12, 0, 0, TZ), durationMin: 120, kind: "exterior", forecast: null }))
      .toEqual({ ok: false, reason: "typical" });
  });

  it("reads NOAA's hourly normals in local standard time", () => {
    expect(typicalTempF(zonedToUtc(2027, 1, 1, 0, 0, 0, TZ))).toBe(32); // first value in the table
    expect(typicalTempF(zonedToUtc(2027, 7, 15, 15, 0, 0, TZ))).toBeGreaterThan(80); // a July afternoon
    expect(typicalTempF(zonedToUtc(2028, 2, 29, 12, 0, 0, TZ))).toBe(typicalTempF(zonedToUtc(2027, 2, 28, 12, 0, 0, TZ)));
  });
});

describe("parseGridpoint", () => {
  it("reads the NWS layers into °F, rain and cloud spans", () => {
    expect(isoDurationMs("PT6H")).toBe(6 * H);
    expect(isoDurationMs("P1DT3H")).toBe(27 * H);
    const f = parseGridpoint({
      properties: {
        temperature: { values: [{ validTime: "2026-11-17T15:00:00+00:00/PT2H", value: 10 }] },
        quantitativePrecipitation: { values: [{ validTime: "2026-11-17T12:00:00+00:00/PT6H", value: 1.5 }] },
        skyCover: { values: [{ validTime: "2026-11-17T15:00:00+00:00/PT1H", value: 20 }] },
      },
    })!;
    expect(f.tempF[0]!.value).toBe(50);
    expect(f.tempF[0]!.end - f.tempF[0]!.start).toBe(2 * H);
    expect(f.rainMm[0]!.value).toBe(1.5);
    expect(f.skyCover[0]!.value).toBe(20);
    expect(f.until).toBe(Date.parse("2026-11-17T17:00:00Z"));
    expect(parseGridpoint(null)).toBeNull();
    expect(parseGridpoint({ properties: {} })).toBeNull();
  });
});

describe("the cold pause on exterior (owner, November 11)", () => {
  const noon = (y: number, mo: number, d: number) => zonedToUtc(y, mo, d, 12, 0, 0, TZ);
  const midnight = (y: number, mo: number, d: number) => zonedToUtc(y, mo, d, 0, 0, 0, TZ);

  it("no pause in November: there is a warm-enough day this week", () => {
    expect(coldPause({ kind: "exterior", durationMin: 75, forecast: null, nowMs: noon(2026, 11, 11) })).toBeNull();
  });

  it("in early January it pauses, and names the typical first day back (late February)", () => {
    const p = coldPause({ kind: "exterior", durationMin: 75, forecast: null, nowMs: noon(2027, 1, 5) });
    expect(p).not.toBeNull();
    const next = new Date(p!.nextDayMs!);
    expect(next.getTime()).toBeGreaterThan(midnight(2027, 2, 10));
    expect(next.getTime()).toBeLessThan(midnight(2027, 3, 10));
  });

  it("a forecast warm spell inside the two weeks lifts the pause", () => {
    const now = noon(2027, 1, 5);
    // Hourly, 5 to 12 January: 30°F, except all of the 8th at 52°F.
    const tempF = [];
    for (let t = zonedToUtc(2027, 1, 5, 0, 0, 0, TZ); t < zonedToUtc(2027, 1, 12, 0, 0, 0, TZ); t += H) {
      tempF.push({ start: t, end: t + H, value: t >= midnight(2027, 1, 8) && t < midnight(2027, 1, 9) ? 52 : 30 });
    }
    const warm: Forecast = { tempF, rainMm: [], skyCover: [], until: zonedToUtc(2027, 1, 12, 0, 0, 0, TZ) };
    expect(nextWarmEnoughDay({ kind: "exterior", durationMin: 75, forecast: warm, nowMs: now })).toBe(midnight(2027, 1, 8));
    expect(coldPause({ kind: "exterior", durationMin: 75, forecast: warm, nowMs: now })).toBeNull();
  });

  it("rain never causes the pause: only the cold does", () => {
    const now = noon(2026, 11, 11);
    const wetMild: Forecast = {
      tempF: [{ start: now - 12 * H, end: now + 7 * 24 * H, value: 55 }],
      rainMm: [{ start: now - 12 * H, end: now + 7 * 24 * H, value: 999 }], skyCover: [], until: now + 7 * 24 * H,
    };
    expect(coldPause({ kind: "exterior", durationMin: 75, forecast: wetMild, nowMs: now })).toBeNull();
  });

  it("interior never pauses", () => {
    expect(coldPause({ kind: "interior", durationMin: 120, forecast: null, nowMs: noon(2027, 1, 15) })).toBeNull();
  });
});
