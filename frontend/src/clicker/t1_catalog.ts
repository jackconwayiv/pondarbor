/** Tier 1 marquee passive multiplier per denizen: passive ×(1 + this) each. */
export const TIER1_MARQUEE_PASSIVE_BONUS = 0.1;

export const TIER1_MARQUEE_IDS = ["pond_snails", "tadpoles", "water_fleas"] as const;

/** Long-hover ecology copy for the pond stage (not tied to a single upgrade). */
export const POND_STAGE_ECOLOGY_NOTE =
  "Ponds are small, still or slow‑moving freshwater habitats—basins where rain, springs, or runoff gather. They punch above their weight for wildlife: shallow edges, soft bottoms, and open water stack different microhabitats and food webs into one compact landscape.";

export type PondStatId = "fertility" | "oxygen" | "depth" | "shelter";

export type UpgradeFamily =
  | "insolation"
  | "nutrients"
  | "abiotic"
  | "primary_producer"
  | "detritus"
  | "zooplankton"
  | "mollusk"
  | "amphibian"
  | "arthropod"
  | "fish"
  | "reptile"
  | "bird"
  | "mammal";

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
  | { type: "multiplier"; target: "global" | "click" | "passive"; value: number }
  | { type: "unlock"; mechanicId: string }
  | { type: "threshold_delta"; stat: PondStatId; delta: number };

export type UpgradeDef = {
  id: string;
  name: string;
  family: UpgradeFamily;
  tier: number;
  description: string;
  /** Real-world ecology for tooltips; keep game mechanics in `description` / effects. */
  ecologyNote: string;
  costs: EnergyCosts;
  maxOwned?: number;
  requirements: UpgradeRequirement[];
  effects: UpgradeEffect[];
  denizenKind?: DenizenKind;
  pondVisual?: PondVisualSpec;
};

export function validateUpgradeDef(upgrade: UpgradeDef): string[] {
  const errors: string[] = [];
  if (upgrade.denizenKind && upgrade.family === "abiotic") {
    errors.push(`${upgrade.id}: denizenKind not allowed on abiotic family`);
  }
  if (upgrade.maxOwned !== undefined) {
    if (!Number.isInteger(upgrade.maxOwned) || upgrade.maxOwned < 1) {
      errors.push(`${upgrade.id}: maxOwned must be a positive integer`);
    }
  }
  if (!(typeof upgrade.costs.energy === "number") || !Number.isFinite(upgrade.costs.energy) || upgrade.costs.energy < 0) {
    errors.push(`${upgrade.id}: costs.energy must be a finite number ≥ 0`);
  }
  if (typeof upgrade.ecologyNote !== "string" || upgrade.ecologyNote.trim().length < 8) {
    errors.push(`${upgrade.id}: ecologyNote must be a non-empty string`);
  }
  return errors;
}

export function getOwnedCount(ownedUpgrades: Record<string, number>, upgradeId: string): number {
  const n = ownedUpgrades[upgradeId];
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}

export function effectiveOwnedStacks(def: UpgradeDef, ownedUpgrades: Record<string, number>): number {
  const raw = getOwnedCount(ownedUpgrades, def.id);
  if (def.maxOwned === undefined) return raw;
  return Math.min(raw, def.maxOwned);
}

export type ResourcePresentation = { label: string; symbol: string };
export type FamilyPresentation = { label: string; symbol: string; accent: string };

export const ENERGY_PRESENTATION: ResourcePresentation = { label: "Energy", symbol: "⚡" };

/** Spendable primary resource in v1 (Energy only). */
export type PrimaryResourceId = "energy";

export const PRIMARY_RESOURCE_IDS: readonly PrimaryResourceId[] = ["energy"];

export const RESOURCE_PRESENTATION: Record<PrimaryResourceId, ResourcePresentation> = {
  energy: ENERGY_PRESENTATION,
};

export const POND_STAT_LABELS: Record<PondStatId, string> = {
  fertility: "Fertility",
  oxygen: "Oxygen",
  depth: "Depth",
  shelter: "Shelter",
};

