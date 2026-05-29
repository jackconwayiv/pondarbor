import { rollD4 } from "./combatRules";
import {
  createEquipmentLootCard,
  isTreasureEvent,
  LOCKPICK_EQUIPMENT_ID,
} from "./combatLoot";
import { rollTreasureLocked, SEA_TREASURE_LOCKED_CHANCE } from "./dungeonTreasure";
import type {
  CombatLootItem,
  EventType,
  FoodItemId,
  ItemId,
} from "./shantiesTypes";

export const FLOATING_SUPPLIES_EVENT_NAME = "Floating Supplies";
export const FLOATING_CHEST_EVENT_NAME = "Floating Chest";

/** Unicode 17 treasure chest — floating treasure event heading. */
export const TREASURE_CHEST_EMOJI = "🪎";

export const FLOATING_SUPPLIES_UNLOCKED_INTRO =
  "You sail past some floating supplies which you can easily scoop up.";

const SEA_TREASURE_TEMPLATE_NAME = FLOATING_SUPPLIES_EVENT_NAME;

const SUPPLY_ITEM_IDS = [
  "cannonball",
  "ammo_pouch",
  "tea",
  "rum",
  "sail_cloth",
  "wood_plank",
  "candle",
  "key",
] as const satisfies readonly ItemId[];

type SupplyPoolEntry = (typeof SUPPLY_ITEM_IDS)[number] | "fruit" | "lockpick";

const SUPPLY_POOL: SupplyPoolEntry[] = [
  ...SUPPLY_ITEM_IDS,
  "fruit",
  "lockpick",
];

export function isFloatingSuppliesEvent(event: EventType): boolean {
  return isTreasureEvent(event) && event.name === FLOATING_SUPPLIES_EVENT_NAME;
}

export function isFloatingChestEvent(event: EventType): boolean {
  return isTreasureEvent(event) && event.name === FLOATING_CHEST_EVENT_NAME;
}

export function isSeaTreasureEvent(event: EventType): boolean {
  return isFloatingSuppliesEvent(event) || isFloatingChestEvent(event);
}

export function isSeaTreasureTemplate(event: EventType): boolean {
  return (
    isTreasureEvent(event) &&
    (event.name === SEA_TREASURE_TEMPLATE_NAME ||
      event.name === FLOATING_CHEST_EVENT_NAME)
  );
}

/** 75% locked Floating Chest, 25% unlocked Floating Supplies. */
export function prepareSeaTreasureEvent(event: EventType): EventType {
  if (!isSeaTreasureTemplate(event)) return event;
  const locked = rollTreasureLocked(SEA_TREASURE_LOCKED_CHANCE);
  if (locked) {
    return { name: FLOATING_CHEST_EVENT_NAME, type: "treasure", locked: true };
  }
  return { name: FLOATING_SUPPLIES_EVENT_NAME, type: "treasure", locked: false };
}

/** @deprecated Use prepareSeaTreasureEvent */
export function prepareFloatingSuppliesEvent(event: EventType): EventType {
  return prepareSeaTreasureEvent(event);
}

export function rollSpawnFruit(): FoodItemId {
  const roll = Math.floor(Math.random() * 100);
  if (roll < 50) return "banana";
  if (roll < 85) return "coconut";
  if (roll < 95) return "mango";
  return "pineapple";
}

function rollSupplyPoolEntry(): SupplyPoolEntry {
  return SUPPLY_POOL[Math.floor(Math.random() * SUPPLY_POOL.length)]!;
}

/** 1d4 rolls from the supply pool (items stacked; equipment is one card per roll). */
export function generateFloatingSuppliesLoot(): CombatLootItem[] {
  const rollCount = rollD4();
  const counts = new Map<ItemId, number>();
  const loot: CombatLootItem[] = [];
  let equipmentIndex = 0;

  for (let i = 0; i < rollCount; i++) {
    const entry = rollSupplyPoolEntry();
    if (entry === "lockpick") {
      loot.push(
        createEquipmentLootCard(
          `floating-supplies-lockpick-${equipmentIndex}`,
          LOCKPICK_EQUIPMENT_ID,
          FLOATING_SUPPLIES_EVENT_NAME,
        ),
      );
      equipmentIndex += 1;
      continue;
    }
    const itemId = entry === "fruit" ? rollSpawnFruit() : entry;
    counts.set(itemId, (counts.get(itemId) ?? 0) + 1);
  }

  const itemCards = [...counts.entries()].map(([itemId, amount], index) => ({
    id: `floating-supplies-${itemId}-${index}`,
    kind: "item" as const,
    itemId,
    amount,
    sourceName: FLOATING_SUPPLIES_EVENT_NAME,
    claimed: false,
  }));

  return [...itemCards, ...loot];
}
