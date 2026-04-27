import { mapCellBuildingOwner } from "./pondsteadVision";
import {
  canStartWonderConstruction,
  isWonderBuildingKind,
  WONDER_KINDS,
  type WonderKind,
} from "./pondsteadWonders";
import type { BuildingKind, MapCell, ParsedMap } from "./types";
import type { PondsteadUnitKind } from "./pondsteadUnits";

/** 1-day civic / military (Orchard, Camp, Quarry, Wall, Barracks). */
const CONSTRUCTION_NIGHTS_SHORT = 1;
/** 2-day worker civic: Granary, Sawmill, Mason’s Yard. */
const CONSTRUCTION_NIGHTS_LONG = 2;
/** World Wonders (worker-built). */
const CONSTRUCTION_NIGHTS_WONDER = 3;

const TWO_NIGHT_CIVIC = new Set<BuildingKind>(["granary", "sawmill", "masonYard"]);
const WONDER_THREE_NIGHT = new Set<BuildingKind>(WONDER_KINDS as unknown as BuildingKind[]);

export function constructionNightsForTarget(target: BuildingKind): number {
  if (WONDER_THREE_NIGHT.has(target)) return CONSTRUCTION_NIGHTS_WONDER;
  if (TWO_NIGHT_CIVIC.has(target)) return CONSTRUCTION_NIGHTS_LONG;
  return CONSTRUCTION_NIGHTS_SHORT;
}

export const CIVIC_RESOURCE_BUILDS = [
  "orchard",
  "camp",
  "quarry",
  "granary",
  "sawmill",
  "masonYard",
] as const;
export type WorkerCivicPlacedBuilding = (typeof CIVIC_RESOURCE_BUILDS)[number];

export const MILITARY_BUILDS = ["wall", "barracks"] as const;
export type MilitaryPlacedBuilding = (typeof MILITARY_BUILDS)[number];

/** @deprecated use CIVIC_RESOURCE_BUILDS subset */
export const WORKER_BUILDS = CIVIC_RESOURCE_BUILDS;
export type WorkerPlacedBuilding = WorkerCivicPlacedBuilding;

export const SOLDIER_BUILDS = MILITARY_BUILDS;
export type SoldierPlacedBuilding = MilitaryPlacedBuilding;

/** Empty lot suitable for new construction (not water or marsh). */
export function cellAllowsNewBuilding(cell: MapCell): boolean {
  if (cell.building !== "none") return false;
  if (cell.constructionTarget) return false;
  if (cell.ground === "water" || cell.ground === "marsh") return false;
  return true;
}

/**
 * Empty buildable lot with no harvest node (wall, barracks, and similar “clear land” rules).
 * Does not require base ground `grass` — berry/reed tiles with no node may still qualify.
 */
export function canBuildOnGrassNoResource(cell: MapCell): boolean {
  if (!cellAllowsNewBuilding(cell)) return false;
  if (cell.resource !== "none") return false;
  return true;
}

/** Military buildings: clear land, no harvest node. */
export function canBuildMilitaryOnCell(cell: MapCell): boolean {
  return canBuildOnGrassNoResource(cell);
}

/** Granary, Sawmill, Mason’s Yard: plain grass, empty, no harvest node. */
export function canBuildGrassTierCivicOnCell(cell: MapCell): boolean {
  return canBuildOnGrassNoResource(cell) && cell.ground === "grass";
}

/** Completed `building === kind` owned by `ownerId` (not in-progress construction). */
export function countCompletedOwnedBuildingsOfKind(
  map: ParsedMap,
  kind: BuildingKind,
  ownerId: number,
): number {
  let n = 0;
  for (const row of map.cells) {
    for (const c of row) {
      if (c.building === kind && mapCellBuildingOwner(c) === ownerId) n += 1;
    }
  }
  return n;
}

/**
 * Placement rules that depend on the builder’s completed portfolio (local player id in solo).
 * Granary → 2+ orchards, Sawmill → 2+ camps, Mason’s Yard → 2+ quarries, Wall → 1+ barracks.
 */
