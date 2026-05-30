import {
  createStarterDeck,
  createStarterCardCollection,
} from "./combatDeck";
import { isDeckValid } from "./deckValidation";
import {
  cardIdFromUnknown,
  createCombatCard,
  countCardCopies,
  isCardId,
  type CardId,
} from "./squallsCardCatalog";
import {
  capLootToSingleItem,
  dedupeEventLootByItemType,
  generateCombatLoot,
  generateEventLoot,
  HERO_STARTING_AMMO,
  isTreasureEvent,
} from "./combatLoot";
import {
  generateFloatingSuppliesLoot,
  isSeaTreasureEvent,
} from "./floatingSuppliesLoot";
import {
  ensureIslandEventDeck,
  normalizeIslandEventDeck,
} from "./islandEventDeck";
import {
  generateIslandTreasureLoot,
  isIslandTreasureEvent,
} from "./islandTreasureLoot";
import { buildSeaEventDeck, normalizeSeaEventDeck } from "./seaEventDeck";
import { generatePortTown, normalizePortTown } from "./portTowns";
import { getMonsterTemplate } from "./monsters";
import { isIslandDungeonKind } from "./dungeonExplore";
import { heroLevelFromXp } from "./squallsXpProgression";
import { maxHpForLevel } from "./squallsHeroProgression";
import {
  initializeEnemyActionDeck,
  normalizeEnemyAction,
  normalizeEnemyActionPile,
  normalizeEnemyBroadcast,
} from "./enemyActions";
import {
  createEmptyScopedEncounterModifiers,
  type EncounterModifiers,
  type ScopedEncounterModifiers,
} from "./encounterProbability";
import {
  createStarterEquipped,
  normalizeEquipped,
  normalizeEquipmentInventory,
} from "./shantiesEquipment";
import type {
  CombatCard,
  CombatLogEntry,
  CombatLogSide,
  CombatLootItem,
  CombatLootKind,
  CombatPhase,
  EnemyType,
  EquipmentId,
  EventType,
  GameLocationTypes,
  GameStateTypes,
  HeroType,
  DungeonType,
  IslandType,
  PortTownType,
} from "./shantiesTypes";
import {
  EQUIPMENT_IDS,
  INDOOR_AREA_KINDS,
  ITEM_IDS,
  type IndoorAreaId,
  type IndoorAreaKind,
  type Inventory,
  type ItemId,
  type ShopVariant,
} from "./shantiesTypes";

export const SHANTIES_STORAGE_KEY = "pondarbor.squalls.v1";
export const SHANTIES_SAVE_VERSION = 18;

const GAME_STATES: GameStateTypes[] = [
  "lobby",
  "shop",
  "home",
  "battle",
  "rest",
  "explore",
  "event",
  "sail",
  "dead",
  "tavern",
  "shipwright",
  "exploreTest",
  "cookstove",
  "levelUp",
];

const LOCATIONS: GameLocationTypes[] = ["ship", "island", "dungeon", "port"];

const COMBAT_PHASES: CombatPhase[] = ["player", "enemy"];

export type ShantiesSaveData = {
  gameState: GameStateTypes;
  location: GameLocationTypes;
  currentIsland: IslandType | null;
  currentPortTown: PortTownType | null;
  currentDungeon: DungeonType | null;
  day: number;
  hero: HeroType;
  enemies: EnemyType[];
  activeEvent: EventType | null;
  hand: CombatCard[];
  drawPile: CombatCard[];
  discardPile: CombatCard[];
  combatLog: CombatLogEntry[];
  armor: number;
  heroWeakened: boolean;
  energy: number;
  combatPhase: CombatPhase;
  enemyTurnIndex: number | null;
  combatVictory: boolean;
  /** Snapshot of the battlefield when combat was won (slain foes stay visible). */
  victoryEnemies: EnemyType[];
  combatLoot: CombatLootItem[];
  eventLoot: CombatLootItem[];
  /** Where to resume when paused at the lobby (Quit). */
  resumeGameState: GameStateTypes | null;
  /** Indoor areas permanently lit with a candle. */
  illuminatedAreas: IndoorAreaId[];
  /** Set while the captain is inside a cave, ruins, or temple. */
  currentIndoorArea: IndoorAreaId | null;
  /** Weight penalties per encounter type; scoped by sail / island / dungeon. */
  encounterModifiers: ScopedEncounterModifiers;
  /** False while a locked dungeon chest awaits key / force-open. */
  dungeonChestUnlocked: boolean;
  /** Remaining sea event cards (drawn from the end). */
  seaEventDeck: EventType[];
  /** Active shop catalog when gameState is shop. */
  shopVariant: ShopVariant | null;
  /** Ship is docked near a discovered port town (Return to Town on ship menu). */
  nearPortTown: boolean;
  levelUpPicksRemaining: number;
  levelUpCardChoices: CardId[];
};

