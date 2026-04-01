export type UpgradeClass = "nutrients" | "plants" | "foragers" | "predators" | "habitat";
export type EcoKey = "fertility" | "oxygen" | "verdancy" | "wildlife";
export type UpgradeClassPresentation = {
  label: string;
  symbol: string;
  bg: string;
  accent: string;
};

export type EcoValues = Record<EcoKey, number>;

/** Spendable costs: energy plus ecosystem resources only. */
export type ResourceCostKey = "energy" | EcoKey;
export type ResourceCost = Partial<Record<ResourceCostKey, number>>;

export type UpgradeEffects = {
  passive?: number;
  click?: number;
  /** Deferred: present in data, not yet applied in runtime math. */
  mult?: number;
  target?: string;
};

export type UpgradeReq = {
  upgrades?: number[];
};

export type UpgradeDef = {
  id: number;
  name: string;
  class: UpgradeClass;
  tier: number;
  /** Energy is exact; fertility/oxygen/verdancy/wildlife use small steps scaled by tier in purchase helpers. */
  cost: ResourceCost;
  maxLevel: number;
  description: string;
  effects?: UpgradeEffects;
  /** Per-second change to each resource per owned level (can be negative). */
  ecoIncome?: Partial<EcoValues>;
  req?: UpgradeReq;
};

export const ECO_KEYS: EcoKey[] = ["fertility", "oxygen", "verdancy", "wildlife"];
export const UPGRADE_CLASS_ORDER: UpgradeClass[] = [
  "nutrients",
  "plants",
  "foragers",
  "predators",
  "habitat",
];
export const STARTER_REVEALED_IDS = new Set<number>([1, 4]);
export const UPGRADE_CLASS_PRESENTATION: Record<UpgradeClass, UpgradeClassPresentation> = {
  nutrients: { label: "Nutrients", symbol: "🌱", bg: "rgba(143, 188, 143, 0.28)", accent: "#2f5a2f" },
  plants: { label: "Plants", symbol: "🌿", bg: "rgba(127, 176, 105, 0.3)", accent: "#2f5d1f" },
  foragers: { label: "Foragers", symbol: "🐌", bg: "rgba(198, 171, 128, 0.3)", accent: "#664b28" },
  predators: { label: "Predators", symbol: "🐟", bg: "rgba(111, 163, 196, 0.3)", accent: "#1f4f70" },
  habitat: { label: "Habitat", symbol: "🌊", bg: "rgba(135, 187, 224, 0.3)", accent: "#1f5278" },
};

const tierPower = (tier: number): number => 5 ** (tier - 1);

/** Maps abstract eco cost steps to real spend so a +2/s stream cannot buy a single step in a fraction of a second. */
function ecoCostTierMultiplier(tier: number): number {
  return 15 + tier * 5;
}

/** Applies tier scaling to fertility/oxygen/verdancy/wildlife only; energy is unchanged. */
export function scaledPurchaseResourceCost(def: UpgradeDef): ResourceCost {
  const mult = ecoCostTierMultiplier(def.tier);
  const out: ResourceCost = { ...def.cost };
  for (const k of ECO_KEYS) {
    const v = out[k];
    if (typeof v === "number" && v > 0) {
      out[k] = Math.max(1, Math.round(v * mult));
    }
  }
  return out;
}

