import {
  countCompletedOwnedAcademies,
  countCompletedOwnedColossi,
  countCompletedOwnedPyramids,
  isWonderBuildingKind,
} from "./pondsteadWonders";
import { mapCellBuildingOwner, PONDSTEAD_LOCAL_PLAYER_ID } from "./pondsteadVision";
import type { MapCell, ParsedMap } from "./types";
import { PONDSTEAD_KING_MOVES_PER_STACK_PER_DAY, type UnitStack } from "./pondsteadUnits";

/** Each completed building (HQ, camp, orchard, …) adds this many unit slots. */
export const PONDSTEAD_POPULATION_PER_BUILDING = 5;

/** Workers on a valid tile produce this many units of that tile’s resource per day. */
export const PONDSTEAD_RESOURCE_PER_WORKER_PER_DAY = 2;

/** Walls do not add population cap; all other non-`none` completed buildings do. */
export function completedBuildingsOnMapCount(map: ParsedMap): number {
  let n = 0;
  for (let r = 0; r < map.height; r++) {
    for (let c = 0; c < map.width; c++) {
      const b = map.cells[r]![c]!.building;
      if (b === "none" || b === "wall") continue;
      n += 1;
    }
  }
  return n;
}

/** Win when points reach or exceed this (Granary, Sawmill, Mason’s Yard = 1 each). */
export const PONDSTEAD_VICTORY_POINTS = 10;

function countScoringBuildingPlacedOrUnderConstruction(
  map: ParsedMap,
  kind: "granary" | "sawmill" | "masonYard",
): number {
  let n = 0;
  for (const row of map.cells) {
    for (const c of row) {
      if (c.building === kind || c.constructionTarget === kind) n += 1;
    }
  }
  return n;
}

/**
 * +1 per completed Granary / Sawmill / Mason’s Yard; +3 per completed World Wonder (local player).
 * Win at {@link PONDSTEAD_VICTORY_POINTS}.
 */
export function pointsFromMap(map: ParsedMap): number {
  let p = 0;
  for (const row of map.cells) {
    for (const c of row) {
      if (c.building === "granary" || c.building === "sawmill" || c.building === "masonYard") p += 1;
      if (
        isWonderBuildingKind(c.building) &&
        mapCellBuildingOwner(c) === PONDSTEAD_LOCAL_PLAYER_ID
      ) {
        p += 3;
      }
    }
  }
  return p;
}

function countCivicTiersOnMap(
  map: ParsedMap,
  kind: "granary" | "sawmill" | "masonYard",
): number {
  return countScoringBuildingPlacedOrUnderConstruction(map, kind);
}

function foodBonusMultiplierFromMap(map: ParsedMap): number {
  const n = countCivicTiersOnMap(map, "granary");
  const p = countCompletedOwnedPyramids(map, PONDSTEAD_LOCAL_PLAYER_ID);
  return 1 + 0.2 * n + 0.1 * p;
}

function woodBonusMultiplierFromMap(map: ParsedMap): number {
  const n = countCivicTiersOnMap(map, "sawmill");
  const p = countCompletedOwnedPyramids(map, PONDSTEAD_LOCAL_PLAYER_ID);
  return 1 + 0.2 * n + 0.1 * p;
}

function stoneBonusMultiplierFromMap(map: ParsedMap): number {
  const n = countCivicTiersOnMap(map, "masonYard");
  const p = countCompletedOwnedPyramids(map, PONDSTEAD_LOCAL_PLAYER_ID);
  return 1 + 0.2 * n + 0.1 * p;
}

/** Max units = {@link PONDSTEAD_POPULATION_PER_BUILDING} × completed buildings. */
export function populationCapFromMap(map: ParsedMap): number {
  return completedBuildingsOnMapCount(map) * PONDSTEAD_POPULATION_PER_BUILDING;
}

export function recruitPopulationCapMessage(): string {
  return "You can’t recruit more units — population is at the limit.";
}

export function totalOwnedUnits(stacks: UnitStack[]): number {
  return stacks.reduce((sum, s) => sum + s.count, 0);
}

function sumWorkerCountWhere(
  stacks: UnitStack[],
  map: ParsedMap,
  pred: (cell: MapCell) => boolean,
): number {
  let n = 0;
  for (const s of stacks) {
    if (s.kind !== "worker") continue;
    if (!inMap(map, s.row, s.col)) continue;
    const cell = map.cells[s.row]![s.col]!;
    if (pred(cell)) n += s.count;
  }
  return n;
}

