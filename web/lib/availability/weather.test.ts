import { describe, expect, it } from "vitest";
import { zonedToUtc } from "../time/zone.js";
import { isoDurationMs, parseGridpoint, weatherVerdict, type Forecast } from "./weather.js";

const TZ = "America/New_York";
const at = (mo: number, d: number, h: number) => zonedToUtc(2026, mo, d, h, 0, 0, TZ);
const H = 3_600_000;

/** Hourly temperatures from 6am to 10pm on 17 November, plus a rain spell. */
function forecast(tempF: (h: number) => number, rain: { h: number; mmPer6h: number }[] = []): Forecast {
  const temps = [];
  for (let h = 6; h < 22; h++) temps.push({ start: at(11, 17, h), end: at(11, 17, h) + H, value: tempF(h) });
  const rainMm = rain.map((r) => ({ start: at(11, 17, r.h), end: at(11, 17, r.h) + 6 * H, value: r.mmPer6h }));
  return { tempF: temps, rainMm, until: at(11, 17, 22) };
}

describe("weatherVerdict", () => {
  const mild = forecast((h) => (h < 10 ? 36 : 48));

  it("never limits interior work", () => {
    expect(weatherVerdict({ startMs: at(1, 15, 10), durationMin: 240, kind: "none", forecast: null }).ok).toBe(true);
  });

  it("blocks exterior work in any hour under 40°F", () => {
    expect(weatherVerdict({ startMs: at(11, 17, 8), durationMin: 120, kind: "exterior", forecast: mild }))
      .toEqual({ ok: false, reason: "cold" });
    expect(weatherVerdict({ startMs: at(11, 17, 10), durationMin: 240, kind: "exterior", forecast: mild }).ok).toBe(true);
  });

  it("blocks exterior work in heavy rain, not in a drizzle", () => {
    const drizzle = forecast(() => 50, [{ h: 12, mmPer6h: 3 }]);
    const pour = forecast(() => 50, [{ h: 12, mmPer6h: 30 }]);
    expect(weatherVerdict({ startMs: at(11, 17, 12), durationMin: 120, kind: "exterior", forecast: drizzle }).ok).toBe(true);
    expect(weatherVerdict({ startMs: at(11, 17, 12), durationMin: 120, kind: "exterior", forecast: pour }))
      .toEqual({ ok: false, reason: "rain" });
  });

  it("holds coatings to 60°F and no rain at all", () => {
    const warm = forecast(() => 64, [{ h: 14, mmPer6h: 3 }]);
    expect(weatherVerdict({ startMs: at(11, 17, 10), durationMin: 180, kind: "coating", forecast: warm }).ok).toBe(true);
    expect(weatherVerdict({ startMs: at(11, 17, 13), durationMin: 180, kind: "coating", forecast: warm }))
      .toEqual({ ok: false, reason: "rain" });
    expect(weatherVerdict({ startMs: at(11, 17, 10), durationMin: 180, kind: "coating", forecast: mild }))
      .toEqual({ ok: false, reason: "cold" });
  });

  it("past the forecast, or with none, lets the season decide", () => {
    const later = (mo: number, kind: "exterior" | "coating") =>
      weatherVerdict({ startMs: zonedToUtc(2027, mo, 10, 10, 0, 0, TZ), durationMin: 120, kind, forecast: mild }).ok;
    expect(later(1, "exterior")).toBe(false);
    expect(later(2, "exterior")).toBe(false);
    expect(later(3, "exterior")).toBe(true);
    expect(later(4, "coating")).toBe(false);
    expect(later(6, "coating")).toBe(true);
    expect(weatherVerdict({ startMs: at(12, 1, 10), durationMin: 120, kind: "exterior", forecast: null }))
      .toEqual({ ok: false, reason: "season" });
  });
});

describe("parseGridpoint", () => {
  it("reads the NWS layers into °F and rain spans", () => {
    expect(isoDurationMs("PT6H")).toBe(6 * H);
    expect(isoDurationMs("P1DT3H")).toBe(27 * H);
    const f = parseGridpoint({
      properties: {
        temperature: { values: [{ validTime: "2026-11-17T15:00:00+00:00/PT2H", value: 10 }] },
        quantitativePrecipitation: { values: [{ validTime: "2026-11-17T12:00:00+00:00/PT6H", value: 1.5 }] },
      },
    })!;
    expect(f.tempF[0]!.value).toBe(50);
    expect(f.tempF[0]!.end - f.tempF[0]!.start).toBe(2 * H);
    expect(f.rainMm[0]!.value).toBe(1.5);
    expect(f.until).toBe(Date.parse("2026-11-17T17:00:00Z"));
    expect(parseGridpoint(null)).toBeNull();
    expect(parseGridpoint({ properties: {} })).toBeNull();
  });
});
