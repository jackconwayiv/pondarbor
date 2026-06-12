import { describe, expect, it } from "vitest";

import { createDefaultClicker2State } from "./api";
import { FAE_PORTAL_SPECIALTY_ID } from "./fossilShop";
import {
  offlineBonusParams,
  settleOfflineEnergyOnLoad,
} from "./offlineEarnings";

describe("offlineEarnings", () => {
  it("returns null when Fae Portal is not owned", () => {
    expect(offlineBonusParams({})).toBeNull();
  });

  it("returns Fae Portal params when owned", () => {
    expect(
      offlineBonusParams({ [FAE_PORTAL_SPECIALTY_ID]: true }),
    ).toEqual({ epsPercent: 5, maxMinutes: 60 });
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
      owned_specialties: { [FAE_PORTAL_SPECIALTY_ID]: true },
      last_active_at_ms: 0,
    };
    const result = settleOfflineEnergyOnLoad(state, 1000, 1_000_600_000);
    expect(result.bonusEnergy).toBe(0);
  });

  it("grants proportional bonus for 10 min away at 5% EpS", () => {
    const state = {
      ...createDefaultClicker2State(),
      owned_specialties: { [FAE_PORTAL_SPECIALTY_ID]: true },
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

  it("caps bonus at 60 minutes offline", () => {
    const state = {
      ...createDefaultClicker2State(),
      owned_specialties: { [FAE_PORTAL_SPECIALTY_ID]: true },
      last_active_at_ms: 1_000_000,
    };
    const twoHoursMs = 2 * 60 * 60_000;
    const result = settleOfflineEnergyOnLoad(
      state,
      1000,
      1_000_000 + twoHoursMs,
    );
    expect(result.bonusEnergy).toBe(180_000);
    expect(result.creditedMs).toBe(60 * 60_000);
  });

  it("grants proportional bonus for 30s away", () => {
    const state = {
      ...createDefaultClicker2State(),
      owned_specialties: { [FAE_PORTAL_SPECIALTY_ID]: true },
      last_active_at_ms: 1_000_000,
    };
    const result = settleOfflineEnergyOnLoad(state, 1000, 1_000_000 + 30_000);
    expect(result.bonusEnergy).toBe(1500);
  });
});
