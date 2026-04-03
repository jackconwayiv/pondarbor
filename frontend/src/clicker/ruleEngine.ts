import {
  CATALOG_UPGRADES,
  TIER1_MARQUEE_IDS,
  effectiveOwnedStacks,
  getOwnedCount,
  getUpgradeDef,
  nextPurchaseCost,
  type PondStatId,
  type UpgradeDef,
  type UpgradeFamily,
  type UpgradeRequirement,
} from "./catalog";

/** Spendable balance (Energy only). */
export type ResourceBalances = { energy: number };

export type PondStats = Record<PondStatId, number>;

export { effectiveOwnedStacks, getOwnedCount };

export function emptyPondStats(): PondStats {
  return { fertility: 0, oxygen: 0, depth: 0, shelter: 0 };
}

export function computePondStats(ownedUpgrades: Record<string, number>): PondStats {
  const s = emptyPondStats();
  for (const upgrade of CATALOG_UPGRADES) {
    const stacks = effectiveOwnedStacks(upgrade, ownedUpgrades);
    if (stacks <= 0) continue;
    for (const effect of upgrade.effects) {
      if (effect.type === "threshold_delta") {
        s[effect.stat] += effect.delta * stacks;
      }
    }
  }
  return s;
}

export function computeBiodiversity(ownedUpgrades: Record<string, number>): number {
  let n = 0;
  for (const upgrade of CATALOG_UPGRADES) {
    if (!upgrade.countsTowardBiodiversity) continue;
    if (getOwnedCount(ownedUpgrades, upgrade.id) >= 1) n += 1;
  }
  return n * 100;
}

/** Min value for `stat_threshold` / `biodiversity_threshold` at the next purchase; scales with stacks owned of this upgrade. */
export function scaledNumericGateMin(
  requirement: { min: number },
  upgrade: UpgradeDef,
  ownedUpgrades: Record<string, number>,
): number {
  const owned = getOwnedCount(ownedUpgrades, upgrade.id);
  return Math.ceil(requirement.min * (owned + 1));
}

export function countOwnedByFamily(
  family: UpgradeFamily,
  ownedUpgrades: Record<string, number>,
): number {
  let count = 0;
  for (const upgrade of CATALOG_UPGRADES) {
    if (upgrade.family !== family) continue;
    if (effectiveOwnedStacks(upgrade, ownedUpgrades) > 0) count += 1;
  }
  return count;
}

function requirementMet(
  requirement: UpgradeRequirement,
  upgrade: UpgradeDef,
  ownedUpgrades: Record<string, number>,
  _resources: ResourceBalances,
  pondStats: PondStats,
  biodiversity: number,
): boolean {
  switch (requirement.type) {
    case "prerequisite_upgrade":
      return requirement.upgradeIds.every((id) => {
        const def = getUpgradeDef(id);
        if (!def) return false;
        return effectiveOwnedStacks(def, ownedUpgrades) >= 1;
      });
    case "owned_upgrade_threshold": {
      const def = getUpgradeDef(requirement.upgradeId);
      if (!def) return false;
      return effectiveOwnedStacks(def, ownedUpgrades) >= requirement.minLevel;
    }
    case "family_threshold":
      return countOwnedByFamily(requirement.family, ownedUpgrades) >= requirement.minOwned;
    case "stat_threshold":
      return pondStats[requirement.stat] >= scaledNumericGateMin(requirement, upgrade, ownedUpgrades);
    case "biodiversity_threshold":
      return biodiversity >= scaledNumericGateMin(requirement, upgrade, ownedUpgrades);
    default:
      return false;
  }
}

export function isUpgradeUnlocked(
  upgrade: UpgradeDef,
  ownedUpgrades: Record<string, number>,
  resources: ResourceBalances,
  pondStats: PondStats,
  biodiversity: number,
): boolean {
  return upgrade.requirements.every((req) =>
    requirementMet(req, upgrade, ownedUpgrades, resources, pondStats, biodiversity),
  );
}

export function getUnmetRequirements(
  upgrade: UpgradeDef,
  ownedUpgrades: Record<string, number>,
  resources: ResourceBalances,
  pondStats: PondStats,
  biodiversity: number,
): UpgradeRequirement[] {
  return upgrade.requirements.filter(
    (req) => !requirementMet(req, upgrade, ownedUpgrades, resources, pondStats, biodiversity),
  );
}

/** Half of next purchase energy cost (rounded up); reveal threshold. */
export function revealEnergyThresholdForNextPurchase(upgrade: UpgradeDef, ownedCount: number): number {
  const nextCost = nextPurchaseCost(upgrade, ownedCount);
  if (!nextCost) return Number.POSITIVE_INFINITY;
  return Math.ceil(nextCost.energy / 2);
}

export function isUpgradeVisible(
  upgrade: UpgradeDef,
  ownedUpgrades: Record<string, number>,
  resources: ResourceBalances,
  revealedUpgrades: Record<string, boolean>,
  pondStats: PondStats,
  biodiversity: number,
): boolean {
  const ownedCount = getOwnedCount(ownedUpgrades, upgrade.id);
  if (nextPurchaseCost(upgrade, ownedCount) === null) return false;
  if (!isUpgradeUnlocked(upgrade, ownedUpgrades, resources, pondStats, biodiversity)) return false;

  const thr = revealEnergyThresholdForNextPurchase(upgrade, ownedCount);

  if (revealedUpgrades[upgrade.id]) {
    return true;
  }
  return resources.energy >= thr;
}

export function requirementSummary(requirement: UpgradeRequirement): string {
  switch (requirement.type) {
    case "prerequisite_upgrade": {
      const names = requirement.upgradeIds.map((id) => getUpgradeDef(id)?.name ?? id);
      return `Requires ${names.join(" + ")}`;
    }
    case "owned_upgrade_threshold": {
      const name = getUpgradeDef(requirement.upgradeId)?.name ?? requirement.upgradeId;
      return `Requires ${name} ×${requirement.minLevel}+`;
    }
    case "family_threshold":
      return `Requires ${requirement.minOwned}+ ${requirement.family} upgrades`;
    case "stat_threshold":
      return `Requires ${requirement.min} ${requirement.stat} (scales with stacks)`;
    case "biodiversity_threshold":
      return `Requires ${requirement.min} biodiversity (scales with stacks)`;
    default:
      return "Requirement not met";
  }
}

export function canAffordCosts(costs: { energy: number }, resources: ResourceBalances): boolean {
  return resources.energy >= costs.energy;
}

export function tier1PondComplete(ownedUpgrades: Record<string, number>): boolean {
  return TIER1_MARQUEE_IDS.every((id) => getOwnedCount(ownedUpgrades, id) >= 1);
}