export function placementPrerequisitesMetForTarget(
  map: ParsedMap,
  target: BuildingKind,
  ownerId: number,
): boolean {
  switch (target) {
    case "granary":
      return countCompletedOwnedBuildingsOfKind(map, "orchard", ownerId) >= 2;
    case "sawmill":
      return countCompletedOwnedBuildingsOfKind(map, "camp", ownerId) >= 2;
    case "masonYard":
      return countCompletedOwnedBuildingsOfKind(map, "quarry", ownerId) >= 2;
    case "wall":
      return countCompletedOwnedBuildingsOfKind(map, "barracks", ownerId) >= 1;
    default:
      return true;
  }
}

/**
 * Worker civic builds: Orchard / Camp / Quarry on matching resource tiles; Granary, Sawmill, and Mason’s
 * Yard on clear grass when {@link placementPrerequisitesMetForTarget} allows each.
 */
export function workerCivicBuildOptionsOnCell(
  map: ParsedMap,
  cell: MapCell,
  ownerId: number,
): WorkerCivicPlacedBuilding[] {
  if (!cellAllowsNewBuilding(cell)) return [];
  const out: WorkerCivicPlacedBuilding[] = [];
  if (cell.resource === "food") {
    out.push("orchard");
  } else if (cell.resource === "wood") {
    out.push("camp");
  } else if (cell.resource === "stone") {
    out.push("quarry");
  } else if (canBuildGrassTierCivicOnCell(cell)) {
    if (placementPrerequisitesMetForTarget(map, "granary", ownerId)) out.push("granary");
    if (placementPrerequisitesMetForTarget(map, "sawmill", ownerId)) out.push("sawmill");
    if (placementPrerequisitesMetForTarget(map, "masonYard", ownerId)) out.push("masonYard");
  }
  return out;
}

/** @deprecated use {@link workerCivicBuildOptionsOnCell} */
export function workerBuildOptionsOnCell(map: ParsedMap, cell: MapCell, ownerId: number): WorkerCivicPlacedBuilding[] {
  return workerCivicBuildOptionsOnCell(map, cell, ownerId);
}

export function militaryBuildOptionsOnCell(map: ParsedMap, cell: MapCell, ownerId: number): MilitaryPlacedBuilding[] {
  if (!canBuildMilitaryOnCell(cell)) return [];
  const out: MilitaryPlacedBuilding[] = ["barracks"];
  if (placementPrerequisitesMetForTarget(map, "wall", ownerId)) out.unshift("wall");
  return out;
}

/** Worker World Wonders: one per type, 3-day build, 10+ non-Wonder buildings first. */
export function workerWonderBuildOptionsOnCell(map: ParsedMap, cell: MapCell, ownerId: number): WonderKind[] {
  const out: WonderKind[] = [];
  for (const w of WONDER_KINDS) {
    if (canStartWonderConstruction(map, cell, ownerId, w)) out.push(w);
  }
  return out;
}

export const WORKER_WONDER_BUILD_ACTION_LABEL: Record<WonderKind, string> = {
  lighthouse: "Build Lighthouse",
  colossus: "Build Colossus",
  mausoleum: "Build Mausoleum",
  pyramid: "Build Pyramid",
  academy: "Build Academy",
};

function withCellConstructionTarget(
  map: ParsedMap,
  row: number,
  col: number,
  constructionTarget: BuildingKind,
  constructionOwnerId: number,
  constructionBorrowedUnitKind: PondsteadUnitKind,
): ParsedMap {
  const constructionNightsLeft = constructionNightsForTarget(constructionTarget);
  return {
    ...map,
    cells: map.cells.map((r, ri) =>
      ri === row
        ? r.map((c, ci) =>
            ci === col
              ? {
                  ...c,
                  constructionTarget,
                  constructionOwnerId,
                  constructionBorrowedUnitKind,
                  constructionNightsLeft,
                }
              : c,
          )
        : r,
    ),
  };
}

/**
 * Start construction at {@link row},{@link col}. The builder is removed from stacks separately.
 * Returns a new map or null if rules forbid it.
 */
