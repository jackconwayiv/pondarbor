import type { ReactNode } from "react";

import type { ExploreTestContext, ExploreTestOption } from "./exploreTestPicker";
import type { PortTownType } from "./portTowns";

export type { ExploreTestContext, ExploreTestOption };

export type SaveSummaryLine = {
  label: string;
  value: string;
};

export type GameShellProps = {
  world: ReactNode;
  adventure: ReactNode;
  player: ReactNode;
  /** Live destination scene (drives fade backdrop color). */
  targetGameState: GameStateTypes;
  targetLocation: GameLocationTypes;
  /** Scene shown during fade transitions (lags live state while animating). */
  displayGameState: GameStateTypes;
  displayLocation: GameLocationTypes;
  /** Optional dungeon kind for scene tinting (wreck vs land dungeons). */
  targetDungeonKind?: IndoorAreaKind | null;
  displayDungeonKind?: IndoorAreaKind | null;
  sceneOpacity: number;
  sceneFadeMs: number;
  isTransitioning: boolean;
};

export type GameStateTypes =
  | "lobby"
  | "shop"
  | "home"
  | "battle"
  | "rest"
  | "explore"
  | "event"
  | "sail"
  | "dead"
  | "tavern"
  | "shipwright"
  | "exploreTest"
  | "cookstove"
  | "levelUp";

export type GameLocationTypes = "ship" | "island" | "dungeon" | "port";

export type IslandType = {
  name: string;
  size: "Small" | "Large" | null;
  vibe: "Inviting" | "Foreboding" | null;
  explorePoints: number;
  levelFactor: number;
  /** Built on first anchor; each card is one explore action. */
  eventDeck?: EventType[];
  /** Set when a cookstove is discovered while exploring this island. */
  cookstoveFound?: boolean;
};

export type { PortTownType } from "./portTowns";

export type ShopVariant = "ship" | "merchant" | "island_trader" | "port";

export type EventType = {
  name: string;
  type: string;
  /** Set when type is dungeon_discovery. */
  dungeonKind?: IndoorAreaKind;
  /** Dungeon treasure only: chest requires a key or force-open attempt. */
  locked?: boolean;
};

export type EnemyAction = "attack" | "defend" | "evade" | "electrify" | "weaken";

export type EnemyBroadcast = "attack" | "defend" | "buff" | "debuff";

export type EnemyTrait = "evasive" | "shocking";

export type EnemyType = {
  name: string;
  level: number;
  hp: number;
  max_hp: number;
  damageMin: number;
  damageMax: number;
  isBoss?: boolean;
  /** Attack / Defend / Buff / Debuff telegraph for the player's turn. */
  broadcast: EnemyBroadcast;
  /** Queued action for the next enemy phase. */
  nextAction: EnemyAction;
  actionDrawPile: EnemyAction[];
  actionDiscardPile: EnemyAction[];
  armor: number;
  traits?: readonly EnemyTrait[];
};

/** How a card picks its target when played. */
export type CardTargeting = {
  mode: "auto" | "manual";
  target: "self" | "enemy";
};

export const DEFEND_TARGETING: CardTargeting = {
  mode: "auto",
  target: "self",
};

export type CombatTag =
  | "melee"
  | "sword"
  | "ranged"
  | "firearm"
  | "attack"
  | "defense";

/** @deprecated Use CombatTag */
export type CardTag = CombatTag;

import type { CardId } from "./squallsCardCatalog";
import {
  getCardDefinition,
  type CardEffectKind,
} from "./squallsCardCatalog";

export type { CardId };

export type AttackKind = "melee" | "ranged";

/** Minimal runtime card instance; resolve display/combat via catalog. */
export type CombatCard = { id: CardId };

export type CombatLogSide = "hero" | "enemy";

export type CombatLogEntry = {
  text: string;
  side: CombatLogSide;
};

export type CombatLootKind = "gold" | "xp" | "item" | "equipment";

