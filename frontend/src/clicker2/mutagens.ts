import { getDenizenDef, getDenizenIndex, type DenizenDef } from "./denizens";
import type { Clicker2GameState } from "./api";

export const MUTAGEN_UNLOCK_ALL_TIME_ENERGY = 1_000_000_000;
/** Real-world wall-clock formation time before a mutagen is collectible. */
export const MUTAGEN_FORMATION_MS = 20 * 60 * 60 * 1000;
/** After collectible, manual Collect is available for this long before auto-collect. */
export const MUTAGEN_AUTO_COLLECT_GRACE_MS = 4 * 60 * 60 * 1000;
export const MUTAGEN_MAX_LEVEL = 10;
export const MUTAGEN_EMOJI = "🧬";

export type MutagenPipelineSlice = Pick<
  Clicker2GameState,
  "statistics" | "mutagens_bank" | "mutagen_forming_started_at_ms"
>;

export function isMutagenSystemUnlocked(allTimeEnergyEarned: number): boolean {
  return allTimeEnergyEarned >= MUTAGEN_UNLOCK_ALL_TIME_ENERGY;
}

/** All catalog denizens (ripples through transcendence) can be leveled with mutagen. */
export function isDenizenMutable(denizenId: string): boolean {
  return getDenizenIndex(denizenId) >= 0;
}

export function getMutationLevel(
  levels: Record<string, number>,
  denizenId: string,
): number {
  const v = levels[denizenId];
  if (typeof v !== "number" || !Number.isFinite(v)) return 0;
  return Math.min(MUTAGEN_MAX_LEVEL, Math.max(0, Math.floor(v)));
}

/** True after the player has spent at least one mutagen on any denizen. */
export function hasSpentAnyMutagen(
  levels: Record<string, number>,
): boolean {
  for (const v of Object.values(levels)) {
    if (typeof v === "number" && Number.isFinite(v) && v > 0) {
      return true;
    }
  }
  return false;
}

export function shouldShowDenizenMutationLevel(
  denizenId: string,
  owned: number,
  levels: Record<string, number>,
  mutagenUnlocked: boolean,
): boolean {
  return (
    mutagenUnlocked &&
    isDenizenMutable(denizenId) &&
    owned > 0 &&
    hasSpentAnyMutagen(levels)
  );
}

/** Mutagens required to advance from `level` to `level + 1`. */
export function mutagenCostForNextLevel(level: number): number {
  const L = Math.max(0, Math.min(MUTAGEN_MAX_LEVEL, Math.floor(level)));
  if (L >= MUTAGEN_MAX_LEVEL) return 0;
  return L + 1;
}

/** Total mutagens spent to reach `level` (sum 1..level). */
export function totalMutagensSpentForLevel(level: number): number {
  const L = Math.max(0, Math.min(MUTAGEN_MAX_LEVEL, Math.floor(level)));
  return (L * (L + 1)) / 2;
}

export function mutagenCollectibleAtMs(formingStartedAtMs: number): number {
  return formingStartedAtMs + MUTAGEN_FORMATION_MS;
}

export function isMutagenCollectible(
  formingStartedAtMs: number,
  nowMs: number,
): boolean {
  return (
    formingStartedAtMs > 0 && nowMs >= mutagenCollectibleAtMs(formingStartedAtMs)
  );
}

export function msUntilMutagenCollectible(
  formingStartedAtMs: number,
  nowMs: number,
): number {
  if (formingStartedAtMs <= 0) return MUTAGEN_FORMATION_MS;
  return Math.max(0, mutagenCollectibleAtMs(formingStartedAtMs) - nowMs);
}

export function mutagenAutoCollectAtMs(formingStartedAtMs: number): number {
  return formingStartedAtMs + MUTAGEN_FORMATION_MS + MUTAGEN_AUTO_COLLECT_GRACE_MS;
}

