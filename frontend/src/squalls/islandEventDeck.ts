import {
  createDungeonDiscoveryEvent,
} from "./dungeonExplore";
import { COOKSTOVE_EVENT } from "./cookstove";
import type { DungeonKind, EventType, IslandType } from "./shantiesTypes";

export const ISLAND_COMBAT_EVENT: EventType = {
  name: "Island Combat",
  type: "combat",
};

export const BURIED_CHEST_EVENT: EventType = {
  name: "Buried Chest",
  type: "treasure",
};

export const SUPPLY_CACHE_EVENT: EventType = {
  name: "Supply Cache",
  type: "treasure",
};

/** @deprecated Use BURIED_CHEST_EVENT */
export const BURIED_TREASURE_EVENT = BURIED_CHEST_EVENT;

export const ISLAND_TRADER_EVENT: EventType = {
  name: "Island Trader",
  type: "merchant",
};

export { COOKSTOVE_EVENT };

const ISLAND_DUNGEON_KINDS: DungeonKind[] = ["cave", "ruins", "temple"];

const ISLAND_WEATHER_EVENTS: EventType[] = [
  { name: "Storm!", type: "weather" },
  { name: "Wind", type: "weather" },
  { name: "Heat Wave", type: "weather" },
];

const ISLAND_EVENT_POOL: EventType[] = [
  ISLAND_COMBAT_EVENT,
  BURIED_CHEST_EVENT,
  SUPPLY_CACHE_EVENT,
  ...ISLAND_WEATHER_EVENTS,
  ISLAND_TRADER_EVENT,
  { ...COOKSTOVE_EVENT },
];

export type IslandSizeCategory = "Small" | "Medium" | "Large";

export function getIslandSizeCategory(
  size: IslandType["size"],
): IslandSizeCategory {
  if (size === "Small") return "Small";
  if (size === "Large") return "Large";
  return "Medium";
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle<T>(items: T[]): T[] {
  const deck = [...items];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j]!, deck[i]!];
  }
  return deck;
}

function pickRandomTreasureEvent(): EventType {
  return Math.random() < 0.5
    ? { ...BURIED_CHEST_EVENT }
    : { ...SUPPLY_CACHE_EVENT };
}

function pickRandomDungeonEvent(): EventType {
  const kind =
    ISLAND_DUNGEON_KINDS[
      Math.floor(Math.random() * ISLAND_DUNGEON_KINDS.length)
    ]!;
  return createDungeonDiscoveryEvent(kind);
}

function pickRandomPoolEvent(): EventType {
  const template =
    ISLAND_EVENT_POOL[Math.floor(Math.random() * ISLAND_EVENT_POOL.length)]!;
  return { ...template };
}

/** Ensure a persisted island has a deck (build on first anchor or save migration). */
export function ensureIslandEventDeck(island: IslandType): IslandType {
  const eventDeck =
    island.eventDeck && island.eventDeck.length > 0
      ? island.eventDeck
      : buildIslandEventDeck(island);
  return {
    ...island,
    eventDeck,
    explorePoints: eventDeck.length,
  };
}

function deckSizeRange(category: IslandSizeCategory): { min: number; max: number } {
  switch (category) {
    case "Small":
      return { min: 3, max: 5 };
    case "Large":
      return { min: 7, max: 9 };
    default:
      return { min: 5, max: 7 };
  }
}

function minimumCombatCount(category: IslandSizeCategory): number {
  switch (category) {
    case "Small":
      return 1;
    case "Large":
      return 4;
    default:
      return 3;
  }
}

function countCombatEvents(deck: EventType[]): number {
  return deck.filter((event) => event.type === "combat").length;
}

/** Build a fresh island explore deck sized by island category. */
export function buildIslandEventDeck(island: IslandType): EventType[] {
  const category = getIslandSizeCategory(island.size);
  const { min, max } = deckSizeRange(category);
  const deckSize = randomInt(min, max);
  const deck: EventType[] = [];

  if (category === "Small") {
    deck.push(pickRandomTreasureEvent());
  } else if (category === "Large") {
    deck.push(pickRandomTreasureEvent());
    deck.push(pickRandomDungeonEvent());
  } else {
    deck.push(pickRandomDungeonEvent());
  }

  while (countCombatEvents(deck) < minimumCombatCount(category)) {
    deck.push({ ...ISLAND_COMBAT_EVENT });
  }

  while (deck.length < deckSize) {
    deck.push(pickRandomPoolEvent());
  }

  return shuffle(deck);
}

export type DrawIslandEventResult = {
  drawn: EventType;
  remainingDeck: EventType[];
};

/** Pop the top card from the island deck. */
export function drawIslandEvent(deck: EventType[]): DrawIslandEventResult | null {
  if (deck.length === 0) return null;
  const drawn = deck[deck.length - 1]!;
  return {
    drawn,
    remainingDeck: deck.slice(0, -1),
  };
}

export function normalizeIslandEventDeck(raw: unknown): EventType[] {
  if (!Array.isArray(raw)) return [];
  const deck: EventType[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    if (typeof record.name !== "string" || typeof record.type !== "string") {
      continue;
    }
    const dungeonKind =
      record.dungeonKind === "cave" ||
      record.dungeonKind === "ruins" ||
      record.dungeonKind === "temple" ||
      record.dungeonKind === "wreck"
        ? record.dungeonKind
        : undefined;
    deck.push({
      name: record.name,
      type: record.type,
      ...(dungeonKind ? { dungeonKind } : {}),
      ...(record.locked === true ? { locked: true } : {}),
    });
  }
  return deck;
}

export function isIslandWeatherEvent(event: EventType): boolean {
  return (
    event.type === "weather" &&
    (event.name === "Storm!" ||
      event.name === "Wind" ||
      event.name === "Heat Wave")
  );
}

export function isIslandTraderEvent(event: EventType): boolean {
  return event.type === "merchant" && event.name === ISLAND_TRADER_EVENT.name;
}

export function isIslandCookstoveEvent(event: EventType): boolean {
  return event.type === "cookstove" && event.name === COOKSTOVE_EVENT.name;
}
