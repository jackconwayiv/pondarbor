import {
  CATALOG_UPGRADES,
  PRIMARY_RESOURCE_IDS,
  effectiveOwnedStacks,
  nextPurchaseCost,
  getOwnedCount,
  type PrimaryResourceId,
  type UpgradeEffect,
  type UpgradeDef,
  type UpgradeFamily,
} from "./catalog";
import { type ResourceBalances } from "./ruleEngine";

export function marginalRatesIfBuyNextTier(
  def: UpgradeDef,
  ownedUpgrades: Record<string, number>,
): ResourceBalances {
  const cur = simulateOwnedUpgrades(ownedUpgrades);
  const owned = getOwnedCount(ownedUpgrades, def.id);
  if (nextPurchaseCost(def, owned) === null) {
    return { energy: 0, oxygen: 0, vegetation: 0, abundance: 0 };
  }
  const hypothetical = { ...ownedUpgrades, [def.id]: owned + 1 };
  const next = simulateOwnedUpgrades(hypothetical);
  return {
    energy: next.resourceRates.energy - cur.resourceRates.energy,
    oxygen: next.resourceRates.oxygen - cur.resourceRates.oxygen,
    vegetation: next.resourceRates.vegetation - cur.resourceRates.vegetation,
    abundance: next.resourceRates.abundance - cur.resourceRates.abundance,
  };
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

type GenerationContribution = {
  resource: PrimaryResourceId;
  amount: number;
  family: UpgradeFamily;
};

type ConverterContribution = {
  from: PrimaryResourceId;
  to: PrimaryResourceId;
  rate: number;
  family: UpgradeFamily;
};

type MultiplierTarget = "global" | "click" | "passive" | UpgradeFamily | PrimaryResourceId;

export type SimulationOutput = {
  clickValue: number;
  resourceRates: ResourceBalances;
  unlockedMechanics: string[];
};

function emptyRates(): ResourceBalances {
  return {
    energy: 0,
    oxygen: 0,
    vegetation: 0,
    abundance: 0,
  };
}

function productMultiplier(values: number[]): number {
  return values.reduce((acc, value) => acc * (1 + value), 1);
}

function targetMultiplier(
  target: MultiplierTarget,
  family: UpgradeFamily,
  resource: PrimaryResourceId,
  byTarget: Map<MultiplierTarget, number[]>,
): number {
  const global = productMultiplier(byTarget.get("global") ?? []);
  const passive = productMultiplier(byTarget.get("passive") ?? []);
  const familyMult = productMultiplier(byTarget.get(family) ?? []);
  const resourceMult = productMultiplier(byTarget.get(resource) ?? []);
  if (target === "click") {
    const click = productMultiplier(byTarget.get("click") ?? []);
    return global * click;
  }
  return global * passive * familyMult * resourceMult;
}

export function simulateOwnedUpgrades(ownedUpgrades: Record<string, number>): SimulationOutput {
  const baseClick = 1;
  let addedClick = 0;
  const generated: GenerationContribution[] = [];
  const converters: ConverterContribution[] = [];
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
      } else if (scaled.type === "passive_generation") {
        generated.push({
          resource: scaled.resource,
          amount: scaled.amount,
          family: upgrade.family,
        });
      } else if (scaled.type === "converter") {
        converters.push({
          from: scaled.from,
          to: scaled.to,
          rate: scaled.rate,
          family: upgrade.family,
        });
      } else if (scaled.type === "multiplier") {
        pushMultiplier(scaled.target, scaled.value);
      } else if (scaled.type === "unlock") {
        unlockedMechanics.add(scaled.mechanicId);
      }
    }
  }

  const resourceRates = emptyRates();
  for (const item of generated) {
    const mult = targetMultiplier("passive", item.family, item.resource, byMultiplierTarget);
    resourceRates[item.resource] += item.amount * mult;
  }

  for (const converter of converters) {
    const mult = targetMultiplier("passive", converter.family, converter.to, byMultiplierTarget);
    const rate = converter.rate * mult;
    resourceRates[converter.from] -= rate;
    resourceRates[converter.to] += rate;
  }

  for (const resourceId of PRIMARY_RESOURCE_IDS) {
    if (!Number.isFinite(resourceRates[resourceId])) {
      resourceRates[resourceId] = 0;
    }
  }

  const clickMult = targetMultiplier("click", "nonliving", "energy", byMultiplierTarget);
  const clickValue = (baseClick + addedClick) * clickMult;
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
  const next: ResourceBalances = { ...current };
  for (const resourceId of PRIMARY_RESOURCE_IDS) {
    next[resourceId] = Math.max(0, next[resourceId] + rates[resourceId] * dtSeconds);
  }
  return next;
}

function scaleEffect(effect: UpgradeEffect, level: number): UpgradeEffect {
  if (effect.type === "click_bonus") {
    return { ...effect, amount: effect.amount * level };
  }
  if (effect.type === "passive_generation") {
    return { ...effect, amount: effect.amount * level };
  }
  if (effect.type === "converter") {
    return { ...effect, rate: effect.rate * level };
  }
  if (effect.type === "multiplier") {
    return { ...effect, value: effect.value * level };
  }
  return effect;
}
