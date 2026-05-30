import {
  addItemToInventory,
  getItemCount,
  removeItemFromInventory,
} from "./shantiesItems";
import type { EventType, HeroType, ItemId } from "./shantiesTypes";

export const COOKSTOVE_EVENT: EventType = {
  name: "Cookstove",
  type: "cookstove",
};

export const RAW_COOKABLE_ITEM_IDS = ["raw_fish", "raw_meat"] as const;
export type RawCookableItemId = (typeof RAW_COOKABLE_ITEM_IDS)[number];

const RAW_TO_COOKED: Record<RawCookableItemId, ItemId> = {
  raw_fish: "cooked_fish",
  raw_meat: "cooked_meat",
};

export function isCookstoveEvent(event: EventType): boolean {
  return event.type === "cookstove" && event.name === COOKSTOVE_EVENT.name;
}

export function countRawCookables(inventory: HeroType["inventory"]): number {
  return RAW_COOKABLE_ITEM_IDS.reduce(
    (sum, itemId) => sum + getItemCount(inventory, itemId),
    0,
  );
}

export function hasCookstoveWood(inventory: HeroType["inventory"]): boolean {
  return getItemCount(inventory, "wood_plank") >= 1;
}

export function canCookAtStove(hero: HeroType): boolean {
  return hasCookstoveWood(hero.inventory) && countRawCookables(hero.inventory) > 0;
}

export type CookAtStoveResult = {
  hero: HeroType;
  rawFishCooked: number;
  rawMeatCooked: number;
};

export function applyCookAtStove(hero: HeroType): CookAtStoveResult {
  let inventory = removeItemFromInventory(hero.inventory, "wood_plank");
  let rawFishCooked = 0;
  let rawMeatCooked = 0;

  for (const rawId of RAW_COOKABLE_ITEM_IDS) {
    const count = getItemCount(inventory, rawId);
    if (count <= 0) continue;
    inventory = removeItemFromInventory(inventory, rawId, count);
    inventory = addItemToInventory(inventory, RAW_TO_COOKED[rawId], count);
    if (rawId === "raw_fish") rawFishCooked = count;
    if (rawId === "raw_meat") rawMeatCooked = count;
  }

  return {
    hero: { ...hero, inventory },
    rawFishCooked,
    rawMeatCooked,
  };
}

export function formatCookResultMessage(
  rawFishCooked: number,
  rawMeatCooked: number,
): string {
  const parts: string[] = [];
  if (rawFishCooked > 0) {
    parts.push(
      `${rawFishCooked} raw fish → cooked fish`,
    );
  }
  if (rawMeatCooked > 0) {
    parts.push(
      `${rawMeatCooked} raw meat → cooked meat`,
    );
  }
  if (parts.length === 0) {
    return "The fire dies down — nothin' raw left to cook.";
  }
  return `Ye cook over the stove: ${parts.join("; ")}.`;
}
