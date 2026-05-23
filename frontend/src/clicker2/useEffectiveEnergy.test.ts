import { describe, expect, it } from "vitest";

import {
  computeEffectiveEnergy,
  computeEffectiveEnergyAtBlusterEnd,
} from "./useEffectiveEnergy";

describe("computeEffectiveEnergy", () => {
  it("drifts linearly with EpS from anchor", () => {
    const anchor = 1000;
    expect(computeEffectiveEnergy(100, 10, anchor, anchor)).toBe(100);
    expect(computeEffectiveEnergy(100, 10, anchor, anchor + 5000)).toBe(150);
    expect(computeEffectiveEnergy(100, 10, anchor, anchor + 10_000)).toBe(200);
  });

  it("does not drift backward before anchor", () => {
    expect(computeEffectiveEnergy(50, 100, 2000, 1000)).toBe(50);
  });
});

describe("computeEffectiveEnergyAtBlusterEnd", () => {
  it("uses boosted EpS through boost end time", () => {
    const anchor = 0;
    const baseEps = 100;
    const boostUntil = 60_000;
    const mult = 5;
    const frozen = computeEffectiveEnergyAtBlusterEnd(
      0,
      baseEps,
      anchor,
      boostUntil,
      mult,
    );
    expect(frozen).toBe(30_000);
    expect(
      computeEffectiveEnergy(frozen, baseEps, boostUntil, boostUntil + 1000),
    ).toBe(30_100);
  });
});

describe("re-anchor invariant", () => {
  it("over-counts passive gain if EpS rises without re-anchor", () => {
    const anchor = 0;
    const at5s = 5000;
    const at10s = 10_000;
    const earnedAt5 = computeEffectiveEnergy(0, 10, anchor, at5s);
    expect(earnedAt5).toBe(50);
    const wrongAt10 = computeEffectiveEnergy(0, 20, anchor, at10s);
    const rightAt10 = computeEffectiveEnergy(earnedAt5, 20, at5s, at10s);
    expect(wrongAt10).toBe(200);
    expect(rightAt10).toBe(150);
    expect(wrongAt10).toBeGreaterThan(rightAt10);
  });
});
