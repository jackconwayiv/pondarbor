import {
  CATALOG_UPGRADES,
  PRIMARY_RESOURCE_IDS,
  effectiveOwnedStacks,
  getOwnedCount,
  getUpgradeDef,
  nextPurchaseCost,
  type PrimaryResourceId,
  type UpgradeDef,
  type UpgradeFamily,
  type UpgradeRequirement,
} from "./catalog";

export type ResourceBalances = Record<PrimaryResourceId, number>;

export { effectiveOwnedStacks, getOwnedCount };

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
  ownedUpgrades: Record<string, number>,
  resources: ResourceBalances,
): boolean {
  switch (requirement.type) {
    case "currency_cost":
      return true;
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
    case "resource_threshold":
      if (requirement.resource === "detritus") {
        return false;
      }
      return resources[requirement.resource] >= requirement.min;
    default:
      return false;
  }
}

export function isUpgradeUnlocked(
  upgrade: UpgradeDef,
  ownedUpgrades: Record<string, number>,
  resources: ResourceBalances,
): boolean {
  return upgrade.requirements.every((req) => requirementMet(req, ownedUpgrades, resources));
}

export function getUnmetRequirements(
  upgrade: UpgradeDef,
  ownedUpgrades: Record<string, number>,
  resources: ResourceBalances,
): UpgradeRequirement[] {
  return upgrade.requirements.filter((req) => !requirementMet(req, ownedUpgrades, resources));
}

/** Half of next purchase energy cost (rounded up); same rule as first-time shop reveal. */
export function revealEnergyThresholdForNextPurchase(upgrade: UpgradeDef, ownedCount: number): number {
  const nextCost = nextPurchaseCost(upgrade, ownedCount);
  if (!nextCost) return Number.POSITIVE_INFINITY;
  return Math.ceil((nextCost.energy ?? 0) / 2);
}

export function isUpgradeVisible(
  upgrade: UpgradeDef,
  ownedUpgrades: Record<string, number>,
  resources: ResourceBalances,
  revealedUpgrades: Record<string, boolean>,
): boolean {
  const ownedCount = getOwnedCount(ownedUpgrades, upgrade.id);
  if (nextPurchaseCost(upgrade, ownedCount) === null) return false;
  if (!isUpgradeUnlocked(upgrade, ownedUpgrades, resources)) return false;

  const thr = revealEnergyThresholdForNextPurchase(upgrade, ownedCount);

  // Sticky once set in `revealed_upgrades` (see buy flow: only the purchased id may be cleared when energy dips).
  if (revealedUpgrades[upgrade.id]) {
    return true;
  }
  return resources.energy >= thr;
}

export function requirementSummary(requirement: UpgradeRequirement): string {
  switch (requirement.type) {
    case "currency_cost":
      return "Requires costs";
    case "prerequisite_upgrade": {
      const names = requirement.upgradeIds.map((id) => getUpgradeDef(id)?.name ?? id);
      return `Requires ${names.join(" + ")}`;
    }
    case "owned_upgrade_threshold": {
      const name = getUpgradeDef(requirement.upgradeId)?.name ?? requirement.upgradeId;
      return `Requires ${name} ×${requirement.minLevel}+`;
    }
    case "family_threshold":
      return `Requires ${requirement.minOwned}+ ${requirement.family.replace("_", " ")} upgrades`;
    case "resource_threshold":
      return `Requires ${requirement.min} ${requirement.resource}`;
    default:
      return "Requirement not met";
  }
}

export function canAffordCosts(costs: Partial<Record<PrimaryResourceId, number>>, resources: ResourceBalances): boolean {
  for (const resourceId of PRIMARY_RESOURCE_IDS) {
    const amount = costs[resourceId];
    if (typeof amount !== "number" || amount <= 0) continue;
    if (resources[resourceId] < amount) return false;
  }
  return true;
}