export const UPGRADES: UpgradeDef[] = [
  { id: 1, name: "Dissolved Nitrogen", class: "nutrients", tier: 1, maxLevel: 1, description: "Dissolved nutrients begin the pond food web.", cost: { energy: 40 }, effects: { passive: 1 }, ecoIncome: { fertility: 2 } },
  { id: 2, name: "Algae Film", class: "plants", tier: 1, maxLevel: 1, description: "A soft film of green catches the first sunlight.", cost: { energy: 50, fertility: 1 }, effects: { click: 1 }, ecoIncome: { verdancy: 2, fertility: -1 }},
  { id: 3, name: "Pond Snails", class: "foragers", tier: 1, maxLevel: 1, description: "Gentle grazers recycle life along the pond edge.", cost: { energy: 62, verdancy: 1, oxygen: 1 }, effects: { passive: 1 }, ecoIncome: { wildlife: 2, verdancy: -1 }},
  { id: 4, name: "Sunlit Shore", class: "habitat", tier: 1, maxLevel: 1, description: "Warm shallows create a stable nursery zone.", cost: { energy: 80 }, effects: { mult: 0.1, target: "plants" }, ecoIncome: { oxygen: 2 } },
  { id: 5, name: "Duckweed Patch", class: "plants", tier: 2, maxLevel: 1, description: "Floating leaves spread shade and cover.", cost: { energy: 200, fertility: 2 }, effects: { passive: tierPower(2) }, ecoIncome: { verdancy: 2, fertility: -1 }},
  { id: 6, name: "Water Beetles", class: "predators", tier: 2, maxLevel: 1, description: "Quick hunters patrol the surface and edges.", cost: { energy: 250, wildlife: 1 }, effects: { mult: 0.1, target: "foragers" }, ecoIncome: { wildlife: 2 } },
  { id: 7, name: "Water Fleas", class: "foragers", tier: 2, maxLevel: 1, description: "Tiny drifters convert green water into motion.", cost: { energy: 312, verdancy: 2, oxygen: 1 }, effects: { passive: tierPower(2) }, ecoIncome: { wildlife: 2, verdancy: -1 }},
  { id: 8, name: "Pebble Bottom", class: "habitat", tier: 2, maxLevel: 1, description: "A firm base supports oxygen flow and shelter.", cost: { energy: 400 }, effects: { click: tierPower(2) }, ecoIncome: { oxygen: 2 }, req: { upgrades: [4] } },
  { id: 9, name: "Phosphate Sediment", class: "nutrients", tier: 3, maxLevel: 1, description: "Settled sediment deepens long-term fertility.", cost: { energy: 1000 }, effects: { passive: tierPower(3) }, ecoIncome: { fertility: 2, oxygen: -1 }, req: { upgrades: [8] } },
  { id: 10, name: "Pond Moss", class: "plants", tier: 3, maxLevel: 1, description: "Soft moss mats hold moisture and micro-life.", cost: { energy: 1250, fertility: 2 }, effects: { mult: 0.12, target: "plants" }, ecoIncome: { verdancy: 2, fertility: -1 }, req: { upgrades: [8] } },
  { id: 11, name: "Driftwood Log", class: "habitat", tier: 3, maxLevel: 1, description: "A fallen log adds texture, cover, and flow breaks.", cost: { energy: 1562 }, effects: { mult: 0.1, target: "click" }, ecoIncome: { oxygen: 2 }, req: { upgrades: [8] } },
  { id: 12, name: "Dragonflies", class: "predators", tier: 3, maxLevel: 1, description: "Bright hunters stitch the air above the water.", cost: { energy: 2000, wildlife: 2 }, effects: { click: tierPower(3) }, ecoIncome: { wildlife: 2 }, req: { upgrades: [10] } },
  { id: 13, name: "Elodea Growth", class: "plants", tier: 4, maxLevel: 1, description: "Submerged stems add density to the pond floor.", cost: { energy: 5000, fertility: 3 }, effects: { passive: tierPower(4) }, ecoIncome: { verdancy: 2, fertility: -1 }, req: { upgrades: [11] } },
  { id: 14, name: "Minnows", class: "predators", tier: 4, maxLevel: 1, description: "Small schools connect insects to larger life.", cost: { energy: 6250, wildlife: 2, oxygen: 2 }, effects: { mult: 0.1, target: "passive" }, ecoIncome: { wildlife: 2 }, req: { upgrades: [8] } },
  { id: 15, name: "Midge Swarm", class: "foragers", tier: 4, maxLevel: 1, description: "Emergent insects fuel the evening feeding rush.", cost: { energy: 7812, verdancy: 2, oxygen: 2 }, effects: { click: tierPower(4) }, ecoIncome: { wildlife: 2, oxygen: -1 }},
  { id: 16, name: "Soft Mud Floor", class: "habitat", tier: 4, maxLevel: 1, description: "Deep mud stores cycles of decay and renewal.", cost: { energy: 10000 }, effects: { mult: 0.12, target: "nutrients" }, ecoIncome: { oxygen: 2, wildlife: -1 }, req: { upgrades: [11] } },
  { id: 17, name: "Decaying Leaf Matter", class: "nutrients", tier: 5, maxLevel: 1, description: "Autumn debris steadily enriches pond fertility.", cost: { energy: 25000 }, effects: { passive: tierPower(5) }, ecoIncome: { fertility: 2, oxygen: -1 }, req: { upgrades: [16] } },
  { id: 18, name: "Cattails", class: "plants", tier: 5, maxLevel: 1, description: "Tall stands define the shoreline and calm the wind.", cost: { energy: 31250, fertility: 3 }, effects: { click: tierPower(5), passive: tierPower(5) / 5 }, ecoIncome: { verdancy: 2, fertility: -1 }, req: { upgrades: [4] } },
  { id: 19, name: "Tadpoles", class: "foragers", tier: 5, maxLevel: 1, description: "Amphibian nurseries stir the shallows with life.", cost: { energy: 39062, verdancy: 3, oxygen: 2 }, effects: { passive: tierPower(5) }, ecoIncome: { wildlife: 2, verdancy: -1 }, req: { upgrades: [18] } },
  { id: 20, name: "Small Fish", class: "predators", tier: 5, maxLevel: 1, description: "Predatory fish begin shaping the food web.", cost: { energy: 50000, wildlife: 3, oxygen: 2 }, effects: { mult: 0.12, target: "plants" }, ecoIncome: { wildlife: 2 }, req: { upgrades: [19] } },
  { id: 21, name: "Reeds", class: "plants", tier: 6, maxLevel: 1, description: "Dense reeds add shelter and rooted structure.", cost: { energy: 125000, fertility: 4 }, effects: { passive: tierPower(6) }, ecoIncome: { verdancy: 2, fertility: -1 }, req: { upgrades: [4] } },
  { id: 22, name: "Frogs", class: "predators", tier: 6, maxLevel: 1, description: "Night calls mark a healthy wetland rhythm.", cost: { energy: 156250, wildlife: 3, verdancy: 3 }, effects: { mult: 0.12, target: "click" }, ecoIncome: { wildlife: 2, oxygen: -1 }, req: { upgrades: [19] } },
  { id: 23, name: "Freshwater Shrimp", class: "foragers", tier: 6, maxLevel: 1, description: "Bottom foragers process leftovers into circulation.", cost: { energy: 195312, verdancy: 3, oxygen: 3 }, effects: { mult: 0.12, target: "nutrients" }, ecoIncome: { wildlife: 2, verdancy: -1 }, req: { upgrades: [8] } },
  { id: 24, name: "Clear Water", class: "habitat", tier: 6, maxLevel: 1, description: "Visibility improves and channels become usable.", cost: { energy: 250000 }, effects: { mult: 0.1, target: "global" }, ecoIncome: { oxygen: 2, fertility: -1 }, req: { upgrades: [16] } },
  { id: 25, name: "Creek Runoff", class: "nutrients", tier: 7, maxLevel: 1, description: "Seasonal inflow brings fresh mineral charge.", cost: { energy: 625000 }, effects: { click: tierPower(7) }, ecoIncome: { fertility: 2, oxygen: -1 }, req: { upgrades: [24] } },
  { id: 26, name: "Lily Pads", class: "plants", tier: 7, maxLevel: 1, description: "Floating pads form a calm, dappled canopy.", cost: { energy: 781250, fertility: 4, oxygen: 3 }, effects: { click: tierPower(7) }, ecoIncome: { verdancy: 2, fertility: -1 }, req: { upgrades: [4] } },
  { id: 27, name: "Bubbling Spring", class: "habitat", tier: 7, maxLevel: 1, description: "Constant seep adds cool oxygen-rich flow.", cost: { energy: 976562 }, effects: { mult: 0.15, target: "plants" }, ecoIncome: { oxygen: 2 }, req: { upgrades: [24] } },
  { id: 28, name: "Sunfish", class: "predators", tier: 7, maxLevel: 1, description: "Colorful hunters patrol sunny pockets.", cost: { energy: 1250000, wildlife: 4, oxygen: 3 }, effects: { mult: 0.15, target: "passive" }, ecoIncome: { wildlife: 2 }, req: { upgrades: [24] } },
  { id: 29, name: "Bulrushes", class: "plants", tier: 8, maxLevel: 1, description: "Thick rush clusters hold shorelines together.", cost: { energy: 3125000, fertility: 5 }, effects: { passive: tierPower(8) }, ecoIncome: { verdancy: 2, fertility: -1 }, req: { upgrades: [11] } },
  { id: 30, name: "Yellow Perch", class: "predators", tier: 8, maxLevel: 1, description: "Striped schools add pressure and balance.", cost: { energy: 3906250, wildlife: 4, oxygen: 3 }, effects: { mult: 0.15, target: "wildlife" }, ecoIncome: { wildlife: 2, oxygen: -1 }, req: { upgrades: [24] } },
  { id: 31, name: "Crawfish", class: "foragers", tier: 8, maxLevel: 1, description: "Night scavengers recycle rich bottom debris.", cost: { energy: 4882812, verdancy: 4, oxygen: 3 }, effects: { passive: tierPower(8) }, ecoIncome: { wildlife: 2, verdancy: -1 }, req: { upgrades: [11] } },
  { id: 32, name: "Shaded Banks", class: "habitat", tier: 8, maxLevel: 1, description: "Cool margins reduce stress in summer heat.", cost: { energy: 6250000 }, effects: { mult: 0.12, target: "predators" }, ecoIncome: { oxygen: 2 }, req: { upgrades: [27] } },
  { id: 33, name: "Rich Pond Mud", class: "nutrients", tier: 9, maxLevel: 1, description: "Long-settled sediments support steady output.", cost: { energy: 15625000 }, effects: { passive: tierPower(9) }, ecoIncome: { fertility: 2 }, req: { upgrades: [32] } },
  { id: 34, name: "Wild Pond Grass", class: "plants", tier: 9, maxLevel: 1, description: "Native grasses knit shallow zones into habitat.", cost: { energy: 19531250, fertility: 5 }, effects: { mult: 0.18, target: "plants" }, ecoIncome: { verdancy: 2, fertility: -1 }, req: { upgrades: [32] } },
  { id: 35, name: "Mayflies", class: "foragers", tier: 9, maxLevel: 1, description: "Mass hatches pulse energy through the pond.", cost: { energy: 24414062, verdancy: 5, oxygen: 3 }, effects: { click: tierPower(9) }, ecoIncome: { wildlife: 2, oxygen: -1 }, req: { upgrades: [34] } },
  { id: 36, name: "Crappie", class: "predators", tier: 9, maxLevel: 1, description: "Ambush feeders favor cover-rich pockets.", cost: { energy: 31250000, wildlife: 5, oxygen: 3 }, effects: { mult: 0.18, target: "passive" }, ecoIncome: { wildlife: 2 }, req: { upgrades: [35] } },
  { id: 37, name: "Floating Plant Mats", class: "plants", tier: 10, maxLevel: 1, description: "Interlocking mats create layered microclimates.", cost: { energy: 78125000, fertility: 6 }, effects: { passive: tierPower(10) }, ecoIncome: { verdancy: 2, oxygen: -1 }, req: { upgrades: [24] } },
  { id: 38, name: "Largemouth Bass", class: "predators", tier: 10, maxLevel: 1, description: "A strong predator anchors trophic structure.", cost: { energy: 97656250, wildlife: 6, oxygen: 4 }, effects: { mult: 0.2, target: "global" }, ecoIncome: { wildlife: 2, oxygen: -1 }, req: { upgrades: [40] } },
  { id: 39, name: "Caddisflies", class: "foragers", tier: 10, maxLevel: 1, description: "Case-building larvae convert flow into food.", cost: { energy: 122070312, verdancy: 5, oxygen: 4 }, effects: { mult: 0.15, target: "habitat" }, ecoIncome: { wildlife: 2, verdancy: -1 }, req: { upgrades: [11] } },
  { id: 40, name: "Deep Pool", class: "habitat", tier: 10, maxLevel: 1, description: "Depth provides refuge through temperature swings.", cost: { energy: 156250000 }, effects: { passive: tierPower(10) }, ecoIncome: { oxygen: 2, wildlife: -1 }, req: { upgrades: [32] } },
  { id: 41, name: "Spring Flood Silt", class: "nutrients", tier: 11, maxLevel: 1, description: "Flood pulses rebuild productive sediments.", cost: { energy: 390625000 }, effects: { click: tierPower(11) }, ecoIncome: { fertility: 2, oxygen: -1 }, req: { upgrades: [40] } },
  { id: 42, name: "Lotus Flowers", class: "plants", tier: 11, maxLevel: 1, description: "Late-season blooms mark peak pond vitality.", cost: { energy: 488281250, fertility: 6, oxygen: 4 }, effects: { click: tierPower(11), passive: tierPower(10) }, ecoIncome: { verdancy: 2, fertility: -1 }, req: { upgrades: [40] } },
  { id: 43, name: "Freshwater Inlet", class: "habitat", tier: 11, maxLevel: 1, description: "A clean inlet refreshes circulation patterns.", cost: { energy: 610351562 }, effects: { mult: 0.2, target: "oxygen" }, ecoIncome: { oxygen: 2 }, req: { upgrades: [40] } },
  { id: 44, name: "Painted Turtle", class: "predators", tier: 11, maxLevel: 1, description: "Basking hunters bridge shoreline and open water.", cost: { energy: 781250000, wildlife: 6, oxygen: 4 }, effects: { mult: 0.18, target: "passive" }, ecoIncome: { wildlife: 2 }, req: { upgrades: [32] } },
  { id: 45, name: "Dense Shoreline Plants", class: "plants", tier: 12, maxLevel: 1, description: "Thick margins stabilize banks and nurseries.", cost: { energy: 1953125000, fertility: 7 }, effects: { passive: tierPower(12) }, ecoIncome: { verdancy: 2, fertility: -1 }, req: { upgrades: [32] } },
  { id: 46, name: "Snapping Turtle", class: "predators", tier: 12, maxLevel: 1, description: "Ancient ambush predators reinforce top pressure.", cost: { energy: 2441406250, wildlife: 7, oxygen: 4 }, effects: { mult: 0.22, target: "predators" }, ecoIncome: { wildlife: 2, oxygen: -1 }, req: { upgrades: [40] } },
  { id: 47, name: "Bottom Feeders", class: "foragers", tier: 12, maxLevel: 1, description: "Substrate feeders keep nutrients in motion.", cost: { energy: 3051757812, verdancy: 6, oxygen: 4 }, effects: { mult: 0.18, target: "nutrients" }, ecoIncome: { wildlife: 2, verdancy: -1 }, req: { upgrades: [40] } },
  { id: 48, name: "Cool Water Flow", class: "habitat", tier: 12, maxLevel: 1, description: "Flow corridors reduce oxygen stress.", cost: { energy: 3906250000 }, effects: { mult: 0.18, target: "global" }, ecoIncome: { oxygen: 2 }, req: { upgrades: [43] } },
  { id: 49, name: "Autumn Leaf Fall", class: "nutrients", tier: 13, maxLevel: 1, description: "Leaf litter renews fertility each year.", cost: { energy: 9765625000 }, effects: { passive: tierPower(13) }, ecoIncome: { fertility: 2, oxygen: -1 }, req: { upgrades: [48] } },
  { id: 50, name: "Overgrown Vegetation", class: "plants", tier: 13, maxLevel: 1, description: "Mature growth creates deep vertical habitat.", cost: { energy: 12207031250, fertility: 7 }, effects: { mult: 0.25, target: "plants" }, ecoIncome: { verdancy: 2, fertility: -1 }, req: { upgrades: [48] } },
  { id: 51, name: "Grazing Schools", class: "foragers", tier: 13, maxLevel: 1, description: "Coordinated shoals improve foraging efficiency.", cost: { energy: 15258789062, verdancy: 7, oxygen: 5 }, effects: { mult: 0.22, target: "foragers" }, ecoIncome: { wildlife: 2, verdancy: -1 }, req: { upgrades: [50] } },
  { id: 52, name: "Newts", class: "predators", tier: 13, maxLevel: 1, description: "Subtle amphibian hunters complete edge niches.", cost: { energy: 19531250000, wildlife: 7, oxygen: 5 }, effects: { click: tierPower(13), passive: tierPower(12) }, ecoIncome: { wildlife: 2 }, req: { upgrades: [48] } },
  { id: 53, name: "Thick Canopy Cover", class: "plants", tier: 14, maxLevel: 1, description: "A broad canopy cools and shades key zones.", cost: { energy: 48828125000, fertility: 8 }, effects: { mult: 0.22, target: "click" }, ecoIncome: { verdancy: 2, oxygen: -1 }, req: { upgrades: [32] } },
  { id: 54, name: "Heron", class: "predators", tier: 14, maxLevel: 1, description: "A patient wader signals mature prey abundance.", cost: { energy: 61035156250, wildlife: 8, oxygen: 5 }, effects: { mult: 0.25, target: "wildlife" }, ecoIncome: { wildlife: 2 }, req: { upgrades: [32] } },
  { id: 55, name: "Natural Filter Bed", class: "habitat", tier: 14, maxLevel: 1, description: "Biological filtering smooths seasonal shocks.", cost: { energy: 76293945312 }, effects: { mult: 0.25, target: "global" }, ecoIncome: { oxygen: 2, fertility: -1 }, req: { upgrades: [48] } },
  { id: 56, name: "Busy Detritivores", class: "foragers", tier: 14, maxLevel: 1, description: "Constant decomposition powers nutrient cycling.", cost: { energy: 97656250000, verdancy: 7, oxygen: 5 }, effects: { passive: tierPower(14) }, ecoIncome: { wildlife: 2, verdancy: -1 }, req: { upgrades: [55] } },
  { id: 57, name: "Ancient Lakebed Soil", class: "nutrients", tier: 15, maxLevel: 1, description: "Deep history stores massive fertility reserves.", cost: { energy: 244140625000 }, effects: { passive: tierPower(15) }, ecoIncome: { fertility: 2, oxygen: -1 }, req: { upgrades: [55] } },
  { id: 58, name: "Old Growth Wetland", class: "plants", tier: 15, maxLevel: 1, description: "Long-settled growth supports resilient life.", cost: { energy: 305175781250, fertility: 8, oxygen: 6 }, effects: { mult: 0.3, target: "passive" }, ecoIncome: { verdancy: 2, fertility: -1 }, req: { upgrades: [55] } },
  { id: 59, name: "Stable Water Levels", class: "habitat", tier: 15, maxLevel: 1, description: "Hydrologic stability protects every guild.", cost: { energy: 381469726562 }, effects: { mult: 0.22, target: "global" }, ecoIncome: { oxygen: 2 }, req: { upgrades: [55] } },
  { id: 60, name: "Kingfisher", class: "predators", tier: 15, maxLevel: 1, description: "A vivid aerial hunter crowns the shoreline.", cost: { energy: 488281250000, wildlife: 9, oxygen: 6 }, effects: { mult: 0.3, target: "click" }, ecoIncome: { wildlife: 2 }, req: { upgrades: [59] } },
  { id: 61, name: "Ancient Root Network", class: "plants", tier: 16, maxLevel: 1, description: "Interwoven roots lock in enduring productivity.", cost: { energy: 1220703125000, fertility: 9, oxygen: 6 }, effects: { passive: tierPower(16) }, ecoIncome: { verdancy: 2, fertility: -1 }, req: { upgrades: [59] } },
  { id: 62, name: "River Otter", class: "predators", tier: 16, maxLevel: 1, description: "Playful apex hunters signal full system health.", cost: { energy: 1525878906250, wildlife: 10, oxygen: 6 }, effects: { mult: 0.35, target: "global" }, ecoIncome: { wildlife: 2 }, req: { upgrades: [59] } },
  { id: 63, name: "Keystone Foragers", class: "foragers", tier: 16, maxLevel: 1, description: "Forager networks maintain nutrient turnover.", cost: { energy: 1907348632812, verdancy: 8, oxygen: 6 }, effects: { mult: 0.3, target: "plants" }, ecoIncome: { wildlife: 2, verdancy: -1 }, req: { upgrades: [61] } },
  { id: 64, name: "Apex Pond Balance", class: "predators", tier: 16, maxLevel: 1, description: "A mature balance of prey, cover, and flow.", cost: { energy: 2441406250000, wildlife: 10, oxygen: 6, verdancy: 8, fertility: 8 }, effects: { mult: 0.4, target: "wildlife" }, ecoIncome: { wildlife: 2, oxygen: -1 }, req: { upgrades: [62, 63] } },

];