type ShantiesSavePayload = {
  version: number;
  savedAtMs: number;
  data: ShantiesSaveData;
};

export function createInitialHero(): HeroType {
  const level = 1;
  const max_hp = maxHpForLevel(level);
  return {
    name: "Silver",
    class: "Swashbuckler",
    current_hp: max_hp,
    max_hp,
    ammo: HERO_STARTING_AMMO,
    max_ammo: HERO_STARTING_AMMO,
    gold: 0,
    xp: 0,
    level,
    deck: createStarterDeck(),
    cardCollection: createStarterCardCollection(),
    deckEditRequired: false,
    inventory: {},
    equipped: createStarterEquipped(),
    equipmentInventory: [],
  };
}

export function createDefaultSaveData(): ShantiesSaveData {
  return {
    gameState: "lobby",
    location: "ship",
    currentIsland: null,
    currentPortTown: null,
    currentDungeon: null,
    day: 1,
    hero: createInitialHero(),
    enemies: [],
    activeEvent: null,
    hand: [],
    drawPile: [],
    discardPile: [],
    combatLog: [],
    armor: 0,
    heroWeakened: false,
    energy: 3,
    combatPhase: "player",
    enemyTurnIndex: null,
    combatVictory: false,
    victoryEnemies: [],
    combatLoot: [],
    eventLoot: [],
    resumeGameState: null,
    illuminatedAreas: [],
    currentIndoorArea: null,
    encounterModifiers: createEmptyScopedEncounterModifiers(),
    dungeonChestUnlocked: false,
    seaEventDeck: [],
    shopVariant: null,
    nearPortTown: false,
    levelUpPicksRemaining: 0,
    levelUpCardChoices: [],
  };
}

function normalizeEncounterModifiers(raw: unknown): EncounterModifiers {
  if (!isRecord(raw)) return {};
  const modifiers: EncounterModifiers = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "number" && Number.isFinite(value)) {
      modifiers[key] = value;
    }
  }
  return modifiers;
}

