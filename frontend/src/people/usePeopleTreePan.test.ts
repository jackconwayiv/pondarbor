import { describe, expect, it } from "vitest";

import {
  clampPeopleTreePan,
  computePeopleTreeInitialPan,
  computePeopleTreePanBounds,
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

  it("top-aligns tall content instead of vertically centering focus", () => {
    const pan = computePeopleTreeInitialPan(400, 300, 900, 500, 450, 24, 40);
    expect(pan.y).toBe(16);
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
});
