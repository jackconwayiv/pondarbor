import type { ShopVariant } from "../shantiesTypes";
import { ENCOUNTER_GROUP_SIZES, ENCOUNTER_POOLS, ENCOUNTER_POOL_LABELS } from "../monsters";
import { PORT_POOL_CHANCE } from "../portEvents";

export { ENCOUNTER_POOLS, ENCOUNTER_GROUP_SIZES, ENCOUNTER_POOL_LABELS, PORT_POOL_CHANCE };

export const SEA_DECK_RULES =
  "4–6 Sea Combat, 1–2 Discover an Island!, remainder from event pool → 10 cards shuffled";

export const SEA_PORT_RULES = `${Math.round(PORT_POOL_CHANCE * 100)}% chance on each random sea pool slot when building the deck`;

export const SEA_EVENT_POOL_DISPLAY = [
  { name: "Port Town", type: "port" },
  { name: "Storm!", type: "weather" },
  { name: "Fog Bank", type: "weather" },
  { name: "Merchant Ship", type: "merchant" },
  { name: "Floating Supplies", type: "treasure" },
  { name: "Shipwreck Dive", type: "shipwreck" },
] as const;

export const SEA_FIXED_EVENTS = [
  { name: "Sea Combat", type: "combat" },
  { name: "Discover an Island!", type: "discovery" },
] as const;

export const ISLAND_DECK_RULES = {
  Small: "3–5 cards; min 1 combat; guaranteed 1 treasure",
  Medium: "5–7 cards; min 3 combat; guaranteed 1 dungeon discovery",
  Large: "7–9 cards; min 4 combat; guaranteed 1 treasure + 1 dungeon discovery",
} as const;

export const ISLAND_EVENT_POOL_DISPLAY = [
  { name: "Island Combat", type: "combat" },
  { name: "Buried Chest", type: "treasure" },
  { name: "Supply Cache", type: "treasure" },
  { name: "Storm!", type: "weather" },
  { name: "Wind", type: "weather" },
  { name: "Heat Wave", type: "weather" },
  { name: "Island Trader", type: "merchant" },
  { name: "Cookstove", type: "cookstove" },
] as const;

export const ISLAND_DUNGEON_KINDS = ["cave", "ruins", "temple"] as const;

export const DUNGEON_DISCOVERY_NAMES: Record<string, string> = {
  cave: "Cave Mouth",
  ruins: "Ancient Ruins",
  temple: "Hidden Temple",
  wreck: "Sunken Wreck",
};

export const FLOATING_SUPPLY_POOL = [
  "cannonball",
  "ammo_pouch",
  "tea",
  "rum",
  "sail_cloth",
  "wood_plank",
  "candle",
  "key",
  "fruit",
  "lockpick",
] as const;

export const ISLAND_TREASURE_POOL_DISPLAY = [
  "fruit",
  "wood_plank",
  "cannonball",
  "ammo_pouch",
  "lockpick",
  "gold",
] as const;

export const SHOP_CATALOG_LABELS: Record<ShopVariant, string> = {
  ship: "Provisions",
  merchant: "Merchant ship",
  island_trader: "Island trader",
  port: "Marketplace",
};

export const ENEMY_ACTION_DESCRIPTIONS = [
  { action: "Attack", broadcast: "Attack", effect: "1–4 damage to hero" },
  { action: "Defend", broadcast: "Defend", effect: "1–4 armor" },
  { action: "Evade", broadcast: "Buff", effect: "Adds Evasive stack (25% melee miss per stack; ×2 = 50%)" },
  {
    action: "Electrify",
    broadcast: "Buff",
    effect: "Grants Shocking — successful melee hits reflect 1 damage to hero (Electric Eel only)",
  },
  { action: "Weaken", broadcast: "Debuff", effect: "Hero gains Weakened (−1 damage, min 1)" },
] as const;

export const STARTER_DECK_COMPOSITION = [
  { label: "Melee Attack", count: 7 },
  { label: "Ranged Attack", count: 7 },
  { label: "Strong Melee Attack", count: 1 },
  { label: "Strong Ranged Attack", count: 1 },
  { label: "Defend", count: 4 },
] as const;
