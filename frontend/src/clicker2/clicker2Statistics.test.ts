import { describe, expect, it } from "vitest";

import { createDefaultClicker2State } from "./api";
import {
  accrueGrossEnergyBonus,
  accruePassiveStatistics,
  effectiveAllTimeEnergyEarned,
} from "./clicker2Statistics";

describe("accruePassiveStatistics", () => {
  it("adds passive EpS to era and all-time totals", () => {
    const base = createDefaultClicker2State().statistics;
    const next = accruePassiveStatistics(
      base,
      42,
      { energyPerSecond: 42, denizenEps: { pond_snails: 42 } },
    );
    expect(next.era_energy_earned).toBe(42);
    expect(next.all_time_energy_earned).toBe(42);
    expect(next.denizen_energy_earned.pond_snails).toBe(42);
  });

  it("simulates ref lifecycle: repeated accrual without clobbering stale React state", () => {
    const staleReactStatistics = createDefaultClicker2State().statistics;
    let statisticsRef = { ...staleReactStatistics };

    const sim = { energyPerSecond: 100, denizenEps: { pond_snails: 100 } };
    for (let i = 0; i < 5; i++) {
      statisticsRef = accruePassiveStatistics(statisticsRef, 100, sim);
      // Buggy pattern: reset ref from stale React state each "render".
      statisticsRef = { ...staleReactStatistics };
    }

    expect(statisticsRef.all_time_energy_earned).toBe(0);

    statisticsRef = { ...staleReactStatistics };
    for (let i = 0; i < 5; i++) {
      statisticsRef = accruePassiveStatistics(statisticsRef, 100, sim);
    }

    expect(statisticsRef.all_time_energy_earned).toBe(500);
    expect(statisticsRef.era_energy_earned).toBe(500);
  });
});

describe("accrueGrossEnergyBonus", () => {
  it("adds instant bonus to era and all-time totals", () => {
    const base = createDefaultClicker2State().statistics;
    const next = accrueGrossEnergyBonus(base, 1_234);
    expect(next.era_energy_earned).toBe(1_234);
    expect(next.all_time_energy_earned).toBe(1_234);
  });

  it("persists through ref-style snapshot (sun bonus path)", () => {
    let statisticsRef = createDefaultClicker2State().statistics;
    const bonus = 9_876;
    statisticsRef = accrueGrossEnergyBonus(statisticsRef, bonus);

    const snapshotStatistics = statisticsRef;
    expect(snapshotStatistics.all_time_energy_earned).toBe(bonus);
    expect(snapshotStatistics.era_energy_earned).toBe(bonus);
  });
});

describe("effectiveAllTimeEnergyEarned", () => {
  it("includes passive drift since anchor", () => {
    const stats = {
      ...createDefaultClicker2State().statistics,
      all_time_energy_earned: 1_000,
    };
    const anchor = 0;
    const now = 5_000;
    expect(effectiveAllTimeEnergyEarned(stats, 10, anchor, now)).toBe(1_050);
  });
});
