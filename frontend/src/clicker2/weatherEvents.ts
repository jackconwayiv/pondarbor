import { DESIGN } from "../theme/tokens";

import { formatEnergyAmount } from "./formatEnergy";

export type WeatherFamily = "rain" | "bluster" | "sun";

export type WeatherVariantId =
  | "downpour"
  | "rainstorm"
  | "drizzle"
  | "howling_gale"
  | "strong_wind"
  | "steady_breeze"
  | "sunshine"
  | "mostly_sunny"
  | "partly_sunny";

/** @deprecated Use `WeatherFamily`. */
export type WeatherEventKind = WeatherFamily;

export const WEATHER_SPAWN_MIN_MS = 5 * 60 * 1000;
export const WEATHER_SPAWN_MAX_MS = 15 * 60 * 1000;
export const WEATHER_FADE_IN_MS = 1_000;
export const WEATHER_FADE_OUT_MS = 3_000;

export const WEATHER_VISIBLE_MS_14 = WEATHER_FADE_IN_MS + 10_000 + WEATHER_FADE_OUT_MS;
export const WEATHER_VISIBLE_MS_17 = WEATHER_FADE_IN_MS + 13_000 + WEATHER_FADE_OUT_MS;
export const WEATHER_VISIBLE_MS_20 = WEATHER_FADE_IN_MS + 16_000 + WEATHER_FADE_OUT_MS;

/** @deprecated Use per-variant `visibleMs`. */
export const WEATHER_HOLD_MS = 10_000;
/** @deprecated Use per-variant `visibleMs`. */
export const WEATHER_VISIBLE_MS = WEATHER_VISIBLE_MS_14;

export const WIND_EPS_BOOST_MS = 60_000;

/** Page backdrop fade-out when the weather ambient changes. */
export const WEATHER_PAGE_BACKGROUND_FADE_MS = 1_000;
export const SUNSHINE_FADE_IN_MS = WEATHER_PAGE_BACKGROUND_FADE_MS;
export const SUNSHINE_HOLD_MS = 5_000;
export const SUNSHINE_FADE_OUT_MS = WEATHER_PAGE_BACKGROUND_FADE_MS;
/** Fade to yellow, hold, fade back to clear green. */
export const SUNSHINE_PULSE_MS =
  SUNSHINE_FADE_IN_MS + SUNSHINE_HOLD_MS + SUNSHINE_FADE_OUT_MS;

/** Full-page sunshine pulse tint (yellow), layered over clear green. */
export const SUNSHINE_PAGE_BACKGROUND = "#F3E6A8";
/** Shop column during sun weather — lighter than page pulse so cards stay readable. */
export const SUNSHINE_SHOP_BACKGROUND = "#FAF6DC";

/** Ambient weather for page + shop surfaces (not the floating emoji alone). */
export type WeatherAmbient = "clear" | WeatherFamily;

export type WeatherSurfacePair = {
  page: string;
  shop: string;
};

export const WEATHER_SURFACE_BY_AMBIENT: Readonly<
  Record<WeatherAmbient, WeatherSurfacePair>
> = {
  clear: { page: DESIGN.lilypad, shop: DESIGN.lilypadLight },
  rain: { page: DESIGN.sky, shop: DESIGN.skyLight },
  bluster: { page: DESIGN.grayMediumBase, shop: DESIGN.grayLightBase },
  sun: { page: SUNSHINE_PAGE_BACKGROUND, shop: SUNSHINE_SHOP_BACKGROUND },
};

export type WeatherVariantDef = {
  id: WeatherVariantId;
  family: WeatherFamily;
  name: string;
  emoji: string;
  spawnWeight: number;
  visibleMs: number;
  clickMultiplier?: number;
  clickBoostHoldMs?: number;
  epsMultiplier?: number;
  epsBoostMs?: number;
  epsMinutes?: number;
};

