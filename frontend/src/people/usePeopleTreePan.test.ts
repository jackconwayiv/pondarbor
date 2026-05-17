import { describe, expect, it } from "vitest";

import {
  clampPeopleTreePan,
  computePeopleTreeInitialPan,
  computePeopleTreePanBounds,
  PEOPLE_TREE_PAN_BOTTOM_EXTRA,
  PEOPLE_TREE_PAN_MARGIN,
} from "./usePeopleTreePan";

describe("people tree pan bounds", () => {
  it("locks pan when content fits in the viewport", () => {
    const bounds = computePeopleTreePanBounds(400, 300, 200, 150, 40);
    expect(bounds.minX).toBe(100);
    expect(bounds.maxX).toBe(100);
    expect(bounds.minY).toBe(75);
    expect(bounds.maxY).toBe(75);
    expect(clampPeopleTreePan({ x: 0, y: 0 }, bounds)).toEqual({ x: 100, y: 75 });
  });

  it("centers focus vertically when content is taller than viewport", () => {
    const pan = computePeopleTreeInitialPan(400, 300, 900, 500, 450, 200, 40, 0);
    expect(pan.y).toBe(150 - 200);
    expect(pan.x).toBe(-250);
  });

  it("limits pan when content is larger than the viewport", () => {
    const bounds = computePeopleTreePanBounds(400, 300, 900, 500, 40);
    expect(bounds.maxX).toBe(40);
    expect(bounds.minX).toBe(400 - 900 - 40);
    expect(clampPeopleTreePan({ x: 500, y: -200 }, bounds)).toEqual({
      x: 40,
      y: -200,
    });
    expect(clampPeopleTreePan({ x: -800, y: 400 }, bounds)).toEqual({
      x: -540,
      y: 40,
    });
  });

  it("adds extra bottom scroll range via bottomExtra", () => {
    const without = computePeopleTreePanBounds(400, 300, 900, 500, PEOPLE_TREE_PAN_MARGIN, 0);
    const withExtra = computePeopleTreePanBounds(
      400,
      300,
      900,
      500,
      PEOPLE_TREE_PAN_MARGIN,
      PEOPLE_TREE_PAN_BOTTOM_EXTRA,
    );
    expect(withExtra.minY).toBe(without.minY - PEOPLE_TREE_PAN_BOTTOM_EXTRA);
    expect(withExtra.maxY).toBe(without.maxY);

    const panAtMin = clampPeopleTreePan({ x: 0, y: withExtra.minY }, withExtra);
    expect(panAtMin.y).toBe(
      300 - 500 - PEOPLE_TREE_PAN_MARGIN - PEOPLE_TREE_PAN_BOTTOM_EXTRA,
    );
  });
});
