import { clampHp } from "./combatRules";
import {
  AMMO_ITEM_IDS,
  FOOD_ITEM_IDS,
  INDOOR_AREA_KINDS,
  ITEM_IDS,
  MUNITIONS_ITEM_IDS,
  SHIP_ITEM_IDS,
  WRECK_UNLOCK_ITEM_IDS,
  type AmmoItemId,
  type CombatPhase,
  type FoodItemId,
  type GameStateTypes,
  type HeroType,
  type IndoorAreaId,
  type IndoorAreaKind,
  type Inventory,
  type ItemId,
  type MunitionsItemId,
  type ShopVariant,
  type ShipItemId,
  type WreckUnlockItemId,
} from "./shantiesTypes";
import { sellPriceFromBasePrice, shopBuyPrice } from "./shantiesShop";

export {
  AMMO_ITEM_IDS,
  FOOD_ITEM_IDS,
  ITEM_IDS,
  INDOOR_AREA_KINDS,
  MUNITIONS_ITEM_IDS,
  SHIP_ITEM_IDS,
  WRECK_UNLOCK_ITEM_IDS,
};

export type ItemKind =
  | "food"
  | "ship"
  | "ammo"
  | "munitions"
  | "dive"
  | "candle"
  | "key";

export type ItemDefinition = {
  id: ItemId;
  kind: ItemKind;
  name: string;
  emoji: string;
  description: string;
  /** HP restored when eaten; food only. */
  healAmount?: number;
  /** Energy spent when used during combat; omit if not usable in battle. */
  energyCost?: number;
  /** Gold price at the ship shop; omit if not sold here. */
  shopPrice?: number;
  /** Reference value for sell price (half, rounded down); food and other loot. */
  basePrice?: number;
};

export const SHOP_ITEM_IDS = ["candle", "key", "orange"] as const satisfies readonly ItemId[];

export const MERCHANT_SHOP_ITEM_IDS = [
  "banana",
  "tea",
  "rum",
  "sail_cloth",
  "cannonball",
  "dive_helmet",
] as const satisfies readonly ItemId[];

export const ISLAND_TRADER_SHOP_ITEM_IDS = [
  "wood_plank",
  "banana",
  "coconut",
] as const satisfies readonly ItemId[];

