import {
  DUNGEON_EVENT_DECK,
  getEncounterWeight,
  type EncounterModifiers,
} from "./encounterProbability";
import { createDungeonDiscoveryEvent } from "./dungeonExplore";
import { PORT_POOL_CHANCE, PORT_TOWN_EVENT } from "./portEvents";
import type { EventType, IslandType } from "./shantiesTypes";

export type ExploreTestContext = "sea" | "island" | "dungeon";

export type ExploreTestOption = {
  id: string;
  label: string;
  detail: string;
  probabilityLabel: string;
  event: EventType | null;
  /** Dungeon-only: force combat instead of an event card. */
  forceCombat?: boolean;
};

const SEA_CANONICAL: EventType[] = [
  { name: "Sea Combat", type: "combat" },
  { name: "Discover an Island!", type: "discovery" },
  { ...PORT_TOWN_EVENT },
  { name: "Storm!", type: "weather" },
  { name: "Fog Bank", type: "weather" },
  { name: "Merchant Ship", type: "merchant" },
  { name: "Floating Supplies", type: "treasure" },
  { name: "Shipwreck Dive", type: "shipwreck" },
];

const ISLAND_CANONICAL: EventType[] = [
  { name: "Island Combat", type: "combat" },
  { name: "Buried Chest", type: "treasure" },
  { name: "Supply Cache", type: "treasure" },
  { name: "Storm!", type: "weather" },
  { name: "Wind", type: "weather" },
  { name: "Heat Wave", type: "weather" },
  { name: "Island Trader", type: "merchant" },
  { name: "Cookstove", type: "cookstove" },
  createDungeonDiscoveryEvent("cave"),
  createDungeonDiscoveryEvent("ruins"),
  createDungeonDiscoveryEvent("temple"),
];

function eventKey(event: EventType): string {
  return `${event.type}|${event.name}|${event.dungeonKind ?? ""}`;
}

function formatPercent(probability: number): string {
  if (probability <= 0) return "0%";
  if (probability >= 1) return "100%";
  return `${Math.round(probability * 1000) / 10}%`;
}

function deckProbability(deck: EventType[], target: EventType): number {
  if (deck.length === 0) return 0;
  const key = eventKey(target);
  const matches = deck.filter((entry) => eventKey(entry) === key).length;
  return matches / deck.length;
}

function seaOptionId(event: EventType): string {
  return `sea:${eventKey(event)}`;
}

function islandOptionId(event: EventType): string {
  return `island:${eventKey(event)}`;
}

function dungeonEventOptionId(event: EventType): string {
  return `dungeon:event:${eventKey(event)}`;
}

export function getSeaExploreTestOptions(deck: EventType[]): ExploreTestOption[] {
  const workingDeck =
    deck.length > 0 ? deck : [{ name: "(empty — rebuilds on draw)", type: "neutral" }];
  const poolNote = `${Math.round(PORT_POOL_CHANCE * 100)}% when rolled on random sea pool slot`;

  return SEA_CANONICAL.map((event) => {
    const inDeck = deck.length > 0 ? deckProbability(deck, event) : 0;
    const isPort = event.type === "port";
    return {
      id: seaOptionId(event),
      label: event.name,
      detail: isPort ? `port · ${poolNote}` : event.type,
      probabilityLabel:
        deck.length > 0
          ? inDeck > 0
            ? `${formatPercent(inDeck)} (next card from ${workingDeck.length} remaining)`
            : isPort
              ? `0% in deck · ${poolNote}`
              : "0% in current deck"
          : "Deck empty — new 10-card deck on draw",
      event,
    };
  });
}

export function getIslandExploreTestOptions(
  _island: IslandType | null,
  deck: EventType[],
): ExploreTestOption[] {
  return ISLAND_CANONICAL.map((event) => {
    const inDeck = deck.length > 0 ? deckProbability(deck, event) : 0;
    const probabilityLabel =
      deck.length > 0
        ? inDeck > 0
          ? `${formatPercent(inDeck)} (next card from ${deck.length} remaining)`
          : "0% in current deck"
        : "No cards left";

    let detail = event.type;
    if (event.dungeonKind) detail = `dungeon discovery · ${event.dungeonKind}`;

    return {
      id: islandOptionId(event),
      label: event.name,
      detail,
      probabilityLabel,
      event,
    };
  });
}

export function getDungeonExploreTestOptions(
  modifiers: EncounterModifiers,
): ExploreTestOption[] {
  const combatProbability = 0.5;
  const eventWeights = DUNGEON_EVENT_DECK.map((event) =>
    getEncounterWeight(modifiers, event),
  );
  const eventWeightTotal = eventWeights.reduce((sum, weight) => sum + weight, 0);
  const nonCombatProbability = 1 - combatProbability;

  const combatOption: ExploreTestOption = {
    id: "dungeon:combat",
    label: "Dungeon Combat",
    detail: "Random 50% before event roll",
    probabilityLabel: formatPercent(combatProbability),
    event: null,
    forceCombat: true,
  };

  const eventOptions = DUNGEON_EVENT_DECK.map((event, index) => {
    const weight = eventWeights[index]!;
    const probability = nonCombatProbability * (weight / eventWeightTotal);
    return {
      id: dungeonEventOptionId(event),
      label: event.name,
      detail: event.type,
      probabilityLabel: `${formatPercent(probability)} (weight ${weight})`,
      event,
    };
  });

  return [combatOption, ...eventOptions];
}

export function getExploreTestOptions(
  context: ExploreTestContext,
  params: {
    seaEventDeck: EventType[];
    currentIsland: IslandType | null;
    dungeonModifiers: EncounterModifiers;
  },
): ExploreTestOption[] {
  switch (context) {
    case "sea":
      return getSeaExploreTestOptions(params.seaEventDeck);
    case "island":
      return getIslandExploreTestOptions(
        params.currentIsland,
        params.currentIsland?.eventDeck ?? [],
      );
    case "dungeon":
      return getDungeonExploreTestOptions(params.dungeonModifiers);
  }
}

export function exploreTestContextTitle(context: ExploreTestContext): string {
  switch (context) {
    case "sea":
      return "Set Sail — test outcome";
    case "island":
      return "Explore Island — test outcome";
    case "dungeon":
      return "Delve — test outcome";
  }
}

export function findExploreTestOption(
  context: ExploreTestContext,
  optionId: string,
  params: {
    seaEventDeck: EventType[];
    currentIsland: IslandType | null;
    dungeonModifiers: EncounterModifiers;
  },
): ExploreTestOption | undefined {
  return getExploreTestOptions(context, params).find(
    (option) => option.id === optionId,
  );
}