export function tryStartConstruction(
  map: ParsedMap,
  row: number,
  col: number,
  unitKind: PondsteadUnitKind,
  target: BuildingKind,
  constructionOwnerId = 0,
): ParsedMap | null {
  if (row < 0 || col < 0 || row >= map.height || col >= map.width) return null;
  const cell = map.cells[row]![col]!;

  if (unitKind === "worker") {
    if (target === "orchard" && cellAllowsNewBuilding(cell) && cell.resource === "food") {
      return withCellConstructionTarget(map, row, col, "orchard", constructionOwnerId, unitKind);
    }
    if (target === "camp" && cellAllowsNewBuilding(cell) && cell.resource === "wood") {
      return withCellConstructionTarget(map, row, col, "camp", constructionOwnerId, unitKind);
    }
    if (target === "quarry" && cellAllowsNewBuilding(cell) && cell.resource === "stone") {
      return withCellConstructionTarget(map, row, col, "quarry", constructionOwnerId, unitKind);
    }
    if (
      target === "granary" &&
      canBuildGrassTierCivicOnCell(cell) &&
      placementPrerequisitesMetForTarget(map, "granary", constructionOwnerId)
    ) {
      return withCellConstructionTarget(map, row, col, "granary", constructionOwnerId, unitKind);
    }
    if (
      target === "sawmill" &&
      canBuildGrassTierCivicOnCell(cell) &&
      placementPrerequisitesMetForTarget(map, "sawmill", constructionOwnerId)
    ) {
      return withCellConstructionTarget(map, row, col, "sawmill", constructionOwnerId, unitKind);
    }
    if (
      target === "masonYard" &&
      canBuildGrassTierCivicOnCell(cell) &&
      placementPrerequisitesMetForTarget(map, "masonYard", constructionOwnerId)
    ) {
      return withCellConstructionTarget(map, row, col, "masonYard", constructionOwnerId, unitKind);
    }
    if (
      target === "wall" &&
      canBuildMilitaryOnCell(cell) &&
      placementPrerequisitesMetForTarget(map, "wall", constructionOwnerId)
    ) {
      return withCellConstructionTarget(map, row, col, "wall", constructionOwnerId, unitKind);
    }
    if (target === "barracks" && canBuildMilitaryOnCell(cell)) {
      return withCellConstructionTarget(map, row, col, "barracks", constructionOwnerId, unitKind);
    }
    if (isWonderBuildingKind(target) && canStartWonderConstruction(map, cell, constructionOwnerId, target)) {
      return withCellConstructionTarget(map, row, col, target, constructionOwnerId, unitKind);
    }
    return null;
  }

  if (unitKind === "soldier") {
    if (
      target === "wall" &&
      canBuildMilitaryOnCell(cell) &&
      placementPrerequisitesMetForTarget(map, "wall", constructionOwnerId)
    ) {
      return withCellConstructionTarget(map, row, col, "wall", constructionOwnerId, unitKind);
    }
    if (target === "barracks" && canBuildMilitaryOnCell(cell)) {
      return withCellConstructionTarget(map, row, col, "barracks", constructionOwnerId, unitKind);
    }
  }
  return null;
}

export const WORKER_BUILD_ACTION_LABEL: Record<WorkerCivicPlacedBuilding, string> = {
  orchard: "Build Orchard",
  camp: "Build Camp",
  quarry: "Build Quarry",
  granary: "Build Granary",
  sawmill: "Build Sawmill",
  masonYard: "Build Mason’s Yard",
};

export const MILITARY_BUILD_ACTION_LABEL: Record<MilitaryPlacedBuilding, string> = {
  wall: "Build Wall",
  barracks: "Build Barracks",
};

/** @deprecated */
export const SOLDIER_BUILD_ACTION_LABEL = MILITARY_BUILD_ACTION_LABEL;

export function buildingAllowsRecruitWorker(b: Exclude<BuildingKind, "none">): boolean {
  if (b === "wall") return false;
  if (b === "barracks") return false;
  if (isWonderBuildingKind(b)) return false;
  return true;
}

export function buildingAllowsRecruitSoldier(b: Exclude<BuildingKind, "none">): boolean {
  return b === "hq" || b === "barracks";
}