export const WEATHER_VARIANTS: Readonly<Record<WeatherVariantId, WeatherVariantDef>> =
  {
    downpour: {
      id: "downpour",
      family: "rain",
      name: "Downpour!",
      emoji: "⛈️",
      spawnWeight: 5,
      visibleMs: WEATHER_VISIBLE_MS_14,
      clickMultiplier: 100,
      clickBoostHoldMs: 10_000,
    },
    rainstorm: {
      id: "rainstorm",
      family: "rain",
      name: "Rainstorm!",
      emoji: "🌧️",
      spawnWeight: 10,
      visibleMs: WEATHER_VISIBLE_MS_17,
      clickMultiplier: 50,
      clickBoostHoldMs: 12_000,
    },
    drizzle: {
      id: "drizzle",
      family: "rain",
      name: "Drizzle!",
      emoji: "☔",
      spawnWeight: 15,
      visibleMs: WEATHER_VISIBLE_MS_20,
      clickMultiplier: 25,
      clickBoostHoldMs: 15_000,
    },
    howling_gale: {
      id: "howling_gale",
      family: "bluster",
      name: "Howling Gale!",
      emoji: "🌪️",
      spawnWeight: 5,
      visibleMs: WEATHER_VISIBLE_MS_14,
      epsMultiplier: 10,
      epsBoostMs: WIND_EPS_BOOST_MS,
    },
    strong_wind: {
      id: "strong_wind",
      family: "bluster",
      name: "Strong Wind!",
      emoji: "🌬️",
      spawnWeight: 10,
      visibleMs: WEATHER_VISIBLE_MS_17,
      epsMultiplier: 7,
      epsBoostMs: WIND_EPS_BOOST_MS,
    },
    steady_breeze: {
      id: "steady_breeze",
      family: "bluster",
      name: "Steady Breeze!",
      emoji: "💨",
      spawnWeight: 15,
      visibleMs: WEATHER_VISIBLE_MS_20,
      epsMultiplier: 5,
      epsBoostMs: WIND_EPS_BOOST_MS,
    },
    sunshine: {
      id: "sunshine",
      family: "sun",
      name: "Sunshine!",
      emoji: "☀️",
      spawnWeight: 5,
      visibleMs: WEATHER_VISIBLE_MS_14,
      epsMinutes: 15,
    },
    mostly_sunny: {
      id: "mostly_sunny",
      family: "sun",
      name: "Mostly Sunny",
      emoji: "⛅",
      spawnWeight: 15,
      visibleMs: WEATHER_VISIBLE_MS_17,
      epsMinutes: 10,
    },
    partly_sunny: {
      id: "partly_sunny",
      family: "sun",
      name: "Partly Sunny",
      emoji: "🌥️",
      spawnWeight: 20,
      visibleMs: WEATHER_VISIBLE_MS_20,
      epsMinutes: 5,
    },
  };

export const WEATHER_VARIANT_IDS = Object.keys(
  WEATHER_VARIANTS,
) as WeatherVariantId[];

const WEATHER_SPAWN_WEIGHT_TOTAL = WEATHER_VARIANT_IDS.reduce(
  (sum, id) => sum + WEATHER_VARIANTS[id].spawnWeight,
  0,
);

export type ActiveWeatherEvent = {
  id: number;
  variantId: WeatherVariantId;
  leftPct: number;
  topPct: number;
  spawnedAtPerfMs: number;
  expiresAtPerfMs: number;
};

export type ActiveRainBoost = {
  untilPerfMs: number;
  peakMultiplier: number;
};

export type ActiveBlusterBoost = {
  untilPerfMs: number;
  peakMultiplier: number;
};

export function weatherVariantDef(id: WeatherVariantId): WeatherVariantDef {
  return WEATHER_VARIANTS[id];
}

export function weatherFamily(variantId: WeatherVariantId): WeatherFamily {
  return WEATHER_VARIANTS[variantId].family;
}

export function weatherEventEmoji(variantId: WeatherVariantId): string {
  return WEATHER_VARIANTS[variantId].emoji;
}

export function weatherEventDisplayName(variantId: WeatherVariantId): string {
  return WEATHER_VARIANTS[variantId].name;
}

export function weatherVisibleFadeTier(
  visibleMs: number,
): "14" | "17" | "20" {
  if (visibleMs >= WEATHER_VISIBLE_MS_20) return "20";
  if (visibleMs >= WEATHER_VISIBLE_MS_17) return "17";
  return "14";
}

function spawnChancePercentsFromWeights(): Record<WeatherVariantId, number> {
  const tenthsById = Object.fromEntries(
    WEATHER_VARIANT_IDS.map((id) => [id, 0]),
  ) as Record<WeatherVariantId, number>;

  const ranked = WEATHER_VARIANT_IDS.map((id) => {
    const weight = WEATHER_VARIANTS[id].spawnWeight;
    const exact = (weight / WEATHER_SPAWN_WEIGHT_TOTAL) * 1000;
    const tenths = Math.floor(exact);
    return { id, tenths, frac: exact - tenths };
  });

  for (const { id, tenths } of ranked) {
    tenthsById[id] = tenths;
  }

  let remainder =
    1000 -
    WEATHER_VARIANT_IDS.reduce((sum, id) => sum + tenthsById[id], 0);
  const order = [...ranked].sort((a, b) => b.frac - a.frac);
  for (let i = 0; remainder > 0; i += 1, remainder -= 1) {
    tenthsById[order[i % order.length]!.id] += 1;
  }

  return Object.fromEntries(
    WEATHER_VARIANT_IDS.map((id) => [id, tenthsById[id] / 10]),
  ) as Record<WeatherVariantId, number>;
}

