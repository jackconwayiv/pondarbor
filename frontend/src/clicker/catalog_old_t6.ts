/** Auto-generated from pond_clicker_runtime_catalog_seed.json. */
export const TIER1_MARQUEE_PASSIVE_BONUS = 0.12;

/**
 * Kept for compatibility with the current runtime while the pause/completion
 * logic is moved from Tier 1 to Tier 6.
 */
export const TIER1_MARQUEE_IDS = [
  "pond_snails",
  "tadpoles",
  "water_fleas",
  "dragonfly_nymph",
  "leeches",
] as const;

/** Final-game completion target inferred from the canon node sheet. */
export const FINAL_TIER_MARQUEE_IDS = [
  "otters",
  "beavers",
  "bald_eagles",
  "bowfin",
  "mute_swans",
] as const;

/** Marquee denizen ids grouped by tier. */
export const MARQUEE_IDS_BY_TIER = {
  "1": ["pond_snails", "tadpoles", "water_fleas", "dragonfly_nymph", "leeches"],
  "2": [
    "crayfish",
    "minnows",
    "green_frogs",
    "water_striders",
    "diving_beetles",
  ],
  "3": [
    "bluegill",
    "pumpkinseed_sunfish",
    "painted_turtles",
    "salamanders",
    "perch",
  ],
  "4": [
    "largemouth_bass",
    "softshell_turtle",
    "bullfrogs",
    "muskrats",
    "catfish",
  ],
  "5": [
    "northern_pike",
    "snapping_turtle",
    "mallard_ducks",
    "great_blue_herons",
    "canada_geese",
  ],
  "6": ["otters", "beavers", "bald_eagles", "bowfin", "mute_swans"],
} as const;

/** Long-hover ecology copy for the pond stage (not tied to a single upgrade). */
export const POND_STAGE_ECOLOGY_NOTE =
  "Ponds are small, still or slow-moving freshwater habitats where shallow edges, soft bottoms, plants, plankton, and open water create tightly packed food webs.";

export type PondStatId = "fertility" | "oxygen" | "depth" | "shelter";

export type UpgradeFamily =
  | "Geology"
  | "Hydrology"
  | "Nutrients"
  | "Structure"
  | "Invertebrates"
  | "Herptiles"
  | "Plants"
  | "Microbes, Algae, and Plankton"
  | "Fish"
  | "Mammals"
  | "Birds";

export type DenizenKind = "animal" | "plant" | "fungus";

/** Only Energy is spent; `energy` may be 0 (e.g. Pond Basin). */
export type EnergyCosts = { energy: number };

export type PondVisualSpec = { type: "sunlight_twinkle"; perStack: true };

export type UpgradeRequirement =
  | { type: "prerequisite_upgrade"; upgradeIds: string[] }
  | { type: "owned_upgrade_threshold"; upgradeId: string; minLevel: number }
  | { type: "family_threshold"; family: UpgradeFamily; minOwned: number }
  | { type: "stat_threshold"; stat: PondStatId; min: number }
  | { type: "biodiversity_threshold"; min: number };

export type UpgradeEffect =
  | { type: "passive_generation"; resource: "energy"; amount: number }
  | { type: "click_bonus"; amount: number }
  | {
      type: "multiplier";
      target: "global" | "click" | "passive";
      value: number;
    }
  | { type: "unlock"; mechanicId: string }
  | { type: "threshold_delta"; stat: PondStatId; delta: number };

export type RequirementScalingMeta = Partial<
  Record<PondStatId | "biodiversity", number>
>;

export type UpgradeDef = {
  id: string;
  name: string;
  family: UpgradeFamily;
  tier: number;
  description: string;
  effectText?: string;
  /** Real-world ecology for tooltips; keep game mechanics in `description` / effects. */
  ecologyNote: string;
  costs: EnergyCosts;
  maxOwned?: number;
  requirements: UpgradeRequirement[];
  effects: UpgradeEffect[];
  denizenKind?: DenizenKind;
  pondVisual?: PondVisualSpec;
  /** Canon node-sheet metadata preserved for rule/UI migration. */
  nodeType?: string;
  isMarquee?: boolean;
  meta?: {
    requirementScalingPerOwned?: RequirementScalingMeta;
  };
};

export function validateUpgradeDef(upgrade: UpgradeDef): string[] {
  const errors: string[] = [];
  if (
    upgrade.denizenKind &&
    (upgrade.family === "Geology" ||
      upgrade.family === "Hydrology" ||
      upgrade.family === "Structure" ||
      upgrade.family === "Nutrients")
  ) {
    // Allowed, because canon families are broader than the old internal abiotic split.
  }
  if (upgrade.maxOwned !== undefined) {
    if (!Number.isInteger(upgrade.maxOwned) || upgrade.maxOwned < 1) {
      errors.push(`${upgrade.id}: maxOwned must be a positive integer`);
    }
  }
  if (
    !(typeof upgrade.costs.energy === "number") ||
    !Number.isFinite(upgrade.costs.energy) ||
    upgrade.costs.energy < 0
  ) {
    errors.push(`${upgrade.id}: costs.energy must be a finite number ≥ 0`);
  }
  if (
    typeof upgrade.ecologyNote !== "string" ||
    upgrade.ecologyNote.trim().length < 8
  ) {
    errors.push(`${upgrade.id}: ecologyNote must be a non-empty string`);
  }
  return errors;
}

export function getOwnedCount(
  ownedUpgrades: Record<string, number>,
  upgradeId: string,
): number {
  const n = ownedUpgrades[upgradeId];
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}

export function effectiveOwnedStacks(
  def: UpgradeDef,
  ownedUpgrades: Record<string, number>,
): number {
  const raw = getOwnedCount(ownedUpgrades, def.id);
  if (def.maxOwned === undefined) return raw;
  return Math.min(raw, def.maxOwned);
}

export type ResourcePresentation = { label: string; symbol: string };
export type FamilyPresentation = {
  label: string;
  symbol: string;
  accent: string;
};

export const ENERGY_PRESENTATION: ResourcePresentation = {
  label: "Energy",
  symbol: "⚡",
};

/** Spendable primary resource in v1 (Energy only). */
export type PrimaryResourceId = "energy";

export const PRIMARY_RESOURCE_IDS: readonly PrimaryResourceId[] = ["energy"];

export const RESOURCE_PRESENTATION: Record<
  PrimaryResourceId,
  ResourcePresentation
> = {
  energy: ENERGY_PRESENTATION,
};

export const POND_STAT_LABELS: Record<PondStatId, string> = {
  fertility: "Fertility",
  oxygen: "Oxygen",
  depth: "Depth",
  shelter: "Shelter",
};

