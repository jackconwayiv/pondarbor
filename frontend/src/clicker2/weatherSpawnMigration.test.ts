import { describe, expect, it } from "vitest";

import { normalizeClicker2State, normalizeNextWeatherSpawnRemaining } from "./api";
import { WEATHER_SPAWN_MAX_MS, WEATHER_SPAWN_MIN_MS } from "./weatherEvents";

describe("normalizeNextWeatherSpawnRemaining", () => {
  it("keeps positive play-time remaining", () => {
    expect(
      normalizeNextWeatherSpawnRemaining({
        next_weather_spawn_remaining_ms: 600_000,
      }),
    ).toBe(600_000);
  });

  it("discards legacy wall-clock target and rolls fresh delay", () => {
    const remaining = normalizeNextWeatherSpawnRemaining({
      next_weather_spawn_at_ms: Date.now() - 60_000,
    });
    expect(remaining).toBeGreaterThanOrEqual(WEATHER_SPAWN_MIN_MS);
    expect(remaining).toBeLessThanOrEqual(WEATHER_SPAWN_MAX_MS);
  });

  it("returns 0 when no weather schedule is stored", () => {
    expect(normalizeNextWeatherSpawnRemaining({})).toBe(0);
  });
});

describe("normalizeClicker2State weather field", () => {
  it("migrates legacy wall-clock saves to remaining ms", () => {
    const state = normalizeClicker2State({
      energy: 0,
      owned_denizens: {},
      owned_specialties: {},
      revealed_denizens: { ripples: true },
      next_weather_spawn_at_ms: 1,
      statistics: {},
    });
    expect(state.next_weather_spawn_remaining_ms).toBeGreaterThanOrEqual(
      WEATHER_SPAWN_MIN_MS,
    );
    expect(
      (state as { next_weather_spawn_at_ms?: number }).next_weather_spawn_at_ms,
    ).toBeUndefined();
  });
});