export const WEATHER_SPAWN_CHANCES_PERCENT: Readonly<
  Record<WeatherVariantId, number>
> = spawnChancePercentsFromWeights();

export type WeatherEventCatalogEntry = {
  variantId: WeatherVariantId;
  family: WeatherFamily;
  name: string;
  emoji: string;
  spawnChancePercent: number;
  effectSummary: string;
  notes: readonly string[];
};

function formatDurationMs(ms: number): string {
  if (ms % 60_000 === 0) {
    const min = ms / 60_000;
    return min === 1 ? "1 minute" : `${min} minutes`;
  }
  if (ms % 1_000 === 0) return `${ms / 1_000} seconds`;
  return `${ms} ms`;
}

function variantEffectSummary(def: WeatherVariantDef): string {
  if (def.family === "rain") {
    const holdSec = (def.clickBoostHoldMs ?? 0) / 1000;
    return `${def.clickMultiplier}× click energy for ${holdSec} seconds`;
  }
  if (def.family === "bluster") {
    const duration = formatDurationMs(def.epsBoostMs ?? WIND_EPS_BOOST_MS);
    return `${def.epsMultiplier}× energy per second for ${duration}`;
  }
  const minutes = def.epsMinutes ?? 0;
  return `${minutes} minute${minutes === 1 ? "" : "s"} of EpS as bonus energy`;
}

function variantCatalogNotes(def: WeatherVariantDef): readonly string[] {
  const holdMs = def.visibleMs - WEATHER_FADE_IN_MS - WEATHER_FADE_OUT_MS;
  const notes: string[] = [
    `On-screen: ${formatDurationMs(def.visibleMs)} (fade in ${formatDurationMs(WEATHER_FADE_IN_MS)}, hold ${formatDurationMs(holdMs)}, fade out ${formatDurationMs(WEATHER_FADE_OUT_MS)})`,
    `Family ambient: ${def.family} page + shop colors`,
  ];
  if (def.family === "rain" || def.family === "bluster") {
    notes.push(
      `Background fade-out after boost: ${formatDurationMs(WEATHER_PAGE_BACKGROUND_FADE_MS)}`,
    );
  }
  if (def.family === "bluster") {
    notes.push("Snaps energy counter when boost ends");
  }
  if (def.family === "sun") {
    notes.push(
      `Page fades to sunshine tint for ${formatDurationMs(SUNSHINE_HOLD_MS)} (${formatDurationMs(SUNSHINE_PULSE_MS)} total)`,
      "Counted in weather_events_clicked and per-family click statistics",
    );
  }
  return notes;
}

const SPAWN_MIN_MINUTES = WEATHER_SPAWN_MIN_MS / 60_000;
const SPAWN_MAX_MINUTES = WEATHER_SPAWN_MAX_MS / 60_000;

export const WEATHER_EVENT_CATALOG: readonly WeatherEventCatalogEntry[] =
  WEATHER_VARIANT_IDS.map((variantId) => {
    const def = WEATHER_VARIANTS[variantId];
    return {
      variantId,
      family: def.family,
      name: def.name,
      emoji: def.emoji,
      spawnChancePercent: WEATHER_SPAWN_CHANCES_PERCENT[variantId],
      effectSummary: variantEffectSummary(def),
      notes: variantCatalogNotes(def),
    };
  });

export const WEATHER_CATALOG_GLOBAL_NOTES: readonly string[] = [
  `Spawn interval: ${SPAWN_MIN_MINUTES}–${SPAWN_MAX_MINUTES} minutes after the previous event ends`,
  "On-screen lifetime: 14s, 17s, or 20s by tier (1s fade in, 10–16s hold, 3s fade out)",
  "Spawn position: random % over pond stage (left 10–85%, top 14–72%)",
  "Persisted in save: next_weather_spawn_at_ms (wall-clock countdown)",
  "Rain: 30% total (5% + 10% + 15%); Wind: 30% (5% + 10% + 15%); Sun: 40% (5% + 15% + 20%)",
];

