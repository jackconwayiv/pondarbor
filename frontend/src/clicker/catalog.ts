/** Auto-generated from Tier 1 - 7 Upgrades - Canon Nodes.csv. */
export const TIER1_MARQUEE_PASSIVE_BONUS = 0.1;

/**
 * Kept for compatibility with the current runtime while completion logic
 * is moved from the old Tier 1 pause to final-tier completion.
 */
export const TIER1_MARQUEE_IDS = [
  "pond_snails",
  "tadpoles",
  "water_fleas",
  "dragonfly_nymph",
  "leeches",
] as const;

/** Final-game completion: all Tier VII prestige denizens. */
export const FINAL_TIER_MARQUEE_IDS = [
  "white_tailed_deer",
  "fireflies",
  "brown_bats",
  "bumblebees",
  "water_snake",
  "fishing_spider",
  "american_mink",
  "belted_kingfisher",
  "monarch_butterfly",
  "raccoon",
] as const;

/**
 * Marquee denizen ids grouped by tier.
 * Keep in sync with `PONDCLICKER_MARQUEE_BY_TIER` in `backend/achievements/services.py` (tier badges).
 */
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
  "7": [
    "white_tailed_deer",
    "fireflies",
    "brown_bats",
    "bumblebees",
    "water_snake",
    "fishing_spider",
    "american_mink",
    "belted_kingfisher",
    "monarch_butterfly",
    "raccoon",
  ],
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
  /** Field ecology for hover copy: real processes and organisms, not node-title casing or progression jargon (gameplay stays in `description` / effects). */
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
  Geology: { label: "Geology", symbol: "🪨", accent: "#6b7280" },
  Hydrology: { label: "Hydrology", symbol: "💧", accent: "#2563eb" },
  Nutrients: { label: "Nutrients", symbol: "🧪", accent: "#8b5e3c" },
  Structure: { label: "Structure", symbol: "🪵", accent: "#7c4f2a" },
  Invertebrates: { label: "Invertebrates", symbol: "🦐", accent: "#b45309" },
  Herptiles: { label: "Herptiles", symbol: "🐸", accent: "#4d7c0f" },
  Plants: { label: "Plants", symbol: "🌿", accent: "#2f855a" },
  "Microbes, Algae, and Plankton": {
    label: "Microbes & Algae",
    symbol: "🦠",
    accent: "#0f766e",
  },
  Fish: { label: "Fish", symbol: "🐟", accent: "#0369a1" },
  Mammals: { label: "Mammals", symbol: "🦫", accent: "#92400e" },
  Birds: { label: "Birds", symbol: "🦆", accent: "#7c3aed" },
};

