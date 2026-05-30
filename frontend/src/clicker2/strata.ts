/** One cubic step in the Strata ladder (1 trillion all-time energy). */
export const STRATUM_ENERGY_UNIT = 1_000_000_000_000;

/** Cumulative all-time energy required to reach stratum `level` (level ≥ 1). */
export function stratumThresholdEnergy(level: number): number {
  if (level < 1) return 0;
  return level ** 3 * STRATUM_ENERGY_UNIT;
}

/** Highest stratum level achieved (0 = not yet at Stratum 1). */
export function stratumLevelFromAllTimeEnergy(allTimeEnergy: number): number {
  if (allTimeEnergy < STRATUM_ENERGY_UNIT) return 0;
  return Math.floor(Math.cbrt(allTimeEnergy / STRATUM_ENERGY_UNIT));
}

/** Lifetime energy still needed to reach the next stratum. */
export function energyToNextStratum(allTimeEnergy: number): number {
  const level = stratumLevelFromAllTimeEnergy(allTimeEnergy);
  const nextThreshold = stratumThresholdEnergy(level + 1);
  return Math.max(0, nextThreshold - allTimeEnergy);
}

/** Progress from current stratum floor toward the next (0..1). */
export function stratumProgressToNext(allTimeEnergy: number): number {
  const level = stratumLevelFromAllTimeEnergy(allTimeEnergy);
  const floor = level === 0 ? 0 : stratumThresholdEnergy(level);
  const ceiling = stratumThresholdEnergy(level + 1);
  if (ceiling <= floor) return 1;
  return Math.min(1, Math.max(0, (allTimeEnergy - floor) / (ceiling - floor)));
}

export function isStratumSystemUnlocked(allTimeEnergy: number): boolean {
  return stratumLevelFromAllTimeEnergy(allTimeEnergy) >= 1;
}

export function stratumProgressLabel(level: number): string {
  const n = Math.max(0, Math.floor(level));
  if (n === 1) return "1 Stratum";
  return `${n} Strata`;
}