/** JSON / `owned_upgrades` keys are stringified numeric ids. */
export function idKey(id: number): string {
  return String(id);
}

const byId = new Map(UPGRADES.map((u) => [u.id, u]));
const byKey = new Map(UPGRADES.map((u) => [idKey(u.id), u]));

export const KNOWN_UPGRADE_KEYS = new Set(UPGRADES.map((u) => idKey(u.id)));

export function getUpgradeDef(id: number | string): UpgradeDef | undefined {
  return typeof id === "number" ? byId.get(id) : byKey.get(id);
}

export function getUpgradeClassPresentation(upgradeClass: UpgradeClass): UpgradeClassPresentation {
  return UPGRADE_CLASS_PRESENTATION[upgradeClass];
}

export function getLevel(owned: Record<string, number>, id: number): number {
  const n = owned[idKey(id)];
  return typeof n === "number" && n > 0 ? n : 0;
}

/** Cost for the next purchase; `null` if maxed. Eco resource spends include tier scaling. */
export function nextPurchaseCost(def: UpgradeDef, currentLevel: number): ResourceCost | null {
  if (currentLevel >= def.maxLevel) return null;
  return scaledPurchaseResourceCost(def);
}

export function totalEcoIncomeRates(owned: Record<string, number>): EcoValues {
  const eco: EcoValues = { fertility: 0, oxygen: 0, verdancy: 0, wildlife: 0 };
  for (const u of UPGRADES) {
    const level = getLevel(owned, u.id);
    if (level <= 0 || !u.ecoIncome) continue;
    for (const key of ECO_KEYS) {
      const r = u.ecoIncome[key];
      if (typeof r === "number" && r !== 0) {
        eco[key] += r * level;
      }
    }
  }
  return eco;
}