export const CATALOG_UPGRADES: UpgradeDef[] = [
  {
    id: "pond_basin",
    name: "Pond Basin",
    family: "Geology",
    tier: 0,
    description:
      "A geology threshold & economy upgrade. Depth +25, Energy/Click +1.",
    ecologyNote:
      "Excavating or damming concentrates runoff into a basin—the physical bowl around which settling, water chemistry, and shoreline food webs then organize.",
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
    ecologyNote:
      "When the surface stays calm long enough for silt to settle and light to reach into the water column, sunlit water supports subsurface photosynthesis and dissolved oxygen that richer nutrient cycles and submerged plants can build on.",
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
    /* PondStage shows all hand-placed twinkle spots once owned; perStack is ignored there. */
    pondVisual: { type: "sunlight_twinkle", perStack: true },
  },
  {
    id: "nutrient_silt",
    name: "Nutrient Silt",
    family: "Nutrients",
    tier: 0,
    description: "A nutrients threshold upgrade. Fertility +25.",
    ecologyNote:
      "Where water lies still and dissolved oxygen begins to rise over soft sediments, fine silt delivers phosphorus and nitrogen to the bottom, feeding bacteria and paving the way for detritus-driven fertility.",
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
    ecologyNote:
      "After still water appears and early fertility builds on the bed, sunk wood adds slow-release carbon and complex surfaces that bacteria, fungi, and later invertebrates colonize along the margin.",
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
    description: "A invertebrates economy upgrade. Energy/Click +1.",
    ecologyNote:
      "When the basin is modestly deep, fertile, oxygenated, and littered with edge cover, chironomid larvae can complete an aquatic generation—a sign the littoral is ready for warm spawning shallows and other shallow-edge life.",
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
    effects: [
      {
        type: "click_bonus",
        amount: 1,
      },
    ],
    nodeType: "Economy",
    isMarquee: false,
  },
  {
    id: "still_water",
    name: "Still Water",
    family: "Hydrology",
    tier: 0,
    description: "A hydrology economy upgrade. Energy/Second +1.",
    ecologyNote:
      "Once a basin holds water, calm conditions let silt settle and light reach into the basin, turning a turbid excavation into a place where margins, nutrients, and producers begin to differentiate.",
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
    description: "A invertebrates denizen upgrade. Energy/Click +15%.",
    ecologyNote:
      "Where periphyton and biofilms thicken on stones and stems under rich enough bottom chemistry and dissolved oxygen, snails graze and recycle that microscopic production toward heavier invertebrates and fish consumers.",
    costs: {
      energy: 760,
    },
    maxOwned: 1,
    requirements: [
      {
        type: "owned_upgrade_threshold",
        upgradeId: "pond_algae",
        minLevel: 2,
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
        value: 0.15,
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
    description: "A herptiles denizen upgrade. Energy/Second +10%.",
    ecologyNote:
      "When shallow nursery habitat spreads and cover builds along warm vegetated margins, tadpoles find periphyton to graze and refuge from predators on the way toward adult frogs and fish predators.",
    costs: {
      energy: 780,
    },
    maxOwned: 1,
    requirements: [
      {
        type: "owned_upgrade_threshold",
        upgradeId: "spawning_shallows",
        minLevel: 2,
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
        value: 0.1,
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
    description: "A invertebrates denizen upgrade. Energy/Second +10%.",
    ecologyNote:
      "As suspended algae and nutrients increase in the water column, cladocerans bloom as planktonic grazers that convert phytoplankton into food for planktivorous fish that arrive later.",
    costs: {
      energy: 800,
    },
    maxOwned: 1,
    requirements: [
      {
        type: "owned_upgrade_threshold",
        upgradeId: "pond_algae",
        minLevel: 2,
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
        value: 0.1,
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
    description: "A invertebrates denizen upgrade. Energy/Second +10%.",
    ecologyNote:
      "Once emergent reeds and sedges form a stalk-rich littoral with more oxygen and cover among stems, odonate nymphs hunt there before emerging as adults over open water.",
    costs: {
      energy: 820,
    },
    maxOwned: 1,
    requirements: [
      {
        type: "owned_upgrade_threshold",
        upgradeId: "reed_fringe",
        minLevel: 2,
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
        value: 0.1,
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
    description: "A invertebrates denizen upgrade. Energy/Click +15%.",
    ecologyNote:
      "Where organic detritus enriches soft sediments and the system supports more vertebrate activity, leeches embed in organic muck and later take blood meals from fish and amphibians as those hosts become common.",
    costs: {
      energy: 840,
    },
    maxOwned: 1,
    requirements: [
      {
        type: "owned_upgrade_threshold",
        upgradeId: "detritus",
        minLevel: 2,
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
        value: 0.15,
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
    ecologyNote:
      "As the basin deepens, a broad sunlit shelf widens the nursery where plants, periphyton, and juvenile fish will later partition shallow from deep habitat.",
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
    ecologyNote:
      "After fine mineral silt raises fertility along the margin, coarse and fine organic debris accumulates as benthic detritus that fuels bacteria and fungi on the path toward attached algae, zooplankton, and larger grazers.",
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
    ecologyNote:
      "Once clearer water lets light reach the bed, rooted submerged macrophytes anchor in place, oxygenating pockets and giving structure for invertebrates and small fish farther along the food web.",
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
    ecologyNote:
      "As shoreline wood and litter add complexity and cover at the edge, emergent sedges and reeds knit a fringe that slows erosion and sets up habitat for odonates, frogs, and birds along the rim.",
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
    ecologyNote:
      "Where a broad shallow shelf meets midge-rich water under rising depth and littoral cover, warm food-rich shallows form where fish and amphibians can spawn and young stages can hide.",
    costs: {
      energy: 150,
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
        depth: 15,
        shelter: 15,
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
    ecologyNote:
      "Where bottom detritus feeds heterotrophs and fertility and dissolved oxygen support aerobic chemistry, attached and suspended algae capitalize on the nutrient pulse, linking microbes to snails, water fleas, and higher consumers.",
    costs: {
      energy: 225,
    },
    maxOwned: 5,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["midge_hatch"],
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
        type: "passive_generation",
        resource: "energy",
        amount: 2,
      },
    ],
    nodeType: "Economy",
    isMarquee: false,
    meta: {
      requirementScalingPerOwned: {
        fertility: 15,
        oxygen: 15,
      },
    },
  },
  {
    id: "crayfish",
    name: "Crayfish",
    family: "Invertebrates",
    tier: 2,
    description: "A invertebrates denizen upgrade. Energy/Click +18%.",
    ecologyNote:
      "After woody debris and spawning shallows build sheltered structure and organic fertility climbs, crayfish excavate refugia in soft edges, scavenging detritus and preying on smaller animals as larger fish predators eventually arrive.",
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
        value: 0.18,
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
    description: "A fish denizen upgrade. Energy/Second +12%.",
    ecologyNote:
      "Where microbial films coat surfaces and zooplankton swell under deep, oxygenated water, small cyprinids school in the water column as early planktivores that larger fish will eventually thin.",
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
        value: 0.12,
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
    description: "A herptiles denizen upgrade. Energy/Second +12%.",
    ecologyNote:
      "When dense cattail beds raise cover and dissolved oxygen along the emergent margin, green frogs hunt the warm weedy fringe, linking plant architecture to adult frogs whose energy feeds shoreline predators.",
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
        value: 0.12,
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
    description: "A invertebrates denizen upgrade. Energy/Second +12%.",
    ecologyNote:
      "When broad wading flats widen shallow shorelines and sheltered margins grow, water striders patrol the surface film where windfall arthropods and emerging midges link the meniscus to the open pond.",
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
        value: 0.12,
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
    description: "A invertebrates denizen upgrade. Energy/Click +18%.",
    ecologyNote:
      "With sunken wood deepening habitat complexity and oxygen rising in littoral pockets, predaceous diving beetles prowl submerged structure as top invertebrate micropredators before fish dominate the same space.",
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
        value: 0.18,
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
    ecologyNote:
      "Building on the earlier littoral shelf, broad flats extend wadeable shallows that collect heat, detritus, and emerging insects where shorebirds and fish will later concentrate feeding.",
    costs: {
      energy: 1500,
    },
    maxOwned: 5,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["shallow_shelf"],
      },
      {
        type: "owned_upgrade_threshold",
        upgradeId: "shallow_shelf",
        minLevel: 4,
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
    ecologyNote:
      "Once a leaf-litter layer concentrates labile carbon on sediments beneath oxygenated water, bacterial and fungal biofilms coat grains and stems, preparing soft organic muck where burrowing worms and chironomids can thrive.",
    costs: {
      energy: 15000,
    },
    maxOwned: 1,
    requirements: [
      {
        type: "owned_upgrade_threshold",
        upgradeId: "leaf_litter_bed",
        minLevel: 3,
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
    effectText: "Required for Soft Muck.",
  },
  {
    id: "leaf_litter_bed",
    name: "Leaf Litter Bed",
    family: "Nutrients",
    tier: 2,
    description: "A nutrients threshold upgrade. Fertility +25 / Stack.",
    ecologyNote:
      "Continuing from coarser detritus on the bottom, mats of packed leaves pulse seasonally with carbon that fungi and microbes attack, feeding detritivores toward peaks of biofilm and zooplankton.",
    costs: {
      energy: 1500,
    },
    maxOwned: 5,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["detritus"],
      },
      {
        type: "owned_upgrade_threshold",
        upgradeId: "detritus",
        minLevel: 4,
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
    ecologyNote:
      "Expanding from earlier submerged pondweed beds, denser macrophyte stands oxygenate interior water, pin silt, and carve refugia that fish predators will later patrol.",
    costs: {
      energy: 1500,
    },
    maxOwned: 5,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["pondweed"],
      },
      {
        type: "owned_upgrade_threshold",
        upgradeId: "pondweed",
        minLevel: 4,
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
    ecologyNote:
      "As emergent reeds thicken into tall cattail stands, shelter and nutrient uptake along the rim increase, litter feeds the detritus base, and shade and stems benefit tadpoles and dragonflies at the edge.",
    costs: {
      energy: 1500,
    },
    maxOwned: 5,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["reed_fringe"],
      },
      {
        type: "owned_upgrade_threshold",
        upgradeId: "reed_fringe",
        minLevel: 4,
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
    ecologyNote:
      "When attached and suspended algae lift primary productivity with the fertility–oxygen trade-offs common in mesotrophic water, filamentous fungi join bacteria in shredding tough detritus so nutrients recycle toward a pulse of rotifers and crustaceans.",
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
    effectText: "Required for Zooplankton Bloom.",
  },
  {
    id: "sunken_log",
    name: "Sunken Log",
    family: "Structure",
    tier: 2,
    description: "A structure economy upgrade. Energy/Click +40 per Stack.",
    ecologyNote:
      "After shallows concentrate flow and organic matter banks along margins, sunken boles create oxygenated snag faces beside softer pockets where aquatic insects, crayfish, and small fish partition three-dimensional habitat.",
    costs: {
      energy: 3000,
    },
    maxOwned: 5,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["spawning_shallows"],
      },
      {
        type: "owned_upgrade_threshold",
        upgradeId: "spawning_shallows",
        minLevel: 4,
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
        amount: 40,
      },
    ],
    nodeType: "Economy",
    isMarquee: false,
    meta: {
      requirementScalingPerOwned: {
        depth: 20,
        shelter: 20,
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
    ecologyNote:
      "With balanced fertility and oxygen after fungal and bacterial processing of detritus, rotifers and small crustaceans convert microbial and algal production into pelagic biomass that minnows and fingerlings harvest.",
    costs: {
      energy: 4000,
    },
    maxOwned: 5,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["decomposer_fungi"],
      },
      {
        type: "owned_upgrade_threshold",
        upgradeId: "pond_algae",
        minLevel: 4,
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
        amount: 40,
      },
    ],
    nodeType: "Economy",
    isMarquee: false,
    meta: {
      requirementScalingPerOwned: {
        fertility: 20,
        oxygen: 20,
      },
    },
  },
  {
    id: "bluegill",
    name: "Bluegill",
    family: "Fish",
    tier: 3,
    description: "A fish denizen upgrade. Energy/Click +21%.",
    ecologyNote:
      "Where slack eddies deepen flow refuges and a living veneer of bacteria and microfauna carpets organic sediment under well-oxygenated water, bluegill nest in swept shallows and pick off zooplankton and snails.",
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
        value: 0.21,
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
    description: "A fish denizen upgrade. Energy/Second +14%.",
    ecologyNote:
      "Where open water widens the sunlit pelagic zone over a fertile organic bottom, deep-bodied sunfish weave open-water feeding with weedy cover to evade fish predators still to come.",
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
        value: 0.14,
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
    description: "A herptiles denizen upgrade. Energy/Second +14%.",
    ecologyNote:
      "After roots and wood weave structure into sheltered margins, painted turtles bask on snags and forage snails and carrion, linking aquatic production to riparian scavengers.",
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
        value: 0.14,
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
    description: "A herptiles denizen upgrade. Energy/Second +14%.",
    ecologyNote:
      "Along tall emergent reeds where oxygen and cover spike in vegetated shallows, salamanders hunt benthic invertebrates under mats that wading birds will probe later in the season.",
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
        value: 0.14,
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
    description: "A fish denizen upgrade. Energy/Click +21%.",
    ecologyNote:
      "Combining eddy-lined structure with an organic, detrital bottom, yellow perch school over drag-feeding substrates as mid-level predators between minnows and large bass.",
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
        value: 0.21,
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
    ecologyNote:
      "Extending broad wading flats downward, incision carves cooler bottom pockets and depth refugia that stratification-sensitive fish exploit as the basin gains volume.",
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
        type: "owned_upgrade_threshold",
        upgradeId: "wading_flats",
        minLevel: 4,
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
    ecologyNote:
      "With microbial films priming organic particles, soft muck accumulates as fluid, flocculent sediment where worms and chironomids burrow, fueling bottom-foraging fish.",
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
        type: "owned_upgrade_threshold",
        upgradeId: "leaf_litter_bed",
        minLevel: 4,
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
    ecologyNote:
      "Beyond dense submerged weed beds, open clearings widen the pelagic arena so wind mixing and light shape phytoplankton dynamics that sunfish and bass exploit in different ways.",
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
        type: "owned_upgrade_threshold",
        upgradeId: "submerged_weeds",
        minLevel: 4,
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
    ecologyNote:
      "Weaving roots through dense cattail peat, woody rizosphere architecture slows erosion and traps litter, tightening edge cover before turtles and herons settle in.",
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
        type: "owned_upgrade_threshold",
        upgradeId: "cattail_stand",
        minLevel: 4,
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
    ecologyNote:
      "After microbial biofilms bind fine sediment, a living veneer of bacteria, microfauna, and meiofauna carpets the bottom so benthic fish can sift for prey in organic-rich muck.",
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
    effectText: "Required for Fish denizens.",
  },
  {
    id: "calm_eddies",
    name: "Calm Eddies",
    family: "Hydrology",
    tier: 3,
    description: "A hydrology economy upgrade. Energy/Click +400 / Stack.",
    ecologyNote:
      "Downstream of sunken-snag fields that interrupt flow, eddies sort fines and concentrate drifting prey where sight-feeding sunfish and bass fin along wood.",
    costs: {
      energy: 50000,
    },
    maxOwned: 5,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["sunken_log"],
      },
      {
        type: "owned_upgrade_threshold",
        upgradeId: "sunken_log",
        minLevel: 4,
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
        amount: 400,
      },
    ],
    nodeType: "Economy",
    isMarquee: false,
    meta: {
      requirementScalingPerOwned: {
        depth: 25,
        oxygen: 25,
      },
    },
  },
  {
    id: "calling_reeds",
    name: "Calling Reeds",
    family: "Plants",
    tier: 3,
    description: "A plants economy upgrade. Energy/Second +400 / Stack.",
    ecologyNote:
      "Above dense zooplankton that lifts trophic throughput in the water column, tall emergent reeds shelter calling amphibians and export foliage that rains carbon back into detritus spirals.",
    costs: {
      energy: 65000,
    },
    maxOwned: 5,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["zooplankton_bloom"],
      },
      {
        type: "owned_upgrade_threshold",
        upgradeId: "zooplankton_bloom",
        minLevel: 4,
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
        amount: 400,
      },
    ],
    nodeType: "Economy",
    isMarquee: false,
    meta: {
      requirementScalingPerOwned: {
        fertility: 25,
        shelter: 25,
      },
    },
  },
  {
    id: "largemouth_bass",
    name: "Largemouth Bass",
    family: "Fish",
    tier: 4,
    description: "A fish denizen upgrade. Energy/Click +24%.",
    ecologyNote:
      "Where drifting prey and small fish concentrate over a soft organic bottom and dissolved oxygen stays high along weed edges, largemouth bass stage ambushes as a dominant ambush piscivore.",
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
        value: 0.24,
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
    description: "A herptiles denizen upgrade. Energy/Second +16%.",
    ecologyNote:
      "After a true deep pool carves cool bottom refuge and peat swells organic fines along the shore, softshell turtles bury in soft flats where they vacuum benthic invertebrates between sunfish and pike territories.",
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
        value: 0.16,
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
    description: "A herptiles denizen upgrade. Energy/Second +16%.",
    ecologyNote:
      "With floating lily leaves thickening surface cover as oxygen and littoral cover climb, bullfrogs command warm shallows as generalist predators whose tadpoles and adults recycle energy toward wading birds and snakes.",
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
        value: 0.16,
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
    description: "A mammals denizen upgrade. Energy/Second +16%.",
    ecologyNote:
      "On rich organic banks with dense shoreline cover, muskrats graze submerged plants and build lodges that export clipped biomass back into detritus spirals larger vertebrates mine.",
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
        value: 0.16,
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
    description: "A fish denizen upgrade. Energy/Click +24%.",
    ecologyNote:
      "Where drifting food concentrates above organic sediment and fertility is high relative to depth, channel catfish root nocturnally through soft bottoms as benthic omnivores linking detritus to piscivore diets.",
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
        value: 0.24,
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
    ecologyNote:
      "Extending an incised channel, a true deep pool traps cooler, darker water where thermal refuge and winter oxygen stratification begin to matter for large fish.",
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
        type: "owned_upgrade_threshold",
        upgradeId: "deeper_channel",
        minLevel: 4,
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
    ecologyNote:
      "After soft muck fluidizes organic fines, anoxic black muck concentrates sulfide and methane pockets that specialized bacteria exploit while exporting labile carbon toward muskrats and catfish.",
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
        type: "owned_upgrade_threshold",
        upgradeId: "soft_muck",
        minLevel: 4,
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
    ecologyNote:
      "Beyond clear pelagic water, wind-ruffled surface films boost gas exchange and mix phytoplankton, priming oxygen for cool-spring seeps and large piscivores downstream in the web.",
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
        type: "owned_upgrade_threshold",
        upgradeId: "open_water",
        minLevel: 4,
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
    ecologyNote:
      "Weaving through root-tangled margins, floating-leaved lilies shade undercuts and concentrate periphyton where bullfrogs and sunfish ambush prey before overhanging branches offer perches for canopy birds.",
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
        type: "owned_upgrade_threshold",
        upgradeId: "tangled_roots",
        minLevel: 4,
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
    description:
      "A fish economy upgrade. Energy/Click +4,000 / Stack (each later stack adds +25% more than the last).",
    ecologyNote:
      "Downstream of wood-sorted eddies where drifting prey piles up, feeding lanes align depth and fertility so bass, catfish, and ambush weedbeds can concentrate harvests.",
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
        type: "owned_upgrade_threshold",
        upgradeId: "calm_eddies",
        minLevel: 4,
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
        amount: 4000,
      },
    ],
    nodeType: "Economy",
    isMarquee: false,
    meta: {
      requirementScalingPerOwned: {
        depth: 30,
        fertility: 30,
      },
    },
  },
  {
    id: "rainwater_inflow",
    name: "Rainwater Inflow",
    family: "Hydrology",
    tier: 4,
    description:
      "A hydrology economy upgrade. Energy / Second +4,000 / Stack (each later stack adds +25% more than the last).",
    ecologyNote:
      "Where reed litter and dissolved organics enrich oxygen-rich, sheltered margins, pulsed rainwater inflow fuels pelagic bacteria and algae that migrating waterfowl skim.",
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
        type: "owned_upgrade_threshold",
        upgradeId: "calling_reeds",
        minLevel: 4,
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
    effects: [
      {
        type: "passive_generation",
        resource: "energy",
        amount: 4000,
      },
    ],
    nodeType: "Economy",
    isMarquee: false,
    meta: {
      requirementScalingPerOwned: {
        oxygen: 30,
        shelter: 30,
      },
    },
  },
  {
    id: "northern_pike",
    name: "Northern Pike",
    family: "Fish",
    tier: 5,
    description: "A fish denizen upgrade. Energy/Click +27%.",
    ecologyNote:
      "Once dense submerged weedbeds knit ambush cover over a fertile organic bottom in deep, well-oxygenated water, northern pike lurk at weed edges as cold-water apex hunters culling mid-sized fish schools.",
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
        value: 0.27,
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
    description: "A herptiles denizen upgrade. Energy/Second +18%.",
    ecologyNote:
      "After spongy peat swells organic banks and depth and shoreline cover climb, snapping turtles scavenge carrion and nest in soft margins, recycling energy from fish and waterfowl toward riparian scavengers.",
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
        value: 0.18,
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
    description: "A birds denizen upgrade. Energy/Second +18%.",
    ecologyNote:
      "With overhanging branches shading fertile, sheltered edges, mallards dabble seeds and invertebrates in the littoral, importing terrestrial nutrients and exporting droppings that fertilize phytoplankton.",
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
        value: 0.18,
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
    description: "A birds denizen upgrade. Energy/Second +18%.",
    ecologyNote:
      "Once long deep channels lengthen sightlines into cool bottom refuge and shoreline cover is high, great blue herons spear fish and amphibians at the weedline, exporting biomass to rookeries that rain guano back into the basin.",
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
        value: 0.18,
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
    description: "A birds denizen upgrade. Energy/Click +27%.",
    ecologyNote:
      "After pulses of migrating ducks and coots align high fertility with high oxygen, resident geese graze shoreline turf and algae, clipping plants and re-depositing nutrients that fuel floating duckweed mats.",
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
        value: 0.27,
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
    ecologyNote:
      "Carving beyond a deep winter refuge pool, long channels thread cold, oxygenated water into the basin so piscivores and wading birds can exploit vertical habitat before the pond links to larger waterways.",
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
        type: "owned_upgrade_threshold",
        upgradeId: "deep_pool",
        minLevel: 4,
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
    ecologyNote:
      "Atop anoxic black muck, peat accretes partially decayed organic matter that sponges water and acidifies porewater, setting up flooded peat and cold pockets turtles and otters later probe.",
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
        type: "owned_upgrade_threshold",
        upgradeId: "black_muck",
        minLevel: 4,
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
    ecologyNote:
      "After wind mixing stirs the warm surface layer, discrete upwellings of cold, oxygen-rich groundwater pin coldwater pockets where relict fish and microbes persist under summer heat.",
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
        type: "owned_upgrade_threshold",
        upgradeId: "breezy_surface",
        minLevel: 4,
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
    ecologyNote:
      "Arching beyond floating lily leaves, riparian limbs shade the meniscus and drop terrestrial insects that bass and sunfish snatch, while limbs overhang the open water as perches for herons and eagles.",
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
        type: "owned_upgrade_threshold",
        upgradeId: "lily_pads",
        minLevel: 4,
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
    description:
      "A plants economy upgrade. Energy/Click +40,000 / Stack (each later stack adds +50% more than the last).",
    ecologyNote:
      "Extending prey lanes into deep, sheltered water, dense submerged weedbeds partition light and flow so pike and bass can stage ambushes before tall snags offer perches for aerial hunters.",
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
        type: "owned_upgrade_threshold",
        upgradeId: "feeding_waters",
        minLevel: 4,
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
        amount: 40000,
      },
    ],
    nodeType: "Economy",
    isMarquee: false,
    meta: {
      requirementScalingPerOwned: {
        depth: 35,
        shelter: 35,
      },
    },
  },
  {
    id: "migrating_waterfowl",
    name: "Migrating Waterfowl",
    family: "Birds",
    tier: 5,
    description:
      "A birds economy upgrade. Energy/Second +40,000 / Stack (each later stack adds +50% more than the last).",
    ecologyNote:
      "After rain swells the basin and fertility and oxygen crest together, migrant ducks and coots stir sediments and seeds, coupling watershed subsidies to dusk frog choruses and floating plant mats to come.",
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
        type: "owned_upgrade_threshold",
        upgradeId: "rainwater_inflow",
        minLevel: 4,
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
        amount: 40000,
      },
    ],
    nodeType: "Economy",
    isMarquee: false,
    meta: {
      requirementScalingPerOwned: {
        fertility: 35,
        oxygen: 35,
      },
    },
  },
  {
    id: "otters",
    name: "Otters",
    family: "Mammals",
    tier: 6,
    description: "A mammals denizen upgrade. Energy/Click +30%.",
    ecologyNote:
      "Once bank dens tuck into protected, heavily vegetated shorelines above very deep water, river otters shuttle between holts and channels, hunting fish and crayfish while spraint piles concentrate scent and nutrients along runways.",
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
        value: 0.3,
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
    description: "A mammals denizen upgrade. Energy/Second +20%.",
    ecologyNote:
      "Where a stable cut bank on a fertile, sheltered shoreline offers footing for sticks and mud, beavers impound creeks into slackwater wetlands that raise local groundwater, bury carbon in silt, and open sunlit shallows for new plant succession.",
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
        value: 0.2,
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
    description: "A birds denizen upgrade. Energy/Second +20%.",
    ecologyNote:
      "After a high canopy perch opens a raptor seat above well-oxygenated water and dense structure, bald eagles pluck fish from the surface and carry scraps to treetop nests, raining feathers and bones that recycle phosphorus back toward the littoral.",
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
        value: 0.2,
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
    description: "A fish denizen upgrade. Energy/Second +20%.",
    ecologyNote:
      "With longitudinal circulation threading exchange through very deep, well-oxygenated corridors, bowfin patrol relict pockets as sit-and-wait predators that tolerate warm, weedy water other piscivores avoid.",
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
        value: 0.2,
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
    description: "A birds denizen upgrade. Energy/Click +30%.",
    ecologyNote:
      "Once a floating duckweed skin rafts over fertile, highly oxygenated margins, mute swans uproot tubers and stir soft sediments, exporting coarse droppings that refuel submerged plants the mat later re-captures as floating turf.",
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
        value: 0.3,
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
    ecologyNote:
      "Root-tangled banks on a stable, armored shoreline hide submerged entrances where depth and cover stay high enough for otters to cache prey, dry pelts, and raise kits away from open-water eagles.",
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
    effectText: "Required for Otters.",
  },
  {
    id: "lodge_site",
    name: "Lodge Site",
    family: "Structure",
    tier: 6,
    description: "A structure prerequisite upgrade. prerequisite for Beavers.",
    ecologyNote:
      "A quiet backwater ledge on the same protected shoreline becomes the anchor for a dome lodge of sticks and mud, concentrating family traffic that trails nutrients into the pond’s slowest currents.",
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
    effectText: "Required for Beavers.",
  },
  {
    id: "canopy_perch",
    name: "Canopy Perch",
    family: "Structure",
    tier: 6,
    description:
      "A structure prerequisite upgrade. prerequisite for Bald Eagles.",
    ecologyNote:
      "Above a tall dead snag’s open superstructure, a canopy-level seat clears sightlines over oxygen-rich water so eagles can commute between fishing perches and nest trees without crossing bare mudflats.",
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
    effectText: "Required for Bald Eagles.",
  },
  {
    id: "circulation_lanes",
    name: "Circulation Lanes",
    family: "Hydrology",
    tier: 6,
    description: "A hydrology prerequisite upgrade. prerequisite for Bowfin.",
    ecologyNote:
      "Longitudinal lanes that link deep basins to inlets shear stratification just enough that oxygen reaches thalweg refuges where bowfin stage without abandoning cover.",
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
    effectText: "Required for Bowfin.",
  },
  {
    id: "duckweed_mat",
    name: "Duckweed Mat",
    family: "Plants",
    tier: 6,
    description: "A plants prerequisite upgrade. prerequisite for Mute Swans.",
    ecologyNote:
      "Floating atop tannin-stained flooded peat shallows, a duckweed skin harvests nutrients from enriched porewater while shading phytoplankton, creating a grazing lawn swans can crop without diving.",
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
    effectText: "Required for Mute Swans.",
  },
  {
    id: "connected_waterway",
    name: "Connected Waterway",
    family: "Geology",
    tier: 6,
    description: "A geology threshold upgrade. Depth +45 / Stack.",
    ecologyNote:
      "Extending long scoured channels toward the watershed, conduits deepen thalwegs and admit cooler inflows so larvae, nutrients, and oxygen pulses move seasonally between pond and river networks.",
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
        type: "owned_upgrade_threshold",
        upgradeId: "deepwater_channels",
        minLevel: 4,
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
    ecologyNote:
      "Saturating a spongy peat wedge keeps porewater reduced and humic-stained, chelating metals while slow-release dissolved organics feed duckweed lawns and blackwater edges larger vertebrates skirt.",
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
        type: "owned_upgrade_threshold",
        upgradeId: "peat_bed",
        minLevel: 4,
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
    ecologyNote:
      "Above discrete spring upwellings, trapped cold lenses pin dense, oxygen-rich water against basin topography, holding thermal refugia where sensitive taxa endure summer surface warmth.",
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
        type: "owned_upgrade_threshold",
        upgradeId: "cool_spring_seep",
        minLevel: 4,
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
    ecologyNote:
      "Armoring and benching beyond overhanging branches, stable banks reduce slumping and undercutting so rootwads and boulders persist as three-dimensional cover otters and beavers engineer around.",
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
        type: "owned_upgrade_threshold",
        upgradeId: "overhanging_branches",
        minLevel: 4,
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
      "A structure economy upgrade. Energy/Click +800,000 / Stack (each later stack adds +50% more than the last).",
    ecologyNote:
      "Dead-top snags rising where dense submerged weedbeds partition open water lift raptor perches into clear air while cavities shed insects and bark into highly oxygenated, structured shallows bass still patrol.",
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
        type: "owned_upgrade_threshold",
        upgradeId: "ambush_weedbeds",
        minLevel: 4,
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
        amount: 800000,
      },
    ],
    nodeType: "Economy",
    isMarquee: false,
    meta: {
      requirementScalingPerOwned: {
        oxygen: 40,
        shelter: 40,
      },
    },
  },
  {
    id: "evening_chorus",
    name: "Evening Chorus",
    family: "Hydrology",
    tier: 6,
    description:
      "A hydrology economy upgrade. Energy/Second +800,000 / Stack (each later stack adds +50% more than the last).",
    ecologyNote:
      "After pulses of migrating ducks and coots when fertility and oxygen crest together, humid, windless evenings flatten capillary waves so stable surface films and warm shallows carry dusk choruses of frogs across the whole basin.",
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
        type: "owned_upgrade_threshold",
        upgradeId: "migrating_waterfowl",
        minLevel: 4,
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
        amount: 800000,
      },
    ],
    nodeType: "Economy",
    isMarquee: false,
    meta: {
      requirementScalingPerOwned: {
        fertility: 40,
        oxygen: 40,
      },
    },
  },
  {
    id: "browsing_margin",
    name: "Browsing Margin",
    family: "Structure",
    tier: 7,
    description:
      "A structure prerequisite upgrade. Unlocks the white-tailed deer prestige denizen.",
    ecologyNote:
      "Where lawn-like turf meets shrubby edge above a stable, armored bank, deer can crop herbs and woody browse without collapsing cover, trailing nutrients that wash into littoral shallows.",
    costs: {
      energy: 100_000_000_000_000,
    },
    maxOwned: 1,
    requirements: [
      {
        type: "stat_threshold",
        stat: "shelter",
        min: 1000,
      },
    ],
    effects: [],
    nodeType: "Prerequisite",
    isMarquee: false,
    effectText: "Required for White-Tailed Deer.",
  },
  {
    id: "white_tailed_deer",
    name: "White-Tailed Deer",
    family: "Mammals",
    tier: 7,
    description: "Prestige Pond denizen. No mechanical bonus.",
    ecologyNote:
      "At dawn and dusk, deer stage along browse-rich margins above deep, fertile, oxygenated water, cropping herbs and leaving coarse droppings that subsidize shoreline grazers and detritivores.",
    costs: {
      energy: 500_000_000_000_000,
    },
    maxOwned: 1,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["browsing_margin"],
      },
      {
        type: "stat_threshold",
        stat: "depth",
        min: 1000,
      },
      {
        type: "stat_threshold",
        stat: "fertility",
        min: 1000,
      },
      {
        type: "stat_threshold",
        stat: "oxygen",
        min: 1000,
      },
      {
        type: "stat_threshold",
        stat: "shelter",
        min: 1000,
      },
    ],
    effects: [],
    nodeType: "Denizen",
    isMarquee: true,
    denizenKind: "animal",
  },
  {
    id: "damp_meadow_edge",
    name: "Damp Meadow Edge",
    family: "Plants",
    tier: 7,
    description:
      "A plants prerequisite upgrade. Unlocks the fireflies prestige denizen.",
    ecologyNote:
      "Sedge and rush tussocks at a wet meadow edge hold soil moisture where night-flying insects emerge and mate, linking upland grassland litter to pond-edge food webs.",
    costs: {
      energy: 100_000_000_000_000,
    },
    maxOwned: 1,
    requirements: [
      {
        type: "stat_threshold",
        stat: "fertility",
        min: 1000,
      },
    ],
    effects: [],
    nodeType: "Prerequisite",
    isMarquee: false,
    effectText: "Required for Fireflies.",
  },
  {
    id: "fireflies",
    name: "Fireflies",
    family: "Invertebrates",
    tier: 7,
    description: "Prestige Pond denizen. No mechanical bonus.",
    ecologyNote:
      "On warm nights, soft-winged beetles signal over humid sedge edges where larvae hunt snails in damp soil, pulsing light above water that mirrors their courtship.",
    costs: {
      energy: 500_000_000_000_000,
    },
    maxOwned: 1,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["damp_meadow_edge"],
      },
      {
        type: "stat_threshold",
        stat: "depth",
        min: 1000,
      },
      {
        type: "stat_threshold",
        stat: "fertility",
        min: 1000,
      },
      {
        type: "stat_threshold",
        stat: "oxygen",
        min: 1000,
      },
      {
        type: "stat_threshold",
        stat: "shelter",
        min: 1000,
      },
    ],
    effects: [],
    nodeType: "Denizen",
    isMarquee: true,
    denizenKind: "animal",
  },
  {
    id: "cloud_of_insects",
    name: "Cloud of Insects",
    family: "Invertebrates",
    tier: 7,
    description:
      "An invertebrates prerequisite upgrade. Unlocks the brown bats prestige denizen.",
    ecologyNote:
      "Where fertility drives high insect productivity, emergences and mating swarms stack into aerial clouds that bats and swallows slice through after dusk.",
    costs: {
      energy: 100_000_000_000_000,
    },
    maxOwned: 1,
    requirements: [
      {
        type: "stat_threshold",
        stat: "fertility",
        min: 1000,
      },
    ],
    effects: [],
    nodeType: "Prerequisite",
    isMarquee: false,
    effectText: "Required for Brown Bats.",
  },
  {
    id: "brown_bats",
    name: "Brown Bats",
    family: "Mammals",
    tier: 7,
    description: "Prestige Pond denizen. No mechanical bonus.",
    ecologyNote:
      "At insect peaks, bats commute along tree lines and over open water, skimming emergences and exporting nutrients in guano to roost trees and soil.",
    costs: {
      energy: 500_000_000_000_000,
    },
    maxOwned: 1,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["cloud_of_insects"],
      },
      {
        type: "stat_threshold",
        stat: "depth",
        min: 1000,
      },
      {
        type: "stat_threshold",
        stat: "fertility",
        min: 1000,
      },
      {
        type: "stat_threshold",
        stat: "oxygen",
        min: 1000,
      },
      {
        type: "stat_threshold",
        stat: "shelter",
        min: 1000,
      },
    ],
    effects: [],
    nodeType: "Denizen",
    isMarquee: true,
    denizenKind: "animal",
  },
  {
    id: "flowering_shoreline",
    name: "Flowering Shoreline",
    family: "Plants",
    tier: 7,
    description:
      "A plants prerequisite upgrade. Unlocks the bumblebees prestige denizen.",
    ecologyNote:
      "Forbs and shrubs bloom along the water’s edge where shelter is high, feeding long-tongued bees that link pollen and nectar to bank stability and seed rain.",
    costs: {
      energy: 100_000_000_000_000,
    },
    maxOwned: 1,
    requirements: [
      {
        type: "stat_threshold",
        stat: "shelter",
        min: 1000,
      },
    ],
    effects: [],
    nodeType: "Prerequisite",
    isMarquee: false,
    effectText: "Required for Bumblebees.",
  },
  {
    id: "bumblebees",
    name: "Bumblebees",
    family: "Invertebrates",
    tier: 7,
    description: "Prestige Pond denizen. No mechanical bonus.",
    ecologyNote:
      "Bumblebees nest in undisturbed soil and tussocks near rich flowering edges, vibrating flowers for pollen and moving nutrients between upland and littoral plants.",
    costs: {
      energy: 500_000_000_000_000,
    },
    maxOwned: 1,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["flowering_shoreline"],
      },
      {
        type: "stat_threshold",
        stat: "depth",
        min: 1000,
      },
      {
        type: "stat_threshold",
        stat: "fertility",
        min: 1000,
      },
      {
        type: "stat_threshold",
        stat: "oxygen",
        min: 1000,
      },
      {
        type: "stat_threshold",
        stat: "shelter",
        min: 1000,
      },
    ],
    effects: [],
    nodeType: "Denizen",
    isMarquee: true,
    denizenKind: "animal",
  },
  {
    id: "basking_bank",
    name: "Basking Bank",
    family: "Structure",
    tier: 7,
    description:
      "A structure prerequisite upgrade. Unlocks the water snake prestige denizen.",
    ecologyNote:
      "Low, sun-warmed banks with dense cover let snakes thermoregulate at the waterline, slipping between hunt and refuge without crossing bare mud.",
    costs: {
      energy: 100_000_000_000_000,
    },
    maxOwned: 1,
    requirements: [
      {
        type: "stat_threshold",
        stat: "shelter",
        min: 1000,
      },
    ],
    effects: [],
    nodeType: "Prerequisite",
    isMarquee: false,
    effectText: "Required for Water Snake.",
  },
  {
    id: "water_snake",
    name: "Water Snake",
    family: "Herptiles",
    tier: 7,
    description: "Prestige Pond denizen. No mechanical bonus.",
    ecologyNote:
      "Slender snakes patrol weedy margins and shallow cover, taking fish and amphibians in water that is deep, fertile, oxygenated, and structurally complex.",
    costs: {
      energy: 500_000_000_000_000,
    },
    maxOwned: 1,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["basking_bank"],
      },
      {
        type: "stat_threshold",
        stat: "depth",
        min: 1000,
      },
      {
        type: "stat_threshold",
        stat: "fertility",
        min: 1000,
      },
      {
        type: "stat_threshold",
        stat: "oxygen",
        min: 1000,
      },
      {
        type: "stat_threshold",
        stat: "shelter",
        min: 1000,
      },
    ],
    effects: [],
    nodeType: "Denizen",
    isMarquee: true,
    denizenKind: "animal",
  },
  {
    id: "wooden_dock",
    name: "Wooden Dock",
    family: "Structure",
    tier: 7,
    description:
      "A structure prerequisite upgrade. Unlocks the fishing spider prestige denizen.",
    ecologyNote:
      "A quiet pier shades pilings and posts where spiders span open water, anchoring silk to hunt surface insects without competing with shoreline clutter.",
    costs: {
      energy: 100_000_000_000_000,
    },
    maxOwned: 1,
    requirements: [
      {
        type: "stat_threshold",
        stat: "depth",
        min: 1000,
      },
    ],
    effects: [],
    nodeType: "Prerequisite",
    isMarquee: false,
    effectText: "Required for Fishing Spider.",
  },
  {
    id: "fishing_spider",
    name: "Fishing Spider",
    family: "Invertebrates",
    tier: 7,
    description: "Prestige Pond denizen. No mechanical bonus.",
    ecologyNote:
      "Large spiders wait motionless on pilings and posts, diving or skimming surface tension to capture prey when the pond is deep, fertile, oxygenated, and sheltered.",
    costs: {
      energy: 500_000_000_000_000,
    },
    maxOwned: 1,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["wooden_dock"],
      },
      {
        type: "stat_threshold",
        stat: "depth",
        min: 1000,
      },
      {
        type: "stat_threshold",
        stat: "fertility",
        min: 1000,
      },
      {
        type: "stat_threshold",
        stat: "oxygen",
        min: 1000,
      },
      {
        type: "stat_threshold",
        stat: "shelter",
        min: 1000,
      },
    ],
    effects: [],
    nodeType: "Denizen",
    isMarquee: true,
    denizenKind: "animal",
  },
  {
    id: "hidden_bank_run",
    name: "Hidden Bank Run",
    family: "Hydrology",
    tier: 7,
    description:
      "A hydrology prerequisite upgrade. Unlocks the American mink prestige denizen.",
    ecologyNote:
      "A concealed rivulet undercutting the bank feeds cool, oxygen-rich water to a narrow run where mink can hunt and travel without crossing open mud.",
    costs: {
      energy: 100_000_000_000_000,
    },
    maxOwned: 1,
    requirements: [
      {
        type: "stat_threshold",
        stat: "shelter",
        min: 1000,
      },
    ],
    effects: [],
    nodeType: "Prerequisite",
    isMarquee: false,
    effectText: "Required for American Mink.",
  },
  {
    id: "american_mink",
    name: "American Mink",
    family: "Mammals",
    tier: 7,
    description: "Prestige Pond denizen. No mechanical bonus.",
    ecologyNote:
      "Semi-aquatic mustelids hunt along hidden runs and dense cover, taking fish and crayfish when depth, fertility, oxygen, and shelter are all extreme.",
    costs: {
      energy: 500_000_000_000_000,
    },
    maxOwned: 1,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["hidden_bank_run"],
      },
      {
        type: "stat_threshold",
        stat: "depth",
        min: 1000,
      },
      {
        type: "stat_threshold",
        stat: "fertility",
        min: 1000,
      },
      {
        type: "stat_threshold",
        stat: "oxygen",
        min: 1000,
      },
      {
        type: "stat_threshold",
        stat: "shelter",
        min: 1000,
      },
    ],
    effects: [],
    nodeType: "Denizen",
    isMarquee: true,
    denizenKind: "animal",
  },
  {
    id: "crystal_clear_water",
    name: "Crystal-Clear Water",
    family: "Hydrology",
    tier: 7,
    description:
      "A hydrology prerequisite upgrade. Unlocks the belted kingfisher prestige denizen.",
    ecologyNote:
      "Where mixing and low turbidity align, light penetrates the water column so predators and anglers see prey from above, and plants can photosynthesize deeper.",
    costs: {
      energy: 100_000_000_000_000,
    },
    maxOwned: 1,
    requirements: [
      {
        type: "stat_threshold",
        stat: "oxygen",
        min: 1000,
      },
    ],
    effects: [],
    nodeType: "Prerequisite",
    isMarquee: false,
    effectText: "Required for Belted Kingfisher.",
  },
  {
    id: "belted_kingfisher",
    name: "Belted Kingfisher",
    family: "Birds",
    tier: 7,
    description: "Prestige Pond denizen. No mechanical bonus.",
    ecologyNote:
      "Kingfishers perch on snags and posts over clear water, diving on fish when depth, fertility, oxygen, and shelter support a dense prey field.",
    costs: {
      energy: 500_000_000_000_000,
    },
    maxOwned: 1,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["crystal_clear_water"],
      },
      {
        type: "stat_threshold",
        stat: "depth",
        min: 1000,
      },
      {
        type: "stat_threshold",
        stat: "fertility",
        min: 1000,
      },
      {
        type: "stat_threshold",
        stat: "oxygen",
        min: 1000,
      },
      {
        type: "stat_threshold",
        stat: "shelter",
        min: 1000,
      },
    ],
    effects: [],
    nodeType: "Denizen",
    isMarquee: true,
    denizenKind: "animal",
  },
  {
    id: "milkweed_stand",
    name: "Milkweed Stand",
    family: "Plants",
    tier: 7,
    description:
      "A plants prerequisite upgrade. Unlocks the monarch butterfly prestige denizen.",
    ecologyNote:
      "Milkweed stands anchor monarch breeding with latex-rich leaves and nectar, tying upland forb patches to pond edge humidity and insect prey.",
    costs: {
      energy: 100_000_000_000_000,
    },
    maxOwned: 1,
    requirements: [
      {
        type: "stat_threshold",
        stat: "fertility",
        min: 1000,
      },
    ],
    effects: [],
    nodeType: "Prerequisite",
    isMarquee: false,
    effectText: "Required for Monarch Butterfly.",
  },
  {
    id: "monarch_butterfly",
    name: "Monarch Butterfly",
    family: "Invertebrates",
    tier: 7,
    description: "Prestige Pond denizen. No mechanical bonus.",
    ecologyNote:
      "Monarchs stage on milkweed near rich flowering margins, migrating and laying eggs where depth, fertility, oxygen, and shelter support a full summer food web.",
    costs: {
      energy: 500_000_000_000_000,
    },
    maxOwned: 1,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["milkweed_stand"],
      },
      {
        type: "stat_threshold",
        stat: "depth",
        min: 1000,
      },
      {
        type: "stat_threshold",
        stat: "fertility",
        min: 1000,
      },
      {
        type: "stat_threshold",
        stat: "oxygen",
        min: 1000,
      },
      {
        type: "stat_threshold",
        stat: "shelter",
        min: 1000,
      },
    ],
    effects: [],
    nodeType: "Denizen",
    isMarquee: true,
    denizenKind: "animal",
  },
  {
    id: "stranded_treats",
    name: "Stranded Treats",
    family: "Nutrients",
    tier: 7,
    description:
      "A nutrients prerequisite upgrade. Unlocks the raccoon prestige denizen.",
    ecologyNote:
      "Picnic scraps and shoreline litter concentrate calories on high-shelter banks where generalists can wash food and retreat to cover between forays.",
    costs: {
      energy: 100_000_000_000_000,
    },
    maxOwned: 1,
    requirements: [
      {
        type: "stat_threshold",
        stat: "shelter",
        min: 1000,
      },
    ],
    effects: [],
    nodeType: "Prerequisite",
    isMarquee: false,
    effectText: "Required for Raccoon.",
  },
  {
    id: "raccoon",
    name: "Raccoon",
    family: "Mammals",
    tier: 7,
    description: "Prestige Pond denizen. No mechanical bonus.",
    ecologyNote:
      "Raccoons probe shallows and stranded litter at night, dexterous in water that is deep, fertile, oxygenated, and full of cover for escape from larger predators.",
    costs: {
      energy: 500_000_000_000_000,
    },
    maxOwned: 1,
    requirements: [
      {
        type: "prerequisite_upgrade",
        upgradeIds: ["stranded_treats"],
      },
      {
        type: "stat_threshold",
        stat: "depth",
        min: 1000,
      },
      {
        type: "stat_threshold",
        stat: "fertility",
        min: 1000,
      },
      {
        type: "stat_threshold",
        stat: "oxygen",
        min: 1000,
      },
      {
        type: "stat_threshold",
        stat: "shelter",
        min: 1000,
      },
    ],
    effects: [],
    nodeType: "Denizen",
    isMarquee: true,
    denizenKind: "animal",
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
