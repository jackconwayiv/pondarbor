import { clampHp } from "./combatRules";
import type { HeroType } from "./shantiesTypes";
import type { UseItemCheck } from "./shantiesItems";

export const REST_BASE_GOLD = 50;
export const REST_GOLD_PER_LEVEL = 10;

export function getRestCost(level: number): number {
  return REST_BASE_GOLD + REST_GOLD_PER_LEVEL * Math.max(1, level);
}

export function checkRest(hero: HeroType): UseItemCheck {
  const cost = getRestCost(hero.level);
  if (hero.current_hp >= hero.max_hp) {
    return { ok: false, message: "Yer HP is already full." };
  }
  if (hero.gold < cost) {
    return { ok: false, message: `Not enough gold (needs ${cost}).` };
  }
  return { ok: true };
}

export function applyRest(hero: HeroType): HeroType {
  const cost = getRestCost(hero.level);
  return {
    ...hero,
    gold: hero.gold - cost,
    current_hp: clampHp(hero.max_hp),
  };
}

export const REST_COMPLETE_MESSAGE =
  "You spend the night resting in your bunk and recover all your HP.";
