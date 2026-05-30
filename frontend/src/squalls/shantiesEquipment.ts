import type { CardClass } from "./squallsCardCatalog";
import type {
  CombatTag,
  EquipmentId,
  EquipmentSlot,
  EquippedGear,
  HeroType,
} from "./shantiesTypes";
import { sellPriceFromBasePrice } from "./shantiesShop";

export const EQUIPMENT_SLOTS: readonly EquipmentSlot[] = [
  "melee",
  "ranged",
  "armor",
  "relic",
  "relic2",
  "pet",
];

export const EQUIPMENT_SLOT_LABELS: Record<EquipmentSlot, string> = {
  melee: "MELEE",
  ranged: "RANGED",
  armor: "Armor",
  relic: "Relic 1",
  relic2: "Relic 2",
  pet: "Pet",
};

export type EquipmentCombatStats = {
  min: number;
  max: number;
};

export type EquipmentDefinition = {
  id: EquipmentId;
  name: string;
  emoji: string;
  slot: EquipmentSlot;
  description: string;
  /** Reference buy value for barter sell price (50% rounded down). */
  shopPrice?: number;
  tags?: readonly CombatTag[];
  combat?: EquipmentCombatStats;
  /** Card class pool granted when this item is equipped. */
  cardClass?: CardClass;
};

export const EQUIPMENT_DEFINITIONS: Record<EquipmentId, EquipmentDefinition> = {
  rusty_cutlass: {
    id: "rusty_cutlass",
    name: "Rusty Cutlass",
    emoji: "🗡️",
    slot: "melee",
    description: "A salt-crusted blade. 1–5 slashing damage.",
    shopPrice: 20,
    tags: ["melee"] satisfies readonly CombatTag[],
    combat: { min: 1, max: 5 },
    cardClass: "cutlass",
  },
  sooty_pistol: {
    id: "sooty_pistol",
    name: "Sooty Pistol",
    emoji: "🔫",
    slot: "ranged",
    description: "Black powder and hope. 1–4 piercing damage.",
    shopPrice: 40,
    tags: ["ranged"] satisfies readonly CombatTag[],
    combat: { min: 1, max: 4 },
    cardClass: "pistol",
  },
  sailors_garb: {
    id: "sailors_garb",
    name: "Sailor's Garb",
    emoji: "🧥",
    slot: "armor",
    description: "Well-worn kit. 1–4 armor when defending.",
    shopPrice: 30,
    combat: { min: 1, max: 4 },
    cardClass: "light_armor",
  },
  lockpick: {
    id: "lockpick",
    name: "Lockpick",
    emoji: "🪝",
    slot: "relic",
    description: "Pick locked chests. May break on use.",
    shopPrice: 35,
    cardClass: "scoundrel",
  },
};

export function heroOwnsRelicGear(hero: HeroType): boolean {
  if (hero.equipped.relic || hero.equipped.relic2) return true;
  return hero.equipmentInventory.some((id) => {
    const slot = EQUIPMENT_DEFINITIONS[id].slot;
    return slot === "relic" || slot === "relic2";
  });
}

export function heroOwnsPetGear(hero: HeroType): boolean {
  if (hero.equipped.pet) return true;
  return hero.equipmentInventory.some(
    (id) => EQUIPMENT_DEFINITIONS[id].slot === "pet",
  );
}

/** Equipped grid slots shown in the character sheet (conditional relic/pet rows). */
export function visibleEquipmentSlots(hero: HeroType): EquipmentSlot[] {
  const slots: EquipmentSlot[] = ["melee", "ranged", "armor"];
  if (heroOwnsRelicGear(hero)) {
    slots.push("relic", "relic2");
  }
  if (heroOwnsPetGear(hero)) {
    slots.push("pet");
  }
  return slots;
}

export function getEquipmentBuyPrice(equipmentId: EquipmentId): number | null {
  const price = EQUIPMENT_DEFINITIONS[equipmentId].shopPrice;
  return price === undefined ? null : price;
}

export function isEquipmentId(value: string): value is EquipmentId {
  return value in EQUIPMENT_DEFINITIONS;
}

export function createStarterEquipped(): EquippedGear {
  return {
    melee: "rusty_cutlass",
    ranged: "sooty_pistol",
    armor: "sailors_garb",
    relic: null,
    relic2: null,
    pet: null,
  };
}

