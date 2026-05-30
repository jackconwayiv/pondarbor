import type { EnemyTrait } from "./shantiesTypes";

export type MonsterTemplate = {
  level: number;
  hp: number;
  armor?: number;
  traits?: readonly EnemyTrait[];
  isBoss?: boolean;
};

export const MONSTER_TEMPLATES: Record<string, MonsterTemplate> = {
  Bat: { level: 1, hp: 6, traits: ["evasive"] },
  Harpy: { level: 1, hp: 7, traits: ["evasive"] },
  Siren: { level: 1, hp: 7, traits: ["evasive"] },
  "Electric Eel": { level: 1, hp: 7 },
  Skeleton: { level: 1, hp: 9 },
  Boar: { level: 1, hp: 12, armor: 4 },
  Wolf: { level: 1, hp: 8 },
  "Cave Matriarch": { level: 1, hp: 14, traits: ["evasive"], isBoss: true },
  "Ancient Bone Captain": { level: 1, hp: 18, armor: 2, isBoss: true },
  "Temple War Boar": { level: 1, hp: 20, armor: 5, isBoss: true },
};

export const ENCOUNTER_POOLS = {
  sea: ["Harpy", "Siren"],
  island: ["Boar", "Wolf"],
  islandDungeon: ["Bat", "Skeleton"],
  wreck: ["Siren", "Electric Eel"],
} as const;

export type EncounterPoolScope = keyof typeof ENCOUNTER_POOLS;
export type IslandDungeonBossKind = "cave" | "ruins" | "temple";

export const ENCOUNTER_POOL_LABELS: Record<EncounterPoolScope, string> = {
  sea: "Sea",
  island: "Island",
  islandDungeon: "Island dungeon (cave, ruins, temple)",
  wreck: "Shipwreck dungeon",
};

export function encounterPoolScopeForDungeonKind(
  kind: string | null | undefined,
): EncounterPoolScope {
  return kind === "wreck" ? "wreck" : "islandDungeon";
}

export const ENCOUNTER_GROUP_SIZES: Record<string, string> = {
  Harpy: "1–2",
  Siren: "1",
  "Electric Eel": "1–2",
  Wolf: "1–2",
  Bat: "2",
  Boar: "1",
  Skeleton: "1–2",
  "Cave Matriarch": "1",
  "Ancient Bone Captain": "1",
  "Temple War Boar": "1",
};

const ISLAND_DUNGEON_BOSS_BY_KIND: Record<IslandDungeonBossKind, string> = {
  cave: "Cave Matriarch",
  ruins: "Ancient Bone Captain",
  temple: "Temple War Boar",
};

function rollInRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function encounterCountForMonster(name: string): number {
  switch (name) {
    case "Harpy":
    case "Electric Eel":
    case "Wolf":
    case "Skeleton":
      return rollInRange(1, 2);
    case "Siren":
    case "Boar":
      return 1;
    case "Bat":
      return 2;
    default:
      return 1;
  }
}

function pickDistinctMonsterTypes(
  pool: readonly string[],
  count: number,
): string[] {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function encounterTypeCountForScope(
  scope: EncounterPoolScope,
  poolSize: number,
): number {
  if (scope === "sea") return poolSize;
  return rollInRange(1, Math.min(2, poolSize));
}

/** Pick 1–2 monster types, then a per-type quantity for each. Sea always uses both pool types (2–3 foes). */
export function pickEncounterMonsterNames(scope: EncounterPoolScope): string[] {
  const pool = ENCOUNTER_POOLS[scope];
  const typeCount = encounterTypeCountForScope(scope, pool.length);
  const types = pickDistinctMonsterTypes(pool, typeCount);
  const names: string[] = [];

  for (const name of types) {
    const count = encounterCountForMonster(name);
    for (let i = 0; i < count; i++) {
      names.push(name);
    }
  }

  return names;
}

export function getMonsterTemplate(name: string): MonsterTemplate | null {
  return MONSTER_TEMPLATES[name] ?? null;
}

export function getIslandDungeonBossName(kind: IslandDungeonBossKind): string {
  return ISLAND_DUNGEON_BOSS_BY_KIND[kind];
}
