import { describe, expect, it } from "vitest";

import {
  elbowPoint,
  parentChildPath,
  partnerPath,
  petLeashPath,
  petLeashPaths,
} from "./peopleTreeLayout";

describe("peopleTreeLayout paths", () => {
  it("builds orthogonal parent-child path", () => {
    const d = parentChildPath({ x: 10, y: 20 }, { x: 50, y: 80 });
    expect(d).toContain("M 10 20");
    expect(d).toContain("50 80");
  });

  it("builds horizontal partner path", () => {
    const d = partnerPath({ x: 0, y: 10 }, { x: 100, y: 12 });
    expect(d).toMatch(/^M 0 11 L 100 11$/);
  });

  it("places elbow at child x and mid y", () => {
    const e = elbowPoint({ x: 10, y: 0 }, { x: 40, y: 100 });
    expect(e).toEqual({ x: 40, y: 50 });
  });

  it("builds triangle handle, solid drop, and collar circle", () => {
    const parts = petLeashPaths({ x: 20, y: 10 }, { x: 60, y: 90 });
    expect(parts.handle).toContain("Z");
    expect(parts.drop).toMatch(/^M 20 23 Q/);
    expect(parts.collar).toContain("A 6 6");
    expect(petLeashPath({ x: 20, y: 10 }, { x: 60, y: 90 })).not.toContain("3 2");
  });
});