export type CombatLootItem = {
  id: string;
  kind: CombatLootKind;
  amount: number;
  /** Foe name, event name, etc. */
  sourceName: string;
  claimed: boolean;
  /** Present when kind is "item". */
  itemId?: ItemId;
  /** Present when kind is "equipment". */
  equipmentId?: EquipmentId;
};

export const FOOD_ITEM_IDS = [
  "banana",
  "orange",
  "raw_fish",
  "raw_meat",
  "cooked_fish",
  "cooked_meat",
  "coconut",
  "mango",
  "pineapple",
  "tea",
  "rum",
  "grog",
] as const;
export type FoodItemId = (typeof FOOD_ITEM_IDS)[number];

export const SHIP_ITEM_IDS = [
  "wood_plank",
  "sail_cloth",
  "water_bucket",
] as const;
export type ShipItemId = (typeof SHIP_ITEM_IDS)[number];

export const AMMO_ITEM_IDS = ["ammo_pouch"] as const;
export type AmmoItemId = (typeof AMMO_ITEM_IDS)[number];

export const MUNITIONS_ITEM_IDS = [
  "cannonball",
  "scattershot",
  "powderkeg",
] as const;
export type MunitionsItemId = (typeof MUNITIONS_ITEM_IDS)[number];

export const WRECK_UNLOCK_ITEM_IDS = ["siren_gills", "dive_helmet"] as const;
export type WreckUnlockItemId = (typeof WRECK_UNLOCK_ITEM_IDS)[number];

export const ITEM_IDS = [
  ...FOOD_ITEM_IDS,
  ...SHIP_ITEM_IDS,
  ...AMMO_ITEM_IDS,
  ...MUNITIONS_ITEM_IDS,
  ...WRECK_UNLOCK_ITEM_IDS,
  "candle",
  "key",
] as const;
export type ItemId = (typeof ITEM_IDS)[number];

export type Inventory = Partial<Record<ItemId, number>>;

export const EQUIPMENT_IDS = [
  "rusty_cutlass",
  "sooty_pistol",
  "sailors_garb",
  "lockpick",
] as const;
export type EquipmentId = (typeof EQUIPMENT_IDS)[number];

export type EquipmentSlot =
  | "melee"
  | "ranged"
  | "armor"
  | "relic"
  | "relic2"
  | "pet";

export type EquippedGear = Record<EquipmentSlot, EquipmentId | null>;

export const INDOOR_AREA_KINDS = ["cave", "ruins", "temple", "wreck"] as const;
export type IndoorAreaKind = (typeof INDOOR_AREA_KINDS)[number];

/** Stable id for a specific cave, ruins, or temple instance (e.g. `cave:island-1-main`). */
export type IndoorAreaId = `${IndoorAreaKind}:${string}`;

export type DungeonKind = IndoorAreaKind;

export type DungeonType = {
  kind: DungeonKind;
  name: string;
  delvePoints: number;
  levelFactor: number;
  areaId: IndoorAreaId;
  /** Island dungeons: candle spent to enter; re-entry is free until depleted. */
  candleUnlocked?: boolean;
};

export type HeroType = {
  name: string;
  class: string;
  current_hp: number;
  max_hp: number;
  ammo: number;
  max_ammo: number;
  gold: number;
  xp: number;
  level: number;
  deck: CardId[];
  /** Every owned copy — exact counts per card id (binder inventory). */
  cardCollection: CardId[];
  /** Set when loadout change leaves deck illegal until fixed. */
  deckEditRequired?: boolean;
  inventory: Inventory;
  equipped: EquippedGear;
  /** Unequipped equipment pieces (drag to slots to equip). */
  equipmentInventory: EquipmentId[];
};

export type CombatPhase = "player" | "enemy";

export type PlayerPanelProps = {
  hero: HeroType;
  gameState: GameStateTypes;
  armor: number;
  weakened?: boolean;
  onOpenCharacterSheet: () => void;
};