function normalizeScopedEncounterModifiers(
  raw: unknown,
): ScopedEncounterModifiers {
  if (!isRecord(raw)) return createEmptyScopedEncounterModifiers();
  return {
    sail: normalizeEncounterModifiers(raw.sail),
    island: normalizeEncounterModifiers(raw.island),
    dungeon: normalizeEncounterModifiers(raw.dungeon),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** v5 coconut was the 5 HP snack; v6 renames that role to banana. */
function migrateV5ToV6(raw: unknown): unknown {
  if (!isRecord(raw)) return raw;
  const next: Record<string, unknown> = { ...raw };

  if (isRecord(raw.hero) && isRecord(raw.hero.inventory)) {
    const inv = { ...raw.hero.inventory };
    const legacyCoconut = Math.floor(finiteNumber(inv.coconut, 0));
    if (legacyCoconut > 0) {
      inv.banana = Math.floor(finiteNumber(inv.banana, 0)) + legacyCoconut;
      delete inv.coconut;
    }
    next.hero = { ...raw.hero, inventory: inv };
  }

  const migrateLootItemIds = (loot: unknown): unknown => {
    if (!Array.isArray(loot)) return loot;
    return loot.map((entry) => {
      if (!isRecord(entry) || entry.itemId !== "coconut") return entry;
      return { ...entry, itemId: "banana" };
    });
  };

  if ("combatLoot" in raw) {
    next.combatLoot = migrateLootItemIds(raw.combatLoot);
  }
  if ("eventLoot" in raw) {
    next.eventLoot = migrateLootItemIds(raw.eventLoot);
  }

  return next;
}

function migrateV13ToV14(raw: unknown): unknown {
  if (!isRecord(raw)) return raw;
  const next: Record<string, unknown> = { ...raw };

  const migrateItemId = (itemId: unknown): unknown =>
    itemId === "boar_meat" ? "raw_meat" : itemId;

  if (isRecord(raw.hero) && isRecord(raw.hero.inventory)) {
    const inv = { ...raw.hero.inventory };
    const legacyBoar = Math.floor(finiteNumber(inv.boar_meat, 0));
    if (legacyBoar > 0) {
      inv.raw_meat = Math.floor(finiteNumber(inv.raw_meat, 0)) + legacyBoar;
      delete inv.boar_meat;
    }
    next.hero = { ...raw.hero, inventory: inv };
  }

  const migrateLootItemIds = (loot: unknown): unknown => {
    if (!Array.isArray(loot)) return loot;
    return loot.map((entry) => {
      if (!isRecord(entry)) return entry;
      return { ...entry, itemId: migrateItemId(entry.itemId) };
    });
  };

  if ("combatLoot" in raw) {
    next.combatLoot = migrateLootItemIds(raw.combatLoot);
  }
  if ("eventLoot" in raw) {
    next.eventLoot = migrateLootItemIds(raw.eventLoot);
  }

  return next;
}

function migrateV14ToV15(raw: unknown): unknown {
  if (!isRecord(raw)) return raw;
  if (!isRecord(raw.hero)) return raw;
  const hero = raw.hero;
  return {
    ...raw,
    hero: {
      ...hero,
      ammo: Math.max(0, finiteNumber(hero.ammo, HERO_STARTING_AMMO)),
      max_ammo: Math.max(
        1,
        finiteNumber(hero.max_ammo, HERO_STARTING_AMMO),
      ),
    },
  };
}

function migrateV17ToV18(raw: unknown): unknown {
  if (!isRecord(raw)) return raw;
  if (!isRecord(raw.hero)) return raw;
  const hero = raw.hero;
  const deck = normalizeDeck(hero.deck);
  const cardCollection = normalizeCardCollection(
    hero.cardCollection,
    hero.unlockedCardIds,
    deck.length > 0 ? deck : createStarterDeck(),
  );
  const nextHero = { ...(hero as unknown as HeroType) };
  delete (nextHero as Record<string, unknown>).unlockedCardIds;
  return {
    ...raw,
    hero: {
      ...nextHero,
      deck: deck.length > 0 ? deck : createStarterDeck(),
      cardCollection,
      deckEditRequired: hero.deckEditRequired === true,
    },
  };
}

function migrateV16ToV17(raw: unknown): unknown {
  if (!isRecord(raw)) return raw;
  if (!isRecord(raw.hero)) return raw;
  const hero = raw.hero;
  const legacyDeck = Array.isArray(hero.deck) ? hero.deck : [];
  const migratedDeck: CardId[] = [];
  for (const entry of legacyDeck) {
    const id = cardIdFromUnknown(entry);
    if (id) migratedDeck.push(id);
  }
  const deck =
    migratedDeck.length > 0 ? migratedDeck : createStarterDeck();
  const unlockedSet = new Set<CardId>([
    ...createStarterCardCollection(),
    ...deck,
  ]);
  const legacyUnlocked = Array.isArray(hero.unlockedCardIds)
    ? hero.unlockedCardIds
    : [];
  for (const entry of legacyUnlocked) {
    if (typeof entry === "string" && isCardId(entry)) {
      unlockedSet.add(entry);
    }
  }
  const cardCollection = normalizeCardCollection(
    null,
    [...unlockedSet],
    deck,
  );
  const nextHero: HeroType = {
    ...(hero as unknown as HeroType),
    deck,
    cardCollection,
    deckEditRequired: hero.deckEditRequired === true,
  };
  if (!isDeckValid(nextHero)) {
    nextHero.deckEditRequired = true;
  }
  const legacyChoices = Array.isArray(raw.levelUpCardChoices)
    ? raw.levelUpCardChoices
    : [];
  const levelUpCardChoices: CardId[] = [];
  for (const entry of legacyChoices) {
    const id = cardIdFromUnknown(entry);
    if (id && !levelUpCardChoices.includes(id)) {
      levelUpCardChoices.push(id);
    }
  }
  return {
    ...raw,
    hero: nextHero,
    levelUpCardChoices,
  };
}

function migrateV15ToV16(raw: unknown): unknown {
  if (!isRecord(raw)) return raw;
  return {
    ...raw,
    levelUpPicksRemaining: Math.max(0, finiteNumber(raw.levelUpPicksRemaining, 0)),
    levelUpCardChoices: normalizeLevelUpCardChoices(raw.levelUpCardChoices),
  };
}

function migrateV8ToV9(raw: unknown): unknown {
  if (!isRecord(raw)) return raw;
  const next: Record<string, unknown> = { ...raw };
  if (isRecord(raw.hero)) {
    next.hero = {
      ...raw.hero,
      deck: createStarterDeck(),
    };
  }
  return next;
}

function resolveSavePayload(parsed: Record<string, unknown>): {
  data: unknown;
  savedAtMs: number | null;
} | null {
  let version =
    typeof parsed.version === "number" ? parsed.version : SHANTIES_SAVE_VERSION;
  let data: unknown = isRecord(parsed.data) ? parsed.data : parsed;
  const savedAtMs =
    typeof parsed.savedAtMs === "number" ? parsed.savedAtMs : null;

  if (version === 5) {
    data = migrateV5ToV6(data);
    version = 6;
  }

  if (version === 6) {
    version = 7;
  }

  if (version === 7) {
    version = 8;
  }

  if (version === 8) {
    data = migrateV8ToV9(data);
    version = 9;
  }

  if (version === 9) {
    version = 10;
  }

  if (version === 10) {
    version = 11;
  }

  if (version === 11) {
    version = 12;
  }

  if (version === 12) {
    version = 13;
  }

  if (version === 13) {
    data = migrateV13ToV14(data);
    version = 14;
  }

  if (version === 14) {
    data = migrateV14ToV15(data);
    version = 15;
  }

  if (version === 15) {
    data = migrateV15ToV16(data);
    version = 16;
  }

  if (version === 16) {
    data = migrateV16ToV17(data);
    version = 17;
  }

  if (version === 17) {
    data = migrateV17ToV18(data);
    version = 18;
  }

  if (version !== SHANTIES_SAVE_VERSION) return null;
  return { data, savedAtMs };
}

function normalizeCardId(raw: unknown): CardId | null {
  return cardIdFromUnknown(raw);
}

function normalizeDeck(raw: unknown): CardId[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => normalizeCardId(item))
    .filter((id): id is CardId => id !== null);
}

function ensureCollectionCoversDeck(
  collection: CardId[],
  deck: CardId[],
): CardId[] {
  const result = [...collection];
  const deckCounts = new Map<CardId, number>();
  for (const id of deck) {
    deckCounts.set(id, (deckCounts.get(id) ?? 0) + 1);
  }
  for (const [id, needed] of deckCounts) {
    let have = countCardCopies(result, id);
    while (have < needed) {
      result.push(id);
      have += 1;
    }
  }
  return result;
}

function normalizeCardCollection(
  rawCollection: unknown,
  legacyUnlocked: unknown,
  deck: CardId[],
): CardId[] {
  const fromRaw = normalizeDeck(rawCollection);
  if (fromRaw.length > 0) {
    return ensureCollectionCoversDeck(fromRaw, deck);
  }

  const collection = [...deck];
  if (Array.isArray(legacyUnlocked)) {
    for (const entry of legacyUnlocked) {
      if (typeof entry === "string" && isCardId(entry)) {
        if (countCardCopies(collection, entry) === 0) {
          collection.push(entry);
        }
      }
    }
  }
  return ensureCollectionCoversDeck(collection, deck);
}

function normalizeCombatCard(raw: unknown): CombatCard | null {
  const id = normalizeCardId(raw);
  if (!id) return null;
  return createCombatCard(id);
}

function normalizeCombatCards(raw: unknown): CombatCard[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => normalizeCombatCard(item))
    .filter((card): card is CombatCard => card !== null);
}

