import { describe, expect, it } from "vitest";

import { PONDSTEAD_DEFAULT_MAP_TEMPLATE } from "./defaultMapTemplate";
import { populationCapFromMap, PONDSTEAD_POPULATION_PER_BUILDING } from "./pondsteadHudMetrics";
import { parseMapTemplate } from "./parseMapTemplate";
import {
  countOrchardsOnMap,
  getBuildCostForTarget,
  getRecruitCostForNextUnit,
} from "./pondsteadBuildingCosts";
import type { PendingRecruits } from "./pondsteadDay";
import type { UnitStack } from "./pondsteadUnits";
import type { MapCell, ParsedMap } from "./types";

function withBuildingAt(
  map: ParsedMap,
  row: number,
  col: number,
  building: (typeof map.cells)[0][0]["building"],
): ParsedMap {
  return {
    ...map,
    cells: map.cells.map((r, ri) =>
      r.map((c, ci) => (ri === row && ci === col ? { ...c, building } : c)),
    ),
  };
}

describe("getBuildCostForTarget", () => {
  it("prices the next orchard from existing orchard count", () => {
    const map = parseMapTemplate(PONDSTEAD_DEFAULT_MAP_TEMPLATE);
    expect(countOrchardsOnMap(map)).toBe(1);
    const c = getBuildCostForTarget(map, "orchard", 0);
    expect(c).toEqual({ food: 10, wood: 10, stone: 0 });
  });

  it("prices the first quarry with no existing quarries", () => {
    const map = parseMapTemplate(PONDSTEAD_DEFAULT_MAP_TEMPLATE);
    const c = getBuildCostForTarget(map, "quarry", 0);
    expect(c).toEqual({ food: 10, wood: 10, stone: 0 });
  });

  it("prices the first wall at 10 wood 10 stone", () => {
    const map = parseMapTemplate(PONDSTEAD_DEFAULT_MAP_TEMPLATE);
    const c = getBuildCostForTarget(map, "wall", 0);
    expect(c).toEqual({ food: 0, wood: 10, stone: 10 });
  });

  it("prices the next worker recruit from current army size", () => {
    const stacks: UnitStack[] = [
      { id: "a", kind: "worker", count: 2, row: 0, col: 0 },
      { id: "b", kind: "worker", count: 1, row: 0, col: 0 },
      { id: "c", kind: "soldier", count: 1, row: 0, col: 0 },
    ];
    const q: PendingRecruits = {};
    expect(getRecruitCostForNextUnit(stacks, "worker", q, 0)).toEqual({ food: 4, wood: 4, stone: 0 });
    expect(getRecruitCostForNextUnit(stacks, "soldier", q, 0)).toEqual({ food: 4, wood: 4, stone: 4 });
  });

  it("prices first soldier at 2 of each resource with no soldiers owned or queued", () => {
    const stacks: UnitStack[] = [{ id: "a", kind: "worker", count: 1, row: 0, col: 0 }];
    expect(getRecruitCostForNextUnit(stacks, "soldier", {}, 0)).toEqual({ food: 2, wood: 2, stone: 2 });
  });

  it("counts queued soldiers toward the next soldier recruit cost", () => {
    const stacks: UnitStack[] = [];
    const q: PendingRecruits = { "0-0": "soldier" };
    const map = parseMapTemplate(PONDSTEAD_DEFAULT_MAP_TEMPLATE);
    // Ensure the queued cell belongs to seat 0 for this test.
    expect(getRecruitCostForNextUnit(stacks, "soldier", q, 0, map)).toEqual({ food: 4, wood: 4, stone: 4 });
  });

  it("counts queued workers toward the next worker recruit cost", () => {
    const stacks: UnitStack[] = [];
    const q: PendingRecruits = { "1-1": "worker" };
    const map = parseMapTemplate(PONDSTEAD_DEFAULT_MAP_TEMPLATE);
    expect(getRecruitCostForNextUnit(stacks, "worker", q, 0, map)).toEqual({ food: 2, wood: 2, stone: 0 });
  });

  it("prices first wonder at 100 each resource", () => {
    const map = parseMapTemplate(PONDSTEAD_DEFAULT_MAP_TEMPLATE);
    expect(getBuildCostForTarget(map, "lighthouse", 0)).toEqual({ food: 100, wood: 100, stone: 100 });
  });

  it("adds 100 per resource for each existing completed wonder", () => {
    const cell: MapCell = {
      symbol: "G",
      ground: "grass",
      resource: "none",
      building: "lighthouse",
      buildingOwnerId: 0,
    };
    const map: ParsedMap = { width: 1, height: 1, cells: [[cell]] };
    expect(getBuildCostForTarget(map, "pyramid", 0)).toEqual({ food: 200, wood: 200, stone: 200 });
  });

  it("counts a worker in an active construction site toward the next worker recruit cost", () => {
    const stacks: UnitStack[] = [];
    const map: ParsedMap = {
      width: 1,
      height: 1,
      cells: [
        [
          {
            symbol: "F",
            ground: "berry",
            resource: "food",
            building: "none",
            constructionTarget: "orchard",
            constructionOwnerId: 0,
            constructionBorrowedUnitKind: "worker",
          },
        ],
      ],
    };
    expect(getRecruitCostForNextUnit(stacks, "worker", {}, 0, map)).toEqual({ food: 2, wood: 2, stone: 0 });
  });

  it("does not count other seats' units toward recruit marginal cost", () => {
    const map = parseMapTemplate(PONDSTEAD_DEFAULT_MAP_TEMPLATE);
    const stacks: UnitStack[] = [
      { id: "p0w", kind: "worker", count: 2, row: 0, col: 0, ownerId: 0 },
      { id: "p1w", kind: "worker", count: 5, row: 0, col: 0, ownerId: 1 },
    ];
    expect(getRecruitCostForNextUnit(stacks, "worker", {}, 0, map)).toEqual({ food: 3, wood: 3, stone: 0 });
    expect(getRecruitCostForNextUnit(stacks, "worker", {}, 1, map)).toEqual({ food: 6, wood: 6, stone: 0 });
  });

  it("does not count walls toward population cap", () => {
    const map = parseMapTemplate(PONDSTEAD_DEFAULT_MAP_TEMPLATE);
    const cap0 = populationCapFromMap(map);
    const withBar = withBuildingAt(map, 0, 0, "wall");
    const cap1 = populationCapFromMap(withBar);
    expect(cap0).toBe(3 * PONDSTEAD_POPULATION_PER_BUILDING);
    expect(cap1).toBe(cap0);
  });
});
