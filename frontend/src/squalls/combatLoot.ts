import { LOOT_ITEM_COPY_LIMIT, pickRandomItemId } from "./shantiesItems";
import type { CombatLootItem, EnemyType, EventType, ItemId } from "./shantiesTypes";

/** At most one consumable loot card, always quantity 1. */
export function createRandomItemLootCard(
  idPrefix: string,
  sourceName: string,
): CombatLootItem {
  const itemId: ItemId = pickRandomItemId();
  return {
    id: `${idPrefix}-${itemId}`,
    kind: "item",
    itemId,
    amount: LOOT_ITEM_COPY_LIMIT,
    sourceName,
    claimed: false,
  };
}

/** Keep a single item entry (first wins) with amount capped at 1. */
export function capLootToSingleItem(loot: CombatLootItem[]): CombatLootItem[] {
  let seenItem = false;
  return loot.reduce<CombatLootItem[]>((acc, entry) => {
    if (entry.kind !== "item") {
      acc.push(entry);
      return acc;
    }
    if (seenItem) return acc;
    seenItem = true;
    acc.push({ ...entry, amount: LOOT_ITEM_COPY_LIMIT });
    return acc;
  }, []);
}

export function isTreasureEvent(event: EventType): boolean {
  return event.type === "treasure";
}

export function claimLootItem(
  prev: CombatLootItem[],
  lootId: string,
  onGrant: (item: CombatLootItem) => void,
): CombatLootItem[] {
  const item = prev.find((entry) => entry.id === lootId);
  if (!item || item.claimed) return prev;
  onGrant(item);
  return prev.map((entry) =>
    entry.id === lootId ? { ...entry, claimed: true } : entry,
  );
}

export function allLootClaimed(loot: CombatLootItem[]): boolean {
  if (loot.length === 0) return true;
  return loot.every((item) => item.claimed);
}

/** @deprecated Use allLootClaimed */
export const allCombatLootClaimed = allLootClaimed;

export function goldDropForEnemy(enemy: EnemyType): number {
  const base = enemy.level * 3;
  const bonus = Math.floor(Math.random() * (enemy.level * 2 + 1));
  return base + bonus + 1;
}

export function xpDropForEnemy(enemy: EnemyType): number {
  return enemy.level * 5;
}

/** One gold card and one XP card with totals from all foes in the victory snapshot. */
export function generateCombatLoot(enemies: EnemyType[]): CombatLootItem[] {
  const foes = enemies.filter((enemy): enemy is EnemyType => Boolean(enemy));
  if (foes.length === 0) return [];

  let totalGold = 0;
  let totalXp = 0;
  for (const enemy of foes) {
    totalGold += goldDropForEnemy(enemy);
    totalXp += xpDropForEnemy(enemy);
  }

  const sourceName =
    foes.length === 1 ? foes[0].name : `${foes.length} foes`;

  const itemLoot = createRandomItemLootCard("combat-loot-item", sourceName);

  return capLootToSingleItem([
    {
      id: "combat-loot-gold",
      kind: "gold",
      amount: totalGold,
      sourceName,
      claimed: false,
    },
    {
      id: "combat-loot-xp",
      kind: "xp",
      amount: totalXp,
      sourceName,
      claimed: false,
    },
    itemLoot,
  ]);
}

function rollInRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const EVENT_TREASURE_REWARDS: Record<
  string,
  { gold?: [number, number]; xp?: [number, number] }
> = {
  "Floating Chest": { gold: [6, 14], xp: [4, 8] },
  "Hidden Treasure": { gold: [12, 24], xp: [8, 14] },
  "Wild Supplies": { gold: [4, 10], xp: [2, 6] },
  "Temple Offerings": { gold: [2, 8], xp: [12, 20] },
  "Buried Chest": { gold: [8, 18], xp: [6, 12] },
};

/** Gold, XP, and a random item for a treasure event. */
export function generateEventLoot(event: EventType): CombatLootItem[] {
  const table = EVENT_TREASURE_REWARDS[event.name] ?? {
    gold: [5, 12] as [number, number],
    xp: [3, 8] as [number, number],
  };
  const slug = event.name.replace(/\s+/g, "-").toLowerCase();
  const items: CombatLootItem[] = [];

  if (table.gold) {
    items.push({
      id: `event-${slug}-gold`,
      kind: "gold",
      amount: rollInRange(table.gold[0], table.gold[1]),
      sourceName: event.name,
      claimed: false,
    });
  }
  if (table.xp) {
    items.push({
      id: `event-${slug}-xp`,
      kind: "xp",
      amount: rollInRange(table.xp[0], table.xp[1]),
      sourceName: event.name,
      claimed: false,
    });
  }

  const itemLoot = createRandomItemLootCard(`event-${slug}-item`, event.name);

  return capLootToSingleItem(items.concat(itemLoot));
}