export function createEmptyEquipped(): EquippedGear {
  return {
    melee: null,
    ranged: null,
    armor: null,
    relic: null,
    relic2: null,
    pet: null,
  };
}

export function normalizeEquipped(raw: unknown): EquippedGear {
  const starter = createStarterEquipped();
  if (!raw || typeof raw !== "object") return starter;
  const record = raw as Record<string, unknown>;
  const parse = (key: EquipmentSlot): EquipmentId | null => {
    const value = record[key];
    if (value === null || value === undefined) return null;
    if (typeof value === "string" && isEquipmentId(value)) return value;
    return starter[key];
  };
  return {
    melee: parse("melee"),
    ranged: parse("ranged"),
    armor: parse("armor"),
    relic: parse("relic"),
    relic2: parse("relic2"),
    pet: parse("pet"),
  };
}

export function normalizeEquipmentInventory(raw: unknown): EquipmentId[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (entry): entry is EquipmentId =>
      typeof entry === "string" && isEquipmentId(entry),
  );
}

export type EquipmentDragFrom =
  | { source: "slot"; slot: EquipmentSlot }
  | { source: "inventory"; index: number };

export type EquipmentDragTo =
  | { target: "slot"; slot: EquipmentSlot }
  | { target: "inventory" };

/** Move gear between an equipped slot and the unequipped inventory bag. */
export function applyEquipmentMove(
  hero: HeroType,
  from: EquipmentDragFrom,
  to: EquipmentDragTo,
): HeroType {
  const equipped: EquippedGear = { ...hero.equipped };
  const bag = [...hero.equipmentInventory];

  if (from.source === "slot" && to.target === "inventory") {
    const id = equipped[from.slot];
    if (!id) return hero;
    equipped[from.slot] = null;
    bag.push(id);
    return { ...hero, equipped, equipmentInventory: bag };
  }

  if (from.source === "inventory" && to.target === "slot") {
    const moving = bag[from.index];
    if (!moving) return hero;
    if (EQUIPMENT_DEFINITIONS[moving].slot !== to.slot) return hero;
    const displaced = equipped[to.slot];
    bag.splice(from.index, 1);
    equipped[to.slot] = moving;
    if (displaced) {
      bag.splice(from.index, 0, displaced);
    }
    return { ...hero, equipped, equipmentInventory: bag };
  }

  return hero;
}

export function getEquipmentSellPrice(equipmentId: EquipmentId): number | null {
  const basePrice = getEquipmentBuyPrice(equipmentId);
  if (basePrice === null) return null;
  return sellPriceFromBasePrice(basePrice);
}

export function heroHasLockpickEquipped(hero: HeroType): boolean {
  return hero.equipped.relic === "lockpick";
}

export function breakEquippedLockpick(hero: HeroType): HeroType {
  if (hero.equipped.relic !== "lockpick") return hero;
  return {
    ...hero,
    equipped: { ...hero.equipped, relic: null },
  };
}

export function addEquipmentToBag(
  hero: HeroType,
  equipmentId: EquipmentId,
): HeroType {
  return {
    ...hero,
    equipmentInventory: [...hero.equipmentInventory, equipmentId],
  };
}

export function checkSellEquipment(
  hero: HeroType,
  bagIndex: number,
): { ok: true } | { ok: false; message: string } {
  const equipmentId = hero.equipmentInventory[bagIndex];
  if (!equipmentId) {
    return { ok: false, message: "Nothing to sell there." };
  }
  if (getEquipmentSellPrice(equipmentId) === null) {
    return { ok: false, message: "The merchant won't buy that." };
  }
  return { ok: true };
}

export function applySellEquipment(hero: HeroType, bagIndex: number): HeroType {
  const equipmentId = hero.equipmentInventory[bagIndex];
  if (!equipmentId) return hero;
  const sellPrice = getEquipmentSellPrice(equipmentId);
  if (sellPrice === null) return hero;
  const bag = [...hero.equipmentInventory];
  bag.splice(bagIndex, 1);
  return {
    ...hero,
    gold: hero.gold + sellPrice,
    equipmentInventory: bag,
  };
}
