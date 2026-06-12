import type { Clicker2GameState } from "./api";
import { FIRST_DENIZEN_ID } from "./denizens";
import {
  cycleStartOwnedDenizens,
  FOSSIL_SHOP_SPECIALTY_IDS,
  mergeCycleStartOwnedDenizens,
  STRATIFIED_POND_SPECIALTY_ID,
} from "./fossilShop";
import { isMutagenSystemUnlocked } from "./mutagens";
import {
  applyPetroglyphsOnCycleStart,
  capturePetroglyphEtchPool,
} from "./petroglyphs";
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

/** Convert unfossilized strata to spendable fossils (once per pond cycle). */
export function grantFossilsFromUnfossilizedStrata(
  state: Clicker2GameState,
): Clicker2GameState {
  const allTime = state.statistics.all_time_energy_earned;
  const grant = fossilsGrantedOnCycle(allTime, state.fossilized_strata);
  if (grant <= 0) return state;
  return {
    ...state,
    fossils: state.fossils + grant,
    fossilized_strata: state.fossilized_strata + grant,
    total_fossils_earned: state.total_fossils_earned + grant,
  };
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
  const afterFossils = grantFossilsFromUnfossilizedStrata(state);
  const { fossils, fossilized_strata, total_fossils_earned } = afterFossils;

  const petroglyph_etch_pool = capturePetroglyphEtchPool(
    state.owned_specialties,
  );
  const owned_specialties = pruneOwnedSpecialtiesForCycle(
    state.owned_specialties,
  );
  const petroglyphGrant = applyPetroglyphsOnCycleStart(
    owned_specialties,
    state.specialty_acquired_at_ms,
    state.petroglyph_slots,
  );
  Object.assign(owned_specialties, petroglyphGrant.owned_specialties);
  const specialty_acquired_at_ms = pruneSpecialtyAcquiredAtMs(
    petroglyphGrant.specialty_acquired_at_ms,
    new Set([
      ...FOSSIL_SHOP_SPECIALTY_IDS.filter((id) => owned_specialties[id]),
      ...state.petroglyph_slots
        .map((slot) => slot.etched_specialty_id)
        .filter((id): id is number => id != null),
    ]),
  );

  const mutagenUnlocked = isMutagenSystemUnlocked(
    state.statistics.all_time_energy_earned,
  );
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
    petroglyph_etch_pool,
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
  const withCycleStartDenizens = repairCycleStartOwnedDenizens(state);
  if (withCycleStartDenizens.pond_era <= 1) return withCycleStartDenizens;
  if (withCycleStartDenizens.energy === 0) return withCycleStartDenizens;
  if (Object.keys(withCycleStartDenizens.owned_denizens).length === 0) {
    return { ...withCycleStartDenizens, energy: 0 };
  }
  const eraEnergy = withCycleStartDenizens.statistics.era_energy_earned ?? 0;
  if (
    eraEnergy === 0 &&
    withCycleStartDenizens.denizen_purchase_timeline.length === 0
  ) {
    return { ...withCycleStartDenizens, energy: 0 };
  }
  return withCycleStartDenizens;
}

/** Backfill cycle-start denizens when a fossil shop bonus was acquired after the pond reset ran. */
export function repairCycleStartOwnedDenizens(
  state: Clicker2GameState,
): Clicker2GameState {
  const owned_denizens = mergeCycleStartOwnedDenizens(
    state.owned_denizens,
    state.owned_specialties,
  );
  if (owned_denizens === state.owned_denizens) return state;
  return { ...state, owned_denizens };
}

export function isPondCycleInterstitial(state: Clicker2GameState): boolean {
  return state.pond_cycle_interstitial === true;
}

/** True when a mid-cycle save still has pre-cycle run state that must be flushed. */
export function pondCycleResetStillPending(state: Clicker2GameState): boolean {
  if (!isPondCycleInterstitial(state)) return false;
  if (Object.keys(state.owned_denizens).length > 0) return true;
  if ((state.statistics.era_energy_earned ?? 0) > 0) return true;
  if (state.denizen_purchase_timeline.length > 0) return true;
  return false;
}

/** Repair saves that entered the fossil shop but never persisted the pond reset. */
export function repairMidCycleInterstitialState(
  state: Clicker2GameState,
  nowMs: number,
): Clicker2GameState {
  if (!pondCycleResetStillPending(state)) return state;
  return {
    ...applyPondCycle(state, nowMs),
    pond_cycle_interstitial: true,
  };
}

export { STRATIFIED_POND_SPECIALTY_ID };