export const FAMILY_PRESENTATION: Record<UpgradeFamily, FamilyPresentation> = {
  Geology: {
    label: "Geology",
    symbol: "🪨",
    accent: "#6b7280",
  },
  Hydrology: {
    label: "Hydrology",
    symbol: "💧",
    accent: "#2563eb",
  },
  Nutrients: {
    label: "Nutrients",
    symbol: "🧪",
    accent: "#8b5e3c",
  },
  Structure: {
    label: "Structure",
    symbol: "🪵",
    accent: "#7c4f2a",
  },
  Invertebrates: {
    label: "Invertebrates",
    symbol: "🦐",
    accent: "#b45309",
  },
  Herptiles: {
    label: "Herptiles",
    symbol: "🐸",
    accent: "#4d7c0f",
  },
  Plants: {
    label: "Plants",
    symbol: "🌿",
    accent: "#2f855a",
  },
  "Microbes, Algae, and Plankton": {
    label: "Microbes, Algae, and Plankton",
    symbol: "🦠",
    accent: "#0f766e",
  },
  Fish: {
    label: "Fish",
    symbol: "🐟",
    accent: "#0369a1",
  },
  Mammals: {
    label: "Mammals",
    symbol: "🦫",
    accent: "#92400e",
  },
  Birds: {
    label: "Birds",
    symbol: "🦆",
    accent: "#7c3aed",
  },
};

