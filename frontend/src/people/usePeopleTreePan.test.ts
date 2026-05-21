import { describe, expect, it } from "vitest";

import {
  clampPeopleTreePan,
  computePeopleTreeInitialPan,
  computePeopleTreePanBounds,
  panForScaleChange,
  PEOPLE_TREE_PAN_BOTTOM_EXTRA,
  PEOPLE_TREE_PAN_MARGIN,
  PEOPLE_TREE_SCALE_DEFAULT,
  PEOPLE_TREE_SCALE_DEFAULT_VIEW_DESKTOP,
  PEOPLE_TREE_SCALE_MAX,
  PEOPLE_TREE_SCALE_MIN,
  PEOPLE_TREE_ZOOM_STEP,
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

  it("uses asymmetric margins for pan bounds", () => {
    const bounds = computePeopleTreePanBounds(400, 300, 900, 500, {
      top: 12,
      side: 12,
      bottom: 40,
      bottomExtra: 160,
    });
    expect(bounds.maxX).toBe(12);
    expect(bounds.maxY).toBe(12);
    expect(bounds.minX).toBe(400 - 900 - 12);
    expect(bounds.minY).toBe(300 - 500 - 40 - 160);
  });

  it("top align frames content top near viewport top inset", () => {
    const pan = computePeopleTreeInitialPan(
      400,
      300,
      900,
      500,
      450,
      200,
      1,
      { top: 12, side: 12, bottom: 40 },
      undefined,
      "top",
      80,
    );
    expect(pan.y).toBe(12 - 80);
    expect(pan.x).toBe(200 - 450);
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

  it("default scale is 3 zoom-out notches below legacy 0.6", () => {
    expect(PEOPLE_TREE_SCALE_DEFAULT).toBeCloseTo(0.6 / PEOPLE_TREE_ZOOM_STEP ** 3, 6);
  });

  it("desktop view default is 3 zoom-in notches above mobile default", () => {
    expect(PEOPLE_TREE_SCALE_DEFAULT_VIEW_DESKTOP).toBeCloseTo(0.6, 6);
    expect(PEOPLE_TREE_SCALE_DEFAULT_VIEW_DESKTOP).toBeCloseTo(
      PEOPLE_TREE_SCALE_DEFAULT * PEOPLE_TREE_ZOOM_STEP ** 3,
      6,
    );
  });
});
