import type { DungeonType, IslandType } from "./shantiesTypes";

export type EncounterLevelContext = {
  heroLevel: number;
  scope: "sea" | "island" | "islandDungeon" | "wreck";
  island: IslandType | null;
  dungeon: DungeonType | null;
};

export function resolveEncounterBaseLevel(context: EncounterLevelContext): number {
  const heroLevel = Math.max(1, Math.floor(context.heroLevel));
  if (context.scope === "island" && context.island) {
    return Math.max(1, heroLevel + context.island.levelFactor);
  }
  if (context.scope === "islandDungeon" && context.dungeon) {
    return Math.max(1, heroLevel + context.dungeon.levelFactor);
  }
  return heroLevel;
}

export function levelOffsetFromRoll(roll: number): -1 | 0 | 1 {
  if (roll < 0.15) return -1;
  if (roll < 0.25) return 1;
  return 0;
}

export function rollEncounterLevel(
  baseLevel: number,
  randomValue = Math.random(),
): number {
  const base = Math.max(1, Math.floor(baseLevel));
  const offset = levelOffsetFromRoll(randomValue);
  const low = Math.max(1, base - 1);
  const high = base + 1;
  return Math.min(high, Math.max(low, base + offset));
}