export type AdventureStripeProps = {
  location: GameLocationTypes;
  currentIsland: IslandType | null;
  currentDungeon: DungeonType | null;
  renderIslandName: (island: IslandType) => string;
  renderDungeonName: (dungeon: DungeonType) => string;
  gameState?: GameStateTypes;
  onOpenCharacterSheet?: () => void;
};

export type WorldPanelProps = {
  gameState: GameStateTypes;
  setGameState: React.Dispatch<React.SetStateAction<GameStateTypes>>;
  location: GameLocationTypes;
  setLocation: React.Dispatch<React.SetStateAction<GameLocationTypes>>;
  currentIsland: IslandType | null;
  currentPortTown: PortTownType | null;
  currentDungeon: DungeonType | null;
  setCurrentDungeon: React.Dispatch<React.SetStateAction<DungeonType | null>>;
  renderIslandName: (island: IslandType) => string;
  renderPortTownName: (port: PortTownType) => string;
  renderDungeonName: (dungeon: DungeonType) => string;
  enterCurrentDungeon: () => void;
  returnToIslandFromDungeon: () => void;
  resolveDungeonDiscovery: (enterNow: boolean) => void;
  day: number;
  setDay: React.Dispatch<React.SetStateAction<number>>;
  hero: HeroType;
  armor: number;
  heroWeakened: boolean;
  enemies: EnemyType[];
  activeEvent: EventType | null;
  setActiveEvent: React.Dispatch<React.SetStateAction<EventType | null>>;
  hand: CombatCard[];
  discardPile: CombatCard[];
  combatLog: CombatLogEntry[];
  energy: number;
  maxEnergy: number;
  combatPhase: CombatPhase;
  victoryPending: boolean;
  combatVictory: boolean;
  combatLoot: CombatLootItem[];
  allCombatLootClaimed: boolean;
  eventLoot: CombatLootItem[];
  allEventLootClaimed: boolean;
  levelUpCardChoices: CombatCard[];
  enemyActionMessage: string | null;
  handleSailOrExplore: () => void;
  startSailFromShip: () => void;
  returnToShipFromIsland: () => void;
  anchorAtDiscoveredIsland: () => void;
  abandonDiscoveredIsland: () => void;
  dockAtPortTown: () => void;
  sailPastPortTown: () => void;
  claimCombatLoot: (lootId: string) => void;
  claimEventLoot: (lootId: string) => void;
  completeTreasureEvent: () => void;
  acknowledgeGenericEvent: () => void;
  acknowledgeWeatherEvent: () => void;
  abandonLockedDungeonChest: () => void;
  unlockDungeonChestWithKey: () => void;
  pickLockOnChest: () => void;
  forceOpenDungeonChest: () => void;
  dungeonChestUnlocked: boolean;
  chestMessage: string | null;
  forceOpenAttempted: boolean;
  dismissCombatVictory: () => void;
  playCombatCard: (handIndex: number, targetIndex?: number) => void;
  endPlayerTurn: () => void;
  resetToLobby: () => void;
  goToLobby: () => void;
  healHero: () => void;
  openRest: () => void;
  wakeFromRest: () => void;
  leaveRest: () => void;
  restComplete: boolean;
  restMessage: string | null;
  openCookstove: () => void;
  leaveCookstove: () => void;
  cookAtStove: (fromIslandEvent?: boolean) => void;
  dismissCookstoveEncounter: () => void;
  cookMessage: string | null;
  shopMessage: string | null;
  shopVariant: ShopVariant | null;
  buyShopItem: (itemId: ItemId) => void;
  sellShopItem: (itemId: ItemId) => void;
  sellShopEquipment: (bagIndex: number) => void;
  leaveShop: () => void;
  openShipShop: () => void;
  openMerchantShop: () => void;
  openIslandTraderShop: () => void;
  openPortShop: () => void;
  openShipwright: () => void;
  openTavern: () => void;
  leavePort: () => void;
  returnToPort: () => void;
  nearPortTown: boolean;
  leaveTavern: () => void;
  leaveShipwright: () => void;
  tavernMessage: string | null;
  buyTavernCard: (offerId: string) => void;
  refineTavernCard: (deckIndex: number) => void;
  resolveShipwreckDive: (choice: "sail_past" | WreckUnlockItemId) => void;
  exploreTestContext: ExploreTestContext | null;
  exploreTestOptions: ExploreTestOption[];
  applyExploreTestOutcome: (optionId: string) => void;
  cancelExploreTest: () => void;
  chooseLevelUpCard: (choiceIndex: number) => void;
  onOpenCharacterSheet: () => void;
};