export const FAMILY_PRESENTATION: Record<UpgradeFamily, FamilyPresentation> = {
  insolation: { label: "Insolation", symbol: "☀️", accent: "#c9a227" },
  nutrients: { label: "Nutrients", symbol: "🧪", accent: "#6b5a45" },
  abiotic: { label: "Basin & water", symbol: "🪨", accent: "#5a6a7a" },
  primary_producer: { label: "Producers", symbol: "🌿", accent: "#2f5a2f" },
  detritus: { label: "Detritus", symbol: "🍂", accent: "#6b5a45" },
  zooplankton: { label: "Zooplankton", symbol: "🦐", accent: "#4a7a8f" },
  mollusk: { label: "Mollusks", symbol: "🐌", accent: "#7a6a5a" },
  amphibian: { label: "Amphibians", symbol: "🐸", accent: "#4f8f5a" },
  arthropod: { label: "Arthropods", symbol: "🕷️", accent: "#6b4f3a" },
  fish: { label: "Fish", symbol: "🐟", accent: "#1f6f8b" },
  reptile: { label: "Reptiles", symbol: "🐢", accent: "#4f7a43" },
  bird: { label: "Birds", symbol: "🦆", accent: "#5a7fc9" },
  mammal: { label: "Mammals", symbol: "🦫", accent: "#7a5a3a" },
};

