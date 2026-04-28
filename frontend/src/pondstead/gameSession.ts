import type { ResourcePurse } from "./pondsteadBuildingCosts";
import type { UnitStack } from "./pondsteadUnits";
import type { ParsedMap } from "./types";

/** Two-player horizontal layout: two 9×9 regions, P2’s template rotated 180°, stitched to 18×9. */
export type PondsteadLayoutPreset = "twoPlayerHorizontal";

export type GameConfig = {
  playerCount: 2;
  layoutPreset: PondsteadLayoutPreset;
  /** Canonical v1 purse for every seat at game start. */
  startingResources: ResourcePurse;
  mapTemplateId: "default";
};

export type PlayerProfile = {
  playerId: number;
  seatIndex: number;
  displayName: string;
};

/** Per-human state (serializable; fog, purse, daily caps). */
export type PlayerPrivateState = {
  resources: ResourcePurse;
  revealedCellKeys: string[];
  stackMovementUsed: Record<string, number>;
  recruitUsedThisDayKeys: string[];
};

export type WorldState = {
  map: ParsedMap;
  stacks: UnitStack[];
};

/**
 * Structured day outcome (combat, income, builds, …).
 * Populated by the day pipeline; the daily report modal reads from this shape.
 */
export type DayResolutionLog = {
  day: number;
  incomeByPlayer: Record<number, { food: number; wood: number; stone: number }>;
  recruits: Array<{
    seatIndex: number;
    kindLabel: string;
    buildingLabel: string;
  }>;
  completedBuildings: Array<{ label: string; ownerSeat: number }>;
  stillBuilding: Array<{ label: string; nightsLeft: number; ownerSeat: number }>;
  combatLines: string[];
  buildingDamageLines: string[];
  scoreboard: Array<{ seatIndex: number; displayName: string; points: number }>;
};

export type GameSession = {
  config: GameConfig;
  players: PlayerProfile[];
  world: WorldState;
  /** seatIndex → private blob */
  privateBySeat: Record<number, PlayerPrivateState>;
  currentDay: number;
  /** Last committed day log (e.g. after end-day). */
  lastDayLog: DayResolutionLog | null;
};

export const PONDSTEAD_V1_STARTING_RESOURCES: ResourcePurse = { food: 10, wood: 10, stone: 0 };

export const PONDSTEAD_SEAT_COUNT = 2 as const;

export function emptyPlayerPrivateState(resources: ResourcePurse): PlayerPrivateState {
  return {
    resources: { ...resources },
    revealedCellKeys: [],
    stackMovementUsed: {},
    recruitUsedThisDayKeys: [],
  };
}
