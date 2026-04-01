export type PrimaryResourceId =
  | "energy"
  | "oxygen"
  | "vegetation"
  | "abundance";

export type SecondaryResourceId = "detritus";
export type ResourceId = PrimaryResourceId | SecondaryResourceId;

export type UpgradeFamily =
  | "nonliving"
  | "detritus"
  | "flowers"
  | "plant_life"
  | "mammals"
  | "birds"
  | "reptiles"
  | "fish"
  | "arthropods"
  | "small_life"
  | "amphibians";

export type DenizenKind = "animal" | "plant" | "fungus";

export type ResourceCosts = Partial<Record<PrimaryResourceId, number>>;

export type UpgradeRequirement =
  | { type: "currency_cost" }
  | { type: "prerequisite_upgrade"; upgradeIds: string[] }
  | { type: "owned_upgrade_threshold"; upgradeId: string; minLevel: number }
  | { type: "family_threshold"; family: UpgradeFamily; minOwned: number }
  | { type: "resource_threshold"; resource: ResourceId; min: number };

export type UpgradeEffect =
  | { type: "passive_generation"; resource: PrimaryResourceId; amount: number }
  | { type: "click_bonus"; amount: number }
  | { type: "multiplier"; target: "global" | "click" | "passive" | UpgradeFamily | PrimaryResourceId; value: number }
  | { type: "converter"; from: PrimaryResourceId; to: PrimaryResourceId; rate: number }
  | { type: "unlock"; mechanicId: string };

export type UpgradeDef = {
  id: string;
  name: string;
  family: UpgradeFamily;
  /** Progression band for sort order / content phase. */
  tier: number;
  description: string;
  /**
   * Printed base costs per resource. Actual price for the next purchase is each printed value times `2^O`,
   * where `O` is how many copies you already own (0 → use printed costs as-is).
   * Omit `maxOwned` for unlimited stacks; `1` = single purchase only.
   */
  costs: ResourceCosts;
  maxOwned?: number;
  requirements: UpgradeRequirement[];
  effects: UpgradeEffect[];
  /** Only for denizen upgrades (living creatures / plants). */
  denizenKind?: DenizenKind;
};

export function validateUpgradeDef(upgrade: UpgradeDef): string[] {
  const errors: string[] = [];

  if (upgrade.denizenKind) {
    if (upgrade.family === "nonliving") {
      errors.push(`${upgrade.id}: denizens cannot use nonliving family`);
    }
  }

  if (upgrade.maxOwned !== undefined) {
    if (!Number.isInteger(upgrade.maxOwned) || upgrade.maxOwned < 1) {
      errors.push(`${upgrade.id}: maxOwned must be a positive integer`);
    }
  }

  return errors;
}

/** Raw count from save (floored, ≥ 0). */
export function getOwnedCount(ownedUpgrades: Record<string, number>, upgradeId: string): number {
  const n = ownedUpgrades[upgradeId];
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}

/** Stacks used for effects and caps (respects `maxOwned`). */
export function effectiveOwnedStacks(def: UpgradeDef, ownedUpgrades: Record<string, number>): number {
  const raw = getOwnedCount(ownedUpgrades, def.id);
  if (def.maxOwned === undefined) return raw;
  return Math.min(raw, def.maxOwned);
}

export type ResourcePresentation = {
  label: string;
  symbol: string;
};

export type FamilyPresentation = {
  label: string;
  symbol: string;
  accent: string;
};

export const PRIMARY_RESOURCE_IDS: PrimaryResourceId[] = [
  "energy",
  "oxygen",
  "vegetation",
  "abundance",
];

export const RESOURCE_PRESENTATION: Record<PrimaryResourceId, ResourcePresentation> = {
  energy: { label: "Energy", symbol: "⚡" },
  oxygen: { label: "Oxygen", symbol: "🫧" },
  vegetation: { label: "Vegetation", symbol: "🍃" },
  abundance: { label: "Abundance", symbol: "🐸" },
};

export const FAMILY_PRESENTATION: Record<UpgradeFamily, FamilyPresentation> = {
  nonliving: { label: "Habitat", symbol: "🪨", accent: "#5a5a5a" },
  detritus: { label: "Detritus", symbol: "🍂", accent: "#6b5a45" },
  flowers: { label: "Flowers", symbol: "🌸", accent: "#c94f7c" },
  plant_life: { label: "Plants", symbol: "🌲", accent: "#2f5a2f" },
  mammals: { label: "Mammals", symbol: "🦫", accent: "#7a5a3a" },
  birds: { label: "Birds", symbol: "🦢", accent: "#5a7fc9" },
  reptiles: { label: "Reptiles", symbol: "🦎", accent: "#4f7a43" },
  fish: { label: "Fish", symbol: "🐡", accent: "#1f6f8b" },
  arthropods: { label: "Arthropods", symbol: "🕷️", accent: "#6b4f3a" },
  small_life: { label: "Small Life", symbol: "🦠", accent: "#7a3f6b" },
  amphibians: { label: "Amphibians", symbol: "🐸", accent: "#4f8f5a" },
};

