import { describe, expect, it } from "vitest";

import { PONDSTEAD_DEFAULT_MAP_TEMPLATE } from "./defaultMapTemplate";
import { findFirstBuildingCell, findHeadquartersCell, parseMapTemplate } from "./parseMapTemplate";
import { createInitialStacks } from "./pondsteadUnits";
import {
  computeVisibleCellKeys,
  PONDSTEAD_LOCAL_PLAYER_ID,
  PONDSTEAD_VISION_CHEBYSHEV,
} from "./pondsteadVision";

describe("computeVisibleCellKeys", () => {
  it("includes a Chebyshev disk of radius 3 around each owned unit and HQ building", () => {
    const map = parseMapTemplate(PONDSTEAD_DEFAULT_MAP_TEMPLATE);
    const hq = findHeadquartersCell(map)!;
    const stacks = createInitialStacks(hq, null, null);
    const vis = computeVisibleCellKeys(map, stacks, PONDSTEAD_LOCAL_PLAYER_ID);
    expect(vis.has(`${hq.row}-${hq.col}`)).toBe(true);
    expect(vis.has(`${hq.row}-${hq.col + PONDSTEAD_VISION_CHEBYSHEV}`)).toBe(true);
    // Corner of default 9×9 map is outside Chebyshev-3 disks from HQ, orchard, and camp.
    expect(vis.has("8-8")).toBe(false);
    expect(vis.size).toBeGreaterThan(40);
  });

  it("includes vision from completed buildings owned by the local player", () => {
    const map = parseMapTemplate(PONDSTEAD_DEFAULT_MAP_TEMPLATE);
    const hq = findHeadquartersCell(map)!;
    const camp = findFirstBuildingCell(map, "camp")!;
    const stacks = createInitialStacks(hq, camp, null);
    const vis = computeVisibleCellKeys(map, stacks, PONDSTEAD_LOCAL_PLAYER_ID);
    expect(vis.has(`${camp.row}-${camp.col}`)).toBe(true);
  });
});
