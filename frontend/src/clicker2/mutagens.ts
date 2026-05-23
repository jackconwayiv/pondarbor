import { getDenizenDef, getDenizenIndex, type DenizenDef } from "./denizens";
import type { Clicker2GameState } from "./api";

export const MUTAGEN_UNLOCK_ALL_TIME_ENERGY = 1_000_000_000;
/** Real-world wall-clock formation time before a mutagen is collectible. */
export const MUTAGEN_FORMATION_MS = 20 * 60 * 60 * 1000;
export const MUTAGEN_MAX_LEVEL = 10;
export const MUTAGEN_EMOJI = "🧬";

const FUNGI_DENIZEN_INDEX = getDenizenIndex("fungi");

export type MutagenPipelineSlice = Pick<
  Clicker2GameState,
  "statistics" | "mutagens_bank" | "mutagen_forming_started_at_ms"
>;

export function isMutagenSystemUnlocked(allTimeEnergyEarned: number): boolean {
  return allTimeEnergyEarned >= MUTAGEN_UNLOCK_ALL_TIME_ENERGY;
}

export function isDenizenMutable(denizenId: string): boolean {
  const index = getDenizenIndex(denizenId);
  return index >= FUNGI_DENIZEN_INDEX && index >= 0;
}

export function getMutationLevel(
  levels: Record<string, number>,
  denizenId: string,
): number {
  const v = levels[denizenId];
  if (typeof v !== "number" || !Number.isFinite(v)) return 0;
  return Math.min(MUTAGEN_MAX_LEVEL, Math.max(0, Math.floor(v)));
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

/** After load: start formation timer if player already at 1B+ with no active pipeline. */
export function bootstrapMutagenPipelineOnLoad(
  state: Clicker2GameState,
  nowMs: number,
): Pick<Clicker2GameState, "mutagens_bank" | "mutagen_forming_started_at_ms"> {
  const slice = ensureMutagenPipelineStarted(
    {
      statistics: state.statistics,
      mutagens_bank: state.mutagens_bank,
      mutagen_forming_started_at_ms: state.mutagen_forming_started_at_ms,
    },
    nowMs,
  );
  return {
    mutagens_bank: slice.mutagens_bank,
    mutagen_forming_started_at_ms: slice.mutagen_forming_started_at_ms,
  };
}

export function formatMutagenCountdown(msRemaining: number): string {
  const totalSec = Math.ceil(msRemaining / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}