export const CATALOG_UPGRADES: UpgradeDef[] = [
  {
    id: "pond_basin",
    name: "Pond Basin",
    family: "Geology",
    tier: 0,
    description: "A foundational geology upgrade. Depth +25, Energy/Click +1.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 0,
    },
    maxOwned: 1,
    requirements: [],
    effects: [
      {
        type: "threshold_delta",
        stat: "depth",
        delta: 25,
      },
      {
        type: "click_bonus",
        amount: 1,
      },
    ],
    nodeType: "Threshold & Economy",
    isMarquee: false,
  },
  {
    id: "filtered_sunlight",
    name: "Filtered Sunlight",
    family: "Hydrology",
    tier: 0,
    description: "A hydrology threshold upgrade. Oxygen +25.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 30,
    },
    maxOwned: 1,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["still_water"],
      },
    ],
    effects: [
      {
        type: "threshold_delta",
        stat: "oxygen",
        delta: 25,
      },
    ],
    nodeType: "Threshold",
    isMarquee: false,
  },
  {
    id: "nutrient_silt",
    name: "Nutrient Silt",
    family: "Nutrients",
    tier: 0,
    description: "A nutrients threshold upgrade. Fertility +25.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 40,
    },
    maxOwned: 1,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["still_water"],
      },
      {
        type: "stat_threshold",
        stat: "oxygen",
        min: 5,
      },
    ],
    effects: [
      {
        type: "threshold_delta",
        stat: "fertility",
        delta: 25,
      },
    ],
    nodeType: "Threshold",
    isMarquee: false,
  },
  {
    id: "fallen_branch",
    name: "Fallen Branch",
    family: "Structure",
    tier: 0,
    description: "A structure threshold upgrade. Shelter +25.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 50,
    },
    maxOwned: 1,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["still_water"],
      },
      {
        type: "stat_threshold",
        stat: "fertility",
        min: 5,
      },
    ],
    effects: [
      {
        type: "threshold_delta",
        stat: "shelter",
        delta: 25,
      },
    ],
    nodeType: "Threshold",
    isMarquee: false,
  },
  {
    id: "midge_hatch",
    name: "Midge Hatch",
    family: "Invertebrates",
    tier: 0,
    description:
      "A invertebrates prerequisite upgrade. prerequisite for Spawning Shallows.",
    effectText: "click upgrade prerequisite",
    ecologyNote: "Midge swarms bring a first pulse of insect life to the pond.",
    costs: {
      energy: 60,
    },
    maxOwned: 1,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["still_water"],
      },
      {
        type: "stat_threshold",
        stat: "depth",
        min: 5,
      },
      {
        type: "stat_threshold",
        stat: "fertility",
        min: 5,
      },
      {
        type: "stat_threshold",
        stat: "oxygen",
        min: 5,
      },
      {
        type: "stat_threshold",
        stat: "shelter",
        min: 5,
      },
    ],
    effects: [],
    nodeType: "Prerequisite",
    isMarquee: false,
  },
  {
    id: "still_water",
    name: "Still Water",
    family: "Hydrology",
    tier: 0,
    description: "A hydrology economy upgrade. Energy/Second +1.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 20,
    },
    maxOwned: 1,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["pond_basin"],
      },
      {
        type: "stat_threshold",
        stat: "depth",
        min: 5,
      },
    ],
    effects: [
      {
        type: "passive_generation",
        resource: "energy",
        amount: 1,
      },
    ],
    nodeType: "Economy",
    isMarquee: false,
  },
  {
    id: "pond_snails",
    name: "Pond Snails",
    family: "Invertebrates",
    tier: 1,
    description: "A invertebrates denizen upgrade. Energy/Click +50%.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 760,
    },
    maxOwned: 1,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["pond_algae"],
      },
      {
        type: "stat_threshold",
        stat: "fertility",
        min: 50,
      },
      {
        type: "stat_threshold",
        stat: "oxygen",
        min: 50,
      },
    ],
    effects: [
      {
        type: "multiplier",
        target: "click",
        value: 0.5,
      },
    ],
    nodeType: "Denizen",
    isMarquee: true,
    denizenKind: "animal",
  },
  {
    id: "tadpoles",
    name: "Tadpoles",
    family: "Herptiles",
    tier: 1,
    description: "A herptiles denizen upgrade. Energy/Second +25%.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 780,
    },
    maxOwned: 1,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["spawning_shallows"],
      },
      {
        type: "stat_threshold",
        stat: "depth",
        min: 50,
      },
      {
        type: "stat_threshold",
        stat: "shelter",
        min: 75,
      },
    ],
    effects: [
      {
        type: "multiplier",
        target: "passive",
        value: 0.25,
      },
    ],
    nodeType: "Denizen",
    isMarquee: true,
    denizenKind: "animal",
  },
  {
    id: "water_fleas",
    name: "Water Fleas",
    family: "Invertebrates",
    tier: 1,
    description: "A invertebrates denizen upgrade. Energy/Second +25%.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 800,
    },
    maxOwned: 1,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["pond_algae"],
      },
      {
        type: "stat_threshold",
        stat: "fertility",
        min: 75,
      },
      {
        type: "stat_threshold",
        stat: "oxygen",
        min: 50,
      },
    ],
    effects: [
      {
        type: "multiplier",
        target: "passive",
        value: 0.25,
      },
    ],
    nodeType: "Denizen",
    isMarquee: true,
    denizenKind: "animal",
  },
  {
    id: "dragonfly_nymph",
    name: "Dragonfly Nymph",
    family: "Invertebrates",
    tier: 1,
    description: "A invertebrates denizen upgrade. Energy/Second +25%.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 820,
    },
    maxOwned: 1,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["reed_fringe"],
      },
      {
        type: "stat_threshold",
        stat: "oxygen",
        min: 75,
      },
      {
        type: "stat_threshold",
        stat: "shelter",
        min: 75,
      },
    ],
    effects: [
      {
        type: "multiplier",
        target: "passive",
        value: 0.25,
      },
    ],
    nodeType: "Denizen",
    isMarquee: true,
    denizenKind: "animal",
  },
  {
    id: "leeches",
    name: "Leeches",
    family: "Invertebrates",
    tier: 1,
    description: "A invertebrates denizen upgrade. Energy/Click +50%.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 840,
    },
    maxOwned: 1,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["detritus"],
      },
      {
        type: "stat_threshold",
        stat: "depth",
        min: 50,
      },
      {
        type: "stat_threshold",
        stat: "fertility",
        min: 75,
      },
    ],
    effects: [
      {
        type: "multiplier",
        target: "click",
        value: 0.5,
      },
    ],
    nodeType: "Denizen",
    isMarquee: true,
    denizenKind: "animal",
  },
  {
    id: "shallow_shelf",
    name: "Shallow Shelf",
    family: "Geology",
    tier: 1,
    description: "A geology threshold upgrade. Depth +20 / Stack.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 75,
    },
    maxOwned: 5,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["still_water"],
      },
      {
        type: "stat_threshold",
        stat: "depth",
        min: 25,
      },
    ],
    effects: [
      {
        type: "threshold_delta",
        stat: "depth",
        delta: 20,
      },
    ],
    nodeType: "Threshold",
    isMarquee: false,
  },
  {
    id: "detritus",
    name: "Detritus",
    family: "Nutrients",
    tier: 1,
    description: "A nutrients threshold upgrade. Fertility +20 / Stack.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 75,
    },
    maxOwned: 5,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["nutrient_silt"],
      },
      {
        type: "stat_threshold",
        stat: "fertility",
        min: 25,
      },
    ],
    effects: [
      {
        type: "threshold_delta",
        stat: "fertility",
        delta: 20,
      },
    ],
    nodeType: "Threshold",
    isMarquee: false,
  },
  {
    id: "pondweed",
    name: "Pondweed",
    family: "Plants",
    tier: 1,
    description: "A plants threshold upgrade. Oxygen +20 / Stack.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 75,
    },
    maxOwned: 5,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["filtered_sunlight"],
      },
      {
        type: "stat_threshold",
        stat: "oxygen",
        min: 25,
      },
    ],
    effects: [
      {
        type: "threshold_delta",
        stat: "oxygen",
        delta: 20,
      },
    ],
    nodeType: "Threshold",
    isMarquee: false,
  },
  {
    id: "reed_fringe",
    name: "Reed Fringe",
    family: "Plants",
    tier: 1,
    description: "A plants threshold upgrade. Shelter +20 / Stack.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 75,
    },
    maxOwned: 5,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["fallen_branch"],
      },
      {
        type: "stat_threshold",
        stat: "shelter",
        min: 25,
      },
    ],
    effects: [
      {
        type: "threshold_delta",
        stat: "shelter",
        delta: 20,
      },
    ],
    nodeType: "Threshold",
    isMarquee: false,
  },
  {
    id: "spawning_shallows",
    name: "Spawning Shallows",
    family: "Hydrology",
    tier: 1,
    description: "A hydrology economy upgrade. Energy/Click +2 per Stack.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 125,
    },
    maxOwned: 5,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["midge_hatch"],
      },
      {
        type: "stat_threshold",
        stat: "depth",
        min: 25,
      },
      {
        type: "stat_threshold",
        stat: "shelter",
        min: 25,
      },
    ],
    effects: [
      {
        type: "click_bonus",
        amount: 2,
      },
    ],
    nodeType: "Economy",
    isMarquee: false,
    meta: {
      requirementScalingPerOwned: {
        fertility: 15,
      },
    },
  },
  {
    id: "pond_algae",
    name: "Pond Algae",
    family: "Microbes, Algae, and Plankton",
    tier: 1,
    description:
      "A microbes, algae, and plankton economy upgrade. Energy/Second +2 per Stack.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 250,
    },
    maxOwned: 5,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["detritus"],
      },
      {
        type: "stat_threshold",
        stat: "fertility",
        min: 50,
      },
      {
        type: "stat_threshold",
        stat: "oxygen",
        min: 50,
      },
    ],
    effects: [],
    nodeType: "Economy",
    isMarquee: false,
    meta: {
      requirementScalingPerOwned: {
        depth: 15,
      },
    },
  },
  {
    id: "crayfish",
    name: "Crayfish",
    family: "Invertebrates",
    tier: 2,
    description: "A invertebrates denizen upgrade. Energy/Click +50%.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 30000,
    },
    maxOwned: 1,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["sunken_log"],
      },
      {
        type: "stat_threshold",
        stat: "fertility",
        min: 175,
      },
      {
        type: "stat_threshold",
        stat: "shelter",
        min: 200,
      },
    ],
    effects: [
      {
        type: "multiplier",
        target: "click",
        value: 0.5,
      },
    ],
    nodeType: "Denizen",
    isMarquee: true,
    denizenKind: "animal",
  },
  {
    id: "minnows",
    name: "Minnows",
    family: "Fish",
    tier: 2,
    description: "A fish denizen upgrade. Energy/Second +25%.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 31000,
    },
    maxOwned: 1,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["zooplankton_bloom", "microbial_biofilm"],
      },
      {
        type: "stat_threshold",
        stat: "depth",
        min: 200,
      },
      {
        type: "stat_threshold",
        stat: "oxygen",
        min: 200,
      },
    ],
    effects: [
      {
        type: "multiplier",
        target: "passive",
        value: 0.25,
      },
    ],
    nodeType: "Denizen",
    isMarquee: true,
    denizenKind: "animal",
  },
  {
    id: "green_frogs",
    name: "Green Frogs",
    family: "Herptiles",
    tier: 2,
    description: "A herptiles denizen upgrade. Energy/Second +25%.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 32000,
    },
    maxOwned: 1,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["cattail_stand"],
      },
      {
        type: "stat_threshold",
        stat: "oxygen",
        min: 175,
      },
      {
        type: "stat_threshold",
        stat: "shelter",
        min: 225,
      },
    ],
    effects: [
      {
        type: "multiplier",
        target: "passive",
        value: 0.25,
      },
    ],
    nodeType: "Denizen",
    isMarquee: true,
    denizenKind: "animal",
  },
  {
    id: "water_striders",
    name: "Water Striders",
    family: "Invertebrates",
    tier: 2,
    description: "A invertebrates denizen upgrade. Energy/Second +25%.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 33000,
    },
    maxOwned: 1,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["wading_flats"],
      },
      {
        type: "stat_threshold",
        stat: "oxygen",
        min: 175,
      },
      {
        type: "stat_threshold",
        stat: "shelter",
        min: 200,
      },
    ],
    effects: [
      {
        type: "multiplier",
        target: "passive",
        value: 0.25,
      },
    ],
    nodeType: "Denizen",
    isMarquee: true,
    denizenKind: "animal",
  },
  {
    id: "diving_beetles",
    name: "Diving Beetles",
    family: "Invertebrates",
    tier: 2,
    description: "A invertebrates denizen upgrade. Energy/Click +50%.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 34000,
    },
    maxOwned: 1,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["sunken_log"],
      },
      {
        type: "stat_threshold",
        stat: "depth",
        min: 175,
      },
      {
        type: "stat_threshold",
        stat: "oxygen",
        min: 225,
      },
    ],
    effects: [
      {
        type: "multiplier",
        target: "click",
        value: 0.5,
      },
    ],
    nodeType: "Denizen",
    isMarquee: true,
    denizenKind: "animal",
  },
  {
    id: "wading_flats",
    name: "Wading Flats",
    family: "Geology",
    tier: 2,
    description: "A geology threshold upgrade. Depth +25 / Stack.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 700,
    },
    maxOwned: 5,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["shallow_shelf"],
      },
      {
        type: "stat_threshold",
        stat: "depth",
        min: 125,
      },
    ],
    effects: [
      {
        type: "threshold_delta",
        stat: "depth",
        delta: 25,
      },
    ],
    nodeType: "Threshold",
    isMarquee: false,
  },
  {
    id: "microbial_biofilm",
    name: "Microbial Biofilm",
    family: "Microbes, Algae, and Plankton",
    tier: 2,
    description:
      "A microbes, algae, and plankton prerequisite upgrade. prerequisite for Soft Muck.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 15000,
    },
    maxOwned: 1,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["leaf_litter_bed"],
      },
      {
        type: "stat_threshold",
        stat: "fertility",
        min: 125,
      },
      {
        type: "stat_threshold",
        stat: "oxygen",
        min: 100,
      },
    ],
    effects: [],
    nodeType: "Prerequisite",
    isMarquee: false,
  },
  {
    id: "leaf_litter_bed",
    name: "Leaf Litter Bed",
    family: "Nutrients",
    tier: 2,
    description: "A nutrients threshold upgrade. Fertility +25 / Stack.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 700,
    },
    maxOwned: 5,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["detritus"],
      },
      {
        type: "stat_threshold",
        stat: "fertility",
        min: 125,
      },
    ],
    effects: [
      {
        type: "threshold_delta",
        stat: "fertility",
        delta: 25,
      },
    ],
    nodeType: "Threshold",
    isMarquee: false,
  },
  {
    id: "submerged_weeds",
    name: "Submerged Weeds",
    family: "Plants",
    tier: 2,
    description: "A plants threshold upgrade. Oxygen +25 / Stack.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 700,
    },
    maxOwned: 5,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["pondweed"],
      },
      {
        type: "stat_threshold",
        stat: "oxygen",
        min: 125,
      },
    ],
    effects: [
      {
        type: "threshold_delta",
        stat: "oxygen",
        delta: 25,
      },
    ],
    nodeType: "Threshold",
    isMarquee: false,
  },
  {
    id: "cattail_stand",
    name: "Cattail Stand",
    family: "Plants",
    tier: 2,
    description: "A plants threshold upgrade. Shelter +25 / Stack.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 700,
    },
    maxOwned: 5,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["reed_fringe"],
      },
      {
        type: "stat_threshold",
        stat: "shelter",
        min: 125,
      },
    ],
    effects: [
      {
        type: "threshold_delta",
        stat: "shelter",
        delta: 25,
      },
    ],
    nodeType: "Threshold",
    isMarquee: false,
  },
  {
    id: "decomposer_fungi",
    name: "Decomposer Fungi",
    family: "Microbes, Algae, and Plankton",
    tier: 2,
    description:
      "A microbes, algae, and plankton prerequisite upgrade. prerequisite for Zooplankton Bloom.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 750,
    },
    maxOwned: 1,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["pond_algae"],
      },
      {
        type: "stat_threshold",
        stat: "fertility",
        min: 150,
      },
      {
        type: "stat_threshold",
        stat: "oxygen",
        min: 125,
      },
    ],
    effects: [],
    nodeType: "Prerequisite",
    isMarquee: false,
  },
  {
    id: "sunken_log",
    name: "Sunken Log",
    family: "Structure",
    tier: 2,
    description: "A structure economy upgrade. Energy/Click +40 per Stack.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 1000,
    },
    maxOwned: 5,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["spawning_shallows"],
      },
      {
        type: "stat_threshold",
        stat: "depth",
        min: 125,
      },
      {
        type: "stat_threshold",
        stat: "shelter",
        min: 125,
      },
    ],
    effects: [
      {
        type: "click_bonus",
        amount: 4,
      },
    ],
    nodeType: "Economy",
    isMarquee: false,
    meta: {
      requirementScalingPerOwned: {
        fertility: 20,
      },
    },
  },
  {
    id: "zooplankton_bloom",
    name: "Zooplankton Bloom",
    family: "Microbes, Algae, and Plankton",
    tier: 2,
    description:
      "A microbes, algae, and plankton economy upgrade. Energy/Second +40 per Stack.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 1500,
    },
    maxOwned: 5,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["decomposer_fungi"],
      },
      {
        type: "stat_threshold",
        stat: "fertility",
        min: 150,
      },
      {
        type: "stat_threshold",
        stat: "oxygen",
        min: 150,
      },
    ],
    effects: [
      {
        type: "passive_generation",
        resource: "energy",
        amount: 4,
      },
    ],
    nodeType: "Economy",
    isMarquee: false,
    meta: {
      requirementScalingPerOwned: {
        depth: 20,
      },
    },
  },
  {
    id: "bluegill",
    name: "Bluegill",
    family: "Fish",
    tier: 3,
    description: "A fish denizen upgrade. Energy/Click +50%.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 1000000,
    },
    maxOwned: 1,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["calm_eddies", "living_sediment"],
      },
      {
        type: "stat_threshold",
        stat: "depth",
        min: 300,
      },
      {
        type: "stat_threshold",
        stat: "oxygen",
        min: 300,
      },
    ],
    effects: [
      {
        type: "multiplier",
        target: "click",
        value: 0.5,
      },
    ],
    nodeType: "Denizen",
    isMarquee: true,
    denizenKind: "animal",
  },
  {
    id: "pumpkinseed_sunfish",
    name: "Pumpkinseed Sunfish",
    family: "Fish",
    tier: 3,
    description: "A fish denizen upgrade. Energy/Second +25%.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 1100000,
    },
    maxOwned: 1,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["open_water", "living_sediment"],
      },
      {
        type: "stat_threshold",
        stat: "oxygen",
        min: 325,
      },
      {
        type: "stat_threshold",
        stat: "shelter",
        min: 300,
      },
    ],
    effects: [
      {
        type: "multiplier",
        target: "passive",
        value: 0.25,
      },
    ],
    nodeType: "Denizen",
    isMarquee: true,
    denizenKind: "animal",
  },
  {
    id: "painted_turtles",
    name: "Painted Turtles",
    family: "Herptiles",
    tier: 3,
    description: "A herptiles denizen upgrade. Energy/Second +25%.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 1200000,
    },
    maxOwned: 1,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["tangled_roots"],
      },
      {
        type: "stat_threshold",
        stat: "depth",
        min: 300,
      },
      {
        type: "stat_threshold",
        stat: "shelter",
        min: 325,
      },
    ],
    effects: [
      {
        type: "multiplier",
        target: "passive",
        value: 0.25,
      },
    ],
    nodeType: "Denizen",
    isMarquee: true,
    denizenKind: "animal",
  },
  {
    id: "salamanders",
    name: "Salamanders",
    family: "Herptiles",
    tier: 3,
    description: "A herptiles denizen upgrade. Energy/Second +25%.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 1300000,
    },
    maxOwned: 1,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["calling_reeds"],
      },
      {
        type: "stat_threshold",
        stat: "oxygen",
        min: 300,
      },
      {
        type: "stat_threshold",
        stat: "shelter",
        min: 325,
      },
    ],
    effects: [
      {
        type: "multiplier",
        target: "passive",
        value: 0.25,
      },
    ],
    nodeType: "Denizen",
    isMarquee: true,
    denizenKind: "animal",
  },
  {
    id: "perch",
    name: "Perch",
    family: "Fish",
    tier: 3,
    description: "A fish denizen upgrade. Energy/Click +50%.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 1400000,
    },
    maxOwned: 1,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["calm_eddies", "living_sediment"],
      },
      {
        type: "stat_threshold",
        stat: "depth",
        min: 325,
      },
      {
        type: "stat_threshold",
        stat: "oxygen",
        min: 325,
      },
    ],
    effects: [
      {
        type: "multiplier",
        target: "click",
        value: 0.5,
      },
    ],
    nodeType: "Denizen",
    isMarquee: true,
    denizenKind: "animal",
  },
  {
    id: "deeper_channel",
    name: "Deeper Channel",
    family: "Geology",
    tier: 3,
    description: "A geology threshold upgrade. Depth +30 / Stack.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 25000,
    },
    maxOwned: 5,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["wading_flats"],
      },
      {
        type: "stat_threshold",
        stat: "depth",
        min: 250,
      },
    ],
    effects: [
      {
        type: "threshold_delta",
        stat: "depth",
        delta: 30,
      },
    ],
    nodeType: "Threshold",
    isMarquee: false,
  },
  {
    id: "soft_muck",
    name: "Soft Muck",
    family: "Nutrients",
    tier: 3,
    description: "A nutrients threshold upgrade. Fertility +30 / Stack.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 25000,
    },
    maxOwned: 5,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["microbial_biofilm"],
      },
      {
        type: "stat_threshold",
        stat: "fertility",
        min: 250,
      },
    ],
    effects: [
      {
        type: "threshold_delta",
        stat: "fertility",
        delta: 30,
      },
    ],
    nodeType: "Threshold",
    isMarquee: false,
  },
  {
    id: "open_water",
    name: "Open Water",
    family: "Hydrology",
    tier: 3,
    description: "A hydrology threshold upgrade. Oxygen +30 / Stack.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 25000,
    },
    maxOwned: 5,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["submerged_weeds"],
      },
      {
        type: "stat_threshold",
        stat: "oxygen",
        min: 250,
      },
    ],
    effects: [
      {
        type: "threshold_delta",
        stat: "oxygen",
        delta: 30,
      },
    ],
    nodeType: "Threshold",
    isMarquee: false,
  },
  {
    id: "tangled_roots",
    name: "Tangled Roots",
    family: "Structure",
    tier: 3,
    description: "A structure threshold upgrade. Shelter +30 / Stack.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 25000,
    },
    maxOwned: 5,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["cattail_stand"],
      },
      {
        type: "stat_threshold",
        stat: "shelter",
        min: 250,
      },
    ],
    effects: [
      {
        type: "threshold_delta",
        stat: "shelter",
        delta: 30,
      },
    ],
    nodeType: "Threshold",
    isMarquee: false,
  },
  {
    id: "living_sediment",
    name: "Living Sediment",
    family: "Nutrients",
    tier: 3,
    description:
      "A nutrients prerequisite upgrade. prerequisite for Fish denizens.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 575000,
    },
    maxOwned: 1,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["microbial_biofilm"],
      },
      {
        type: "stat_threshold",
        stat: "fertility",
        min: 275,
      },
      {
        type: "stat_threshold",
        stat: "oxygen",
        min: 250,
      },
    ],
    effects: [],
    nodeType: "Prerequisite",
    isMarquee: false,
  },
  {
    id: "calm_eddies",
    name: "Calm Eddies",
    family: "Hydrology",
    tier: 3,
    description: "A hydrology economy upgrade. Energy/Click +800 / Stack.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 47500,
    },
    maxOwned: 5,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["sunken_log"],
      },
      {
        type: "stat_threshold",
        stat: "depth",
        min: 250,
      },
      {
        type: "stat_threshold",
        stat: "oxygen",
        min: 250,
      },
    ],
    effects: [
      {
        type: "click_bonus",
        amount: 800,
      },
    ],
    nodeType: "Economy",
    isMarquee: false,
    meta: {
      requirementScalingPerOwned: {
        fertility: 25,
      },
    },
  },
  {
    id: "calling_reeds",
    name: "Calling Reeds",
    family: "Plants",
    tier: 3,
    description: "A plants economy upgrade. Energy/Second +800 / Stack.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 52500,
    },
    maxOwned: 5,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["zooplankton_bloom"],
      },
      {
        type: "stat_threshold",
        stat: "fertility",
        min: 275,
      },
      {
        type: "stat_threshold",
        stat: "shelter",
        min: 275,
      },
    ],
    effects: [
      {
        type: "passive_generation",
        resource: "energy",
        amount: 800,
      },
    ],
    nodeType: "Economy",
    isMarquee: false,
    meta: {
      requirementScalingPerOwned: {
        depth: 25,
      },
    },
  },
  {
    id: "largemouth_bass",
    name: "Largemouth Bass",
    family: "Fish",
    tier: 4,
    description: "A fish denizen upgrade. Energy/Click +50%.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 48000000,
    },
    maxOwned: 1,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["feeding_waters", "living_sediment"],
      },
      {
        type: "stat_threshold",
        stat: "depth",
        min: 500,
      },
      {
        type: "stat_threshold",
        stat: "oxygen",
        min: 525,
      },
    ],
    effects: [
      {
        type: "multiplier",
        target: "click",
        value: 0.5,
      },
    ],
    nodeType: "Denizen",
    isMarquee: true,
    denizenKind: "animal",
  },
  {
    id: "softshell_turtle",
    name: "Softshell Turtle",
    family: "Herptiles",
    tier: 4,
    description: "A herptiles denizen upgrade. Energy/Second +25%.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 49000000,
    },
    maxOwned: 1,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["deep_pool", "living_sediment"],
      },
      {
        type: "stat_threshold",
        stat: "depth",
        min: 525,
      },
      {
        type: "stat_threshold",
        stat: "fertility",
        min: 500,
      },
    ],
    effects: [
      {
        type: "multiplier",
        target: "passive",
        value: 0.25,
      },
    ],
    nodeType: "Denizen",
    isMarquee: true,
    denizenKind: "animal",
  },
  {
    id: "bullfrogs",
    name: "Bullfrogs",
    family: "Herptiles",
    tier: 4,
    description: "A herptiles denizen upgrade. Energy/Second +25%.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 50000000,
    },
    maxOwned: 1,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["lily_pads"],
      },
      {
        type: "stat_threshold",
        stat: "oxygen",
        min: 500,
      },
      {
        type: "stat_threshold",
        stat: "shelter",
        min: 525,
      },
    ],
    effects: [
      {
        type: "multiplier",
        target: "passive",
        value: 0.25,
      },
    ],
    nodeType: "Denizen",
    isMarquee: true,
    denizenKind: "animal",
  },
  {
    id: "muskrats",
    name: "Muskrats",
    family: "Mammals",
    tier: 4,
    description: "A mammals denizen upgrade. Energy/Second +25%.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 51000000,
    },
    maxOwned: 1,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["black_muck"],
      },
      {
        type: "stat_threshold",
        stat: "fertility",
        min: 500,
      },
      {
        type: "stat_threshold",
        stat: "shelter",
        min: 550,
      },
    ],
    effects: [
      {
        type: "multiplier",
        target: "passive",
        value: 0.25,
      },
    ],
    nodeType: "Denizen",
    isMarquee: true,
    denizenKind: "animal",
  },
  {
    id: "catfish",
    name: "Catfish",
    family: "Fish",
    tier: 4,
    description: "A fish denizen upgrade. Energy/Click +50%.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 52000000,
    },
    maxOwned: 1,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["feeding_waters", "living_sediment"],
      },
      {
        type: "stat_threshold",
        stat: "depth",
        min: 500,
      },
      {
        type: "stat_threshold",
        stat: "fertility",
        min: 550,
      },
    ],
    effects: [
      {
        type: "multiplier",
        target: "click",
        value: 0.5,
      },
    ],
    nodeType: "Denizen",
    isMarquee: true,
    denizenKind: "animal",
  },
  {
    id: "deep_pool",
    name: "Deep Pool",
    family: "Geology",
    tier: 4,
    description: "A geology threshold upgrade. Depth +35 / Stack.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 1200000,
    },
    maxOwned: 5,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["deeper_channel"],
      },
      {
        type: "stat_threshold",
        stat: "depth",
        min: 400,
      },
    ],
    effects: [
      {
        type: "threshold_delta",
        stat: "depth",
        delta: 35,
      },
    ],
    nodeType: "Threshold",
    isMarquee: false,
  },
  {
    id: "black_muck",
    name: "Black Muck",
    family: "Nutrients",
    tier: 4,
    description: "A nutrients threshold upgrade. Fertility +35 / Stack.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 900000,
    },
    maxOwned: 5,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["soft_muck"],
      },
      {
        type: "stat_threshold",
        stat: "fertility",
        min: 400,
      },
    ],
    effects: [
      {
        type: "threshold_delta",
        stat: "fertility",
        delta: 35,
      },
    ],
    nodeType: "Threshold",
    isMarquee: false,
  },
  {
    id: "breezy_surface",
    name: "Breezy Surface",
    family: "Hydrology",
    tier: 4,
    description: "A hydrology threshold upgrade. Oxygen +35 / Stack.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 1000000,
    },
    maxOwned: 5,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["open_water"],
      },
      {
        type: "stat_threshold",
        stat: "oxygen",
        min: 400,
      },
    ],
    effects: [
      {
        type: "threshold_delta",
        stat: "oxygen",
        delta: 35,
      },
    ],
    nodeType: "Threshold",
    isMarquee: false,
  },
  {
    id: "lily_pads",
    name: "Lily Pads",
    family: "Plants",
    tier: 4,
    description: "A plants threshold upgrade. Shelter +35 / Stack.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 1100000,
    },
    maxOwned: 5,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["tangled_roots"],
      },
      {
        type: "stat_threshold",
        stat: "shelter",
        min: 400,
      },
    ],
    effects: [
      {
        type: "threshold_delta",
        stat: "shelter",
        delta: 35,
      },
    ],
    nodeType: "Threshold",
    isMarquee: false,
  },
  {
    id: "feeding_waters",
    name: "Feeding Waters",
    family: "Fish",
    tier: 4,
    description: "A fish economy upgrade. Energy/Click +16,000 / Stack.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 2000000,
    },
    maxOwned: 5,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["calm_eddies"],
      },
      {
        type: "stat_threshold",
        stat: "depth",
        min: 400,
      },
      {
        type: "stat_threshold",
        stat: "fertility",
        min: 400,
      },
    ],
    effects: [
      {
        type: "click_bonus",
        amount: 16000,
      },
    ],
    nodeType: "Economy",
    isMarquee: false,
    meta: {
      requirementScalingPerOwned: {
        oxygen: 30,
      },
    },
  },
  {
    id: "rainwater_inflow",
    name: "Rainwater Inflow",
    family: "Hydrology",
    tier: 4,
    description:
      "A hydrology economy upgrade. Energy / Second +16,000 / Stack.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 2200000,
    },
    maxOwned: 5,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["calling_reeds"],
      },
      {
        type: "stat_threshold",
        stat: "oxygen",
        min: 425,
      },
      {
        type: "stat_threshold",
        stat: "shelter",
        min: 425,
      },
    ],
    effects: [],
    nodeType: "Economy",
    isMarquee: false,
    meta: {
      requirementScalingPerOwned: {
        fertility: 30,
      },
    },
  },
  {
    id: "northern_pike",
    name: "Northern Pike",
    family: "Fish",
    tier: 5,
    description: "A fish denizen upgrade. Energy/Click +50%.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 1800000000,
    },
    maxOwned: 1,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["ambush_weedbeds", "living_sediment"],
      },
      {
        type: "stat_threshold",
        stat: "depth",
        min: 725,
      },
      {
        type: "stat_threshold",
        stat: "oxygen",
        min: 700,
      },
    ],
    effects: [
      {
        type: "multiplier",
        target: "click",
        value: 0.5,
      },
    ],
    nodeType: "Denizen",
    isMarquee: true,
    denizenKind: "animal",
  },
  {
    id: "snapping_turtle",
    name: "Snapping Turtle",
    family: "Herptiles",
    tier: 5,
    description: "A herptiles denizen upgrade. Energy/Second +25%.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 1900000000,
    },
    maxOwned: 1,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["peat_bed"],
      },
      {
        type: "stat_threshold",
        stat: "depth",
        min: 700,
      },
      {
        type: "stat_threshold",
        stat: "shelter",
        min: 725,
      },
    ],
    effects: [
      {
        type: "multiplier",
        target: "passive",
        value: 0.25,
      },
    ],
    nodeType: "Denizen",
    isMarquee: true,
    denizenKind: "animal",
  },
  {
    id: "mallard_ducks",
    name: "Mallard Ducks",
    family: "Birds",
    tier: 5,
    description: "A birds denizen upgrade. Energy/Second +25%.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 2000000000,
    },
    maxOwned: 1,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["overhanging_branches"],
      },
      {
        type: "stat_threshold",
        stat: "fertility",
        min: 700,
      },
      {
        type: "stat_threshold",
        stat: "shelter",
        min: 700,
      },
    ],
    effects: [
      {
        type: "multiplier",
        target: "passive",
        value: 0.25,
      },
    ],
    nodeType: "Denizen",
    isMarquee: true,
    denizenKind: "animal",
  },
  {
    id: "great_blue_herons",
    name: "Great Blue Herons",
    family: "Birds",
    tier: 5,
    description: "A birds denizen upgrade. Energy/Second +25%.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 2100000000,
    },
    maxOwned: 1,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["deepwater_channels"],
      },
      {
        type: "stat_threshold",
        stat: "depth",
        min: 700,
      },
      {
        type: "stat_threshold",
        stat: "shelter",
        min: 750,
      },
    ],
    effects: [
      {
        type: "multiplier",
        target: "passive",
        value: 0.25,
      },
    ],
    nodeType: "Denizen",
    isMarquee: true,
    denizenKind: "animal",
  },
  {
    id: "canada_geese",
    name: "Canada Geese",
    family: "Birds",
    tier: 5,
    description: "A birds denizen upgrade. Energy/Click +50%.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 2200000000,
    },
    maxOwned: 1,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["migrating_waterfowl"],
      },
      {
        type: "stat_threshold",
        stat: "fertility",
        min: 725,
      },
      {
        type: "stat_threshold",
        stat: "oxygen",
        min: 700,
      },
    ],
    effects: [
      {
        type: "multiplier",
        target: "click",
        value: 0.5,
      },
    ],
    nodeType: "Denizen",
    isMarquee: true,
    denizenKind: "animal",
  },
  {
    id: "deepwater_channels",
    name: "Deepwater Channels",
    family: "Geology",
    tier: 5,
    description: "A geology threshold upgrade. Depth +40 / Stack.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 37500000,
    },
    maxOwned: 5,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["deep_pool"],
      },
      {
        type: "stat_threshold",
        stat: "depth",
        min: 575,
      },
    ],
    effects: [
      {
        type: "threshold_delta",
        stat: "depth",
        delta: 40,
      },
    ],
    nodeType: "Threshold",
    isMarquee: false,
  },
  {
    id: "peat_bed",
    name: "Peat Bed",
    family: "Nutrients",
    tier: 5,
    description: "A nutrients threshold upgrade. Fertility +40 / Stack.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 40000000,
    },
    maxOwned: 5,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["black_muck"],
      },
      {
        type: "stat_threshold",
        stat: "fertility",
        min: 575,
      },
    ],
    effects: [
      {
        type: "threshold_delta",
        stat: "fertility",
        delta: 40,
      },
    ],
    nodeType: "Threshold",
    isMarquee: false,
  },
  {
    id: "cool_spring_seep",
    name: "Cool Spring Seep",
    family: "Hydrology",
    tier: 5,
    description: "A hydrology threshold upgrade. Oxygen +40 / Stack.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 42500000,
    },
    maxOwned: 5,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["breezy_surface"],
      },
      {
        type: "stat_threshold",
        stat: "oxygen",
        min: 575,
      },
    ],
    effects: [
      {
        type: "threshold_delta",
        stat: "oxygen",
        delta: 40,
      },
    ],
    nodeType: "Threshold",
    isMarquee: false,
  },
  {
    id: "overhanging_branches",
    name: "Overhanging Branches",
    family: "Structure",
    tier: 5,
    description: "A structure threshold upgrade. Shelter +40 / Stack.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 45500000,
    },
    maxOwned: 5,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["lily_pads"],
      },
      {
        type: "stat_threshold",
        stat: "shelter",
        min: 575,
      },
    ],
    effects: [
      {
        type: "threshold_delta",
        stat: "shelter",
        delta: 40,
      },
    ],
    nodeType: "Threshold",
    isMarquee: false,
  },
  {
    id: "ambush_weedbeds",
    name: "Ambush Weedbeds",
    family: "Plants",
    tier: 5,
    description: "A plants economy upgrade. Energy/Click +320,000 / Stack.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 75000000,
    },
    maxOwned: 5,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["feeding_waters"],
      },
      {
        type: "stat_threshold",
        stat: "depth",
        min: 575,
      },
      {
        type: "stat_threshold",
        stat: "shelter",
        min: 575,
      },
    ],
    effects: [
      {
        type: "click_bonus",
        amount: 320000,
      },
    ],
    nodeType: "Economy",
    isMarquee: false,
    meta: {
      requirementScalingPerOwned: {
        fertility: 35,
      },
    },
  },
  {
    id: "migrating_waterfowl",
    name: "Migrating Waterfowl",
    family: "Birds",
    tier: 5,
    description: "A birds economy upgrade. Energy/Second +320,000 / Stack.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 90000000,
    },
    maxOwned: 5,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["rainwater_inflow"],
      },
      {
        type: "stat_threshold",
        stat: "fertility",
        min: 600,
      },
      {
        type: "stat_threshold",
        stat: "oxygen",
        min: 600,
      },
    ],
    effects: [
      {
        type: "passive_generation",
        resource: "energy",
        amount: 320000,
      },
    ],
    nodeType: "Economy",
    isMarquee: false,
    meta: {
      requirementScalingPerOwned: {
        shelter: 35,
      },
    },
  },
  {
    id: "otters",
    name: "Otters",
    family: "Mammals",
    tier: 6,
    description: "A mammals denizen upgrade. Energy/Click +50%.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 83000000000,
    },
    maxOwned: 1,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["hidden_holt"],
      },
      {
        type: "stat_threshold",
        stat: "depth",
        min: 950,
      },
      {
        type: "stat_threshold",
        stat: "shelter",
        min: 1000,
      },
    ],
    effects: [
      {
        type: "multiplier",
        target: "click",
        value: 0.5,
      },
    ],
    nodeType: "Denizen",
    isMarquee: true,
    denizenKind: "animal",
  },
  {
    id: "beavers",
    name: "Beavers",
    family: "Mammals",
    tier: 6,
    description: "A mammals denizen upgrade. Energy/Second +25%.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 84000000000,
    },
    maxOwned: 1,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["lodge_site"],
      },
      {
        type: "stat_threshold",
        stat: "fertility",
        min: 1000,
      },
      {
        type: "stat_threshold",
        stat: "shelter",
        min: 950,
      },
    ],
    effects: [
      {
        type: "multiplier",
        target: "passive",
        value: 0.25,
      },
    ],
    nodeType: "Denizen",
    isMarquee: true,
    denizenKind: "animal",
  },
  {
    id: "bald_eagles",
    name: "Bald Eagles",
    family: "Birds",
    tier: 6,
    description: "A birds denizen upgrade. Energy/Second +25%.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 85000000000,
    },
    maxOwned: 1,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["canopy_perch"],
      },
      {
        type: "stat_threshold",
        stat: "oxygen",
        min: 950,
      },
      {
        type: "stat_threshold",
        stat: "shelter",
        min: 1000,
      },
    ],
    effects: [
      {
        type: "multiplier",
        target: "passive",
        value: 0.25,
      },
    ],
    nodeType: "Denizen",
    isMarquee: true,
    denizenKind: "animal",
  },
  {
    id: "bowfin",
    name: "Bowfin",
    family: "Fish",
    tier: 6,
    description: "A fish denizen upgrade. Energy/Second +25%.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 86000000000,
    },
    maxOwned: 1,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["circulation_lanes"],
      },
      {
        type: "stat_threshold",
        stat: "depth",
        min: 1000,
      },
      {
        type: "stat_threshold",
        stat: "oxygen",
        min: 950,
      },
    ],
    effects: [
      {
        type: "multiplier",
        target: "passive",
        value: 0.25,
      },
    ],
    nodeType: "Denizen",
    isMarquee: true,
    denizenKind: "animal",
  },
  {
    id: "mute_swans",
    name: "Mute Swans",
    family: "Birds",
    tier: 6,
    description: "A birds denizen upgrade. Energy/Click +50%.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 87000000000,
    },
    maxOwned: 1,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["duckweed_mat"],
      },
      {
        type: "stat_threshold",
        stat: "fertility",
        min: 975,
      },
      {
        type: "stat_threshold",
        stat: "oxygen",
        min: 1000,
      },
    ],
    effects: [
      {
        type: "multiplier",
        target: "click",
        value: 0.5,
      },
    ],
    nodeType: "Denizen",
    isMarquee: true,
    denizenKind: "animal",
  },
  {
    id: "hidden_holt",
    name: "Hidden Holt",
    family: "Structure",
    tier: 6,
    description: "A structure prerequisite upgrade. prerequisite for Otters.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 25000000000,
    },
    maxOwned: 1,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["protected_shoreline"],
      },
      {
        type: "stat_threshold",
        stat: "depth",
        min: 850,
      },
      {
        type: "stat_threshold",
        stat: "shelter",
        min: 875,
      },
    ],
    effects: [],
    nodeType: "Prerequisite",
    isMarquee: false,
  },
  {
    id: "lodge_site",
    name: "Lodge Site",
    family: "Structure",
    tier: 6,
    description: "A structure prerequisite upgrade. prerequisite for Beavers.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 26000000000,
    },
    maxOwned: 1,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["protected_shoreline"],
      },
      {
        type: "stat_threshold",
        stat: "depth",
        min: 825,
      },
      {
        type: "stat_threshold",
        stat: "shelter",
        min: 875,
      },
    ],
    effects: [],
    nodeType: "Prerequisite",
    isMarquee: false,
  },
  {
    id: "canopy_perch",
    name: "Canopy Perch",
    family: "Structure",
    tier: 6,
    description:
      "A structure prerequisite upgrade. prerequisite for Bald Eagles.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 27000000000,
    },
    maxOwned: 1,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["high_snag"],
      },
      {
        type: "stat_threshold",
        stat: "oxygen",
        min: 850,
      },
      {
        type: "stat_threshold",
        stat: "shelter",
        min: 875,
      },
    ],
    effects: [],
    nodeType: "Prerequisite",
    isMarquee: false,
  },
  {
    id: "circulation_lanes",
    name: "Circulation Lanes",
    family: "Hydrology",
    tier: 6,
    description: "A hydrology prerequisite upgrade. prerequisite for Bowfin.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 28000000000,
    },
    maxOwned: 1,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["connected_waterway"],
      },
      {
        type: "stat_threshold",
        stat: "depth",
        min: 875,
      },
      {
        type: "stat_threshold",
        stat: "oxygen",
        min: 850,
      },
    ],
    effects: [],
    nodeType: "Prerequisite",
    isMarquee: false,
  },
  {
    id: "duckweed_mat",
    name: "Duckweed Mat",
    family: "Plants",
    tier: 6,
    description: "A plants prerequisite upgrade. prerequisite for Mute Swans.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 29000000000,
    },
    maxOwned: 1,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["flooded_peat"],
      },
      {
        type: "stat_threshold",
        stat: "fertility",
        min: 875,
      },
      {
        type: "stat_threshold",
        stat: "oxygen",
        min: 850,
      },
    ],
    effects: [],
    nodeType: "Prerequisite",
    isMarquee: false,
  },
  {
    id: "connected_waterway",
    name: "Connected Waterway",
    family: "Geology",
    tier: 6,
    description: "A geology threshold upgrade. Depth +45 / Stack.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 1750000000,
    },
    maxOwned: 5,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["deepwater_channels"],
      },
      {
        type: "stat_threshold",
        stat: "depth",
        min: 775,
      },
    ],
    effects: [
      {
        type: "threshold_delta",
        stat: "depth",
        delta: 45,
      },
    ],
    nodeType: "Threshold",
    isMarquee: false,
  },
  {
    id: "flooded_peat",
    name: "Flooded Peat",
    family: "Nutrients",
    tier: 6,
    description: "A nutrients threshold upgrade. Fertility +45 / Stack.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 1750000000,
    },
    maxOwned: 5,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["peat_bed"],
      },
      {
        type: "stat_threshold",
        stat: "fertility",
        min: 775,
      },
    ],
    effects: [
      {
        type: "threshold_delta",
        stat: "fertility",
        delta: 45,
      },
    ],
    nodeType: "Threshold",
    isMarquee: false,
  },
  {
    id: "coldwater_pocket",
    name: "Coldwater Pocket",
    family: "Hydrology",
    tier: 6,
    description: "A hydrology threshold upgrade. Oxygen +45 / Stack.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 1750000000,
    },
    maxOwned: 5,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["cool_spring_seep"],
      },
      {
        type: "stat_threshold",
        stat: "oxygen",
        min: 775,
      },
    ],
    effects: [
      {
        type: "threshold_delta",
        stat: "oxygen",
        delta: 45,
      },
    ],
    nodeType: "Threshold",
    isMarquee: false,
  },
  {
    id: "protected_shoreline",
    name: "Protected Shoreline",
    family: "Geology",
    tier: 6,
    description: "A geology threshold upgrade. Shelter +45 / Stack.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 1750000000,
    },
    maxOwned: 5,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["overhanging_branches"],
      },
      {
        type: "stat_threshold",
        stat: "shelter",
        min: 775,
      },
    ],
    effects: [
      {
        type: "threshold_delta",
        stat: "shelter",
        delta: 45,
      },
    ],
    nodeType: "Threshold",
    isMarquee: false,
  },
  {
    id: "high_snag",
    name: "High Snag",
    family: "Structure",
    tier: 6,
    description:
      "A structure economy upgrade. Energy/Click +6,400,000 / Stack.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 3000000000,
    },
    maxOwned: 5,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["ambush_weedbeds"],
      },
      {
        type: "stat_threshold",
        stat: "oxygen",
        min: 775,
      },
      {
        type: "stat_threshold",
        stat: "shelter",
        min: 775,
      },
    ],
    effects: [
      {
        type: "click_bonus",
        amount: 6400000,
      },
    ],
    nodeType: "Economy",
    isMarquee: false,
    meta: {
      requirementScalingPerOwned: {
        depth: 40,
      },
    },
  },
  {
    id: "evening_chorus",
    name: "Evening Chorus",
    family: "Hydrology",
    tier: 6,
    description:
      "A hydrology economy upgrade. Energy/Second +6,400,000 / Stack.",
    ecologyNote: "Ecology note pending.",
    costs: {
      energy: 3500000000,
    },
    maxOwned: 5,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["migrating_waterfowl"],
      },
      {
        type: "stat_threshold",
        stat: "fertility",
        min: 800,
      },
      {
        type: "stat_threshold",
        stat: "oxygen",
        min: 800,
      },
    ],
    effects: [
      {
        type: "passive_generation",
        resource: "energy",
        amount: 6400000,
      },
    ],
    nodeType: "Economy",
    isMarquee: false,
    meta: {
      requirementScalingPerOwned: {
        depth: 40,
      },
    },
  },
];

export const KNOWN_UPGRADE_IDS = new Set<string>(
  CATALOG_UPGRADES.map((u) => u.id),
);

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

export function clampOwnedStacksForUpgrade(
  upgradeId: string,
  raw: number,
): number {
  const def = upgradesById.get(upgradeId);
  if (!def) return 0;
  const n = Math.max(0, Math.floor(raw));
  if (def.maxOwned === undefined) return n;
  return Math.min(n, def.maxOwned);
}

/**
 * Next purchase Energy cost: `base_energy × 2^n` where `n` = copies already owned.
 */
export function nextPurchaseCost(
  def: UpgradeDef,
  ownedCount: number,
): EnergyCosts | null {
  if (def.maxOwned !== undefined && ownedCount >= def.maxOwned) return null;
  const o = Math.max(0, Math.floor(ownedCount));
  const energy = Math.max(0, Math.round(def.costs.energy * 2 ** o));
  return { energy };
}