export function msUntilMutagenAutoCollect(
  formingStartedAtMs: number,
  nowMs: number,
): number {
  if (formingStartedAtMs <= 0) return Number.POSITIVE_INFINITY;
  return Math.max(0, mutagenAutoCollectAtMs(formingStartedAtMs) - nowMs);
}

export function autoCollectMutagen(
  slice: MutagenPipelineSlice,
  nowMs: number,
): MutagenPipelineSlice | null {
  const started = ensureMutagenPipelineStarted(slice, nowMs);
  const formingStarted = started.mutagen_forming_started_at_ms;
  if (formingStarted <= 0) return null;
  const autoAt = mutagenAutoCollectAtMs(formingStarted);
  if (nowMs < autoAt) return null;
  return {
    ...started,
    mutagens_bank: started.mutagens_bank + 1,
    mutagen_forming_started_at_ms: autoAt,
  };
}

export type MutagenPipelineState = MutagenPipelineSlice & {
  total_mutagens_acquired: number;
};

export type SettleMutagenPipelineResult = MutagenPipelineState & {
  completedCount: number;
};

/** Fast-forward pipeline for offline time; auto-collects only after grace expires. */
export function settleMutagenPipeline(
  slice: MutagenPipelineState,
  nowMs: number,
): SettleMutagenPipelineResult {
  if (!isMutagenSystemUnlocked(slice.statistics.all_time_energy_earned)) {
    return { ...slice, completedCount: 0 };
  }

  let bank = slice.mutagens_bank;
  let started = slice.mutagen_forming_started_at_ms;
  let totalAcquired = slice.total_mutagens_acquired;
  let completed = 0;

  if (started <= 0) {
    return { ...slice, completedCount: 0 };
  }

  while (true) {
    const collectibleAt = mutagenCollectibleAtMs(started);
    const autoAt = mutagenAutoCollectAtMs(started);

    if (nowMs < collectibleAt) break;

    if (nowMs >= autoAt) {
      completed += 1;
      bank += 1;
      totalAcquired += 1;
      started = autoAt;
      continue;
    }

    break;
  }

  return {
    ...slice,
    mutagens_bank: bank,
    mutagen_forming_started_at_ms: started,
    total_mutagens_acquired: totalAcquired,
    completedCount: completed,
  };
}

export function ensureMutagenPipelineStarted(
  slice: MutagenPipelineSlice,
  nowMs: number,
): MutagenPipelineSlice {
  if (!isMutagenSystemUnlocked(slice.statistics.all_time_energy_earned)) {
    return slice;
  }
  if (slice.mutagen_forming_started_at_ms > 0) {
    return slice;
  }
  return {
    ...slice,
    mutagen_forming_started_at_ms: nowMs,
  };
}

export function collectMutagen(
  slice: MutagenPipelineSlice,
  nowMs: number,
): MutagenPipelineSlice | null {
  const started = ensureMutagenPipelineStarted(slice, nowMs);
  if (!isMutagenCollectible(started.mutagen_forming_started_at_ms, nowMs)) {
    return null;
  }
  return {
    ...started,
    mutagens_bank: started.mutagens_bank + 1,
    mutagen_forming_started_at_ms: nowMs,
  };
}

export function canMutateDenizen(
  def: DenizenDef,
  owned: number,
  mutationLevel: number,
  mutagensBank: number,
): boolean {
  if (!isDenizenMutable(def.id)) return false;
  if (owned <= 0) return false;
  const level = Math.max(0, Math.floor(mutationLevel));
  if (level >= MUTAGEN_MAX_LEVEL) return false;
  return mutagensBank >= mutagenCostForNextLevel(level);
}

export type MutationApplyResult = {
  mutagens_bank: number;
  denizen_mutation_levels: Record<string, number>;
};

