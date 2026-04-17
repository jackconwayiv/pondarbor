import {
  CATALOG_UPGRADES,
  effectiveOwnedStacks,
  getOwnedCount,
  nextPurchaseCost,
  type UpgradeDef,
  type UpgradeEffect,
} from "./catalog";
import { type ResourceBalances } from "./ruleEngine";

export function marginalRatesIfBuyNextTier(
  def: UpgradeDef,
  ownedUpgrades: Record<string, number>,
): ResourceBalances {
  const cur = simulateOwnedUpgrades(ownedUpgrades);
  const owned = getOwnedCount(ownedUpgrades, def.id);
  if (nextPurchaseCost(def, owned) === null) {
    return { energy: 0 };
  }
  const hypothetical = { ...ownedUpgrades, [def.id]: owned + 1 };
  const next = simulateOwnedUpgrades(hypothetical);
  return { energy: next.resourceRates.energy - cur.resourceRates.energy };
}

export function marginalClickIfBuyNextTier(
  def: UpgradeDef,
  ownedUpgrades: Record<string, number>,
): number {
  const cur = simulateOwnedUpgrades(ownedUpgrades);
  const owned = getOwnedCount(ownedUpgrades, def.id);
  if (nextPurchaseCost(def, owned) === null) return 0;
  const hypothetical = { ...ownedUpgrades, [def.id]: owned + 1 };
  const next = simulateOwnedUpgrades(hypothetical);
  return next.clickValue - cur.clickValue;
}

/**
 * Passive/click attributable to this upgrade vs removing it entirely (all stacks).
 * Used on **owned** chips. Shop cards use `marginalRatesIfBuyNextTier` / `marginalClickIfBuyNextTier` instead.
 */
export function upgradeContributionToEnergyAndClick(
  def: UpgradeDef,
  ownedUpgrades: Record<string, number>,
): { passivePerSec: number; clickPerClick: number } {
  const owned = getOwnedCount(ownedUpgrades, def.id);
  if (owned <= 0) {
    return {
      passivePerSec: marginalRatesIfBuyNextTier(def, ownedUpgrades).energy,
      clickPerClick: marginalClickIfBuyNextTier(def, ownedUpgrades),
    };
  }
  const full = simulateOwnedUpgrades(ownedUpgrades);
  const without = { ...ownedUpgrades, [def.id]: 0 };
  const wo = simulateOwnedUpgrades(without);
  return {
    passivePerSec: full.resourceRates.energy - wo.resourceRates.energy,
    clickPerClick: full.clickValue - wo.clickValue,
  };
}

type MultiplierTarget = "global" | "click" | "passive";

export type SimulationOutput = {
  clickValue: number;
  resourceRates: ResourceBalances;
  unlockedMechanics: string[];
  /** Sum of energy passive_generation before (1+v) multipliers. */
  rawPassiveEnergy: number;
  /** Product of (1+v) for global + passive multipliers. */
  passiveMultiplier: number;
  /** Sum of click_bonus amounts before multipliers. */
  rawClickBonus: number;
  /** Product of (1+v) for global + click multipliers. */
  clickMultiplier: number;
};

function productMultiplier(values: number[]): number {
  return values.reduce((acc, value) => acc * (1 + value), 1);
}

function passiveMultiplier(byTarget: Map<MultiplierTarget, number[]>): number {
  return (
    productMultiplier(byTarget.get("global") ?? []) *
    productMultiplier(byTarget.get("passive") ?? [])
  );
}

function clickMultiplier(byTarget: Map<MultiplierTarget, number[]>): number {
  return (
    productMultiplier(byTarget.get("global") ?? []) *
    productMultiplier(byTarget.get("click") ?? [])
  );
}

/**
 * Multipliers stack multiplicatively: each +v contributes a factor (1+v); two +15% → 1.15², not 1.30.
 * Passive energy = (sum of passive_generation amounts) × Π(1+v) over global+passive multipliers.
 * Click energy = (base + sum click_bonus) × Π(1+v) over global+click multipliers.
 */
