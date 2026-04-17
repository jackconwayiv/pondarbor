import {
  CATALOG_UPGRADES,
  FINAL_TIER_MARQUEE_IDS,
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

export function computePondStats(
  ownedUpgrades: Record<string, number>,
): PondStats {
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

export function computeBiodiversity(
  ownedUpgrades: Record<string, number>,
): number {
  let n = 0;
  for (const upgrade of CATALOG_UPGRADES) {
    n += effectiveOwnedStacks(upgrade, ownedUpgrades);
  }
  return n * 100;
}

function scalingPerOwnedFor(
  upgrade: UpgradeDef,
  key: PondStatId,
): number {
  return upgrade.meta?.requirementScalingPerOwned?.[key] ?? 0;
}

/** Min value for `stat_threshold` at the next purchase; scales with stacks owned of this upgrade. */
export function scaledNumericGateMin(
  requirement: { min: number },
  upgrade: UpgradeDef,
  ownedUpgrades: Record<string, number>,
  key: PondStatId,
): number {
  const owned = getOwnedCount(ownedUpgrades, upgrade.id);
  const perOwned = scalingPerOwnedFor(upgrade, key);
  return requirement.min + owned * perOwned;
}

/** Sum of effective owned stacks for all upgrades in `family` (not “distinct upgrades owned”). */
export function countOwnedByFamily(
  family: UpgradeFamily,
  ownedUpgrades: Record<string, number>,
): number {
  let total = 0;
  for (const upgrade of CATALOG_UPGRADES) {
    if (upgrade.family !== family) continue;
    total += effectiveOwnedStacks(upgrade, ownedUpgrades);
  }
  return total;
}

function isStackableUpgrade(def: UpgradeDef): boolean {
  return (def.maxOwned ?? Number.POSITIVE_INFINITY) > 1;
}

/** Marquee denizens need 2+ stacks of a stackable prerequisite upgrade. */
function minStacksForPrerequisite(
  prereqDef: UpgradeDef,
  subject: UpgradeDef,
): number {
  if (
    subject.nodeType === "Denizen" &&
    subject.isMarquee &&
    isStackableUpgrade(prereqDef)
  ) {
    return 2;
  }
  return 1;
}

function prerequisiteRequirementMet(
  requirement: UpgradeRequirement,
  ownedUpgrades: Record<string, number>,
  subject: UpgradeDef,
): boolean {
  switch (requirement.type) {
    case "prerequisite_upgrade":
      return requirement.upgradeIds.every((id) => {
        const def = getUpgradeDef(id);
        if (!def) return false;
        const min = minStacksForPrerequisite(def, subject);
        return effectiveOwnedStacks(def, ownedUpgrades) >= min;
      });
    case "owned_upgrade_threshold": {
      const def = getUpgradeDef(requirement.upgradeId);
      if (!def) return false;
      return effectiveOwnedStacks(def, ownedUpgrades) >= requirement.minLevel;
    }
    case "family_threshold":
      return (
        countOwnedByFamily(requirement.family, ownedUpgrades) >=
        requirement.minOwned
      );
    case "stat_threshold":
      return true;
    default:
      return false;
  }
}

export function isUpgradePrereqVisible(
  upgrade: UpgradeDef,
  ownedUpgrades: Record<string, number>,
): boolean {
  return upgrade.requirements.every((req) =>
    prerequisiteRequirementMet(req, ownedUpgrades, upgrade),
  );
}

function requirementMet(
  requirement: UpgradeRequirement,
  upgrade: UpgradeDef,
  ownedUpgrades: Record<string, number>,
  _resources: ResourceBalances,
  pondStats: PondStats,
  biodiversity: number,
): boolean {
  void biodiversity;
  switch (requirement.type) {
    case "prerequisite_upgrade":
      return requirement.upgradeIds.every((id) => {
        const def = getUpgradeDef(id);
        if (!def) return false;
        const min = minStacksForPrerequisite(def, upgrade);
        return effectiveOwnedStacks(def, ownedUpgrades) >= min;
      });
    case "owned_upgrade_threshold": {
      const def = getUpgradeDef(requirement.upgradeId);
      if (!def) return false;
      return effectiveOwnedStacks(def, ownedUpgrades) >= requirement.minLevel;
    }
    case "family_threshold":
      return (
        countOwnedByFamily(requirement.family, ownedUpgrades) >=
        requirement.minOwned
      );
    case "stat_threshold":
      return (
        pondStats[requirement.stat] >=
        scaledNumericGateMin(
          requirement,
          upgrade,
          ownedUpgrades,
          requirement.stat,
        )
      );
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
    requirementMet(
      req,
      upgrade,
      ownedUpgrades,
      resources,
      pondStats,
      biodiversity,
    ),
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
    (req) =>
      !requirementMet(
        req,
        upgrade,
        ownedUpgrades,
        resources,
        pondStats,
        biodiversity,
      ),
  );
}

/** Half of next purchase energy cost (rounded up); reveal threshold. */
export function revealEnergyThresholdForNextPurchase(
  upgrade: UpgradeDef,
  ownedCount: number,
): number {
  const nextCost = nextPurchaseCost(upgrade, ownedCount);
  if (!nextCost) return Number.POSITIVE_INFINITY;
  return Math.ceil(nextCost.energy / 2);
}

export function isUpgradeVisible(
  upgrade: UpgradeDef,
  ownedUpgrades: Record<string, number>,
  resources: ResourceBalances,
  revealedUpgrades: Record<string, boolean>,
): boolean {
  const ownedCount = getOwnedCount(ownedUpgrades, upgrade.id);
  const nextCost = nextPurchaseCost(upgrade, ownedCount);

  if (nextCost === null) return false;
  if (ownedCount > 0) return true;
  if (revealedUpgrades[upgrade.id]) return true;
  if (!isUpgradePrereqVisible(upgrade, ownedUpgrades)) return false;

  const thr = revealEnergyThresholdForNextPurchase(upgrade, ownedCount);
  return resources.energy >= thr;
}

export function requirementSummary(requirement: UpgradeRequirement): string {
  switch (requirement.type) {
    case "prerequisite_upgrade": {
      const names = requirement.upgradeIds.map(
        (id) => getUpgradeDef(id)?.name ?? id,
      );
      return `Requires ${names.join(" + ")}`;
    }
    case "owned_upgrade_threshold": {
      const name =
        getUpgradeDef(requirement.upgradeId)?.name ?? requirement.upgradeId;
      return `Requires ${name} ×${requirement.minLevel}+`;
    }
    case "family_threshold":
      return `Requires ${requirement.minOwned}+ total stacks in ${requirement.family}`;
    case "stat_threshold":
      return `Requires ${requirement.min} ${requirement.stat} (scales with stacks)`;
    default:
      return "Requirement not met";
  }
}

export function canAffordCosts(
  costs: { energy: number },
  resources: ResourceBalances,
): boolean {
  return resources.energy >= costs.energy;
}
export function finalTierPondComplete(
  ownedUpgrades: Record<string, number>,
): boolean {
  return FINAL_TIER_MARQUEE_IDS.every(
    (id) => getOwnedCount(ownedUpgrades, id) >= 1,
  );
}
