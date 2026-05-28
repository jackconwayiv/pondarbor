import { clampHp } from "./combatRules";
import {
  INDOOR_AREA_KINDS,
  ITEM_IDS,
  type CombatPhase,
  type GameStateTypes,
  type HeroType,
  type IndoorAreaId,
  type IndoorAreaKind,
  type Inventory,
  type ItemId,
} from "./shantiesTypes";
import { sellPriceFromBuyPrice } from "./shantiesShop";

export { ITEM_IDS, INDOOR_AREA_KINDS };

export const COCONUT_HEAL_AMOUNT = 5;

export type ItemDefinition = {
  id: ItemId;
  name: string;
  emoji: string;
  description: string;
  /** Energy spent when used during combat; omit if not usable in battle. */
  energyCost?: number;
  /** Gold price at the ship shop; omit if not sold. */
  shopPrice?: number;
};

export const SHOP_ITEM_IDS = ["coconut", "candle", "key"] as const satisfies readonly ItemId[];

export const ITEM_DEFINITIONS: Record<ItemId, ItemDefinition> = {
  coconut: {
    id: "coconut",
    name: "Coconut",
    emoji: "🥥",
    description: "Restores 5 HP. Costs 1 energy in combat.",
    energyCost: 1,
    shopPrice: 20,
  },
  candle: {
    id: "candle",
    name: "Candle",
    emoji: "🕯️",
    description: "Permanently lights a Cave, Ruins, or Temple.",
    shopPrice: 30,
  },
  key: {
    id: "key",
    name: "Key",
    emoji: "🗝️",
    description: "Unlocks a locked chest while delving.",
    shopPrice: 50,
  },
};

export function getItemEnergyCost(itemId: ItemId): number | null {
  const cost = ITEM_DEFINITIONS[itemId].energyCost;
  return cost === undefined ? null : cost;
}

export function isItemUsableInCombat(itemId: ItemId): boolean {
  return getItemEnergyCost(itemId) !== null;
}

export function formatIndoorAreaId(
  kind: IndoorAreaKind,
  areaKey: string,
): IndoorAreaId {
  return `${kind}:${areaKey}`;
}

export function parseIndoorAreaId(id: string): {
  kind: IndoorAreaKind;
  areaKey: string;
} | null {
  const [kind, ...rest] = id.split(":");
  if (
    !INDOOR_AREA_KINDS.includes(kind as IndoorAreaKind) ||
    rest.length === 0
  ) {
    return null;
  }
  return { kind: kind as IndoorAreaKind, areaKey: rest.join(":") };
}

export function formatIndoorAreaLabel(id: IndoorAreaId): string {
  const parsed = parseIndoorAreaId(id);
  if (!parsed) return id;
  const labels: Record<IndoorAreaKind, string> = {
    cave: "Cave",
    ruins: "Ruins",
    temple: "Temple",
  };
  return labels[parsed.kind];
}

export function getItemCount(inventory: Inventory, itemId: ItemId): number {
  return Math.max(0, Math.floor(inventory[itemId] ?? 0));
}

export function addItemToInventory(
  inventory: Inventory,
  itemId: ItemId,
  amount = 1,
): Inventory {
  const next = { ...inventory };
  const count = getItemCount(next, itemId) + amount;
  if (count <= 0) {
    delete next[itemId];
  } else {
    next[itemId] = count;
  }
  return next;
}

export function removeItemFromInventory(
  inventory: Inventory,
  itemId: ItemId,
  amount = 1,
): Inventory {
  return addItemToInventory(inventory, itemId, -amount);
}

export type UseItemCheck = { ok: true } | { ok: false; message: string };

export function checkUseCoconut(hero: HeroType): UseItemCheck {
  if (getItemCount(hero.inventory, "coconut") <= 0) {
    return { ok: false, message: "Ye have no coconuts." };
  }
  if (hero.current_hp >= hero.max_hp) {
    return { ok: false, message: "Yer HP is already full." };
  }
  return { ok: true };
}

export type UseItemContext = {
  gameState: GameStateTypes;
  hero: HeroType;
  currentIndoorArea: IndoorAreaId | null;
  illuminatedAreas: IndoorAreaId[];
  combatPhase?: CombatPhase;
  energy?: number;
  victoryPending?: boolean;
  combatVictory?: boolean;
};

