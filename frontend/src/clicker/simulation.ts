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

export function marginalClickIfBuyNextTier(def: UpgradeDef, ownedUpgrades: Record<string, number>): number {
  const cur = simulateOwnedUpgrades(ownedUpgrades);
  const owned = getOwnedCount(ownedUpgrades, def.id);
  if (nextPurchaseCost(def, owned) === null) return 0;
  const hypothetical = { ...ownedUpgrades, [def.id]: owned + 1 };
  const next = simulateOwnedUpgrades(hypothetical);
  return next.clickValue - cur.clickValue;
}

type MultiplierTarget = "global" | "click" | "passive";

export type SimulationOutput = {
  clickValue: number;
  resourceRates: ResourceBalances;
  unlockedMechanics: string[];
};

function productMultiplier(values: number[]): number {
  return values.reduce((acc, value) => acc * (1 + value), 1);
}

function passiveMultiplier(byTarget: Map<MultiplierTarget, number[]>): number {
  return productMultiplier(byTarget.get("global") ?? []) * productMultiplier(byTarget.get("passive") ?? []);
}

function clickMultiplier(byTarget: Map<MultiplierTarget, number[]>): number {
  return (
    productMultiplier(byTarget.get("global") ?? []) * productMultiplier(byTarget.get("click") ?? [])
  );
}

export function simulateOwnedUpgrades(ownedUpgrades: Record<string, number>): SimulationOutput {
  const baseClick = 0;
  let addedClick = 0;
  let passiveEnergy = 0;
  const byMultiplierTarget = new Map<MultiplierTarget, number[]>();
  const unlockedMechanics = new Set<string>();

  const pushMultiplier = (target: MultiplierTarget, value: number) => {
    const arr = byMultiplierTarget.get(target) ?? [];
    arr.push(value);
    byMultiplierTarget.set(target, arr);
  };

  for (const upgrade of CATALOG_UPGRADES) {
    const stacks = effectiveOwnedStacks(upgrade, ownedUpgrades);
    if (stacks <= 0) continue;
    for (const effect of upgrade.effects) {
      const scaled = scaleEffect(effect, stacks);
      if (scaled.type === "click_bonus") {
        addedClick += scaled.amount;
      } else if (scaled.type === "passive_generation" && scaled.resource === "energy") {
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