function inMap(map: ParsedMap, row: number, col: number): boolean {
  return row >= 0 && col >= 0 && row < map.height && col < map.width;
}

function isOrchardForFood(c: MapCell): boolean {
  return c.building === "orchard";
}

function isCampForWood(c: MapCell): boolean {
  return c.building === "camp";
}

function isQuarryForStone(c: MapCell): boolean {
  return c.building === "quarry" || c.resource === "stone";
}

/** Base workers on orchards, then +20% per Granary (stacking, integer floor). */
export function foodPerDayFromOrchards(stacks: UnitStack[], map: ParsedMap): number {
  const base = sumWorkerCountWhere(stacks, map, isOrchardForFood) * PONDSTEAD_RESOURCE_PER_WORKER_PER_DAY;
  return Math.max(0, Math.floor(base * foodBonusMultiplierFromMap(map)));
}

/** Base workers on camps, then +20% per Sawmill (stacking, integer floor). */
export function woodPerDayFromCamps(stacks: UnitStack[], map: ParsedMap): number {
  const base = sumWorkerCountWhere(stacks, map, isCampForWood) * PONDSTEAD_RESOURCE_PER_WORKER_PER_DAY;
  return Math.max(0, Math.floor(base * woodBonusMultiplierFromMap(map)));
}

/**
 * Base workers on quarries or stone nodes; +20% per Mason’s Yard (stacking, integer floor).
 */
export function stonePerDayFromQuarries(stacks: UnitStack[], map: ParsedMap): number {
  const base = sumWorkerCountWhere(stacks, map, isQuarryForStone) * PONDSTEAD_RESOURCE_PER_WORKER_PER_DAY;
  return Math.max(0, Math.floor(base * stoneBonusMultiplierFromMap(map)));
}

export const PONDSTEAD_MAX_ACTIONS_PER_TURN = 6;

/** Max actions at start of day (Academy: +3 each, local player). */
export function maxActionsPerTurnFromMap(
  map: ParsedMap,
  playerId: number = PONDSTEAD_LOCAL_PLAYER_ID,
): number {
  return PONDSTEAD_MAX_ACTIONS_PER_TURN + 3 * countCompletedOwnedAcademies(map, playerId);
}

/** Chebyshev squares a stack may march per day (Colossus: +1 each for that stack’s owner). */
export function kingMarchCapFromMap(
  map: ParsedMap,
  ownerId: number = PONDSTEAD_LOCAL_PLAYER_ID,
): number {
  return PONDSTEAD_KING_MOVES_PER_STACK_PER_DAY + countCompletedOwnedColossi(map, ownerId);
}

/**
 * One-off actions (recruit, build, merge, etc.) need a full 1.0; 0.5 left is not enough.
 * Movement may spend half points (1.5 per diagonal step).
 */
export function canAffordOneFullAction(actionsRemaining: number): boolean {
  return actionsRemaining >= 1;
}

/** Compare in half-increments so 4.5 − 1.5 and similar stays exact in the UI. */
export function canAffordActionCost(actionsRemaining: number, cost: number): boolean {
  return Math.round(actionsRemaining * 2) >= Math.round(cost * 2);
}

/** HUD display: whole numbers without decimals; otherwise one decimal (e.g. 3.5). */
export function formatPondsteadActionPoints(n: number): string {
  const r = Math.round(n * 2) / 2;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

export function noActionsRemainingMessage(): string {
  return "No actions left this day. End the day to refresh your action pool.";
}

/** Passive copy in building/unit modals when the player cannot spend more actions today. */
export function outOfActionsTodayNotice(): string {
  return "You are out of actions for today.";
}

export function stackOutOfMarchMessage(): string {
  return "That stack has no march distance left today.";
}

/** One line for the unit modal: moves remaining vs daily Chebyshev march cap. */
export function stackMarchStatusLine(marchSpent: number, marchCap: number): string {
  const spent = Math.max(0, Math.min(marchCap, Math.floor(marchSpent)));
  const left = Math.max(0, marchCap - spent);
  return `Moves Remaining: ${left} / ${marchCap}`;
}
