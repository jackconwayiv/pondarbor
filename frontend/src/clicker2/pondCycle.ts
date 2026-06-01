import type { Clicker2GameState } from "./api";
import { FIRST_DENIZEN_ID } from "./denizens";
import {
  cycleStartOwnedDenizens,
  FOSSIL_SHOP_SPECIALTY_IDS,
  STRATIFIED_POND_SPECIALTY_ID,
} from "./fossilShop";
import { isMutagenSystemUnlocked } from "./mutagens";
import { stratumLevelFromAllTimeEnergy } from "./strata";

export function unfossilizedStrataCount(
  allTimeEnergyEarned: number,
  fossilizedStrata: number,
): number {
  const level = stratumLevelFromAllTimeEnergy(allTimeEnergyEarned);
  return Math.max(0, level - Math.max(0, Math.floor(fossilizedStrata)));
}

export function fossilsGrantedOnCycle(
  allTimeEnergyEarned: number,
  fossilizedStrata: number,
): number {
  return unfossilizedStrataCount(allTimeEnergyEarned, fossilizedStrata);
}

function pruneOwnedSpecialtiesForCycle(
  owned: Record<number, boolean>,
): Record<number, boolean> {
  const next: Record<number, boolean> = {};
  for (const id of FOSSIL_SHOP_SPECIALTY_IDS) {
    if (owned[id]) next[id] = true;
  }
  return next;
}

function pruneSpecialtyAcquiredAtMs(
  acquired: Record<number, number>,
  keptIds: ReadonlySet<number>,
): Record<number, number> {
  const next: Record<number, number> = {};
  for (const [rawId, ms] of Object.entries(acquired)) {
    const id = Number(rawId);
    if (!keptIds.has(id) || typeof ms !== "number" || !Number.isFinite(ms)) {
      continue;
    }
    next[id] = ms;
  }
  return next;
}

/** Apply pond cycle reset/keep rules after the player confirms. */
export function applyPondCycle(
  state: Clicker2GameState,
  nowMs: number,
): Clicker2GameState {
  const allTime = state.statistics.all_time_energy_earned;
  const grant = fossilsGrantedOnCycle(allTime, state.fossilized_strata);
  const fossilized_strata = state.fossilized_strata + grant;
  const fossils = state.fossils + grant;
  const total_fossils_earned = state.total_fossils_earned + grant;

  const owned_specialties = pruneOwnedSpecialtiesForCycle(
    state.owned_specialties,
  );
  const keptSpecialtyIds = new Set([
    ...FOSSIL_SHOP_SPECIALTY_IDS.filter((id) => owned_specialties[id]),
  ]);
  const specialty_acquired_at_ms = pruneSpecialtyAcquiredAtMs(
    state.specialty_acquired_at_ms,
    keptSpecialtyIds,
  );

  const mutagenUnlocked = isMutagenSystemUnlocked(allTime);
  const mutagen_forming_started_at_ms = mutagenUnlocked ? nowMs : 0;

  return {
    ...state,
    energy: 0,
    owned_denizens: cycleStartOwnedDenizens(owned_specialties),
    owned_specialties,
    specialty_acquired_at_ms,
    revealed_denizens: { [FIRST_DENIZEN_ID]: true },
    pond_started_at_ms: nowMs,
    pond_era: state.pond_era + 1,
    next_weather_spawn_remaining_ms: 0,
    denizen_purchase_timeline: [],
    mutagen_forming_started_at_ms,
    fossils,
    total_fossils_earned,
    fossilized_strata,
    statistics: {
      ...state.statistics,
      era_energy_earned: 0,
      denizen_energy_earned: {},
    },
  };
}

/**
 * Saves written before pond-cycle flush ordering could keep spendable energy
 * after denizens were cleared. Clamp to zero for a post-cycle empty run.
 */
export function repairEnergyAfterPondCycle(
  state: Clicker2GameState,
): Clicker2GameState {
  if (state.pond_era <= 1) return state;
  if (state.energy === 0) return state;
  if (Object.keys(state.owned_denizens).length === 0) {
    return { ...state, energy: 0 };
  }
  const eraEnergy = state.statistics.era_energy_earned ?? 0;
  if (
    eraEnergy === 0 &&
    state.denizen_purchase_timeline.length === 0
  ) {
    return { ...state, energy: 0 };
  }
  return state;
}

export { STRATIFIED_POND_SPECIALTY_ID };
