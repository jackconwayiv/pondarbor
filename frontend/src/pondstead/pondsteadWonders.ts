import type { BuildingKind, MapCell, ParsedMap } from "./types";
import {
  mapCellBuildingOwner,
  mapCellConstructionOwner,
  PONDSTEAD_LOCAL_PLAYER_ID,
  PONDSTEAD_VISION_CHEBYSHEV,
} from "./pondsteadVision";

export const WONDER_KINDS = [
  "lighthouse",
  "colossus",
  "mausoleum",
  "pyramid",
  "academy",
] as const;
export type WonderKind = (typeof WONDER_KINDS)[number];

const WONDER_SET = new Set<BuildingKind>(WONDER_KINDS as unknown as BuildingKind[]);

export function isWonderBuildingKind(b: BuildingKind): b is WonderKind {
  return WONDER_SET.has(b);
}

/** Empty grass lot (same footprint as Granary / Sawmill / Mason’s Yard). */
export function wonderCellTerrainOk(cell: MapCell): boolean {
  if (cell.building !== "none") return false;
  if (cell.constructionTarget) return false;
  if (cell.ground === "water" || cell.ground === "marsh") return false;
  if (cell.resource !== "none") return false;
  return cell.ground === "grass";
}

/** Completed structures that are not Wonders (HQ, walls, civics, military, …). */
export function countCompletedOwnedNonWonderBuildings(map: ParsedMap, ownerId: number): number {
  let n = 0;
  for (const row of map.cells) {
    for (const c of row) {
      const b = c.building;
      if (b === "none") continue;
      if (mapCellBuildingOwner(c) !== ownerId) continue;
      if (isWonderBuildingKind(b)) continue;
      n += 1;
    }
  }
  return n;
}

function wonderOwnerMatchesCellBuilding(c: MapCell, ownerId: number): boolean {
  return mapCellBuildingOwner(c) === ownerId;
}

function wonderOwnerMatchesConstruction(c: MapCell, ownerId: number): boolean {
  return mapCellConstructionOwner(c) === ownerId;
}

/** Completed or in-progress Wonder sites for this owner (any type). */
export function countWonderSitesForOwner(map: ParsedMap, ownerId: number): number {
  let n = 0;
  for (const row of map.cells) {
    for (const c of row) {
      const b = c.building;
      if (b !== "none" && isWonderBuildingKind(b) && wonderOwnerMatchesCellBuilding(c, ownerId)) n += 1;
      const t = c.constructionTarget;
      if (t != null && t !== "none" && isWonderBuildingKind(t) && wonderOwnerMatchesConstruction(c, ownerId)) {
        n += 1;
      }
    }
  }
  return n;
}

export function countWonderTypeSitesForOwner(map: ParsedMap, ownerId: number, kind: WonderKind): number {
  let n = 0;
  for (const row of map.cells) {
    for (const c of row) {
      if (c.building === kind && wonderOwnerMatchesCellBuilding(c, ownerId)) n += 1;
      if (c.constructionTarget === kind && wonderOwnerMatchesConstruction(c, ownerId)) n += 1;
    }
  }
  return n;
}

export function countCompletedOwnedWonderOfKind(
  map: ParsedMap,
  ownerId: number,
  kind: WonderKind,
): number {
  let n = 0;
  for (const row of map.cells) {
    for (const c of row) {
      if (c.building === kind && wonderOwnerMatchesCellBuilding(c, ownerId)) n += 1;
    }
  }
  return n;
}

export function canStartWonderConstruction(
  map: ParsedMap,
  cell: MapCell,
  ownerId: number,
  target: WonderKind,
): boolean {
  if (!wonderCellTerrainOk(cell)) return false;
  if (countCompletedOwnedNonWonderBuildings(map, ownerId) < 10) return false;
  if (countWonderTypeSitesForOwner(map, ownerId, target) >= 1) return false;
  return true;
}

export function visionChebyshevRadiusForPlayer(map: ParsedMap, playerId: number): number {
  const n = countCompletedOwnedWonderOfKind(map, playerId, "lighthouse");
  return PONDSTEAD_VISION_CHEBYSHEV + n;
}

export function hasCompletedMausoleumForOwner(map: ParsedMap, ownerId: number): boolean {
  return countCompletedOwnedWonderOfKind(map, ownerId, "mausoleum") >= 1;
}

export function countCompletedOwnedPyramids(map: ParsedMap, ownerId: number): number {
  return countCompletedOwnedWonderOfKind(map, ownerId, "pyramid");
}

/** Count only; Academy is not a build target while disabled in `pondsteadBuild`. */
export function countCompletedOwnedAcademies(map: ParsedMap, ownerId: number): number {
  return countCompletedOwnedWonderOfKind(map, ownerId, "academy");
}

export function countCompletedOwnedColossi(map: ParsedMap, ownerId: number): number {
  return countCompletedOwnedWonderOfKind(map, ownerId, "colossus");
}

/** Marginal index for Wonder build cost: other Wonder sites (completed + UC) for this owner. */
export function wonderMarginalCostIndex(map: ParsedMap, ownerId: number = PONDSTEAD_LOCAL_PLAYER_ID): number {
  return countWonderSitesForOwner(map, ownerId);
}