export const ITEM_DEFINITIONS: Record<ItemId, ItemDefinition> = {
  banana: {
    id: "banana",
    kind: "food",
    name: "Banana",
    emoji: "🍌",
    description: "Restores 5 HP. Costs 1 energy in combat.",
    healAmount: 5,
    energyCost: 1,
    basePrice: 20,
  },
  orange: {
    id: "orange",
    kind: "food",
    name: "Orange",
    emoji: "🍊",
    description: "Restores 5 HP. Costs 1 energy in combat.",
    healAmount: 5,
    energyCost: 1,
    shopPrice: 15,
    basePrice: 15,
  },
  raw_fish: {
    id: "raw_fish",
    kind: "food",
    name: "Raw Fish",
    emoji: "🐟",
    description: "Restores 5 HP. Costs 1 energy in combat.",
    healAmount: 5,
    energyCost: 1,
    basePrice: 10,
  },
  boar_meat: {
    id: "boar_meat",
    kind: "food",
    name: "Boar Meat",
    emoji: "🥩",
    description: "Restores 5 HP. Costs 1 energy in combat.",
    healAmount: 5,
    energyCost: 1,
    basePrice: 10,
  },
  coconut: {
    id: "coconut",
    kind: "food",
    name: "Coconut",
    emoji: "🥥",
    description: "Restores 10 HP. Costs 1 energy in combat.",
    healAmount: 10,
    energyCost: 1,
    basePrice: 40,
  },
  mango: {
    id: "mango",
    kind: "food",
    name: "Mango",
    emoji: "🥭",
    description: "Restores 25 HP. Costs 1 energy in combat.",
    healAmount: 25,
    energyCost: 1,
    basePrice: 60,
  },
  pineapple: {
    id: "pineapple",
    kind: "food",
    name: "Pineapple",
    emoji: "🍍",
    description: "Restores 50 HP. Costs 1 energy in combat.",
    healAmount: 50,
    energyCost: 1,
    basePrice: 80,
  },
  tea: {
    id: "tea",
    kind: "food",
    name: "Tea",
    emoji: "🍵",
    description: "A steaming cup. No effect yet.",
    basePrice: 95,
  },
  rum: {
    id: "rum",
    kind: "food",
    name: "Rum",
    emoji: "🥃",
    description: "A stiff tot. No effect yet.",
    basePrice: 115,
  },
  wood_plank: {
    id: "wood_plank",
    kind: "ship",
    name: "Wood Plank",
    emoji: "🪵",
    description: "For patching the hull. No use yet.",
    basePrice: 10,
  },
  sail_cloth: {
    id: "sail_cloth",
    kind: "ship",
    name: "Sail Cloth",
    emoji: "🧵",
    description: "For mending sails. No use yet.",
    basePrice: 25,
  },
  water_bucket: {
    id: "water_bucket",
    kind: "ship",
    name: "Water Bucket",
    emoji: "🪣",
    description: "For bailing the bilge. No use yet.",
    basePrice: 20,
  },
  ammo_pouch: {
    id: "ammo_pouch",
    kind: "ammo",
    name: "Ammo Pouch",
    emoji: "👝",
    description: "Lead for yer sidearm. No use yet.",
    basePrice: 50,
  },
  cannonball: {
    id: "cannonball",
    kind: "munitions",
    name: "Cannonball",
    emoji: "⚫",
    description: "Solid shot for the guns. No use yet.",
    basePrice: 45,
  },
  scattershot: {
    id: "scattershot",
    kind: "munitions",
    name: "Scattershot",
    emoji: "💥",
    description: "Grape and nails for close work. No use yet.",
    basePrice: 100,
  },
  powderkeg: {
    id: "powderkeg",
    kind: "munitions",
    name: "Powderkeg",
    emoji: "🛢️",
    description: "Black powder in a keg. No use yet.",
    basePrice: 100,
  },
  siren_gills: {
    id: "siren_gills",
    kind: "dive",
    name: "Siren Gills",
    emoji: "🫁",
    description: "Breathes underwater long enough to explore a shipwreck.",
    basePrice: 20,
  },
  dive_helmet: {
    id: "dive_helmet",
    kind: "dive",
    name: "Dive Helmet",
    emoji: "🤿",
    description: "A brass diving bell for exploring sunken wrecks.",
    basePrice: 95,
  },
  candle: {
    id: "candle",
    kind: "candle",
    name: "Candle",
    emoji: "🕯️",
    description: "Permanently lights a Cave, Ruins, or Temple.",
    shopPrice: 25,
  },
  key: {
    id: "key",
    kind: "key",
    name: "Key",
    emoji: "🗝️",
    description: "Unlocks a locked chest while delving.",
    shopPrice: 45,
  },
};

export function isFoodItem(itemId: ItemId): itemId is FoodItemId {
  return FOOD_ITEM_IDS.includes(itemId as FoodItemId);
}

export function isShipItem(itemId: ItemId): itemId is ShipItemId {
  return SHIP_ITEM_IDS.includes(itemId as ShipItemId);
}

export function isAmmoItem(itemId: ItemId): itemId is AmmoItemId {
  return AMMO_ITEM_IDS.includes(itemId as AmmoItemId);
}

export function isMunitionsItem(itemId: ItemId): itemId is MunitionsItemId {
  return MUNITIONS_ITEM_IDS.includes(itemId as MunitionsItemId);
}

export function isWreckUnlockItem(itemId: ItemId): itemId is WreckUnlockItemId {
  return WRECK_UNLOCK_ITEM_IDS.includes(itemId as WreckUnlockItemId);
}

export function heroHasWreckUnlock(hero: HeroType): boolean {
  return WRECK_UNLOCK_ITEM_IDS.some(
    (itemId) => getItemCount(hero.inventory, itemId) > 0,
  );
}

export function getFoodHealAmount(itemId: FoodItemId): number {
  return ITEM_DEFINITIONS[itemId].healAmount ?? 0;
}

