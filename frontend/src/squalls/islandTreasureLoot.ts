import { rollLd4 } from "./combatLoot";
import {
  capLootToSingleItem,
  createEquipmentLootCard,
  isTreasureEvent,
  LOCKPICK_EQUIPMENT_ID,
} from "./combatLoot";
import {
  ISLAND_TREASURE_LOCKED_CHANCE,
  rollTreasureLocked,
} from "./dungeonTreasure";
import { rollSpawnFruit } from "./floatingSuppliesLoot";
import {
  BURIED_CHEST_EVENT,
  SUPPLY_CACHE_EVENT,
} from "./islandEventDeck";
import type {
  CombatLootItem,
  EventType,
  HeroType,
  IslandType,
  ItemId,
} from "./shantiesTypes";

export const BURIED_CHEST_EVENT_NAME = BURIED_CHEST_EVENT.name;
export const SUPPLY_CACHE_EVENT_NAME = SUPPLY_CACHE_EVENT.name;

/** @deprecated Use BURIED_CHEST_EVENT_NAME */
export const BURIED_TREASURE_EVENT_NAME = BURIED_CHEST_EVENT_NAME;

export const BURIED_CHEST_INTRO =
  "Ye uncover a chest half-buried in the sand.";

/** @deprecated Use BURIED_CHEST_INTRO */
export const BURIED_TREASURE_INTRO = BURIED_CHEST_INTRO;

export const SUPPLY_CACHE_INTRO =
  "A supply cache lies tucked among the undergrowth.";

const LEGACY_BURIED_TREASURE_NAME = "Buried Treasure";

type IslandTreasurePoolEntry =
  | "fruit"
  | "gold"
  | "lockpick"
  | ItemId;

const ISLAND_TREASURE_POOL: IslandTreasurePoolEntry[] = [
  "fruit",
  "wood_plank",
  "cannonball",
  "ammo_pouch",
  "lockpick",
  "gold",
];

export function isBuriedChestEvent(event: EventType): boolean {
  return (
    isTreasureEvent(event) &&
    (event.name === BURIED_CHEST_EVENT_NAME ||
      event.name === LEGACY_BURIED_TREASURE_NAME)
  );
}

/** @deprecated Use isBuriedChestEvent */
export function isBuriedTreasureEvent(event: EventType): boolean {
  return isBuriedChestEvent(event);
}

export function isSupplyCacheEvent(event: EventType): boolean {
  return isTreasureEvent(event) && event.name === SUPPLY_CACHE_EVENT_NAME;
}

export function isIslandTreasureEvent(event: EventType): boolean {
  return isBuriedChestEvent(event) || isSupplyCacheEvent(event);
}

export function isIslandTreasureTemplate(event: EventType): boolean {
  return isIslandTreasureEvent(event);
}

/** 75% locked Buried Chest, 25% unlocked Supply Cache. */
export function prepareIslandTreasureEvent(event: EventType): EventType {
  if (!isIslandTreasureTemplate(event)) return event;
  const locked = rollTreasureLocked(ISLAND_TREASURE_LOCKED_CHANCE);
  if (locked) {
    return { name: BURIED_CHEST_EVENT_NAME, type: "treasure", locked: true };
  }
  return { name: SUPPLY_CACHE_EVENT_NAME, type: "treasure", locked: false };
}

function islandTreasureGoldDiceCount(hero: HeroType, island: IslandType): number {
  return Math.max(1, hero.level + island.levelFactor);
}

function rollIslandTreasurePoolEntry(): IslandTreasurePoolEntry {
  return ISLAND_TREASURE_POOL[
    Math.floor(Math.random() * ISLAND_TREASURE_POOL.length)
  ]!;
}

/** Gold (Ld4 by hero level + island levelFactor) and one pool roll. */
export function generateIslandTreasureLoot(
  event: EventType,
  hero: HeroType,
  island: IslandType,
): CombatLootItem[] {
  if (!isIslandTreasureEvent(event)) return [];

  const slug = event.name.replace(/\s+/g, "-").toLowerCase();
  const goldAmount = rollLd4(islandTreasureGoldDiceCount(hero, island));
  const items: CombatLootItem[] = [
    {
      id: `island-${slug}-gold`,
      kind: "gold",
      amount: goldAmount,
      sourceName: event.name,
      claimed: false,
    },
  ];

  const entry = rollIslandTreasurePoolEntry();
  if (entry === "gold") {
    return items;
  }
  if (entry === "lockpick") {
    return capLootToSingleItem(
      items.concat(
        createEquipmentLootCard(
          `island-${slug}-lockpick`,
          LOCKPICK_EQUIPMENT_ID,
          event.name,
        ),
      ),
    );
  }

  const itemId = entry === "fruit" ? rollSpawnFruit() : entry;
  return capLootToSingleItem(
    items.concat({
      id: `island-${slug}-${itemId}`,
      kind: "item",
      itemId,
      amount: 1,
      sourceName: event.name,
      claimed: false,
    }),
  );
}