export const CATALOG_UPGRADES: UpgradeDef[] = [
  {
    id: "pond_basin",
    name: "Pond Basin",
    family: "abiotic",
    tier: 0,
    description:
      "Defines the hole your pond occupies so the water has a place to live. Unlocks the pond and gives 1 energy per pond click.",
    ecologyNote:
      "Basins form wherever water can collect—human‑dug farm ponds, beaver impoundments, kettle lakes left by ice, or simple depressions in wet ground. The shape of that bowl decides how water lingers, warms, and connects to the surrounding land.",
    costs: { energy: 0 },
    maxOwned: 1,
    requirements: [],
    effects: [
      { type: "unlock", mechanicId: "pond_unlocked" },
      { type: "click_bonus", amount: 1 },
    ],
  },
  {
    id: "sunlight",
    name: "Sunlight",
    family: "insolation",
    tier: 0,
    description: "Light reaching the surface powers photosynthesis and warms shallow water.",
    ecologyNote:
      "Sunlight sets the energy budget of shallow water: it fuels algae and plants, warms the surface layer, and drives daily cycles of oxygen and temperature that everything else in the pond has to live within.",
    costs: { energy: 25 },
    maxOwned: 5,
    requirements: [{ type: "prerequisite_upgrade", upgradeIds: ["pond_basin", "still_water"] }],
    effects: [
      { type: "passive_generation", resource: "energy", amount: 0.5 },
      { type: "threshold_delta", stat: "oxygen", delta: 10 },
    ],
    pondVisual: { type: "sunlight_twinkle", perStack: true },
  },
  {
    id: "still_water",
    name: "Still Water",
    family: "abiotic",
    tier: 0,
    description: "Quiet water allows particles to settle and clarity to begin.",
    ecologyNote:
      "When flow calms, silt and organic particles sink. That clearing is classic “lentic” ecology—still water lets light penetrate deeper and gives periphyton and rooted plants a foothold on stable bottoms.",
    costs: { energy: 20 },
    maxOwned: 5,
    requirements: [{ type: "prerequisite_upgrade", upgradeIds: ["pond_basin"] }],
    effects: [{ type: "threshold_delta", stat: "depth", delta: 10 }],
  },
  {
    id: "nutrient_silt",
    name: "Nutrient Silt",
    family: "nutrients",
    tier: 0,
    description: "Fine, nutrient-rich material supports early productivity.",
    ecologyNote:
      "Clay and fine silt carry phosphorus, nitrogen, and minerals from the watershed. Those grains also have huge surface area for microbes, so muddy margins are often the busiest biochemical corners of a pond.",
    costs: { energy: 50 },
    maxOwned: 5,
    requirements: [{ type: "prerequisite_upgrade", upgradeIds: ["sunlight"] }],
    effects: [
      { type: "click_bonus", amount: 1 },
      { type: "threshold_delta", stat: "fertility", delta: 10 },
    ],
  },
  {
    id: "shallow_shelf",
    name: "Shallow Shelf",
    family: "abiotic",
    tier: 0,
    description: "A broad, sunlit margin expands nursery habitat along the margins.",
    ecologyNote:
      "The littoral shelf—the warm, sunlit edge—is where most pond life concentrates: rooted plants, biofilms, baby fish, and amphibians all use that gradient from wet mud to knee‑deep water.",
    costs: { energy: 200 },
    maxOwned: 1,
    requirements: [
      { type: "prerequisite_upgrade", upgradeIds: ["still_water"] },
      { type: "stat_threshold", stat: "depth", min: 30 },
    ],
    effects: [
      { type: "threshold_delta", stat: "depth", delta: 50 },
      { type: "threshold_delta", stat: "shelter", delta: 40 },
    ],
  },
  {
    id: "pond_algae",
    name: "Pond Algae",
    family: "primary_producer",
    tier: 1,
    description: "Films and turfs of algae begin coating shallow, sunny hard surfaces.",
    ecologyNote:
      "Periphyton—algae glued to rocks, wood, and stems—is pasture for snails, insect larvae, and tadpoles. It’s often the first visible green of recovery in a new or disturbed pond.",
    costs: { energy: 400 },
    maxOwned: 1,
    requirements: [
      { type: "prerequisite_upgrade", upgradeIds: ["shallow_shelf"] },
      { type: "prerequisite_upgrade", upgradeIds: ["nutrient_silt"] },
      { type: "stat_threshold", stat: "fertility", min: 20 },
    ],
    effects: [{ type: "threshold_delta", stat: "oxygen", delta: 20 }],
  },
  {
    id: "pond_detritus",
    name: "Detritus",
    family: "detritus",
    tier: 1,
    description: "Organic particles accumulate—fuel for microbes and grazers.",
    ecologyNote:
      "Leaves, twigs, and dead algae become coarse detritus. Fungi and bacteria unlock that carbon, turning debris into a slow buffet for shredders, collectors, and the rest of the food web.",
    costs: { energy: 600 },
    maxOwned: 1,
    requirements: [{ type: "prerequisite_upgrade", upgradeIds: ["pond_algae"] }],
    effects: [{ type: "threshold_delta", stat: "fertility", delta: 20 }],
  },
  {
    id: "pond_snails",
    name: "Pond Snails",
    family: "mollusk",
    tier: 1,
    description: "Small grazers recycle film algae and detritus along the bottom and stems.",
    ecologyNote:
      "Freshwater snails rasp algae and decaying matter, mixing nutrients back into the water column and sediments. They’re humble engineers of clarity and recycling in vegetated shallows.",
    costs: { energy: 1000 },
    maxOwned: 1,
    requirements: [
      { type: "prerequisite_upgrade", upgradeIds: ["pond_detritus"] },
      { type: "stat_threshold", stat: "depth", min: 100 },
      { type: "stat_threshold", stat: "oxygen", min: 40 },
      { type: "stat_threshold", stat: "fertility", min: 40 },
      { type: "stat_threshold", stat: "shelter", min: 40 },
    ],
    effects: [{ type: "multiplier", target: "passive", value: TIER1_MARQUEE_PASSIVE_BONUS }],
    denizenKind: "animal",
  },
  {
    id: "pondweed",
    name: "Pondweed",
    family: "primary_producer",
    tier: 1,
    description: "Rooted plants spread in quiet, fertile shallows.",
    ecologyNote:
      "Submerged and floating macrophytes add structure, oxygen pockets, and hiding cover. Their roots stabilize mud and pull nutrients out of the water, linking the pond to the bank and the sky.",
    costs: { energy: 500 },
    maxOwned: 1,
    requirements: [
      { type: "prerequisite_upgrade", upgradeIds: ["nutrient_silt"] },
      { type: "prerequisite_upgrade", upgradeIds: ["shallow_shelf"] },
      { type: "stat_threshold", stat: "fertility", min: 30 },
    ],
    effects: [
      { type: "threshold_delta", stat: "oxygen", delta: 20 },
      { type: "threshold_delta", stat: "shelter", delta: 20 },
    ],
  },
  {
    id: "spawning_water",
    name: "Spawning Water",
    family: "abiotic",
    tier: 1,
    description: "Warm, protected pockets cue breeding for shallow-water spawners.",
    ecologyNote:
      "Many fish and amphibians cue on warm, calm shallows—places where eggs won’t drift away and larvae can find cover and food. Micro‑habitat texture matters as much as temperature.",
    costs: { energy: 800 },
    maxOwned: 1,
    requirements: [
      { type: "prerequisite_upgrade", upgradeIds: ["pondweed"] },
      { type: "stat_threshold", stat: "shelter", min: 40 },
      { type: "stat_threshold", stat: "fertility", min: 40 },
    ],
    effects: [{ type: "threshold_delta", stat: "shelter", delta: 20 }],
  },
  {
    id: "tadpoles",
    name: "Tadpoles",
    family: "amphibian",
    tier: 1,
    description: "Young amphibians transform the pond’s shallow edge into a living nursery.",
    ecologyNote:
      "Tadpoles are algae grazers, detritivores, and sometimes predators before they leave the water. A healthy edge—plants, biofilm, warm pockets—feeds that whole metamorphosis.",
    costs: { energy: 1100 },
    maxOwned: 1,
    requirements: [
      { type: "prerequisite_upgrade", upgradeIds: ["spawning_water"] },
      { type: "stat_threshold", stat: "depth", min: 20 },
      { type: "stat_threshold", stat: "shelter", min: 40 },
      { type: "stat_threshold", stat: "fertility", min: 40 },
      { type: "stat_threshold", stat: "oxygen", min: 30 },
    ],
    effects: [{ type: "multiplier", target: "passive", value: TIER1_MARQUEE_PASSIVE_BONUS }],
    denizenKind: "animal",
  },
  {
    id: "phytoplankton",
    name: "Phytoplankton",
    family: "primary_producer",
    tier: 1,
    description: "Microscopic algae tint the water column and feed the tiniest animals.",
    ecologyNote:
      "Phytoplankton are single‑celled solar panels drifting in open water. They feed rotifers, copepods, and cladocerans, linking sunlight to the open‑water food chain.",
    costs: { energy: 300 },
    maxOwned: 1,
    requirements: [
      { type: "prerequisite_upgrade", upgradeIds: ["shallow_shelf"] },
      { type: "prerequisite_upgrade", upgradeIds: ["nutrient_silt"] },
      { type: "stat_threshold", stat: "fertility", min: 20 },
      { type: "stat_threshold", stat: "depth", min: 20 },
    ],
    effects: [{ type: "threshold_delta", stat: "oxygen", delta: 30 }],
  },
  {
    id: "calm_shallows",
    name: "Calm Shallows",
    family: "abiotic",
    tier: 1,
    description: "Glassy pockets let zooplankton gather without being washed out.",
    ecologyNote:
      "Slack water behind stems, logs, or banks traps plankton and fine particles. Those quiet cells are feeding stations for tiny grazers that hate being churned by wind or overflow.",
    costs: { energy: 700 },
    maxOwned: 1,
    requirements: [
      { type: "prerequisite_upgrade", upgradeIds: ["phytoplankton"] },
      { type: "stat_threshold", stat: "depth", min: 40 },
    ],
    effects: [{ type: "threshold_delta", stat: "shelter", delta: 20 }],
  },
  {
    id: "water_fleas",
    name: "Water Fleas",
    family: "zooplankton",
    tier: 1,
    description: "Cladocerans pulse through the water, grazing algae and bacteria.",
    ecologyNote:
      "Water fleas (cladocerans like Daphnia) filter phytoplankton and bacteria, tightening the loop between green water and animal production—and sometimes clearing a bloom overnight.",
    costs: { energy: 900 },
    maxOwned: 1,
    requirements: [
      { type: "prerequisite_upgrade", upgradeIds: ["calm_shallows"] },
      { type: "stat_threshold", stat: "depth", min: 50 },
      { type: "stat_threshold", stat: "fertility", min: 40 },
      { type: "stat_threshold", stat: "oxygen", min: 40 },
    ],
    effects: [{ type: "multiplier", target: "passive", value: TIER1_MARQUEE_PASSIVE_BONUS }],
    denizenKind: "animal",
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

export function clampOwnedStacksForUpgrade(upgradeId: string, raw: number): number {
  const def = upgradesById.get(upgradeId);
  if (!def) return 0;
  const n = Math.max(0, Math.floor(raw));
  if (def.maxOwned === undefined) return n;
  return Math.min(n, def.maxOwned);
}

/**
 * Next purchase Energy cost: `base_energy × 2^n` where `n` = copies already owned.
 */
export function nextPurchaseCost(def: UpgradeDef, ownedCount: number): EnergyCosts | null {
  if (def.maxOwned !== undefined && ownedCount >= def.maxOwned) return null;
  const o = Math.max(0, Math.floor(ownedCount));
  const energy = Math.max(0, Math.round(def.costs.energy * 2 ** o));
  return { energy };
}