function normalizeLevelUpCardChoices(raw: unknown): CardId[] {
  if (!Array.isArray(raw)) return [];
  const choices: CardId[] = [];
  for (const entry of raw) {
    const id = normalizeCardId(entry);
    if (id && !choices.includes(id)) choices.push(id);
  }
  return choices.slice(0, 3);
}

function normalizeInventory(raw: unknown): Inventory {
  if (!isRecord(raw)) return {};
  const inventory: Inventory = {};
  for (const itemId of ITEM_IDS) {
    const count = Math.floor(finiteNumber(raw[itemId], 0));
    if (count > 0) inventory[itemId] = count;
  }
  return inventory;
}

function normalizeIndoorAreaId(raw: unknown): IndoorAreaId | null {
  if (typeof raw !== "string") return null;
  const parsed = raw.split(":");
  const kind = parsed[0];
  if (!INDOOR_AREA_KINDS.includes(kind as IndoorAreaKind)) return null;
  const areaKey = parsed.slice(1).join(":");
  if (!areaKey) return null;
  return raw as IndoorAreaId;
}

function normalizeIlluminatedAreas(raw: unknown): IndoorAreaId[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<IndoorAreaId>();
  const areas: IndoorAreaId[] = [];
  for (const entry of raw) {
    const id = normalizeIndoorAreaId(entry);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    areas.push(id);
  }
  return areas;
}