export function applyMutation(
  state: Pick<Clicker2GameState, "mutagens_bank" | "denizen_mutation_levels">,
  denizenId: string,
  owned: number,
): MutationApplyResult | null {
  const def = getDenizenDef(denizenId);
  if (!def) return null;
  const level = getMutationLevel(state.denizen_mutation_levels, denizenId);
  if (!canMutateDenizen(def, owned, level, state.mutagens_bank)) {
    return null;
  }
  const cost = mutagenCostForNextLevel(level);
  return {
    mutagens_bank: state.mutagens_bank - cost,
    denizen_mutation_levels: {
      ...state.denizen_mutation_levels,
      [denizenId]: level + 1,
    },
  };
}

export function normalizeDenizenMutationLevels(
  raw: unknown,
): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (getDenizenIndex(k) < 0) continue;
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    const level = Math.floor(v);
    if (level > 0) {
      out[k] = Math.min(MUTAGEN_MAX_LEVEL, level);
    }
  }
  return out;
}

/** After load: start pipeline if needed, then settle offline mutagen progress. */
export function bootstrapMutagenPipelineOnLoad(
  state: Clicker2GameState,
  nowMs: number,
): Pick<
  Clicker2GameState,
  "mutagens_bank" | "mutagen_forming_started_at_ms" | "total_mutagens_acquired"
> & { completedCount: number } {
  const ensured = ensureMutagenPipelineStarted(
    {
      statistics: state.statistics,
      mutagens_bank: state.mutagens_bank,
      mutagen_forming_started_at_ms: state.mutagen_forming_started_at_ms,
    },
    nowMs,
  );
  const settled = settleMutagenPipeline(
    {
      ...ensured,
      total_mutagens_acquired: state.total_mutagens_acquired,
    },
    nowMs,
  );
  return {
    mutagens_bank: settled.mutagens_bank,
    mutagen_forming_started_at_ms: settled.mutagen_forming_started_at_ms,
    total_mutagens_acquired: settled.total_mutagens_acquired,
    completedCount: settled.completedCount,
  };
}

const MUTAGEN_FORMING_HOUR_MS = 60 * 60 * 1000;

/** Flavor text for the mutagen panel by hours remaining (20h formation window). */
export function mutagenFormingStatusMessage(msRemaining: number): string {
  const ms = Math.max(0, msRemaining);
  if (ms > 15 * MUTAGEN_FORMING_HOUR_MS) {
    return "A new mutation is beginning to take shape...";
  }
  if (ms > 10 * MUTAGEN_FORMING_HOUR_MS) {
    return "A new mutation is taking shape...";
  }
  if (ms > 5 * MUTAGEN_FORMING_HOUR_MS) {
    return "A new mutation is nearly here...";
  }
  return "A new mutation is imminent...";
}

/** Countdown copy for the mutagen panel second line while forming. */
export function mutagenReadyInMessage(msRemaining: number): string {
  const ms = Math.max(0, msRemaining);
  if (ms >= MUTAGEN_FORMING_HOUR_MS) {
    const hours = Math.ceil(ms / MUTAGEN_FORMING_HOUR_MS);
    return hours === 1
      ? "It will be ready in 1 hour."
      : `It will be ready in ${hours} hours.`;
  }
  const minutes = Math.max(1, Math.ceil(ms / (60 * 1000)));
  return minutes === 1
    ? "It will be ready in 1 minute."
    : `It will be ready in ${minutes} minutes.`;
}

/** Ms until the forming message phase changes, or until collectible (0). */
export function msUntilNextMutagenFormingUiTick(msRemaining: number): number {
  const ms = Math.max(0, msRemaining);
  if (ms === 0) return 60_000;
  const phaseThresholds = [
    15 * MUTAGEN_FORMING_HOUR_MS,
    10 * MUTAGEN_FORMING_HOUR_MS,
    5 * MUTAGEN_FORMING_HOUR_MS,
    0,
  ];
  for (const threshold of phaseThresholds) {
    if (ms > threshold) {
      return Math.max(1_000, ms - threshold);
    }
  }
  return Math.max(1_000, ms);
}
