import type { ReactNode } from "react";

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
  | "dead";

export type GameLocationTypes = "ship" | "island" | "dungeon";

export type IslandType = {
  name: string;
  size: "Small" | "Large" | null;
  vibe: "Inviting" | "Foreboding" | null;
  explorePoints: number;
  levelFactor: number;
  /** Built on first anchor; each card is one explore action. */
  eventDeck?: EventType[];
};

export type ShopVariant = "ship" | "merchant" | "island_trader";

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
  | "slashing"
  | "ranged"
  | "firearm"
  | "piercing"
  | "physical"
  | "armor"
  | "attack"
  | "defense";

/** @deprecated Use CombatTag */
export type CardTag = CombatTag;

export type AttackKind = "melee" | "ranged";

export type AttackCardName =
  | "Melee Attack"
  | "Ranged Attack"
  | "Strong Melee Attack"
  | "Strong Ranged Attack";

export type AttackCard = {
  name: AttackCardName;
  attackKind: AttackKind;
  strong: boolean;
};

export type DefendCard = {
  name: "Defend";
  targeting: CardTargeting;
};

export type CombatCard = AttackCard | DefendCard;

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
  "boar_meat",
  "coconut",
  "mango",
  "pineapple",
  "tea",
  "rum",
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

export type EquipmentSlot = "melee" | "ranged" | "armor" | "relic";

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
  gold: number;
  xp: number;
  level: number;
  deck: CombatCard[];
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
  day: number;
  location: GameLocationTypes;
  currentIsland: IslandType | null;
  currentDungeon: DungeonType | null;
  renderIslandName: (island: IslandType) => string;
  renderDungeonName: (dungeon: DungeonType) => string;
  gameState?: GameStateTypes;
};

export type WorldPanelProps = {
  gameState: GameStateTypes;
  setGameState: React.Dispatch<React.SetStateAction<GameStateTypes>>;
  location: GameLocationTypes;
  setLocation: React.Dispatch<React.SetStateAction<GameLocationTypes>>;
  currentIsland: IslandType | null;
  currentDungeon: DungeonType | null;
  setCurrentDungeon: React.Dispatch<React.SetStateAction<DungeonType | null>>;
  renderIslandName: (island: IslandType) => string;
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
  enemyActionMessage: string | null;
  handleSailOrExplore: () => void;
  startSailFromShip: () => void;
  returnToShipFromIsland: () => void;
  anchorAtDiscoveredIsland: () => void;
  abandonDiscoveredIsland: () => void;
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
  resumeAdventure: () => void;
  restartAdventure: () => void;
  canResumeAdventure: boolean;
  lobbySaveSummaryLines: SaveSummaryLine[];
  lobbySavedAtLabel: string | null;
  healHero: () => void;
  openRest: () => void;
  wakeFromRest: () => void;
  leaveRest: () => void;
  restComplete: boolean;
  restMessage: string | null;
  shopMessage: string | null;
  shopVariant: ShopVariant | null;
  buyShopItem: (itemId: ItemId) => void;
  sellShopItem: (itemId: ItemId) => void;
  sellShopEquipment: (bagIndex: number) => void;
  leaveShop: () => void;
  openShipShop: () => void;
  openMerchantShop: () => void;
  openIslandTraderShop: () => void;
  resolveShipwreckDive: (choice: "sail_past" | WreckUnlockItemId) => void;
  onOpenCharacterSheet: () => void;
  isStaff?: boolean;
};

export function isAttackCard(card: CombatCard): card is AttackCard {
  return (
    card.name === "Melee Attack" ||
    card.name === "Ranged Attack" ||
    card.name === "Strong Melee Attack" ||
    card.name === "Strong Ranged Attack"
  );
}

export function isStrongAttackCard(card: CombatCard): card is AttackCard {
  return isAttackCard(card) && card.strong;
}

export function getAttackKind(card: AttackCard): AttackKind {
  return card.attackKind;
}

export function isDefendCard(card: CombatCard): card is DefendCard {
  return card.name === "Defend";
}

/** Resolved targeting for any combat card (attacks implicit until they carry their own). */
export function getCardTargeting(card: CombatCard): CardTargeting {
  if (isDefendCard(card)) return card.targeting;
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
