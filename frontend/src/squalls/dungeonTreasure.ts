import { rollD4 } from "./combatRules";
import { isTreasureEvent } from "./combatLoot";
import type { EventType, GameLocationTypes } from "./shantiesTypes";

export const DUNGEON_TREASURE_LOCKED_CHANCE = 0.5;

export function rollDungeonTreasureLocked(): boolean {
  return Math.random() < DUNGEON_TREASURE_LOCKED_CHANCE;
}

export function prepareDungeonTreasureEvent(event: EventType): EventType {
  if (!isTreasureEvent(event)) return event;
  return { ...event, locked: rollDungeonTreasureLocked() };
}

export function isLockedDungeonTreasure(
  event: EventType | null,
  location: GameLocationTypes,
  chestUnlocked: boolean,
): boolean {
  return (
    location === "dungeon" &&
    event != null &&
    isTreasureEvent(event) &&
    event.locked === true &&
    !chestUnlocked
  );
}

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
