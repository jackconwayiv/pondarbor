import type { Clicker2Statistics } from "./api";
import type { simulateGame } from "./simulation";

type PassiveSim = ReturnType<typeof simulateGame>;

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