export function checkUseItem(
  itemId: ItemId,
  ctx: UseItemContext,
): UseItemCheck {
  if (ctx.gameState === "lobby") {
    return { ok: false, message: "Ye can't use that right now." };
  }

  if (ctx.gameState === "battle") {
    const energyCost = getItemEnergyCost(itemId);
    if (energyCost === null) {
      return { ok: false, message: "Ye can't use that in battle." };
    }
    if (
      ctx.combatPhase !== "player" ||
      ctx.victoryPending ||
      ctx.combatVictory
    ) {
      return { ok: false, message: "Ye can't use that right now." };
    }
    if ((ctx.energy ?? 0) < energyCost) {
      return {
        ok: false,
        message: `Not enough energy (needs ${energyCost}).`,
      };
    }
    if (itemId === "coconut") {
      return checkUseCoconut(ctx.hero);
    }
    return { ok: false, message: "Ye can't use that in battle." };
  }

  if (itemId === "key") {
    return {
      ok: false,
      message: "Use a key on a locked chest while delving.",
    };
  }
  if (itemId === "coconut") {
    return checkUseCoconut(ctx.hero);
  }
  return checkUseCandle(
    ctx.hero.inventory,
    ctx.currentIndoorArea,
    ctx.illuminatedAreas,
  );
}

export function checkUseCandle(
  inventory: Inventory,
  currentIndoorArea: IndoorAreaId | null,
  illuminatedAreas: IndoorAreaId[],
): UseItemCheck {
  if (getItemCount(inventory, "candle") <= 0) {
    return { ok: false, message: "Ye have no candles." };
  }
  if (!currentIndoorArea) {
    return {
      ok: false,
      message: "Only useful underground — in a Cave, Ruins, or Temple.",
    };
  }
  if (illuminatedAreas.includes(currentIndoorArea)) {
    return { ok: false, message: "This place is already lit." };
  }
  return { ok: true };
}

/** @deprecated Use checkUseCandle */
export const checkUseTorch = checkUseCandle;

export function applyCoconutUse(hero: HeroType): HeroType {
  const healed = Math.min(
    hero.max_hp,
    hero.current_hp + COCONUT_HEAL_AMOUNT,
  );
  return {
    ...hero,
    current_hp: clampHp(healed),
    inventory: removeItemFromInventory(hero.inventory, "coconut"),
  };
}

export function pickRandomItemId(): ItemId {
  return ITEM_IDS[Math.floor(Math.random() * ITEM_IDS.length)]!;
}

/** Loot never adds more than one of a consumable (combat / treasure). */
export const LOOT_ITEM_COPY_LIMIT = 1;

export function grantLootItemToInventory(
  inventory: Inventory,
  itemId: ItemId,
): Inventory {
  if (getItemCount(inventory, itemId) >= LOOT_ITEM_COPY_LIMIT) {
    return inventory;
  }
  return addItemToInventory(inventory, itemId, 1);
}

export function getItemBuyPrice(itemId: ItemId): number | null {
  const price = ITEM_DEFINITIONS[itemId].shopPrice;
  return price === undefined ? null : price;
}

export function getItemSellPrice(itemId: ItemId): number | null {
  const buyPrice = getItemBuyPrice(itemId);
  return buyPrice === null ? null : sellPriceFromBuyPrice(buyPrice);
}

export function checkBuyItem(hero: HeroType, itemId: ItemId): UseItemCheck {
  const def = ITEM_DEFINITIONS[itemId];
  const price = def.shopPrice;
  if (price === undefined) {
    return { ok: false, message: "Not for sale here." };
  }
  if (hero.gold < price) {
    return { ok: false, message: `Not enough gold (needs ${price}).` };
  }
  return { ok: true };
}

export function applyBuyItem(hero: HeroType, itemId: ItemId): HeroType {
  const price = ITEM_DEFINITIONS[itemId].shopPrice!;
  return {
    ...hero,
    gold: hero.gold - price,
    inventory: addItemToInventory(hero.inventory, itemId, 1),
  };
}

export function checkSellItem(hero: HeroType, itemId: ItemId): UseItemCheck {
  if (getItemCount(hero.inventory, itemId) <= 0) {
    return { ok: false, message: "Ye don't have that to sell." };
  }
  if (getItemSellPrice(itemId) === null) {
    return { ok: false, message: "The merchant won't buy that." };
  }
  return { ok: true };
}

export function applySellItem(hero: HeroType, itemId: ItemId): HeroType {
  const sellPrice = getItemSellPrice(itemId);
  if (sellPrice === null || getItemCount(hero.inventory, itemId) <= 0) {
    return hero;
  }
  return {
    ...hero,
    gold: hero.gold + sellPrice,
    inventory: removeItemFromInventory(hero.inventory, itemId),
  };
}

export function isIndoorAreaIlluminated(
  areaId: IndoorAreaId,
  illuminatedAreas: IndoorAreaId[],
): boolean {
  return illuminatedAreas.includes(areaId);
}