export function rollWeatherVariantId(): WeatherVariantId {
  const r = Math.random() * WEATHER_SPAWN_WEIGHT_TOTAL;
  let cumulative = 0;
  for (const id of WEATHER_VARIANT_IDS) {
    cumulative += WEATHER_VARIANTS[id].spawnWeight;
    if (r < cumulative) return id;
  }
  return WEATHER_VARIANT_IDS[WEATHER_VARIANT_IDS.length - 1]!;
}

/** @deprecated Use `rollWeatherVariantId`. */
export function rollWeatherEventKind(): WeatherFamily {
  return weatherFamily(rollWeatherVariantId());
}

export function rollWeatherSpawnDelayMs(): number {
  const span = WEATHER_SPAWN_MAX_MS - WEATHER_SPAWN_MIN_MS;
  return WEATHER_SPAWN_MIN_MS + Math.floor(Math.random() * (span + 1));
}

export function nextWeatherSpawnAtMsFromNow(nowMs = Date.now()): number {
  return nowMs + rollWeatherSpawnDelayMs();
}

export function msUntilWeatherSpawn(
  spawnAtMs: number,
  nowMs = Date.now(),
): number {
  if (!Number.isFinite(spawnAtMs) || spawnAtMs <= 0) return 0;
  return Math.max(0, spawnAtMs - nowMs);
}

export function createWeatherEvent(nowPerfMs = performance.now()): ActiveWeatherEvent {
  const variantId = rollWeatherVariantId();
  const def = weatherVariantDef(variantId);
  return {
    id: nowPerfMs + Math.random(),
    variantId,
    leftPct: 10 + Math.random() * 75,
    topPct: 14 + Math.random() * 58,
    spawnedAtPerfMs: nowPerfMs,
    expiresAtPerfMs: nowPerfMs + def.visibleMs,
  };
}

export function weatherEventOpacity(
  event: Pick<ActiveWeatherEvent, "spawnedAtPerfMs" | "expiresAtPerfMs">,
  nowPerfMs = performance.now(),
): number {
  const fadeInEnd = event.spawnedAtPerfMs + WEATHER_FADE_IN_MS;
  const fadeOutStart = event.expiresAtPerfMs - WEATHER_FADE_OUT_MS;

  if (nowPerfMs <= event.spawnedAtPerfMs) return 0;
  if (nowPerfMs < fadeInEnd) {
    return (nowPerfMs - event.spawnedAtPerfMs) / WEATHER_FADE_IN_MS;
  }
  if (nowPerfMs < fadeOutStart) return 1;
  if (nowPerfMs < event.expiresAtPerfMs) {
    return (event.expiresAtPerfMs - nowPerfMs) / WEATHER_FADE_OUT_MS;
  }
  return 0;
}

export function sunWeatherBonus(
  energyPerSecond: number,
  variantId: WeatherVariantId,
): number {
  const epsMinutes = weatherVariantDef(variantId).epsMinutes ?? 0;
  return Math.max(0, Math.floor(energyPerSecond * epsMinutes * 60));
}

export function isRainClickBoostActive(
  boost: ActiveRainBoost | null,
  nowPerfMs = performance.now(),
): boolean {
  return boost != null && boost.untilPerfMs > nowPerfMs;
}

/** Instant full click multiplier for the boost hold window. */
export function clickWeatherMultiplier(
  boost: ActiveRainBoost | null,
  nowPerfMs = performance.now(),
): number {
  if (!isRainClickBoostActive(boost, nowPerfMs)) return 1;
  return boost!.peakMultiplier;
}

export function isBlusterEpsBoostActive(
  boost: ActiveBlusterBoost | null,
  nowPerfMs = performance.now(),
): boolean {
  return boost != null && boost.untilPerfMs > nowPerfMs;
}

export function epsWeatherMultiplier(
  boost: ActiveBlusterBoost | null,
  nowPerfMs = performance.now(),
): number {
  if (!isBlusterEpsBoostActive(boost, nowPerfMs)) return 1;
  return boost!.peakMultiplier;
}

export function effectiveEnergyPerSecond(
  baseEnergyPerSecond: number,
  blusterBoost: ActiveBlusterBoost | null,
  nowPerfMs = performance.now(),
): number {
  return baseEnergyPerSecond * epsWeatherMultiplier(blusterBoost, nowPerfMs);
}

export function startRainBoost(
  variantId: WeatherVariantId,
  nowPerfMs = performance.now(),
): ActiveRainBoost {
  const def = weatherVariantDef(variantId);
  return {
    untilPerfMs: nowPerfMs + (def.clickBoostHoldMs ?? 0),
    peakMultiplier: def.clickMultiplier ?? 1,
  };
}

