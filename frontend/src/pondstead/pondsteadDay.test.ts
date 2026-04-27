import { describe, expect, it } from "vitest";

import {
  advanceConstructionsAndReleaseBorrowedUnits,
  countTotalQueuedRecruits,
  totalPopulationTowardCap,
  type PendingRecruits,
} from "./pondsteadDay";
import type { UnitStack } from "./pondsteadUnits";
import type { ParsedMap } from "./types";

const emptyGrassMap: ParsedMap = {
  width: 1,
  height: 1,
  cells: [[{ symbol: "F", ground: "berry", resource: "food", building: "none" }]],
};

const orchardUnderConstruction: ParsedMap = {
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

describe("totalPopulationTowardCap", () => {
  it("adds on-map units and queued recruit slots", () => {
    const stacks: UnitStack[] = [{ id: "a", kind: "worker", count: 3, row: 0, col: 0 }];
    const q: PendingRecruits = { "1-1": "soldier", "2-2": "worker" };
    expect(countTotalQueuedRecruits(q)).toBe(2);
    expect(totalPopulationTowardCap(stacks, emptyGrassMap, q)).toBe(5);
  });

  it("treats an empty queue as zero extra population", () => {
    const stacks: UnitStack[] = [{ id: "a", kind: "soldier", count: 1, row: 0, col: 0 }];
    expect(totalPopulationTowardCap(stacks, emptyGrassMap, {})).toBe(1);
  });

  it("counts a unit absorbed into an active construction site", () => {
    expect(totalPopulationTowardCap([], orchardUnderConstruction, {})).toBe(1);
  });
});

describe("advanceConstructionsAndReleaseBorrowedUnits", () => {
  it("completes the building and returns the borrowed worker to the tile", () => {
    const stacks: UnitStack[] = [];
    const { map, stacks: next, completed, stillBuilding } = advanceConstructionsAndReleaseBorrowedUnits(
      orchardUnderConstruction,
      stacks,
    );
    expect(map.cells[0]![0]!.building).toBe("orchard");
    expect(map.cells[0]![0]!.constructionTarget).toBeUndefined();
    expect(next).toHaveLength(1);
    expect(next[0]!.kind).toBe("worker");
    expect(next[0]!.count).toBe(1);
    expect(next[0]!.row).toBe(0);
    expect(next[0]!.col).toBe(0);
    expect(completed).toEqual([{ target: "orchard", label: "Orchard" }]);
    expect(stillBuilding).toEqual([]);
  });

  it("when a build needs two nights, the first tick leaves the site under construction and does not release the unit", () => {
    const twoNightOrchard: ParsedMap = {
      width: 1,
      height: 1,
      cells: [
        [
          {
            ...orchardUnderConstruction.cells[0]![0]!,
            constructionNightsLeft: 2,
          },
        ],
      ],
    };
    const stacks: UnitStack[] = [];
    const first = advanceConstructionsAndReleaseBorrowedUnits(twoNightOrchard, stacks);
    expect(first.map.cells[0]![0]!.constructionTarget).toBe("orchard");
    expect(first.map.cells[0]![0]!.constructionNightsLeft).toBe(1);
    expect(first.stacks).toHaveLength(0);
    expect(first.completed).toEqual([]);
    expect(first.stillBuilding).toEqual([{ target: "orchard", label: "Orchard", nightsLeft: 1 }]);

    const second = advanceConstructionsAndReleaseBorrowedUnits(first.map, first.stacks);
    expect(second.map.cells[0]![0]!.building).toBe("orchard");
    expect(second.stacks).toHaveLength(1);
    expect(second.completed).toEqual([{ target: "orchard", label: "Orchard" }]);
  });
});
