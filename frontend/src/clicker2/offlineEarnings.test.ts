import { describe, expect, it } from "vitest";

import { createDefaultClicker2State } from "./api";
import {
  FAE_PORTAL_SPECIALTY_ID,
  GNOMES_SPECIALTY_ID,
  GREMLINS_SPECIALTY_ID,
  IMPS_SPECIALTY_ID,
  PIXIES_SPECIALTY_ID,
} from "./fossilShop";
import {
  offlineBonusParams,
  settleOfflineEnergyOnLoad,
} from "./offlineEarnings";

const faeOnly = { [FAE_PORTAL_SPECIALTY_ID]: true };
const fullStack = {
  [FAE_PORTAL_SPECIALTY_ID]: true,
  [PIXIES_SPECIALTY_ID]: true,
  [IMPS_SPECIALTY_ID]: true,
  [GNOMES_SPECIALTY_ID]: true,
  [GREMLINS_SPECIALTY_ID]: true,
};

describe("offlineEarnings", () => {
  it("returns null when Fae Portal is not owned", () => {
    expect(offlineBonusParams({})).toBeNull();
  });

  it("returns Fae Portal params when owned", () => {
    expect(offlineBonusParams(faeOnly)).toEqual({
      epsPercent: 5,
      dippedEpsPercent: 0.5,
      maxMinutes: 60,
    });
  });

  it("aggregates Pixies and Imps branch upgrades", () => {
    expect(
      offlineBonusParams({
        ...faeOnly,
        [PIXIES_SPECIALTY_ID]: true,
      }),
    ).toEqual({ epsPercent: 15, dippedEpsPercent: 1.5, maxMinutes: 60 });
    expect(
      offlineBonusParams({
        ...faeOnly,
        [IMPS_SPECIALTY_ID]: true,
      }),
    ).toEqual({ epsPercent: 5, dippedEpsPercent: 0.5, maxMinutes: 120 });
    expect(
      offlineBonusParams({
        ...faeOnly,
        [PIXIES_SPECIALTY_ID]: true,
        [IMPS_SPECIALTY_ID]: true,
      }),
    ).toEqual({ epsPercent: 15, dippedEpsPercent: 1.5, maxMinutes: 120 });
    expect(
      offlineBonusParams({
        ...faeOnly,
        [PIXIES_SPECIALTY_ID]: true,
        [GNOMES_SPECIALTY_ID]: true,
      }),
    ).toEqual({ epsPercent: 25, dippedEpsPercent: 2.5, maxMinutes: 60 });
    expect(
      offlineBonusParams({
        ...faeOnly,
        [IMPS_SPECIALTY_ID]: true,
        [GREMLINS_SPECIALTY_ID]: true,
      }),
    ).toEqual({ epsPercent: 5, dippedEpsPercent: 0.5, maxMinutes: 240 });
    expect(offlineBonusParams(fullStack)).toEqual({
      epsPercent: 25,
      dippedEpsPercent: 2.5,
      maxMinutes: 240,
    });
  });

  it("grants zero bonus without Fae Portal", () => {
    const state = {
      ...createDefaultClicker2State(),
      last_active_at_ms: 1_000_000,
    };
    const result = settleOfflineEnergyOnLoad(state, 1000, 1_000_000 + 600_000);
    expect(result.bonusEnergy).toBe(0);
    expect(result.state.last_active_at_ms).toBe(1_600_000);
  });

  it("grants zero bonus when last_active_at_ms is unset", () => {
    const state = {
      ...createDefaultClicker2State(),
      owned_specialties: faeOnly,
      last_active_at_ms: 0,
    };
    const result = settleOfflineEnergyOnLoad(state, 1000, 1_000_600_000);
    expect(result.bonusEnergy).toBe(0);
  });

  it("grants proportional bonus for 10 min away at 5% EpS", () => {
    const state = {
      ...createDefaultClicker2State(),
      owned_specialties: faeOnly,
      last_active_at_ms: 1_000_000,
      energy: 100,
    };
    const result = settleOfflineEnergyOnLoad(
      state,
      1000,
      1_000_000 + 10 * 60_000,
    );
    expect(result.bonusEnergy).toBe(30_000);
    expect(result.state.energy).toBe(100 + 30_000);
    expect(result.state.statistics.all_time_energy_earned).toBe(30_000);
  });

  it("earns full rate then dipped rate after the offline window", () => {
    const state = {
      ...createDefaultClicker2State(),
      owned_specialties: faeOnly,
      last_active_at_ms: 1_000_000,
    };
    const twoHoursMs = 2 * 60 * 60_000;
    const result = settleOfflineEnergyOnLoad(
      state,
      1000,
      1_000_000 + twoHoursMs,
    );
    expect(result.bonusEnergy).toBe(198_000);
    expect(result.creditedMs).toBe(twoHoursMs);
  });

  it("settles full stack with four hours at full rate then dipped rate", () => {
    const state = {
      ...createDefaultClicker2State(),
      owned_specialties: fullStack,
      last_active_at_ms: 1_000_000,
    };
    const fiveHoursMs = 5 * 60 * 60_000;
    const result = settleOfflineEnergyOnLoad(
      state,
      1000,
      1_000_000 + fiveHoursMs,
    );
    const fourHoursBonus = 4 * 60 * 60 * 1000 * 0.25;
    const oneHourDippedBonus = 60 * 60 * 1000 * 0.025;
    expect(result.bonusEnergy).toBe(fourHoursBonus + oneHourDippedBonus);
    expect(result.creditedMs).toBe(fiveHoursMs);
  });

  it("grants proportional bonus for 30s away", () => {
    const state = {
      ...createDefaultClicker2State(),
      owned_specialties: faeOnly,
      last_active_at_ms: 1_000_000,
    };
    const result = settleOfflineEnergyOnLoad(state, 1000, 1_000_000 + 30_000);
    expect(result.bonusEnergy).toBe(1500);
  });

  it("skips offline bonus while the fossil shop interstitial is open", () => {
    const state = {
      ...createDefaultClicker2State(),
      owned_specialties: faeOnly,
      pond_cycle_interstitial: true,
      last_active_at_ms: 1_000_000,
    };
    const result = settleOfflineEnergyOnLoad(state, 1000, 1_000_000 + 600_000);
    expect(result.bonusEnergy).toBe(0);
    expect(result.state.last_active_at_ms).toBe(1_600_000);
  });
});
