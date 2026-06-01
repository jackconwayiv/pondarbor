import { describe, expect, it } from "vitest";

import { EL_NINO_SPECIALTY_ID } from "./fossilShop";
import {
  clickWeatherMultiplier,
  effectiveClickValue,
  epsWeatherMultiplier,
  remainingMsUntilWeatherSpawn,
  scaleWeatherSpawnDelayMs,
  scheduleWeatherSpawnRemainingMs,
  shopSurfaceForWeather,
  startBlusterBoost,
  startRainBoost,
  SUNSHINE_SHOP_BACKGROUND,
  sunWeatherBonus,
  weatherAmbientFromBoosts,
  WEATHER_FADE_IN_MS,
  WEATHER_FADE_OUT_MS,
  WEATHER_SPAWN_CHANCES_PERCENT,
  WEATHER_SPAWN_MAX_MS,
  WEATHER_SPAWN_MIN_MS,
  WEATHER_VARIANT_IDS,
  WEATHER_VARIANTS,
  WEATHER_VISIBLE_MS_14,
  WEATHER_VISIBLE_MS_17,
  WEATHER_VISIBLE_MS_20,
  weatherVisibleFadeTier,
  type WeatherVariantId,
} from "./weatherEvents";

describe("weather spawn scheduling", () => {
  it("rolls delay within 5–15 minutes", () => {
    const remaining = scheduleWeatherSpawnRemainingMs();
    expect(remaining).toBeGreaterThanOrEqual(WEATHER_SPAWN_MIN_MS);
    expect(remaining).toBeLessThanOrEqual(WEATHER_SPAWN_MAX_MS);
  });

  it("scales spawn delay with El Niño owned", () => {
    const base = 600_000;
    expect(scaleWeatherSpawnDelayMs(base, {})).toBe(base);
    expect(
      scaleWeatherSpawnDelayMs(base, { [EL_NINO_SPECIALTY_ID]: true }),
    ).toBe(Math.floor(base * 0.95));
  });

  it("computes session remaining from performance deadline", () => {
    const now = 10_000;
    expect(remainingMsUntilWeatherSpawn(now + 5_000, now)).toBe(5_000);
    expect(remainingMsUntilWeatherSpawn(now - 1, now)).toBe(0);
  });
});

describe("weather variant catalog", () => {
  it("spawn chances sum to 100%", () => {
    const total = WEATHER_VARIANT_IDS.reduce(
      (sum, id) => sum + WEATHER_SPAWN_CHANCES_PERCENT[id],
      0,
    );
    expect(total).toBeCloseTo(100, 5);
  });

  it("family totals match 30/30/40 rain wind sun", () => {
    const byFamily = { rain: 0, bluster: 0, sun: 0 };
    for (const id of WEATHER_VARIANT_IDS) {
      byFamily[WEATHER_VARIANTS[id].family] += WEATHER_SPAWN_CHANCES_PERCENT[id];
    }
    expect(byFamily.rain).toBeCloseTo(30, 5);
    expect(byFamily.bluster).toBeCloseTo(30, 5);
    expect(byFamily.sun).toBeCloseTo(40, 5);
  });

  it("visible ms tiers are 14s 17s 20s with 1s in and 3s out", () => {
    expect(WEATHER_VISIBLE_MS_14).toBe(WEATHER_FADE_IN_MS + 10_000 + WEATHER_FADE_OUT_MS);
    expect(WEATHER_VISIBLE_MS_17).toBe(WEATHER_FADE_IN_MS + 13_000 + WEATHER_FADE_OUT_MS);
    expect(WEATHER_VISIBLE_MS_20).toBe(WEATHER_FADE_IN_MS + 16_000 + WEATHER_FADE_OUT_MS);
    expect(weatherVisibleFadeTier(WEATHER_VISIBLE_MS_14)).toBe("14");
    expect(weatherVisibleFadeTier(WEATHER_VISIBLE_MS_17)).toBe("17");
    expect(weatherVisibleFadeTier(WEATHER_VISIBLE_MS_20)).toBe("20");
  });

  it("sun bonuses grant eps minutes of passive income", () => {
    expect(sunWeatherBonus(100, "sunshine")).toBe(Math.floor(100 * 15 * 60));
    expect(sunWeatherBonus(100, "mostly_sunny")).toBe(Math.floor(100 * 10 * 60));
    expect(sunWeatherBonus(100, "partly_sunny")).toBe(Math.floor(100 * 5 * 60));
  });

  it("sunshine pulse tints shop when no rain or wind boost", () => {
    expect(
      shopSurfaceForWeather({
        clickMultiplier: 1,
        epsMultiplier: 1,
        sunshinePulseActive: true,
      }),
    ).toBe(SUNSHINE_SHOP_BACKGROUND);
    expect(
      shopSurfaceForWeather({
        clickMultiplier: 25,
        epsMultiplier: 1,
        sunshinePulseActive: true,
      }),
    ).not.toBe(SUNSHINE_SHOP_BACKGROUND);
  });

  it("wind events grant EpS boost only, not click multiplier", () => {
    const now = 5_000;
    const galeEps = startBlusterBoost("howling_gale", now);
    expect(galeEps.peakMultiplier).toBe(10);
    expect(epsWeatherMultiplier(galeEps, now + 30_000)).toBe(10);
    expect(clickWeatherMultiplier(null, now)).toBe(1);
    expect(WEATHER_VARIANTS.howling_gale.clickMultiplier).toBeUndefined();
    expect(
      weatherAmbientFromBoosts({ clickMultiplier: 1, epsMultiplier: 10 }),
    ).toBe("bluster");
  });

  it("wind boosts click-from-EpS reflections without changing click baseline", () => {
    const breakdown = { clickBaseline: 5, clickFromEpSPercent: 100 };
    const boost = startBlusterBoost("howling_gale", 1_000);
    expect(effectiveClickValue(breakdown, null, boost, 2_000)).toBe(1_005);
    expect(effectiveClickValue(breakdown, null, null, 2_000)).toBe(105);
  });

  it("rain still multiplies the full click value including wind-boosted EpS reflections", () => {
    const breakdown = { clickBaseline: 5, clickFromEpSPercent: 100 };
    const rain = startRainBoost("rainstorm", 1_000);
    const wind = startBlusterBoost("howling_gale", 1_000);
    expect(effectiveClickValue(breakdown, rain, wind, 2_000)).toBe(50_250);
  });

  it("rain click multiplier is instant full strength during hold", () => {
    const now = 1_000;
    const boost = { untilPerfMs: now + 5_000, peakMultiplier: 50 };
    expect(clickWeatherMultiplier(boost, now + 500)).toBe(50);
    expect(clickWeatherMultiplier(boost, now + 2_500)).toBe(50);
    expect(clickWeatherMultiplier(boost, now + 4_999)).toBe(50);
    expect(clickWeatherMultiplier(boost, now + 5_001)).toBe(1);
    expect(clickWeatherMultiplier(null, now)).toBe(1);
  });

  it("each variant has unique display name", () => {
    const names = WEATHER_VARIANT_IDS.map((id) => WEATHER_VARIANTS[id].name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("variant weights match spec", () => {
    const weights: Record<WeatherVariantId, number> = {
      downpour: 5,
      rainstorm: 10,
      drizzle: 15,
      howling_gale: 5,
      strong_wind: 10,
      steady_breeze: 15,
      sunshine: 5,
      mostly_sunny: 15,
      partly_sunny: 20,
    };
    for (const id of WEATHER_VARIANT_IDS) {
      expect(WEATHER_VARIANTS[id].spawnWeight).toBe(weights[id]);
    }
  });
});
