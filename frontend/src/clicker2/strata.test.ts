import { describe, expect, it } from "vitest";

import {
  STRATUM_ENERGY_UNIT,
  energyToNextStratum,
  isStratumSystemUnlocked,
  stratumLevelFromAllTimeEnergy,
  stratumProgressToNext,
  stratumThresholdEnergy,
} from "./strata";

describe("strata", () => {
  it("uses 1 trillion as the cubic energy unit", () => {
    expect(STRATUM_ENERGY_UNIT).toBe(1_000_000_000_000);
  });

  it("maps cumulative thresholds to stratum levels", () => {
    expect(stratumThresholdEnergy(1)).toBe(1 * STRATUM_ENERGY_UNIT);
    expect(stratumThresholdEnergy(2)).toBe(8 * STRATUM_ENERGY_UNIT);
    expect(stratumThresholdEnergy(3)).toBe(27 * STRATUM_ENERGY_UNIT);
  });

  it("reaches Stratum 1 at 1T and Stratum 2 at 8T", () => {
    expect(stratumLevelFromAllTimeEnergy(STRATUM_ENERGY_UNIT - 1)).toBe(0);
    expect(stratumLevelFromAllTimeEnergy(STRATUM_ENERGY_UNIT)).toBe(1);
    expect(stratumLevelFromAllTimeEnergy(8 * STRATUM_ENERGY_UNIT - 1)).toBe(1);
    expect(stratumLevelFromAllTimeEnergy(8 * STRATUM_ENERGY_UNIT)).toBe(2);
  });

  it("requires 7T incremental energy from Stratum 1 to Stratum 2", () => {
    expect(energyToNextStratum(STRATUM_ENERGY_UNIT)).toBe(7 * STRATUM_ENERGY_UNIT);
  });

  it("computes progress midway between Stratum 1 and 2", () => {
    const midway = 4 * STRATUM_ENERGY_UNIT;
    expect(stratumProgressToNext(midway)).toBeCloseTo(3 / 7, 10);
  });

  it("tracks progress from zero toward Stratum 1", () => {
    expect(stratumProgressToNext(0)).toBe(0);
    expect(stratumProgressToNext(0.5 * STRATUM_ENERGY_UNIT)).toBeCloseTo(0.5, 10);
    expect(stratumProgressToNext(STRATUM_ENERGY_UNIT)).toBe(0);
  });

  it("unlocks the stratum system at 1T lifetime energy", () => {
    expect(isStratumSystemUnlocked(STRATUM_ENERGY_UNIT - 1)).toBe(false);
    expect(isStratumSystemUnlocked(STRATUM_ENERGY_UNIT)).toBe(true);
  });
});