function normalizeHero(raw: unknown): HeroType {
  if (!isRecord(raw)) return createInitialHero();
  const defaults = createInitialHero();
  const deckRaw = normalizeDeck(raw.deck);
  const deck = deckRaw.length > 0 ? deckRaw : defaults.deck;
  const cardCollection = normalizeCardCollection(
    raw.cardCollection,
    raw.unlockedCardIds,
    deck,
  );
  const xp = Math.max(0, finiteNumber(raw.xp, 0));
  const savedLevel = Math.max(1, finiteNumber(raw.level, 1));
  const computedLevel = heroLevelFromXp(xp);
  const level = Math.max(savedLevel, computedLevel);
  const max_hp = maxHpForLevel(level);
  const current_hp = Math.max(
    0,
    Math.min(max_hp, finiteNumber(raw.current_hp, max_hp)),
  );
  const hero: HeroType = {
    name: typeof raw.name === "string" ? raw.name : "Silver",
    class: typeof raw.class === "string" ? raw.class : "Swashbuckler",
    current_hp,
    max_hp,
    ammo: Math.max(0, finiteNumber(raw.ammo, HERO_STARTING_AMMO)),
    max_ammo: Math.max(1, finiteNumber(raw.max_ammo, HERO_STARTING_AMMO)),
    gold: Math.max(0, finiteNumber(raw.gold, 50)),
    xp,
    level,
    deck,
    cardCollection,
    deckEditRequired: raw.deckEditRequired === true,
    inventory: normalizeInventory(raw.inventory),
    equipped: normalizeEquipped(raw.equipped),
    equipmentInventory: normalizeEquipmentInventory(raw.equipmentInventory),
  };
  if (!isDeckValid(hero)) {
    hero.deckEditRequired = true;
  }
  return hero;
}

function normalizeLootStash(raw: unknown): CombatLootItem[] {
  if (!Array.isArray(raw)) return [];
  const items: CombatLootItem[] = [];
  for (const entry of raw) {
    if (!isRecord(entry) || typeof entry.id !== "string") continue;
    const kind: CombatLootKind | null =
      entry.kind === "gold" ||
      entry.kind === "xp" ||
      entry.kind === "item" ||
      entry.kind === "equipment"
        ? entry.kind
        : null;
    if (!kind) continue;
    const sourceName =
      typeof entry.sourceName === "string"
        ? entry.sourceName
        : typeof entry.enemyName === "string"
          ? entry.enemyName
          : "";
    const itemId =
      kind === "item" && ITEM_IDS.includes(entry.itemId as ItemId)
        ? (entry.itemId as ItemId)
        : undefined;
    const equipmentId =
      kind === "equipment" &&
      EQUIPMENT_IDS.includes(entry.equipmentId as EquipmentId)
        ? (entry.equipmentId as EquipmentId)
        : undefined;
    if (kind === "item" && !itemId) continue;
    if (kind === "equipment" && !equipmentId) continue;
    const amount = Math.max(0, finiteNumber(entry.amount, 0));
    if (kind === "item" && amount <= 0) continue;
    if (kind === "equipment" && amount <= 0) continue;
    items.push({
      id: entry.id,
      kind,
      amount: kind === "equipment" ? 1 : amount,
      sourceName,
      claimed: entry.claimed === true,
      ...(itemId ? { itemId } : {}),
      ...(equipmentId ? { equipmentId } : {}),
    });
  }
  return items;
}