export function simulateOwnedUpgrades(
  ownedUpgrades: Record<string, number>,
): SimulationOutput {
  const baseClick = 0;
  let addedClick = 0;
  let passiveEnergy = 0;
  const byMultiplierTarget = new Map<MultiplierTarget, number[]>();
  const unlockedMechanics = new Set<string>();

  /**
   * Stack ramps: later stacks are worth more than earlier stacks (arithmetic progression).
   * Total for \(n\) stacks is:
   *   base × (n + step × (0+1+...+(n-1))) = base × (n + step × n × (n-1) / 2)
   */
  const ADDITIVE_STACK_RAMP_STEP_BY_UPGRADE_ID: Readonly<Record<string, number>> =
    {
      // Tier 4: +25% of base per later stack (sum multipliers @5 = 7.5 → +50% over linear).
      feeding_waters: 0.25,
      rainwater_inflow: 0.25,
      // Tier 5–6 econ: 50% base cut, recouped by stack 5 (sum multipliers @5 = 10).
      ambush_weedbeds: 0.5,
      migrating_waterfowl: 0.5,
      high_snag: 0.5,
      evening_chorus: 0.5,
    };

  const rampedStackTotal = (
    baseAmount: number,
    stacks: number,
    step: number,
  ): number => {
    const n = Math.max(0, Math.floor(stacks));
    return baseAmount * (n + (step * n * (n - 1)) / 2);
  };

  const pushMultiplier = (target: MultiplierTarget, value: number) => {
    const arr = byMultiplierTarget.get(target) ?? [];
    arr.push(value);
    byMultiplierTarget.set(target, arr);
  };

  for (const upgrade of CATALOG_UPGRADES) {
    const stacks = effectiveOwnedStacks(upgrade, ownedUpgrades);
    if (stacks <= 0) continue;
    for (const effect of upgrade.effects) {
      // Per-upgrade ramp: scale additive income per stack (not linear × stacks).
      const rampStep = ADDITIVE_STACK_RAMP_STEP_BY_UPGRADE_ID[upgrade.id];
      if (typeof rampStep === "number" && Number.isFinite(rampStep) && rampStep > 0) {
        if (effect.type === "click_bonus") {
          addedClick += rampedStackTotal(effect.amount, stacks, rampStep);
          continue;
        }
        if (effect.type === "passive_generation" && effect.resource === "energy") {
          passiveEnergy += rampedStackTotal(effect.amount, stacks, rampStep);
          continue;
        }
      }

      const scaled = scaleEffect(effect, stacks);
      if (scaled.type === "click_bonus") {
        addedClick += scaled.amount;
      } else if (
        scaled.type === "passive_generation" &&
        scaled.resource === "energy"
      ) {
        passiveEnergy += scaled.amount;
      } else if (scaled.type === "multiplier") {
        pushMultiplier(scaled.target, scaled.value);
      } else if (scaled.type === "unlock") {
        unlockedMechanics.add(scaled.mechanicId);
      }
    }
  }

  const pMult = passiveMultiplier(byMultiplierTarget);
  const resourceRates: ResourceBalances = {
    energy: passiveEnergy * pMult,
  };

  const cMult = clickMultiplier(byMultiplierTarget);
  const clickValue = (baseClick + addedClick) * cMult;
  return {
    clickValue,
    resourceRates,
    unlockedMechanics: [...unlockedMechanics],
    rawPassiveEnergy: passiveEnergy,
    passiveMultiplier: pMult,
    rawClickBonus: addedClick,
    clickMultiplier: cMult,
  };
}

export function applyResourceDelta(
  current: ResourceBalances,
  rates: ResourceBalances,
  dtSeconds: number,
): ResourceBalances {
  return {
    energy: Math.max(0, current.energy + rates.energy * dtSeconds),
  };
}

function scaleEffect(effect: UpgradeEffect, level: number): UpgradeEffect {
  if (effect.type === "click_bonus") {
    return { ...effect, amount: effect.amount * level };
  }
  if (effect.type === "passive_generation") {
    return { ...effect, amount: effect.amount * level };
  }
  if (effect.type === "multiplier") {
    return { ...effect, value: effect.value * level };
  }
  return effect;
}
