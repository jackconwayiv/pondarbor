import { describe, expect, it } from "vitest";

import {
  elbowPoint,
  parentChildPath,
  partnerPath,
  partnerPathBetween,
  petLeashPath,
  petLeashPaths,
  type PersonAnchor,
} from "./peopleTreeLayout";

function anchorAt(x: number, y: number, w: number, h: number): PersonAnchor {
  return {
    top: { x: x + w / 2, y },
    bottom: { x: x + w / 2, y: y + h },
    center: { x: x + w / 2, y: y + h / 2 },
    left: { x, y: y + h / 2 },
    right: { x: x + w, y: y + h / 2 },
  };
}

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

  it("partnerPathBetween uses shared row band when aligned", () => {
    const left = anchorAt(0, 100, 80, 80);
    const right = anchorAt(200, 105, 80, 80);
    const d = partnerPathBetween(left, right);
    expect(d).toMatch(/^M 80 [\d.]+ L 200 [\d.]+$/);
  });

  it("partnerPathBetween steps between rows when vertically separated", () => {
    const left = anchorAt(0, 0, 80, 80);
    const right = anchorAt(200, 200, 80, 80);
    const d = partnerPathBetween(left, right);
    expect(d).toContain("L 140 40");
    expect(d).toContain("L 140 240");
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