function normalizeDungeon(raw: unknown): DungeonType | null {
  if (!isRecord(raw)) return null;
  const kind =
    raw.kind === "cave" ||
    raw.kind === "ruins" ||
    raw.kind === "temple" ||
    raw.kind === "wreck"
      ? raw.kind
      : null;
  if (!kind || typeof raw.name !== "string") return null;
  const areaId = normalizeIndoorAreaId(raw.areaId);
  if (!areaId) return null;
  return {
    kind,
    name: raw.name,
    delvePoints: Math.max(0, finiteNumber(raw.delvePoints, 5)),
    levelFactor: finiteNumber(raw.levelFactor, 0),
    areaId,
    ...(kind !== "wreck" ? { candleUnlocked: raw.candleUnlocked === true } : {}),
  };
}

function normalizeIsland(raw: unknown): IslandType | null {
  if (!isRecord(raw) || typeof raw.name !== "string") return null;
  const size =
    raw.size === "Small" || raw.size === "Large" ? raw.size : null;
  const vibe =
    raw.vibe === "Inviting" || raw.vibe === "Foreboding" ? raw.vibe : null;
  let eventDeck = normalizeIslandEventDeck(raw.eventDeck);
  const explorePoints = Math.max(0, finiteNumber(raw.explorePoints, 0));
  const island: IslandType = {
    name: raw.name,
    size,
    vibe,
    explorePoints,
    levelFactor: finiteNumber(raw.levelFactor, 0),
    ...(raw.cookstoveFound === true ? { cookstoveFound: true } : {}),
    ...(eventDeck.length > 0 ? { eventDeck } : {}),
  };
  if (eventDeck.length === 0 && explorePoints > 0) {
    return ensureIslandEventDeck({ ...island, explorePoints: 0 });
  }
  if (eventDeck.length > 0) {
    return {
      ...island,
      eventDeck,
      explorePoints: eventDeck.length,
    };
  }
  return island;
}

function normalizeEvent(raw: unknown): EventType | null {
  if (!isRecord(raw) || typeof raw.name !== "string") return null;
  const type = typeof raw.type === "string" ? raw.type : "neutral";
  const dungeonKind =
    raw.dungeonKind === "cave" ||
    raw.dungeonKind === "ruins" ||
    raw.dungeonKind === "temple" ||
    raw.dungeonKind === "wreck"
      ? raw.dungeonKind
      : undefined;
  return {
    name: raw.name,
    type,
    ...(dungeonKind ? { dungeonKind } : {}),
    ...(raw.locked === true ? { locked: true } : {}),
  };
}

function normalizeEnemy(raw: unknown): EnemyType | null {
  if (!isRecord(raw) || typeof raw.name !== "string") return null;
  const max_hp = Math.max(0, finiteNumber(raw.max_hp, finiteNumber(raw.hp, 1)));
  const hp = Math.max(0, Math.min(max_hp, finiteNumber(raw.hp, max_hp)));
  const level = Math.max(1, finiteNumber(raw.level, 1));
  const defaultDamageMin = 1 + 2 * (level - 1);
  const defaultDamageMax = 4 + 2 * (level - 1);
  const template = getMonsterTemplate(raw.name);
  const traitsFromRaw = Array.isArray(raw.traits)
    ? raw.traits.filter(
        (t): t is "evasive" | "shocking" => t === "evasive" || t === "shocking",
      )
    : null;
  const traits =
    traitsFromRaw && traitsFromRaw.length > 0
      ? traitsFromRaw
      : template?.traits;
  const base = {
    name: raw.name,
    level,
    hp,
    max_hp,
    damageMin: Math.max(1, finiteNumber(raw.damageMin, defaultDamageMin)),
    damageMax: Math.max(
      Math.max(1, finiteNumber(raw.damageMin, defaultDamageMin)),
      finiteNumber(raw.damageMax, defaultDamageMax),
    ),
    armor: Math.max(0, finiteNumber(raw.armor, 0)),
    ...(raw.isBoss === true ? { isBoss: true } : {}),
    ...(traits && traits.length > 0 ? { traits } : {}),
  };

  const nextAction = normalizeEnemyAction(raw.nextAction);
  const broadcast = normalizeEnemyBroadcast(raw.broadcast);
  const actionDrawPile = normalizeEnemyActionPile(raw.actionDrawPile);
  const actionDiscardPile = normalizeEnemyActionPile(raw.actionDiscardPile);

  if (nextAction && broadcast) {
    return {
      ...base,
      nextAction,
      broadcast,
      actionDrawPile,
      actionDiscardPile,
    };
  }

  return initializeEnemyActionDeck(base);
}

