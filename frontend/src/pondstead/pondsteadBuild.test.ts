import { describe, expect, it } from "vitest";

import type { MapCell, ParsedMap } from "./types";
import {
  constructionNightsForTarget,
  countCompletedOwnedBuildingsOfKind,
  militaryBuildOptionsOnCell,
  placementPrerequisitesMetForTarget,
  tryStartConstruction,
  workerCivicBuildOptionsOnCell,
} from "./pondsteadBuild";

function grassEmptyCell(): MapCell {
  return { symbol: "G", ground: "grass", resource: "none", building: "none" };
}

function mapWithCells(cells: MapCell[][]): ParsedMap {
  return { width: cells[0]!.length, height: cells.length, cells };
}

describe("constructionNightsForTarget", () => {
  it("uses 3 nights for world wonders", () => {
    expect(constructionNightsForTarget("lighthouse")).toBe(3);
    expect(constructionNightsForTarget("academy")).toBe(3);
  });
});

describe("placementPrerequisitesMetForTarget", () => {
  it("requires 2 completed owned orchards for granary", () => {
    const oneOrchard: ParsedMap = mapWithCells([
      [
        { symbol: "O", ground: "berry", resource: "food", building: "orchard", buildingOwnerId: 0 },
        grassEmptyCell(),
      ],
    ]);
    expect(placementPrerequisitesMetForTarget(oneOrchard, "granary", 0)).toBe(false);
    const two: ParsedMap = mapWithCells([
      [
        { symbol: "O", ground: "berry", resource: "food", building: "orchard", buildingOwnerId: 0 },
        { symbol: "O", ground: "berry", resource: "food", building: "orchard", buildingOwnerId: 0 },
      ],
    ]);
    expect(placementPrerequisitesMetForTarget(two, "granary", 0)).toBe(true);
  });

  it("counts only completed buildings for wall barracks prereq", () => {
    const underConstruction: ParsedMap = mapWithCells([
      [
        {
          symbol: "G",
          ground: "grass",
          resource: "none",
          building: "none",
          constructionTarget: "barracks",
          constructionOwnerId: 0,
          constructionBorrowedUnitKind: "worker",
          constructionNightsLeft: 1,
        },
      ],
    ]);
    expect(placementPrerequisitesMetForTarget(underConstruction, "wall", 0)).toBe(false);
    const done: ParsedMap = mapWithCells([
      [
        {
          symbol: "G",
          ground: "grass",
          resource: "none",
          building: "barracks",
          buildingOwnerId: 0,
        },
      ],
    ]);
    expect(placementPrerequisitesMetForTarget(done, "wall", 0)).toBe(true);
  });

  it("only counts buildings owned by the given player", () => {
    const map: ParsedMap = mapWithCells([
      [
        { symbol: "O", ground: "berry", resource: "food", building: "orchard", buildingOwnerId: 0 },
        { symbol: "O", ground: "berry", resource: "food", building: "orchard", buildingOwnerId: 1 },
      ],
    ]);
    expect(countCompletedOwnedBuildingsOfKind(map, "orchard", 0)).toBe(1);
    expect(placementPrerequisitesMetForTarget(map, "granary", 0)).toBe(false);
    expect(countCompletedOwnedBuildingsOfKind(map, "orchard", 1)).toBe(1);
  });
});

describe("workerCivicBuildOptionsOnCell", () => {
  it("omits granary on grass until 2 orchards owned", () => {
    const cell = grassEmptyCell();
    const noOrchards = mapWithCells([[cell, grassEmptyCell()]]);
    expect(workerCivicBuildOptionsOnCell(noOrchards, cell, 0).includes("granary")).toBe(false);
    const twoOrchards = mapWithCells([
      [
        { symbol: "O", ground: "berry", resource: "food", building: "orchard", buildingOwnerId: 0 },
        { symbol: "O", ground: "berry", resource: "food", building: "orchard", buildingOwnerId: 0 },
        grassEmptyCell(),
      ],
    ]);
    const grass = twoOrchards.cells[0]![2]!;
    expect(workerCivicBuildOptionsOnCell(twoOrchards, grass, 0)).toContain("granary");
  });
});

describe("militaryBuildOptionsOnCell", () => {
  it("omits wall without a completed owned barracks", () => {
    const cell = grassEmptyCell();
    const m = mapWithCells([[cell]]);
    expect(militaryBuildOptionsOnCell(m, cell, 0)).toEqual(["barracks"]);
    const withBarracks = mapWithCells([
      [
        {
          symbol: "G",
          ground: "grass",
          resource: "none",
          building: "barracks",
          buildingOwnerId: 0,
        },
        grassEmptyCell(),
      ],
    ]);
    const grass = withBarracks.cells[0]![1]!;
    expect(militaryBuildOptionsOnCell(withBarracks, grass, 0)).toEqual(["wall", "barracks"]);
  });
});

describe("tryStartConstruction", () => {
  it("rejects granary without orchard prereq", () => {
    const cell = grassEmptyCell();
    const m = mapWithCells([[cell]]);
    expect(tryStartConstruction(m, 0, 0, "worker", "granary", 0)).toBeNull();
  });

  it("allows granary with 2 orchards on valid grass", () => {
    const m = mapWithCells([
      [
        { symbol: "O", ground: "berry", resource: "food", building: "orchard", buildingOwnerId: 0 },
        { symbol: "O", ground: "berry", resource: "food", building: "orchard", buildingOwnerId: 0 },
        grassEmptyCell(),
      ],
    ]);
    const next = tryStartConstruction(m, 0, 2, "worker", "granary", 0);
    expect(next).not.toBeNull();
    expect(next!.cells[0]![2]!.constructionTarget).toBe("granary");
  });
});
