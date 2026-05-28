import {
  ATTACK_CARD_TAGS,
  DEFEND_CARD_TAGS,
} from "./combatCardStyle";
import { capLootToSingleItem, generateCombatLoot, generateEventLoot, isTreasureEvent } from "./combatLoot";
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
  CardTargeting,
  CombatCard,
  CombatLootItem,
  CombatLootKind,
  CombatPhase,
  EnemyIntent,
  EnemyType,
  EventType,
  GameLocationTypes,
  GameStateTypes,
  HeroType,
  DungeonType,
  IslandType,
} from "./shantiesTypes";
import {
  DEFEND_TARGETING,
  INDOOR_AREA_KINDS,
  ITEM_IDS,
  isAttackCard,
  type IndoorAreaId,
  type IndoorAreaKind,
  type Inventory,
  type ItemId,
} from "./shantiesTypes";

export const SHANTIES_STORAGE_KEY = "pondarbor.squalls.v1";
export const SHANTIES_SAVE_VERSION = 6;

const attackCard: CombatCard = {
  name: "Attack",
  minDamage: 1,
  maxDamage: 4,
  tags: ATTACK_CARD_TAGS,
};
const strongAttackCard: CombatCard = {
  name: "Strong Attack",
  minDamage: 2,
  maxDamage: 8,
  tags: ATTACK_CARD_TAGS,
};
const defendCard: CombatCard = {
  name: "Defend",
  targeting: DEFEND_TARGETING,
  tags: DEFEND_CARD_TAGS,
};

const START_DECK: CombatCard[] = [
  ...Array(10).fill(attackCard),
  ...Array(4).fill(strongAttackCard),
  ...Array(6).fill(defendCard),
];

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
];

const LOCATIONS: GameLocationTypes[] = ["ship", "island", "dungeon"];

const COMBAT_PHASES: CombatPhase[] = ["player", "enemy"];

const ENEMY_INTENTS: EnemyIntent[] = ["attack", "defend"];

export type ShantiesSaveData = {
  gameState: GameStateTypes;
  location: GameLocationTypes;
  currentIsland: IslandType | null;
  currentDungeon: DungeonType | null;
  day: number;
  hero: HeroType;
  enemies: EnemyType[];
  activeEvent: EventType | null;
  hand: CombatCard[];
  drawPile: CombatCard[];
  discardPile: CombatCard[];
  combatLog: string[];
  armor: number;
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
};

type ShantiesSavePayload = {
  version: number;
  savedAtMs: number;
  data: ShantiesSaveData;
};

export function createInitialHero(): HeroType {
  return {
    name: "Silver",
    class: "Swashbuckler",
    current_hp: 20,
    max_hp: 20,
    gold: 50,
    xp: 0,
    level: 1,
    deck: START_DECK.map((card) => ({ ...card })),
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

  if (version !== SHANTIES_SAVE_VERSION) return null;
  return { data, savedAtMs };
}

function normalizeCardTargeting(raw: unknown): CardTargeting | null {
  if (!isRecord(raw)) return null;
  const mode = raw.mode === "auto" || raw.mode === "manual" ? raw.mode : null;
  const target =
    raw.target === "self" || raw.target === "enemy" ? raw.target : null;
  if (!mode || !target) return null;
  return { mode, target };
}

function normalizeCombatCard(raw: unknown): CombatCard | null {
  if (!isRecord(raw) || typeof raw.name !== "string") return null;
  if (raw.name === "Attack") {
    return {
      name: "Attack",
      minDamage: finiteNumber(raw.minDamage, 1),
      maxDamage: finiteNumber(raw.maxDamage, 4),
      tags: ATTACK_CARD_TAGS,
    };
  }
  if (raw.name === "Strong Attack") {
    return {
      name: "Strong Attack",
      minDamage: finiteNumber(raw.minDamage, 2),
      maxDamage: finiteNumber(raw.maxDamage, 8),
      tags: ATTACK_CARD_TAGS,
    };
  }
  if (raw.name === "Defend") {
    return {
      name: "Defend",
      targeting: normalizeCardTargeting(raw.targeting) ?? DEFEND_TARGETING,
      tags: DEFEND_CARD_TAGS,
    };
  }
  return null;
}

function normalizeCombatCards(raw: unknown): CombatCard[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => normalizeCombatCard(item))
    .filter((card): card is CombatCard => card !== null);
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
  const deck = normalizeCombatCards(raw.deck);
  const defaults = createInitialHero();
  return {
    name: typeof raw.name === "string" ? raw.name : "Silver",
    class: typeof raw.class === "string" ? raw.class : "Swashbuckler",
    current_hp: Math.max(0, finiteNumber(raw.current_hp, 20)),
    max_hp: Math.max(0, finiteNumber(raw.max_hp, 20)),
    gold: Math.max(0, finiteNumber(raw.gold, 50)),
    xp: Math.max(0, finiteNumber(raw.xp, 0)),
    level: Math.max(1, finiteNumber(raw.level, 1)),
    deck: deck.length > 0 ? deck : defaults.deck,
    inventory: normalizeInventory(raw.inventory),
    equipped: normalizeEquipped(raw.equipped),
    equipmentInventory: normalizeEquipmentInventory(raw.equipmentInventory),
  };
}