export function isFoodUsable(itemId: FoodItemId): boolean {
  return getFoodHealAmount(itemId) > 0;
}

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
    wreck: "Wreck",
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

export function checkUseFood(hero: HeroType, itemId: FoodItemId): UseItemCheck {
  const def = ITEM_DEFINITIONS[itemId];
  if (!isFoodUsable(itemId)) {
    return { ok: false, message: "That does nothing for ye — not yet, anyway." };
  }
  if (getItemCount(hero.inventory, itemId) <= 0) {
    return { ok: false, message: `Ye have no ${def.name.toLowerCase()}s.` };
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
    if (isFoodItem(itemId)) {
      return checkUseFood(ctx.hero, itemId);
    }
    return { ok: false, message: "Ye can't use that in battle." };
  }

  if (itemId === "key") {
    return {
      ok: false,
      message: "Use a key on a locked chest while delving.",
    };
  }
  if (isShipItem(itemId)) {
    return {
      ok: false,
      message: "Save that for ship repairs — not yet, anyway.",
    };
  }
  if (isAmmoItem(itemId)) {
    return {
      ok: false,
      message: "Save that for yer sidearm — not yet, anyway.",
    };
  }
  if (isMunitionsItem(itemId)) {
    return {
      ok: false,
      message: "Save that for the guns — not yet, anyway.",
    };
  }
  if (isFoodItem(itemId)) {
    return checkUseFood(ctx.hero, itemId);
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

export function applyFoodUse(hero: HeroType, itemId: FoodItemId): HeroType {
  const healAmount = getFoodHealAmount(itemId);
  const healed = Math.min(hero.max_hp, hero.current_hp + healAmount);
  return {
    ...hero,
    current_hp: clampHp(healed),
    inventory: removeItemFromInventory(hero.inventory, itemId),
  };
}

export function pickRandomItemId(): ItemId {
  return ITEM_IDS[Math.floor(Math.random() * ITEM_IDS.length)]!;
}

/** Each combat/treasure loot card grants at most one copy (not an inventory cap). */
export const LOOT_ITEM_COPY_LIMIT = 1;

export function getShopCatalogItemIds(
  shopVariant: ShopVariant | null,
): readonly ItemId[] {
  if (shopVariant === "merchant") return MERCHANT_SHOP_ITEM_IDS;
  if (shopVariant === "island_trader") return ISLAND_TRADER_SHOP_ITEM_IDS;
  return SHOP_ITEM_IDS;
}

export function getItemBuyPrice(
  hero: HeroType,
  itemId: ItemId,
  shopVariant: ShopVariant | null = "ship",
): number | null {
  const catalog = getShopCatalogItemIds(shopVariant);
  if (!catalog.includes(itemId as (typeof catalog)[number])) return null;
  const def = ITEM_DEFINITIONS[itemId];
  const basePrice =
    shopVariant === "merchant" || shopVariant === "island_trader"
      ? def.basePrice
      : def.shopPrice;
  if (basePrice === undefined) return null;
  const owned = getItemCount(hero.inventory, itemId);
  return shopBuyPrice(basePrice, hero.level, owned);
}

export function getItemSellPrice(itemId: ItemId): number | null {
  const def = ITEM_DEFINITIONS[itemId];
  const basePrice = def.basePrice ?? def.shopPrice;
  if (basePrice === undefined) return null;
  return sellPriceFromBasePrice(basePrice);
}

export function checkBuyItem(
  hero: HeroType,
  itemId: ItemId,
  shopVariant: ShopVariant | null = "ship",
): UseItemCheck {
  const price = getItemBuyPrice(hero, itemId, shopVariant);
  if (price === null) {
    return { ok: false, message: "Not for sale here." };
  }
  if (hero.gold < price) {
    return { ok: false, message: `Not enough gold (needs ${price}).` };
  }
  return { ok: true };
}

export function applyBuyItem(
  hero: HeroType,
  itemId: ItemId,
  shopVariant: ShopVariant | null = "ship",
): HeroType {
  const price = getItemBuyPrice(hero, itemId, shopVariant);
  if (price === null) return hero;
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
