import { populationCapFromMap, totalOwnedUnits } from "./pondsteadHudMetrics";
import { buildingLabel } from "./terrain";
import { mapCellBuildingOwner } from "./pondsteadVision";
import {
  applyRecruit,
  mergeOneUnitIgnoringPopulationCap,
  type PondsteadUnitKind,
  type UnitStack,
} from "./pondsteadUnits";
import type { BuildingKind, MapCell, ParsedMap } from "./types";

export function pondsteadCellKey(row: number, col: number): string {
  return `${row}-${col}`;
}

function borrowedKindForConstruction(
  target: BuildingKind,
  stored: "worker" | "soldier" | undefined,
): PondsteadUnitKind {
  if (stored) return stored;
  return target === "wall" ? "soldier" : "worker";
}

function stripConstructionCellToBuilding(c: MapCell, t: BuildingKind): MapCell {
  const {
    constructionTarget: _ct,
    constructionOwnerId: co,
    constructionBorrowedUnitKind: _bk,
    constructionNightsLeft: _nl,
    ...rest
  } = c;
  const buildingOwnerId = co ?? mapCellBuildingOwner(c);
  const buildingCondition: MapCell["buildingCondition"] =
    t === "none" || t === "wall" ? undefined : "intact";
  return { ...rest, building: t, buildingOwnerId, buildingCondition };
}

/** Map-only: apply one “new day” pass to in-progress sites (decrement or complete). */
export function advanceConstructions(map: ParsedMap): ParsedMap {
  return advanceConstructionsAndReleaseBorrowedUnits(map, []).map;
}

/** One construction site finishing: building appears and the borrowed unit should return to this tile. */
export type ConstructionBorrowedRelease = {
  row: number;
  col: number;
  kind: PondsteadUnitKind;
  ownerId: number;
};

export type NewDayCompletedBuilding = { target: BuildingKind; label: string };
export type NewDayStillUnderConstruction = { target: BuildingKind; label: string; nightsLeft: number };

/**
 * One “new day” pass: decrement multi-night sites, or finish builds and return borrowed units
 * to the map (before queued recruits spawn). Release order: row, then col.
 */
export function advanceConstructionsAndReleaseBorrowedUnits(
  map: ParsedMap,
  stacks: UnitStack[],
): {
  map: ParsedMap;
  stacks: UnitStack[];
  completed: NewDayCompletedBuilding[];
  stillBuilding: NewDayStillUnderConstruction[];
} {
  const releases: ConstructionBorrowedRelease[] = [];
  const completed: NewDayCompletedBuilding[] = [];
  const stillBuilding: NewDayStillUnderConstruction[] = [];

  const newCells = map.cells.map((row, ri) =>
    row.map((c, ci) => {
      const t = c.constructionTarget;
      if (!t || t === "none") return c;
      const nights = c.constructionNightsLeft ?? 1;
      if (nights > 1) {
        const nextNights = nights - 1;
        stillBuilding.push({
          target: t,
          label: buildingLabel(t as Exclude<BuildingKind, "none">),
          nightsLeft: nextNights,
        });
        return { ...c, constructionNightsLeft: nextNights };
      }
      const kind = borrowedKindForConstruction(t, c.constructionBorrowedUnitKind);
      const ownerId = c.constructionOwnerId ?? mapCellBuildingOwner(c);
      releases.push({ row: ri, col: ci, kind, ownerId });
      completed.push({ target: t, label: buildingLabel(t as Exclude<BuildingKind, "none">) });
      return stripConstructionCellToBuilding(c, t);
    }),
  );
  const nextMap: ParsedMap = { ...map, cells: newCells };
  releases.sort((a, b) => a.row - b.row || a.col - b.col);
  let nextStacks = stacks;
  for (const rel of releases) {
    const merged = mergeOneUnitIgnoringPopulationCap(
      nextStacks,
      rel.row,
      rel.col,
      rel.kind,
      rel.ownerId,
    );
    if (merged) nextStacks = merged;
  }
  return { map: nextMap, stacks: nextStacks, completed, stillBuilding };
}

export type PendingRecruits = Record<string, PondsteadUnitKind>;

/** Queued recruits of this kind (any building), for marginal recruit pricing. */
export function countQueuedRecruitsOfKind(queues: PendingRecruits, kind: PondsteadUnitKind): number {
  let n = 0;
  for (const v of Object.values(queues)) {
    if (v === kind) n += 1;
  }
  return n;
}

/** All queued recruit slots (one unit each), for population cap and HUD. */
export function countTotalQueuedRecruits(queues: PendingRecruits): number {
  return Object.keys(queues).length;
}

/** Active construction sites, each holding one unit toward population until the build completes. */
export function countConstructionBorrowedPopulationSlots(map: ParsedMap): number {
  let n = 0;
  for (const row of map.cells) {
    for (const c of row) {
      if (c.constructionTarget != null && c.constructionTarget !== "none") n += 1;
    }
  }
  return n;
}

/** On-map units, queued recruits, and units absorbed into construction (each reserves one cap slot). */
export function totalPopulationTowardCap(
  stacks: UnitStack[],
  map: ParsedMap,
  queues: PendingRecruits,
): number {
  return (
    totalOwnedUnits(stacks) +
    countTotalQueuedRecruits(queues) +
    countConstructionBorrowedPopulationSlots(map)
  );
}

export function recruitPendingInQueueMessage(): string {
  return "A recruit is already queued for this building — they arrive at the start of the next day.";
}

/**
 * Spawn at most one queued recruit per building tile. Failed spawns (cap / tile full) stay queued.
 */
export function processPendingRecruitsAtDayStart(
  map: ParsedMap,
  stacks: UnitStack[],
  queues: PendingRecruits,
): { stacks: UnitStack[]; queues: PendingRecruits } {
  const cap = populationCapFromMap(map);
  let nextStacks = stacks;
  const nextQueues: PendingRecruits = { ...queues };

  for (const key of Object.keys(nextQueues).sort()) {
    const kind = nextQueues[key];
    if (kind === undefined) continue;
    const [row, col] = key.split("-").map(Number);
    const cell = map.cells[row]![col]!;
    const recruitOwner = mapCellBuildingOwner(cell);
    const applied = applyRecruit(nextStacks, row, col, kind, cap, recruitOwner);
    if (applied) {
      nextStacks = applied;
      delete nextQueues[key];
    }
  }

  return { stacks: nextStacks, queues: nextQueues };
}
