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
};

export type EventType = {
  name: string;
  type: string;
  /** Set when type is dungeon_discovery. */
  dungeonKind?: IndoorAreaKind;
  /** Dungeon treasure only: chest requires a key or force-open attempt. */
  locked?: boolean;
};

export type EnemyIntent = "attack" | "defend";

export type EnemyType = {
  name: string;
  level: number;
  hp: number;
  max_hp: number;
  /** Telegraph for the upcoming enemy phase. */
  intent: EnemyIntent;
  armor: number;
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

export type CardTag = "physical" | "attack" | "defense";

export type AttackCard = {
  name: "Attack" | "Strong Attack";
  minDamage: number;
  maxDamage: number;
  tags: readonly [CardTag, CardTag];
};

export type DefendCard = {
  name: "Defend";
  targeting: CardTargeting;
  tags: readonly [CardTag, CardTag];
};

export type CombatCard = AttackCard | DefendCard;

export type CombatLootKind = "gold" | "xp" | "item";

export type CombatLootItem = {
  id: string;
  kind: CombatLootKind;
  amount: number;
  /** Foe name, event name, etc. */
  sourceName: string;
  claimed: boolean;
  /** Present when kind is "item". */
  itemId?: ItemId;
};

export const FOOD_ITEM_IDS = [
  "banana",
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

export const ITEM_IDS = [
  ...FOOD_ITEM_IDS,
  ...SHIP_ITEM_IDS,
  ...AMMO_ITEM_IDS,
  ...MUNITIONS_ITEM_IDS,
  "candle",
  "key",
] as const;
export type ItemId = (typeof ITEM_IDS)[number];

export type Inventory = Partial<Record<ItemId, number>>;

export const EQUIPMENT_IDS = [
  "rusty_cutlass",
  "sooty_pistol",
  "sailors_garb",
] as const;
export type EquipmentId = (typeof EQUIPMENT_IDS)[number];

export type EquipmentSlot = "melee" | "ranged" | "armor" | "relic";

export type EquippedGear = Record<EquipmentSlot, EquipmentId | null>;

export const INDOOR_AREA_KINDS = ["cave", "ruins", "temple"] as const;
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
  enemies: EnemyType[];
  activeEvent: EventType | null;
  setActiveEvent: React.Dispatch<React.SetStateAction<EventType | null>>;
  hand: CombatCard[];
  discardPile: CombatCard[];
  combatLog: string[];
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
  abandonLockedDungeonChest: () => void;
  unlockDungeonChestWithKey: () => void;
  forceOpenDungeonChest: () => void;
  dungeonChestUnlocked: boolean;
  chestMessage: string | null;
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
  buyShopItem: (itemId: ItemId) => void;
  sellShopItem: (itemId: ItemId) => void;
  sellShopEquipment: (bagIndex: number) => void;
  leaveShop: () => void;
  onOpenCharacterSheet: () => void;
};

export function isAttackCard(card: CombatCard): card is AttackCard {
  return card.name === "Attack" || card.name === "Strong Attack";
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