export const CATALOG_UPGRADES: UpgradeDef[] = [
  {
    id: "phytoplankton",
    name: "Phytoplankton",
    family: "small_life",
    tier: 1,
    description:
      "Sunlight in the upper water and available nutrients support surface photosynthesis—primary production that feeds the pond.",
    costs: { energy: 30 },
    requirements: [],
    effects: [{ type: "passive_generation", resource: "energy", amount: 0.5 }],
  },
  {
    id: "green_algae",
    name: "Green Algae",
    family: "small_life",
    tier: 1,
    description:
      "Multiplies passive energy generation (each owned copy stacks +100% on energy passives). Freshwater algae are often nutrient-limited—especially phosphorus—so growth tracks available inputs.",
    costs: { energy: 500 },
    requirements: [],
    maxOwned: 1,
    effects: [{ type: "multiplier", target: "energy", value: 1 }],
  },
  {
    id: "duckweed",
    name: "Duckweed",
    family: "plant_life",
    tier: 2,
    description: "Calm water and nutrient-rich surface water let floating mats expand fast—the first obvious plant expansion.",
    costs: { energy: 100 },
    requirements: [{ type: "prerequisite_upgrade", upgradeIds: ["phytoplankton"] }],
    effects: [{ type: "passive_generation", resource: "vegetation", amount: 0.5 }],
  },
  {
    id: "stonewort",
    name: "Stonewort",
    family: "plant_life",
    tier: 2,
    description:
      "Quiet ponds and protected bays suit charophytes; they need suitable bottom chemistry and do poorly in heavy flow.",
    costs: { energy: 100 },
    requirements: [{ type: "prerequisite_upgrade", upgradeIds: ["phytoplankton"] }],
    effects: [{ type: "passive_generation", resource: "oxygen", amount: 0.5 }],
  },
  {
    id: "leaf_litter",
    name: "Leaf Litter",
    family: "detritus",
    tier: 3,
    description:
      "Fallen leaves from shoreline plants add organic matter to the pond, feeding decomposition and nutrient cycling.",
    costs: { energy: 200, vegetation: 100 },
    requirements: [{ type: "prerequisite_upgrade", upgradeIds: ["duckweed"] }],
    effects: [{ type: "passive_generation", resource: "abundance", amount: 0.5 }],
  },
  {
    id: "periphyton",
    name: "Biofilm",
    family: "small_life",
    tier: 4,
    description:
      "Attached algal biofilm on submerged surfaces adds productive edge habitat and boosts harvesting—needs substrate to grow on.",
    costs: { energy: 500 },
    requirements: [{ type: "prerequisite_upgrade", upgradeIds: ["leaf_litter"] }],
    effects: [{ type: "multiplier", target: "click", value: 0.5 }],
  },
  {
    id: "pondweed",
    name: "Pondweed",
    family: "plant_life",
    tier: 3,
    description: "Rooted aquatics need quiet water, substrate, and enough clarity and light for growth on the bottom.",
    costs: { energy: 1000 },
    requirements: [{ type: "prerequisite_upgrade", upgradeIds: ["duckweed"] }],
    maxOwned: 1,
    effects: [{ type: "multiplier", target: "vegetation", value: 1 }],
  },
  {
    id: "elodea",
    name: "Elodea",
    family: "plant_life",
    tier: 4,
    description:
      "A submerged waterweed that does best where enough light reaches below the surface; dense floating cover can limit it.",
    costs: { energy: 1000 },
    requirements: [{ type: "prerequisite_upgrade", upgradeIds: ["stonewort"] }],
    maxOwned: 1,
    effects: [{ type: "multiplier", target: "oxygen", value: 1 }],
  },
  {
    id: "muck",
    name: "Muck",
    family: "detritus",
    tier: 5,
    description: "Soft bottom builds from time, decomposition, and settled organics—nutrient cycling and organic matter accumulation.",
    costs: { energy: 1000 },
    requirements: [{ type: "prerequisite_upgrade", upgradeIds: ["leaf_litter"] }],
    maxOwned: 1,
    effects: [{ type: "multiplier", target: "abundance", value: 1 }],
  },
];

export const KNOWN_UPGRADE_IDS = new Set<string>(CATALOG_UPGRADES.map((u) => u.id));

for (const u of CATALOG_UPGRADES) {
  const errs = validateUpgradeDef(u);
  if (errs.length > 0) {
    throw new Error(`Invalid catalog upgrade:\n${errs.join("\n")}`);
  }
}

const upgradesById = new Map(CATALOG_UPGRADES.map((u) => [u.id, u] as const));

export function getUpgradeDef(id: string): UpgradeDef | undefined {
  return upgradesById.get(id);
}

/** Clamp save data to catalog caps. */
export function clampOwnedStacksForUpgrade(upgradeId: string, raw: number): number {
  const def = upgradesById.get(upgradeId);
  if (!def) return 0;
  const n = Math.max(0, Math.floor(raw));
  if (def.maxOwned === undefined) return n;
  return Math.min(n, def.maxOwned);
}

/**
 * @param ownedCount Copies of this upgrade already owned **before** this purchase (`O` in `printed × 2^O`).
 * When `O === 0`, the multiplier is `2^0 = 1` (printed costs). Returns null if already at `maxOwned`.
 */
export function nextPurchaseCost(def: UpgradeDef, ownedCount: number): ResourceCosts | null {
  if (def.maxOwned !== undefined && ownedCount >= def.maxOwned) return null;
  const o = Math.max(0, Math.floor(ownedCount));
  const multiplier = 2 ** o;
  const out: ResourceCosts = {};
  for (const resourceId of PRIMARY_RESOURCE_IDS) {
    const v = def.costs[resourceId];
    if (typeof v === "number" && v > 0) {
      out[resourceId] = Math.max(1, Math.round(v * multiplier));
    }
  }
  if (Object.keys(out).length === 0) return null;
  return out;
}
