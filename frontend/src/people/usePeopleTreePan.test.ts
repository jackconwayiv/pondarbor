import { describe, expect, it } from "vitest";

import {
  clampPeopleTreePan,
  computePeopleTreeInitialPan,
  computePeopleTreePanBounds,
  panForScaleChange,
  PEOPLE_TREE_PAN_BOTTOM_EXTRA,
  PEOPLE_TREE_PAN_MARGIN,
  PEOPLE_TREE_SCALE_DEFAULT,
  PEOPLE_TREE_SCALE_MAX,
  PEOPLE_TREE_SCALE_MIN,
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
    const scale = 1;
    const pan = computePeopleTreeInitialPan(400, 300, 900, 500, 450, 200, scale, 40, 0);
    expect(pan.y).toBe(150 - 200 * scale);
    expect(pan.x).toBe(200 - 450 * scale);
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

  it("expands bounds when content is scaled up", () => {
    const at1 = computePeopleTreePanBounds(400, 300, 500, 400, 40, 0);
    const at2 = computePeopleTreePanBounds(400, 300, 1000, 800, 40, 0);
    expect(at2.minX).toBeLessThan(at1.minX);
    expect(at2.minY).toBeLessThan(at1.minY);
  });
});

describe("panForScaleChange", () => {
  it("keeps focal content point fixed when zooming in", () => {
    const pan = { x: 10, y: 20 };
    const focal = { x: 200, y: 150 };
    const oldScale = 1;
    const newScale = 2;
    const next = panForScaleChange(pan, oldScale, newScale, focal.x, focal.y);
    const contentX = (focal.x - pan.x) / oldScale;
    const contentY = (focal.y - pan.y) / oldScale;
    expect(next.x + contentX * newScale).toBeCloseTo(focal.x);
    expect(next.y + contentY * newScale).toBeCloseTo(focal.y);
  });
});

describe("scale limits", () => {
  it("documents zoom range", () => {
    expect(PEOPLE_TREE_SCALE_MIN).toBeLessThan(PEOPLE_TREE_SCALE_DEFAULT);
    expect(PEOPLE_TREE_SCALE_DEFAULT).toBeLessThan(PEOPLE_TREE_SCALE_MAX);
  });
});
