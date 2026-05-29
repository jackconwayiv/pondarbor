import { combatItemLootCards, rollMonsterItemDrops } from "./monsterDrops";
import { LOOT_ITEM_COPY_LIMIT, pickRandomItemId } from "./shantiesItems";
import type {
  CombatLootItem,
  EnemyType,
  EquipmentId,
  EventType,
  IslandType,
  ItemId,
} from "./shantiesTypes";

export const LOCKPICK_EQUIPMENT_ID = "lockpick" as const satisfies EquipmentId;

/** Chance the bonus treasure loot card is a lockpick instead of a consumable. */
export const TREASURE_LOCKPICK_DROP_CHANCE = 0.12;

export function createEquipmentLootCard(
  id: string,
  equipmentId: EquipmentId,
  sourceName: string,
): CombatLootItem {
  return {
    id,
    kind: "equipment",
    equipmentId,
    amount: 1,
    sourceName,
    claimed: false,
  };
}

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

/** Keep a single bonus loot card (item or equipment), always quantity 1 for items. */
export function capLootToSingleItem(loot: CombatLootItem[]): CombatLootItem[] {
  let seenBonus = false;
  return loot.reduce<CombatLootItem[]>((acc, entry) => {
    if (entry.kind === "gold" || entry.kind === "xp") {
      acc.push(entry);
      return acc;
    }
    if (entry.kind === "item" || entry.kind === "equipment") {
      if (seenBonus) return acc;
      seenBonus = true;
      if (entry.kind === "item") {
        acc.push({ ...entry, amount: LOOT_ITEM_COPY_LIMIT });
      } else {
        acc.push(entry);
      }
      return acc;
    }
    acc.push(entry);
    return acc;
  }, []);
}

function rollTreasureBonusLoot(
  idPrefix: string,
  sourceName: string,
): CombatLootItem {
  if (Math.random() < TREASURE_LOCKPICK_DROP_CHANCE) {
    return createEquipmentLootCard(
      `${idPrefix}-lockpick`,
      LOCKPICK_EQUIPMENT_ID,
      sourceName,
    );
  }
  return createRandomItemLootCard(idPrefix, sourceName);
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
  return rollLd4(enemy.level);
}

export function xpDropForEnemy(enemy: EnemyType): number {
  return enemy.level;
}

/** One gold card, one XP card, and stacked item cards from per-foe drop rolls. */
export function generateCombatLoot(enemies: EnemyType[]): CombatLootItem[] {
  const foes = enemies.filter((enemy): enemy is EnemyType => Boolean(enemy));
  if (foes.length === 0) return [];

  let totalGold = 0;
  let totalXp = 0;
  for (const enemy of foes) {
    totalGold += goldDropForEnemy(enemy);
    totalXp += xpDropForEnemy(enemy);
  }

  const itemCards = combatItemLootCards(rollMonsterItemDrops(foes));

  return [
    {
      id: "combat-loot-gold",
      kind: "gold",
      amount: totalGold,
      sourceName: "",
      claimed: false,
    },
    {
      id: "combat-loot-xp",
      kind: "xp",
      amount: totalXp,
      sourceName: "",
      claimed: false,
    },
    ...itemCards,
  ];
}

function rollD4(): number {
  return Math.floor(Math.random() * 4) + 1;
}

/** Roll L d4 (minimum one die) and sum. */
export function rollLd4(diceCount: number): number {
  const L = Math.max(1, diceCount);
  let total = 0;
  for (let i = 0; i < L; i++) {
    total += rollD4();
  }
  return total;
}

/** Treasure gold dice from island vibe: Foreboding L+2, Inviting L−1 (min 1 die). */
export function treasureGoldDiceCount(
  islandVibe: IslandType["vibe"] | null | undefined,
  baseL = 1,
): number {
  let L = baseL;
  if (islandVibe === "Foreboding") L += 2;
  else if (islandVibe === "Inviting") L -= 1;
  return Math.max(1, L);
}

export type EventLootContext = {
  /** Island vibe when treasure is found on an island or its dungeon; omit at sea. */
  islandVibe?: IslandType["vibe"] | null;
};

/** Gold (Ld4 by island vibe) and a random item for a treasure event (no XP). */
export function generateEventLoot(
  event: EventType,
  context: EventLootContext = {},
): CombatLootItem[] {
  const slug = event.name.replace(/\s+/g, "-").toLowerCase();
  const goldAmount = rollLd4(treasureGoldDiceCount(context.islandVibe));
  const items: CombatLootItem[] = [
    {
      id: `event-${slug}-gold`,
      kind: "gold",
      amount: goldAmount,
      sourceName: event.name,
      claimed: false,
    },
  ];

  const itemLoot = rollTreasureBonusLoot(`event-${slug}-bonus`, event.name);

  return capLootToSingleItem(items.concat(itemLoot));
}
