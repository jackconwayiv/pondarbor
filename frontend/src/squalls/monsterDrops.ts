import type { CombatLootItem, EnemyType, ItemId } from "./shantiesTypes";

export type MonsterDropDef = {
  itemId: ItemId;
  /** Probability per kill, 0–1. */
  dropRate: number;
};

/** One guaranteed drop slot per monster name; each foe rolls independently. */
export const MONSTER_DROP_BY_NAME: Record<string, MonsterDropDef> = {
  Harpy: { itemId: "raw_fish", dropRate: 0.25 },
  Siren: { itemId: "siren_gills", dropRate: 0.25 },
  Boar: { itemId: "boar_meat", dropRate: 0.25 },
  "Electric Eel": { itemId: "raw_fish", dropRate: 0.35 },
};

export function rollMonsterItemDrops(
  enemies: EnemyType[],
): Map<ItemId, number> {
  const counts = new Map<ItemId, number>();
  for (const enemy of enemies) {
    const drop = MONSTER_DROP_BY_NAME[enemy.name];
    if (!drop || Math.random() >= drop.dropRate) continue;
    counts.set(drop.itemId, (counts.get(drop.itemId) ?? 0) + 1);
  }
  return counts;
}

export function combatItemLootCards(
  drops: Map<ItemId, number>,
): CombatLootItem[] {
  return [...drops.entries()].map(([itemId, amount]) => ({
    id: `combat-loot-item-${itemId}`,
    kind: "item" as const,
    itemId,
    amount,
    sourceName: "",
    claimed: false,
  }));
}
