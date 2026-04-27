import type { PendingRecruits } from "./pondsteadDay";
import { wonderMarginalCostIndex } from "./pondsteadWonders";
import { countQueuedRecruitsOfKind } from "./pondsteadDay";
import type { UnitStack, PondsteadUnitKind } from "./pondsteadUnits";
import { totalKindCountInArmy } from "./pondsteadUnits";
import type { BuildingKind, ParsedMap } from "./types";

function countBorrowedKindInConstruction(map: ParsedMap | undefined, kind: PondsteadUnitKind): number {
  if (!map) return 0;
  let n = 0;
  for (const row of map.cells) {
    for (const c of row) {
      const t = c.constructionTarget;
      if (t == null || t === "none") continue;
      const k = c.constructionBorrowedUnitKind ?? (t === "wall" ? "soldier" : "worker");
      if (k === kind) n += 1;
    }
  }
  return n;
}

/** Food / wood / stone to spend on a build. Zeros are allowed. */
export type ResourcePurse = {
  food: number;
  wood: number;
  stone: number;
};

/** Count completed buildings and in-progress sites of this kind (for marginal build cost). */
export function countBuildingsOrPendingConstruction(map: ParsedMap, kind: BuildingKind): number {
  let n = 0;
  for (const row of map.cells) {
    for (const c of row) {
      if (c.building === kind) n += 1;
      if (c.constructionTarget === kind) n += 1;
    }
  }
  return n;
}

export function countOrchardsOnMap(map: ParsedMap): number {
  return countBuildingsOrPendingConstruction(map, "orchard");
}

export function countCampsOnMap(map: ParsedMap): number {
  return countBuildingsOrPendingConstruction(map, "camp");
}

export function countQuarriesOnMap(map: ParsedMap): number {
  return countBuildingsOrPendingConstruction(map, "quarry");
}

export function countWallsOnMap(map: ParsedMap): number {
  return countBuildingsOrPendingConstruction(map, "wall");
}

/**
 * Cost for the next build of this type. “Already own” = current map; when placing,
 * the new map piece is not on the map yet, so the existing count is the `k` for marginal cost.
 * Orchard, camp, quarry, and all other placeables: marginal `k` counts completed buildings plus
 * matching in-progress construction for that type.
 * Wall: 10+10 wood+stone, +5+5 of each per existing wall. Barracks, Granary, etc.: marginal from priors.
 */
export function getBuildCostForTarget(map: ParsedMap, target: BuildingKind): ResourcePurse | null {
  switch (target) {
    case "orchard": {
      const k = countBuildingsOrPendingConstruction(map, "orchard");
      return { food: 5 + 5 * k, wood: 5 + 5 * k, stone: 0 };
    }
    case "camp": {
      const k = countBuildingsOrPendingConstruction(map, "camp");
      return { food: 5 + 5 * k, wood: 5 + 5 * k, stone: 0 };
    }
    case "quarry": {
      const k = countBuildingsOrPendingConstruction(map, "quarry");
      return { food: 10 + 5 * k, wood: 10 + 5 * k, stone: 0 };
    }
    case "wall": {
      const k = countWallsOnMap(map);
      return { food: 0, wood: 10 + 5 * k, stone: 10 + 5 * k };
    }
    case "barracks": {
      const k = countBuildingsOrPendingConstruction(map, "barracks");
      return { food: 0, wood: 20 + 20 * k, stone: 20 + 20 * k };
    }
    case "granary": {
      const k = countBuildingsOrPendingConstruction(map, "granary");
      return { food: 0, wood: 50 + 50 * k, stone: 50 + 50 * k };
    }
    case "sawmill": {
      const k = countBuildingsOrPendingConstruction(map, "sawmill");
      return { food: 50 + 50 * k, wood: 0, stone: 50 + 50 * k };
    }
    case "masonYard": {
      const k = countBuildingsOrPendingConstruction(map, "masonYard");
      return { food: 25 + 25 * k, wood: 25 + 25 * k, stone: 50 + 50 * k };
    }
    case "lighthouse":
    case "colossus":
    case "mausoleum":
    case "pyramid":
    case "academy": {
      const k = wonderMarginalCostIndex(map);
      const x = 100 + 100 * k;
      return { food: x, wood: x, stone: x };
    }
    default:
      return null;
  }
}

export function canAfford(purse: ResourcePurse, cost: ResourcePurse): boolean {
  return purse.food >= cost.food && purse.wood >= cost.wood && purse.stone >= cost.stone;
}

export function applyCost(purse: ResourcePurse, cost: ResourcePurse): ResourcePurse {
  return {
    food: purse.food - cost.food,
    wood: purse.wood - cost.wood,
    stone: purse.stone - cost.stone,
  };
}

export function insufficientBuildResourcesMessage(): string {
  return "Not enough resources for this build.";
}

/** Compact label for a build button, e.g. "5 food 5 wood". */
export function formatBuildCostPill(cost: ResourcePurse): string {
  const parts: string[] = [];
  if (cost.food > 0) parts.push(`${cost.food} food`);
  if (cost.wood > 0) parts.push(`${cost.wood} wood`);
  if (cost.stone > 0) parts.push(`${cost.stone} stone`);
  return parts.length > 0 ? parts.join(", ") : "Free";
}

/** Reasonable stockpile so early builds are playable before economy accrual is wired. */
export const PONDSTEAD_STARTING_RESOURCES: ResourcePurse = { food: 200, wood: 200, stone: 200 };

export type PlaceBuildResult =
  | { ok: true }
  | { ok: false; reason: "insufficient" | "invalid" | "no_actions" | "prerequisites" };

/**
 * Marginal cost to recruit the next unit of this kind.
 * Worker: 1 food + 1 wood each, +1 food +1 wood per prior worker (on map or queued).
 * Soldier: 2 of each resource, +2 of each per prior soldier (on map or queued).
 */
export function getRecruitCostForNextUnit(
  stacks: UnitStack[],
  kind: PondsteadUnitKind,
  recruitQueues: PendingRecruits,
  map?: ParsedMap,
): ResourcePurse {
  const owned = totalKindCountInArmy(stacks, kind);
  const queued = countQueuedRecruitsOfKind(recruitQueues, kind);
  const borrowedInConstruction = countBorrowedKindInConstruction(map, kind);
  const k = owned + queued + borrowedInConstruction;
  if (kind === "worker") {
    return { food: 1 + k, wood: 1 + k, stone: 0 };
  }
  return { food: 2 + 2 * k, wood: 2 + 2 * k, stone: 2 + 2 * k };
}

export function insufficientRecruitResourcesMessage(): string {
  return "Not enough resources to recruit.";
}