function normalizeEnemies(raw: unknown): EnemyType[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => normalizeEnemy(item))
    .filter((enemy): enemy is EnemyType => enemy !== null);
}

function normalizeCombatLog(raw: unknown): CombatLogEntry[] {
  if (!Array.isArray(raw)) return [];
  const entries: CombatLogEntry[] = [];
  for (const item of raw) {
    if (typeof item === "string") {
      entries.push({ text: item, side: "hero" });
      continue;
    }
    if (!isRecord(item) || typeof item.text !== "string") continue;
    const side: CombatLogSide =
      item.side === "enemy" ? "enemy" : "hero";
    entries.push({ text: item.text, side });
  }
  return entries;
}

function normalizeSaveData(raw: unknown): ShantiesSaveData {
  const defaults = createDefaultSaveData();
  if (!isRecord(raw)) return defaults;

  const gameState = GAME_STATES.includes(raw.gameState as GameStateTypes)
    ? (raw.gameState as GameStateTypes)
    : defaults.gameState;
  const location = LOCATIONS.includes(raw.location as GameLocationTypes)
    ? (raw.location as GameLocationTypes)
    : defaults.location;
  const combatPhase = COMBAT_PHASES.includes(raw.combatPhase as CombatPhase)
    ? (raw.combatPhase as CombatPhase)
    : defaults.combatPhase;

  const enemyTurnIndex =
    raw.enemyTurnIndex === null
      ? null
      : Number.isInteger(raw.enemyTurnIndex)
        ? (raw.enemyTurnIndex as number)
        : null;

  const resumeGameState =
    raw.resumeGameState === null
      ? null
      : GAME_STATES.includes(raw.resumeGameState as GameStateTypes)
        ? (raw.resumeGameState as GameStateTypes)
        : null;

  const enemies = normalizeEnemies(raw.enemies);
  const combatVictory = raw.combatVictory === true;
  const victoryEnemies = normalizeEnemies(raw.victoryEnemies);
  const resolvedVictoryEnemies =
    victoryEnemies.length > 0
      ? victoryEnemies
      : combatVictory
        ? enemies
        : [];

  let combatLoot = normalizeLootStash(raw.combatLoot);
  if (combatLoot.length === 0 && combatVictory && resolvedVictoryEnemies.length > 0) {
    combatLoot = generateCombatLoot(resolvedVictoryEnemies);
  }

  const activeEvent = normalizeEvent(raw.activeEvent);
  const normalizedSeaDeck = normalizeSeaEventDeck(raw.seaEventDeck);
  const seaEventDeck =
    normalizedSeaDeck.length > 0 ? normalizedSeaDeck : buildSeaEventDeck();
  const shopVariant: ShopVariant | null =
    raw.shopVariant === "ship" ||
    raw.shopVariant === "merchant" ||
    raw.shopVariant === "island_trader" ||
    raw.shopVariant === "port"
      ? raw.shopVariant
      : null;
  const hero = normalizeHero(raw.hero);
  const savedHeroLevel = isRecord(raw.hero)
    ? Math.max(1, finiteNumber(raw.hero.level, 1))
    : hero.level;
  const levelUpPicksRemaining =
    Math.max(0, finiteNumber(raw.levelUpPicksRemaining, 0)) +
    Math.max(0, hero.level - savedHeroLevel);
  const levelUpCardChoices = normalizeLevelUpCardChoices(raw.levelUpCardChoices);
  const resolvedGameState =
    gameState === "levelUp" && levelUpPicksRemaining <= 0
      ? (resumeGameState ?? "home")
      : gameState;
  const currentIsland = normalizeIsland(raw.currentIsland);
  let currentDungeon = normalizeDungeon(raw.currentDungeon);
  let currentPortTown = normalizePortTown(raw.currentPortTown);
  if (location === "port" && !currentPortTown) {
    currentPortTown = generatePortTown();
  }
  const nearPortTown = raw.nearPortTown === true || location === "port";
  let eventLoot = normalizeLootStash(raw.eventLoot);
  if (activeEvent && isSeaTreasureEvent(activeEvent)) {
    eventLoot = dedupeEventLootByItemType(eventLoot);
  } else {
    eventLoot = capLootToSingleItem(eventLoot);
  }
  if (
    eventLoot.length === 0 &&
    gameState === "event" &&
    activeEvent &&
    isTreasureEvent(activeEvent)
  ) {
    eventLoot = isSeaTreasureEvent(activeEvent)
      ? generateFloatingSuppliesLoot()
      : isIslandTreasureEvent(activeEvent) && currentIsland
        ? generateIslandTreasureLoot(activeEvent, hero, currentIsland)
        : generateEventLoot(activeEvent, {
            islandVibe:
              location === "island" || location === "dungeon"
                ? (currentIsland?.vibe ?? null)
                : null,
            heroLevel: location === "dungeon" ? hero.level : undefined,
            levelFactor: location === "dungeon" ? (currentDungeon?.levelFactor ?? 0) : undefined,
          });
  }

  if (
    location === "island" &&
    currentDungeon &&
    isIslandDungeonKind(currentDungeon.kind) &&
    currentDungeon.candleUnlocked !== true
  ) {
    currentDungeon = null;
  }

  return {
    gameState: resolvedGameState,
    location,
    currentIsland,
    currentPortTown,
    currentDungeon,
    day: Math.max(1, finiteNumber(raw.day, 1)),
    hero,
    enemies,
    activeEvent,
    hand: normalizeCombatCards(raw.hand),
    drawPile: normalizeCombatCards(raw.drawPile),
    discardPile: normalizeCombatCards(raw.discardPile),
    combatLog: normalizeCombatLog(raw.combatLog),
    armor: Math.max(0, finiteNumber(raw.armor, 0)),
    heroWeakened: raw.heroWeakened === true,
    energy: Math.max(0, finiteNumber(raw.energy, 3)),
    combatPhase,
    enemyTurnIndex,
    combatVictory,
    victoryEnemies: resolvedVictoryEnemies,
    combatLoot,
    eventLoot,
    resumeGameState,
    illuminatedAreas: normalizeIlluminatedAreas(raw.illuminatedAreas),
    currentIndoorArea: normalizeIndoorAreaId(raw.currentIndoorArea),
    encounterModifiers: normalizeScopedEncounterModifiers(raw.encounterModifiers),
    dungeonChestUnlocked: raw.dungeonChestUnlocked === true,
    seaEventDeck,
    shopVariant,
    nearPortTown,
    levelUpPicksRemaining,
    levelUpCardChoices,
  };
}

export function readShantiesSaveWithMeta(): {
  data: ShantiesSaveData;
  savedAtMs: number | null;
} | null {
  try {
    const raw = localStorage.getItem(SHANTIES_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) return null;

    const resolved = resolveSavePayload(parsed);
    if (!resolved) return null;
    return {
      data: normalizeSaveData(resolved.data),
      savedAtMs: resolved.savedAtMs,
    };
  } catch {
    return null;
  }
}

export function readShantiesSave(): ShantiesSaveData | null {
  try {
    const raw = localStorage.getItem(SHANTIES_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) return null;

    const resolved = resolveSavePayload(parsed);
    if (!resolved) return null;
    return normalizeSaveData(resolved.data);
  } catch {
    return null;
  }
}

export function writeShantiesSave(data: ShantiesSaveData): void {
  try {
    const payload: ShantiesSavePayload = {
      version: SHANTIES_SAVE_VERSION,
      savedAtMs: Date.now(),
      data,
    };
    localStorage.setItem(SHANTIES_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Quota or private mode — ignore.
  }
}

export function clearShantiesSave(): void {
  try {
    localStorage.removeItem(SHANTIES_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export { cloneCombatDeck } from "./combatDeck";