const MELEE_EFFECTS: readonly CardEffectKind[] = [
  "melee_attack",
  "lucky_melee",
  "strong_melee",
  "quick_melee",
  "melee_all_enemies",
  "steal",
];

const RANGED_EFFECTS: readonly CardEffectKind[] = [
  "ranged_attack",
  "lucky_ranged",
  "strong_ranged",
  "cheap_ranged",
  "ranged_all_enemies",
];

const DEFEND_EFFECTS: readonly CardEffectKind[] = [
  "defend",
  "lucky_armor",
  "strong_armor",
  "dodge",
  "swish",
];

export function getCardEffect(card: CombatCard): CardEffectKind {
  return getCardDefinition(card.id).effect;
}

export function getCardName(card: CombatCard): string {
  return getCardDefinition(card.id).name;
}

export function isAttackCard(card: CombatCard): boolean {
  return MELEE_EFFECTS.includes(getCardEffect(card)) ||
    RANGED_EFFECTS.includes(getCardEffect(card));
}

export function isMeleeAttackCard(card: CombatCard): boolean {
  return MELEE_EFFECTS.includes(getCardEffect(card));
}

export function isRangedAttackCard(card: CombatCard): boolean {
  return RANGED_EFFECTS.includes(getCardEffect(card));
}

export function isStrongAttackCard(card: CombatCard): boolean {
  const effect = getCardEffect(card);
  return effect === "strong_melee" || effect === "strong_ranged";
}

export function getAttackKind(card: CombatCard): AttackKind {
  return isRangedAttackCard(card) ? "ranged" : "melee";
}

export function cardRequiresAmmo(card: CombatCard): boolean {
  return isRangedAttackCard(card);
}

export function isDefendCard(card: CombatCard): boolean {
  return DEFEND_EFFECTS.includes(getCardEffect(card));
}

export function isAllEnemiesCard(card: CombatCard): boolean {
  const effect = getCardEffect(card);
  return effect === "melee_all_enemies" || effect === "ranged_all_enemies";
}

export function isStealCard(card: CombatCard): boolean {
  return getCardEffect(card) === "steal";
}

export function isSwishCard(card: CombatCard): boolean {
  return getCardEffect(card) === "swish";
}

/** Resolved targeting for any combat card. */
export function getCardTargeting(card: CombatCard): CardTargeting {
  const mode = getCardDefinition(card.id).targeting;
  if (mode === "self") return { mode: "auto", target: "self" };
  if (mode === "all_enemies") return { mode: "auto", target: "enemy" };
  return { mode: "manual", target: "enemy" };
}

export function targetsSelfAutomatically(card: CombatCard): boolean {
  const { mode, target } = getCardTargeting(card);
  return mode === "auto" && target === "self";
}

export function targetsEnemyManually(card: CombatCard): boolean {
  const { mode, target } = getCardTargeting(card);
  return mode === "manual" && target === "enemy";
}

export function targetsAllEnemiesAutomatically(card: CombatCard): boolean {
  return getCardDefinition(card.id).targeting === "all_enemies";
}
