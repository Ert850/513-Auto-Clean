import { describe, expect, it } from "vitest";
import { zonedToUtc } from "../time/zone.js";
import { isoDurationMs, parseGridpoint, weatherVerdict, type Forecast, type WeatherKind } from "./weather.js";

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

  it("past the forecast, or with none, lets the season decide", () => {
    const later = (mo: number, kind: WeatherKind) =>
      weatherVerdict({ startMs: zonedToUtc(2027, mo, 10, 10, 0, 0, TZ), durationMin: 120, kind, forecast: mild }).ok;
    expect(later(1, "exterior")).toBe(false);
    expect(later(3, "exterior")).toBe(true);
    expect(later(4, "correction")).toBe(true);
    expect(later(4, "coating")).toBe(false);
    expect(later(6, "coating")).toBe(true);
    expect(later(1, "interior")).toBe(true);
    expect(weatherVerdict({ startMs: at(12, 1, 10), durationMin: 120, kind: "exterior", forecast: null }))
      .toEqual({ ok: false, reason: "season" });
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
