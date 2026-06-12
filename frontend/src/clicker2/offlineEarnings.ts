import type { Clicker2GameState } from "./api";
import { accrueGrossEnergyBonus } from "./clicker2Statistics";
import { FAE_PORTAL_SPECIALTY_ID } from "./fossilShop";
import { isPondCycleInterstitial } from "./pondCycle";
import { getSpecialtyDef } from "./specialties";

export type OfflineBonusParams = {
  epsPercent: number;
  dippedEpsPercent: number;
  maxMinutes: number;
};

function specialtyEffects(
  def: NonNullable<ReturnType<typeof getSpecialtyDef>>,
): readonly NonNullable<ReturnType<typeof getSpecialtyDef>>["effect"][] {
  return def.effects ?? [def.effect];
}

export function offlineBonusParams(
  ownedSpecialties: Record<number, boolean>,
): OfflineBonusParams | null {
  if (!ownedSpecialties[FAE_PORTAL_SPECIALTY_ID]) return null;
  const faeDef = getSpecialtyDef(FAE_PORTAL_SPECIALTY_ID);
  if (!faeDef) return null;

  let epsPercent: number | null = null;
  let maxMinutes: number | null = null;
  for (const effect of specialtyEffects(faeDef)) {
    if (effect.type === "offline_eps_bonus") {
      epsPercent = effect.epsPercent;
      maxMinutes = effect.maxMinutes;
      break;
    }
  }
  if (epsPercent == null || maxMinutes == null) return null;

  for (const [idStr, owned] of Object.entries(ownedSpecialties)) {
    if (!owned) continue;
    const id = Number(idStr);
    if (id === FAE_PORTAL_SPECIALTY_ID) continue;
    const def = getSpecialtyDef(id);
    if (!def) continue;
    for (const effect of specialtyEffects(def)) {
      if (effect.type === "offline_eps_bonus_percent_add") {
        epsPercent += effect.addPercent;
      } else if (effect.type === "offline_eps_bonus_max_minutes") {
        maxMinutes = Math.max(maxMinutes, effect.maxMinutes);
      }
    }
  }

  return {
    epsPercent,
    dippedEpsPercent: epsPercent / 10,
    maxMinutes,
  };
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
  if (isPondCycleInterstitial(state)) {
    return {
      state: { ...state, last_active_at_ms: nowMs },
      bonusEnergy: 0,
      creditedMs: 0,
    };
  }

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
    const fullRateMs = Math.min(offlineMs, maxMs);
    const dippedMs = Math.max(0, offlineMs - maxMs);
    creditedMs = offlineMs;
    if (creditedMs > 0) {
      bonusEnergy =
        (fullRateMs / 1000) *
          energyPerSecond *
          (params.epsPercent / 100) +
        (dippedMs / 1000) *
          energyPerSecond *
          (params.dippedEpsPercent / 100);
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
