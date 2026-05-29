import { clampHp } from "./combatRules";
import type { HeroType } from "./shantiesTypes";

export type SeaWeatherValence = "favorable" | "unfavorable";

const SEA_WEATHER_VALENCE: Record<string, SeaWeatherValence> = {
  "Fog Bank": "favorable",
  "Storm!": "unfavorable",
};

export function getSeaWeatherValence(
  weatherName: string,
): SeaWeatherValence | null {
  return SEA_WEATHER_VALENCE[weatherName] ?? null;
}

export function applySeaWeatherToHero(
  hero: HeroType,
  weatherName: string,
): HeroType {
  const valence = getSeaWeatherValence(weatherName);
  if (valence === "favorable") {
    return {
      ...hero,
      current_hp: Math.min(hero.max_hp, hero.current_hp + 1),
    };
  }
  if (valence === "unfavorable") {
    return {
      ...hero,
      current_hp: Math.max(1, clampHp(hero.current_hp - 1)),
    };
  }
  return hero;
}

export function seaWeatherEffectLabel(weatherName: string): string | null {
  const valence = getSeaWeatherValence(weatherName);
  if (valence === "favorable") return "Ye recover 1 HP.";
  if (valence === "unfavorable") return "Ye take 1 damage.";
  return null;
}
