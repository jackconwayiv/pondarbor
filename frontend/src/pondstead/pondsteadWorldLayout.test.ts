import { describe, expect, it } from "vitest";

import { chebyshevDistance } from "./adjacency";
import {
  buildDefaultTwoPlayerHorizontalMap,
  createTwoPlayerInitialStacks,
  rotateParsedMap180,
  stitchMapsHorizontally,
} from "./pondsteadWorldLayout";
import { PONDSTEAD_DEFAULT_MAP_TEMPLATE } from "./defaultMapTemplate";
import { findFirstBuildingCellForOwner, parseMapTemplate } from "./parseMapTemplate";

describe("pondsteadWorldLayout", () => {
  it("stitches to 18×9 with two HQs owned separately", () => {
    const map = buildDefaultTwoPlayerHorizontalMap();
    expect(map.width).toBe(18);
    expect(map.height).toBe(9);
    const hq0 = findFirstBuildingCellForOwner(map, "hq", 0);
    const hq1 = findFirstBuildingCellForOwner(map, "hq", 1);
    expect(hq0).not.toBeNull();
    expect(hq1).not.toBeNull();
    expect(hq0!.col).toBeLessThan(9);
    expect(hq1!.col).toBeGreaterThanOrEqual(9);
  });

  it("seam columns 8 and 9 are Chebyshev-adjacent", () => {
    expect(chebyshevDistance({ row: 4, col: 8 }, { row: 4, col: 9 })).toBe(1);
  });

  it("rotateParsedMap180 preserves dimensions", () => {
    const base = parseMapTemplate(PONDSTEAD_DEFAULT_MAP_TEMPLATE);
    const r = rotateParsedMap180(base);
    expect(r.width).toBe(base.width);
    expect(r.height).toBe(base.height);
  });

  it("createTwoPlayerInitialStacks places units for both seats", () => {
    const map = buildDefaultTwoPlayerHorizontalMap();
    const stacks = createTwoPlayerInitialStacks(map);
    const owners = new Set(stacks.map((s) => s.ownerId ?? 0));
    expect(owners.has(0)).toBe(true);
    expect(owners.has(1)).toBe(true);
    expect(stacks.reduce((n, s) => n + s.count, 0)).toBeGreaterThan(8);
  });

  it("stitchMapsHorizontally concatenates width", () => {
    const a = parseMapTemplate("GG\nGG");
    const b = parseMapTemplate("MM\nMM");
    const s = stitchMapsHorizontally(a, b);
    expect(s.width).toBe(4);
    expect(s.height).toBe(2);
  });
});
