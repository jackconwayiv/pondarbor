import { rollD4 } from "./combatRules";
import { isTreasureEvent } from "./combatLoot";
import type { EventType, GameLocationTypes } from "./shantiesTypes";

/** Sea floating treasure: 75% locked Floating Chest, 25% unlocked Floating Supplies. */
export const SEA_TREASURE_LOCKED_CHANCE = 0.75;

/** Island treasure: 75% locked Buried Chest, 25% unlocked Supply Cache. */
export const ISLAND_TREASURE_LOCKED_CHANCE = 0.75;

export function rollTreasureLocked(chance: number): boolean {
  return Math.random() < chance;
}

/** @deprecated Use rollTreasureLocked with location-specific chance. */
export function rollDungeonTreasureLocked(): boolean {
  return rollTreasureLocked(ISLAND_TREASURE_LOCKED_CHANCE);
}

export function prepareDungeonTreasureEvent(event: EventType): EventType {
  if (!isTreasureEvent(event)) return event;
  return { ...event, locked: true };
}

export function isLockedTreasureChest(
  event: EventType | null,
  location: GameLocationTypes,
  chestUnlocked: boolean,
): boolean {
  return (
    (location === "dungeon" || location === "ship" || location === "island") &&
    event != null &&
    isTreasureEvent(event) &&
    event.locked === true &&
    !chestUnlocked
  );
}

/** @deprecated Use isLockedTreasureChest */
export function isLockedDungeonTreasure(
  event: EventType | null,
  location: GameLocationTypes,
  chestUnlocked: boolean,
): boolean {
  return isLockedTreasureChest(event, location, chestUnlocked);
}

export type PickLockResult =
  | { outcome: "success" }
  | { outcome: "success_broken" }
  | { outcome: "fail_broken" };

/** 50% clean open, 25% open but lockpick breaks, 25% fail and lockpick breaks. */
export function rollPickLock(): PickLockResult {
  const roll = Math.random();
  if (roll < 0.5) return { outcome: "success" };
  if (roll < 0.75) return { outcome: "success_broken" };
  return { outcome: "fail_broken" };
}

export const PICK_LOCK_SUCCESS_BROKEN_MESSAGE =
  "The lock yields — but yer lockpick snaps in the tumblers.";
export const PICK_LOCK_FAIL_BROKEN_MESSAGE =
  "The pick slips and breaks — the chest stays shut.";

export type ForceOpenChestResult =
  | { outcome: "success" }
  | { outcome: "hurt"; damage: number }
  | { outcome: "fail" };

/** 25% open, 25% hurt (1d4, non-lethal), 50% fail. */
export function rollForceOpenChest(): ForceOpenChestResult {
  const roll = Math.random();
  if (roll < 0.25) return { outcome: "success" };
  if (roll < 0.5) return { outcome: "hurt", damage: rollD4() };
  return { outcome: "fail" };
}

export const FORCE_OPEN_FAIL_MESSAGE =
  "You're unable to force the chest open.";