export function prerequisitesMet(def: UpgradeDef, owned: Record<string, number>): boolean {
  if (def.req?.upgrades?.length) {
    const hasUpgrades = def.req.upgrades.every((rid) => getLevel(owned, rid) >= 1);
    if (!hasUpgrades) return false;
  }
  return true;
}

export function canAffordCost(energy: number, eco: EcoValues, cost: ResourceCost): boolean {
  const e = cost.energy ?? 0;
  if (energy < e) return false;
  for (const key of ECO_KEYS) {
    const c = cost[key];
    if (typeof c === "number" && c > 0 && eco[key] < c) return false;
  }
  return true;
}

export function revealEnergyThreshold(def: UpgradeDef): number {
  const e = def.cost.energy ?? 0;
  return Math.ceil(e / 2);
}

export function shouldShowUpgradeInShop(
  def: UpgradeDef,
  currentLevel: number,
  energy: number,
  owned: Record<string, number>,
  revealed: Record<string, boolean>,
): boolean {
  const cost = nextPurchaseCost(def, currentLevel);
  if (cost === null) return false;
  if (STARTER_REVEALED_IDS.has(def.id)) return true;
  const key = idKey(def.id);
  if (revealed[key]) return true;
  if (!prerequisitesMet(def, owned)) return false;
  return energy >= revealEnergyThreshold(def);
}