export function startBlusterBoost(
  variantId: WeatherVariantId,
  nowPerfMs = performance.now(),
): ActiveBlusterBoost {
  const def = weatherVariantDef(variantId);
  return {
    untilPerfMs: nowPerfMs + (def.epsBoostMs ?? WIND_EPS_BOOST_MS),
    peakMultiplier: def.epsMultiplier ?? 1,
  };
}

export function weatherAmbientFromBoosts(opts: {
  clickMultiplier: number;
  epsMultiplier: number;
}): WeatherAmbient {
  if (opts.epsMultiplier > 1) return "bluster";
  if (opts.clickMultiplier > 1) return "rain";
  return "clear";
}

export function weatherSurfacesForAmbient(
  ambient: WeatherAmbient,
): WeatherSurfacePair {
  return WEATHER_SURFACE_BY_AMBIENT[ambient];
}

/** Shop backdrop: rain/wind boosts win; otherwise sunshine pulse tints the column. */
export function shopSurfaceForWeather(opts: {
  clickMultiplier: number;
  epsMultiplier: number;
  sunshinePulseActive: boolean;
}): string {
  const ambient = weatherAmbientFromBoosts(opts);
  if (opts.sunshinePulseActive && ambient === "clear") {
    return SUNSHINE_SHOP_BACKGROUND;
  }
  return WEATHER_SURFACE_BY_AMBIENT[ambient].shop;
}

export function weatherBoostBannerTitle(variantId: WeatherVariantId): string {
  const def = weatherVariantDef(variantId);
  return `${def.emoji} ${def.name}`;
}

export function weatherBoostBannerSubtitle(variantId: WeatherVariantId): string {
  const def = weatherVariantDef(variantId);
  if (def.family === "rain") {
    const holdSec = (def.clickBoostHoldMs ?? 0) / 1000;
    return `${def.clickMultiplier}× click energy for ${holdSec} seconds`;
  }
  if (def.family === "bluster") {
    const seconds = (def.epsBoostMs ?? WIND_EPS_BOOST_MS) / 1000;
    return `${def.epsMultiplier}× energy per second for ${seconds} seconds`;
  }
  return "";
}

export function weatherEventAriaLabel(variantId: WeatherVariantId): string {
  const def = weatherVariantDef(variantId);
  if (def.family === "rain") {
    const holdSec = (def.clickBoostHoldMs ?? 0) / 1000;
    return `${def.name} — click for ${def.clickMultiplier}× pond clicks for ${holdSec} seconds`;
  }
  if (def.family === "bluster") {
    const seconds = (def.epsBoostMs ?? WIND_EPS_BOOST_MS) / 1000;
    return `${def.name} — click for ${def.epsMultiplier}× energy per second for ${seconds} seconds`;
  }
  const minutes = def.epsMinutes ?? 0;
  return `${def.name} — click for ${minutes} minute${minutes === 1 ? "" : "s"} of EpS as bonus energy`;
}

export function sunshineBoostBannerSubtitle(bonus: number): string {
  return `${formatEnergyAmount(bonus)} bonus energy added to your pond`;
}

/** @deprecated Use `WEATHER_SURFACE_BY_AMBIENT.clear.page`. */
export const CLEAR_WEATHER_PAGE_BACKGROUND =
  WEATHER_SURFACE_BY_AMBIENT.clear.page;
/** @deprecated Use `WEATHER_SURFACE_BY_AMBIENT.rain.page`. */
export const RAINSTORM_PAGE_BACKGROUND = WEATHER_SURFACE_BY_AMBIENT.rain.page;
/** @deprecated Use `WEATHER_SURFACE_BY_AMBIENT.bluster.page`. */
export const BLUSTER_PAGE_BACKGROUND = WEATHER_SURFACE_BY_AMBIENT.bluster.page;

/** @deprecated Use per-variant multipliers via `startRainBoost`. */
export const RAIN_CLICK_MULTIPLIER = 100;
/** @deprecated Use per-variant hold via `startRainBoost`. */
export const RAIN_CLICK_BOOST_HOLD_MS = 10_000;
/** @deprecated Rain boosts are instant for hold duration only. */
export const RAIN_CLICK_BOOST_TOTAL_MS = RAIN_CLICK_BOOST_HOLD_MS;
/** @deprecated Use `WIND_EPS_BOOST_MS`. */
export const BLUSTER_EPS_BOOST_MS = WIND_EPS_BOOST_MS;
/** @deprecated Use per-variant multipliers via `startBlusterBoost`. */
export const BLUSTER_EPS_MULTIPLIER = 10;
