import {
  createDungeonDiscoveryEvent,
  DUNGEON_DISCOVERY_EVENT_TYPE,
} from "./dungeonExplore";
import type { DungeonKind, EventType } from "./shantiesTypes";

/** Per-encounter-type adjustments (negative = less likely on next draw). */
export type EncounterModifiers = Record<string, number>;

export type EncounterScope = "sail" | "island" | "dungeon";

export type ScopedEncounterModifiers = Record<
  EncounterScope,
  EncounterModifiers
>;

/** Default weight before modifiers; each draw applies ENCOUNTER_PENALTY_PER_DRAW. */
export const ENCOUNTER_BASE_WEIGHT = 10;
export const ENCOUNTER_PENALTY_PER_DRAW = -1;
export const ENCOUNTER_MIN_WEIGHT = 1;

export const SAIL_EVENT_DECK: EventType[] = [
  { name: "Smooth Sailing", type: "neutral" },
  { name: "Storm!", type: "hazard" },
  { name: "Discover an Island!", type: "discovery" },
  { name: "Floating Chest", type: "treasure" },
];

export const ISLAND_TREASURE_EVENTS: EventType[] = [
  { name: "Temple Offerings", type: "treasure" },
  { name: "Hidden Treasure", type: "treasure" },
  { name: "Wild Supplies", type: "treasure" },
];

const DUNGEON_KINDS: DungeonKind[] = ["cave", "ruins", "temple"];

export const ISLAND_EXPLORE_EVENT_DECK: EventType[] = [
  ...ISLAND_TREASURE_EVENTS,
  ...DUNGEON_KINDS.map((kind) => createDungeonDiscoveryEvent(kind)),
];

export const DUNGEON_EVENT_DECK: EventType[] = [
  { name: "Smooth Passage", type: "neutral" },
  { name: "Cave-in!", type: "hazard" },
  { name: "Buried Chest", type: "treasure" },
  { name: "Strange Echoes", type: "neutral" },
];

export function createEmptyScopedEncounterModifiers(): ScopedEncounterModifiers {
  return { sail: {}, island: {}, dungeon: {} };
}

/** Stable key for modifier maps (items can target these strings). */
export function getEncounterModifierKey(event: EventType): string {
  if (event.type === DUNGEON_DISCOVERY_EVENT_TYPE && event.dungeonKind) {
    return `${event.type}:${event.dungeonKind}`;
  }
  return event.type;
}

export function getEncounterWeight(
  modifiers: EncounterModifiers,
  event: EventType,
): number {
  const key = getEncounterModifierKey(event);
  const mod = modifiers[key] ?? 0;
  return Math.max(ENCOUNTER_MIN_WEIGHT, ENCOUNTER_BASE_WEIGHT + mod);
}

export function applyEncounterDrawPenalty(
  modifiers: EncounterModifiers,
  event: EventType,
  penalty = ENCOUNTER_PENALTY_PER_DRAW,
): EncounterModifiers {
  const key = getEncounterModifierKey(event);
  return { ...modifiers, [key]: (modifiers[key] ?? 0) + penalty };
}

export function pickWeightedEvent(
  candidates: readonly EventType[],
  modifiers: EncounterModifiers,
): EventType {
  if (candidates.length === 0) {
    throw new Error("pickWeightedEvent: empty candidate list");
  }
  if (candidates.length === 1) {
    return candidates[0]!;
  }

  const weights = candidates.map((event) =>
    getEncounterWeight(modifiers, event),
  );
  const total = weights.reduce((sum, w) => sum + w, 0);
  let roll = Math.random() * total;

  for (let i = 0; i < candidates.length; i++) {
    roll -= weights[i]!;
    if (roll <= 0) {
      return candidates[i]!;
    }
  }

  return candidates[candidates.length - 1]!;
}

export function pickSailEvent(modifiers: EncounterModifiers): EventType {
  return pickWeightedEvent(SAIL_EVENT_DECK, modifiers);
}

export function pickIslandExploreEvent(modifiers: EncounterModifiers): EventType {
  return pickWeightedEvent(ISLAND_EXPLORE_EVENT_DECK, modifiers);
}

export function pickDungeonEvent(modifiers: EncounterModifiers): EventType {
  return pickWeightedEvent(DUNGEON_EVENT_DECK, modifiers);
}