export function requirementSummary(def: UpgradeDef): string[] {
  const out: string[] = [];
  if (def.req?.upgrades?.length) {
    for (const id of def.req.upgrades) {
      const required = getUpgradeDef(id);
      out.push(`Requires ${required?.name ?? `Upgrade ${id}`}`);
    }
  }
  return out;
}

export function totalPassivePerSecond(owned: Record<string, number>): number {
  let total = 0;
  for (const u of UPGRADES) {
    if (getLevel(owned, u.id) > 0 && u.effects?.passive != null) {
      total += u.effects.passive;
    }
  }
  return total;
}

export function totalClickBonus(owned: Record<string, number>): number {
  let total = 0;
  for (const u of UPGRADES) {
    if (getLevel(owned, u.id) > 0 && u.effects?.click != null) {
      total += u.effects.click;
    }
  }
  return total;
}

const COST_EMOJI: Record<ResourceCostKey, string> = {
  energy: "⚡",
  fertility: "🌾",
  oxygen: "🫧",
  verdancy: "🍃",
  wildlife: "🐸",
};

export function formatResourceCostParts(cost: ResourceCost): string[] {
  const parts: string[] = [];
  const keys: ResourceCostKey[] = ["energy", ...ECO_KEYS];
  for (const k of keys) {
    const v = cost[k];
    if (typeof v === "number" && v > 0) {
      parts.push(`${v} ${COST_EMOJI[k]}`);
    }
  }
  return parts;
}
