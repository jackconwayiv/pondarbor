import type { Clicker2GameState } from "./api";
import { accrueGrossEnergyBonus } from "./clicker2Statistics";
import { FAE_PORTAL_SPECIALTY_ID } from "./fossilShop";
import { getSpecialtyDef } from "./specialties";

export type OfflineBonusParams = {
  epsPercent: number;
  maxMinutes: number;
};

export function offlineBonusParams(
  ownedSpecialties: Record<number, boolean>,
): OfflineBonusParams | null {
  if (!ownedSpecialties[FAE_PORTAL_SPECIALTY_ID]) return null;
  const def = getSpecialtyDef(FAE_PORTAL_SPECIALTY_ID);
  if (!def) return null;
  const effects = def.effects ?? [def.effect];
  for (const effect of effects) {
    if (effect.type === "offline_eps_bonus") {
      return {
        epsPercent: effect.epsPercent,
        maxMinutes: effect.maxMinutes,
      };
    }
  }
  return null;
}

export type SettleOfflineEnergyResult = {
  state: Clicker2GameState;
  bonusEnergy: number;
  creditedMs: number;
};

export function settleOfflineEnergyOnLoad(
  state: Clicker2GameState,
  energyPerSecond: number,
  nowMs: number,
): SettleOfflineEnergyResult {
  const params = offlineBonusParams(state.owned_specialties);
  let bonusEnergy = 0;
  let creditedMs = 0;

  if (
    params &&
    state.last_active_at_ms > 0 &&
    energyPerSecond > 0
  ) {
    const offlineMs = Math.max(0, nowMs - state.last_active_at_ms);
    const maxMs = params.maxMinutes * 60_000;
    creditedMs = Math.min(offlineMs, maxMs);
    if (creditedMs > 0) {
      bonusEnergy =
        (creditedMs / 1000) * energyPerSecond * (params.epsPercent / 100);
    }
  }

  const nextState: Clicker2GameState = {
    ...state,
    last_active_at_ms: nowMs,
    energy: state.energy + bonusEnergy,
    statistics:
      bonusEnergy > 0
        ? accrueGrossEnergyBonus(state.statistics, bonusEnergy)
        : state.statistics,
  };

  return { state: nextState, bonusEnergy, creditedMs };
}
