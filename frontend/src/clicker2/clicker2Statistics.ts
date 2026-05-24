import type { Clicker2Statistics } from "./api";
import type { simulateGame } from "./simulation";
import { computeEffectiveEnergy } from "./useEffectiveEnergy";

type PassiveSim = ReturnType<typeof simulateGame>;

/** Lifetime gross energy including passive drift since the last statistics anchor. */
export function effectiveAllTimeEnergyEarned(
  stats: Clicker2Statistics,
  passiveEps: number,
  passiveAnchorMs: number,
  nowMs: number = performance.now(),
): number {
  return computeEffectiveEnergy(
    stats.all_time_energy_earned ?? 0,
    passiveEps,
    passiveAnchorMs,
    nowMs,
  );
}

/** One-shot gross energy (sun bonus, etc.) into era and all-time totals. */
export function accrueGrossEnergyBonus(
  stats: Clicker2Statistics,
  amount: number,
): Clicker2Statistics {
  if (amount <= 0) return stats;
  return {
    ...stats,
    era_energy_earned: (stats.era_energy_earned ?? 0) + amount,
    all_time_energy_earned: (stats.all_time_energy_earned ?? 0) + amount,
  };
}

/** Accrue one second of passive energy into statistics (mutates via new object in ref). */
export function accruePassiveStatistics(
  stats: Clicker2Statistics,
  passiveEps: number,
  sim: Pick<PassiveSim, "energyPerSecond" | "denizenEps">,
): Clicker2Statistics {
  if (passiveEps <= 0) return stats;

  const denizen_energy_earned = { ...stats.denizen_energy_earned };
  for (const [denizenId, dEps] of Object.entries(sim.denizenEps)) {
    if (dEps > 0) {
      const scaled =
        dEps * (passiveEps / Math.max(sim.energyPerSecond, 1));
      denizen_energy_earned[denizenId] =
        (denizen_energy_earned[denizenId] ?? 0) + scaled;
    }
  }

  return {
    ...stats,
    era_energy_earned: (stats.era_energy_earned ?? 0) + passiveEps,
    all_time_energy_earned: (stats.all_time_energy_earned ?? 0) + passiveEps,
    denizen_energy_earned,
  };
}