function normalizeLootStash(raw: unknown): CombatLootItem[] {
  if (!Array.isArray(raw)) return [];
  const items: CombatLootItem[] = [];
  for (const entry of raw) {
    if (!isRecord(entry) || typeof entry.id !== "string") continue;
    const kind: CombatLootKind | null =
      entry.kind === "gold" ||
      entry.kind === "xp" ||
      entry.kind === "item"
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
    if (kind === "item" && !itemId) continue;
    const amount = Math.max(0, finiteNumber(entry.amount, 0));
    if (kind === "item" && amount <= 0) continue;
    items.push({
      id: entry.id,
      kind,
      amount,
      sourceName,
      claimed: entry.claimed === true,
      ...(itemId ? { itemId } : {}),
    });
  }
  return items;
}

function normalizeDungeon(raw: unknown): DungeonType | null {
  if (!isRecord(raw)) return null;
  const kind =
    raw.kind === "cave" || raw.kind === "ruins" || raw.kind === "temple"
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
  };
}

function normalizeIsland(raw: unknown): IslandType | null {
  if (!isRecord(raw) || typeof raw.name !== "string") return null;
  const size =
    raw.size === "Small" || raw.size === "Large" ? raw.size : null;
  const vibe =
    raw.vibe === "Inviting" || raw.vibe === "Foreboding" ? raw.vibe : null;
  return {
    name: raw.name,
    size,
    vibe,
    explorePoints: Math.max(0, finiteNumber(raw.explorePoints, 5)),
    levelFactor: finiteNumber(raw.levelFactor, 0),
  };
}

function normalizeEvent(raw: unknown): EventType | null {
  if (!isRecord(raw) || typeof raw.name !== "string") return null;
  const type = typeof raw.type === "string" ? raw.type : "neutral";
  const dungeonKind =
    raw.dungeonKind === "cave" ||
    raw.dungeonKind === "ruins" ||
    raw.dungeonKind === "temple"
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
  const intent = ENEMY_INTENTS.includes(raw.intent as EnemyIntent)
    ? (raw.intent as EnemyIntent)
    : "attack";
  const max_hp = Math.max(0, finiteNumber(raw.max_hp, finiteNumber(raw.hp, 1)));
  const hp = Math.max(0, Math.min(max_hp, finiteNumber(raw.hp, max_hp)));
  return {
    name: raw.name,
    level: Math.max(1, finiteNumber(raw.level, 1)),
    hp,
    max_hp,
    intent,
    armor: Math.max(0, finiteNumber(raw.armor, 0)),
  };
}

function normalizeEnemies(raw: unknown): EnemyType[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => normalizeEnemy(item))
    .filter((enemy): enemy is EnemyType => enemy !== null);
}

function normalizeStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === "string");
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
  const currentIsland = normalizeIsland(raw.currentIsland);
  let eventLoot = capLootToSingleItem(normalizeLootStash(raw.eventLoot));
  if (
    eventLoot.length === 0 &&
    gameState === "event" &&
    activeEvent &&
    isTreasureEvent(activeEvent)
  ) {
    eventLoot = generateEventLoot(activeEvent, {
      islandVibe:
        location === "island" || location === "dungeon"
          ? (currentIsland?.vibe ?? null)
          : null,
    });
  }

  return {
    gameState,
    location,
    currentIsland,
    currentDungeon: normalizeDungeon(raw.currentDungeon),
    day: Math.max(1, finiteNumber(raw.day, 1)),
    hero: normalizeHero(raw.hero),
    enemies,
    activeEvent,
    hand: normalizeCombatCards(raw.hand),
    drawPile: normalizeCombatCards(raw.drawPile),
    discardPile: normalizeCombatCards(raw.discardPile),
    combatLog: normalizeStringArray(raw.combatLog),
    armor: Math.max(0, finiteNumber(raw.armor, 0)),
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

export function cloneCombatDeck(cards: CombatCard[]): CombatCard[] {
  return cards.map((card) =>
    isAttackCard(card)
      ? { ...card }
      : {
          name: "Defend" as const,
          targeting: { ...DEFEND_TARGETING },
          tags: DEFEND_CARD_TAGS,
        },
  );
}
