export type DenizenDef = {
  id: string;
  name: string;
  namePlural: string;
  baseCost: number;
  baseEps: number;
  maxOwned: number;
  emoji: string;
  ecologyNote: string;
};

function denizen(
  id: string,
  name: string,
  namePlural: string,
  baseCost: number,
  baseEps: number,
  emoji: string,
  ecologyNote: string,
): DenizenDef {
  return {
    id,
    name,
    namePlural,
    baseCost,
    baseEps,
    maxOwned: 4000,
    emoji,
    ecologyNote,
  };
}

/** Lowercase denizen label for prose; plural when count is not 1. */
export function denizenLabelForCount(def: DenizenDef, count: number): string {
  const label = count === 1 ? def.name : def.namePlural;
  return label.toLowerCase();
}

const UNCOUNTABLE_DENIZEN_IDS = new Set([
  "sediment",
  "transcendence",
  "zooplankton",
]);

function indefiniteArticle(lowerName: string): "a" | "an" {
  return /^[aeiou]/i.test(lowerName) ? "an" : "a";
}

/** Celebration / catalog prose when the player owns their first of a denizen type. */
export function denizenFirstWelcomeDescription(def: DenizenDef): string {
  const label = def.name.toLowerCase();
  if (UNCOUNTABLE_DENIZEN_IDS.has(def.id)) {
    return `Welcome ${label} to your pond.`;
  }
  return `Welcome ${indefiniteArticle(label)} ${label} to your pond.`;
}

/** Effect line for specialties that double a denizen's efficiency. */
export function denizenDoubleEfficiencyEffectText(def: DenizenDef): string {
  const verb = UNCOUNTABLE_DENIZEN_IDS.has(def.id) ? "is" : "are";
  return `${def.namePlural} ${verb} twice as efficient`;
}

export const DENIZENS: readonly DenizenDef[] = [
  denizen(
    "ripples",
    "Ripple",
    "Ripples",
    15,
    0.1,
    "🌊",
    "Every tap sends rings across the meniscus, mixing the surface film and redistributing heat, pollen, and dissolved gases in the top millimeters of the pond.",
  ),
  denizen(
    "sediment",
    "Sediment",
    "Sediment",
    100,
    1,
    "🪨",
    "Fine silt and organic fluff settle into soft bottom muck where pore spaces hold water, nutrients, and refuge for burrowing invertebrates.",
  ),
  denizen(
    "fungi",
    "Fungus",
    "Fungi",
    1_100,
    5,
    "🍄",
    "Threadlike hyphae lace through leaf litter and woody debris, breaking tough plant matter into forms bacteria and grazers can finish recycling.",
  ),
  denizen(
    "microbes",
    "Microbe",
    "Microbes",
    12_000,
    15,
    "🦠",
    "Single-celled decomposers and nitrifiers colonize biofilms on every submerged surface, turning dead organic matter into dissolved nutrients the pond can reuse.",
  ),
  denizen(
    "zooplankton",
    "Zooplankton",
    "Zooplankton",
    150_000,
    50,
    "🦐",
    "Microscopic grazers drift in the water column, cropping algae and bacteria and passing energy upward to the smallest fish and filter feeders.",
  ),
  denizen(
    "aquatic_plants",
    "Aquatic Plant",
    "Aquatic Plants",
    2_000_000,
    250,
    "🌿",
    "Submerged stems and floating leaves pump oxygen into the water by day, stabilize sediments with roots, and offer cover at every depth.",
  ),
  denizen(
    "invertebrates",
    "Invertebrate",
    "Invertebrates",
    25_000_000,
    1_000,
    "🐌",
    "Snails, dragonfly nymphs, and other spineless residents graze films, hunt smaller prey, and stitch together the pond's bottom and midwater food webs.",
  ),
  denizen(
    "small_swimmers",
    "Darter",
    "Darters",
    325_000_000,
    4_500,
    "🐟",
    "Minnows and other tiny fish dart through shallow margins, linking plankton to larger predators and stirring the edges with constant motion.",
  ),
  denizen(
    "amphibians",
    "Amphibian",
    "Amphibians",
    5_000_000_000,
    22_500,
    "🐸",
    "Frogs and salamanders bridge water and land, breeding in quiet shallows while adults control insect numbers from banks and emergent vegetation.",
  ),
  denizen(
    "small_fish",
    "Small Fish",
    "Small Fish",
    68_000_000_000,
    100_000,
    "🐠",
    "Sunfish and similar littoral fish patrol structure-rich zones, ambushing invertebrates and packing pond productivity into flesh larger predators can harvest.",
  ),
  denizen(
    "reptiles",
    "Reptile",
    "Reptiles",
    1_000_000_000_000,
    525_000,
    "🐢",
    "Turtles and other cold-blooded hunters bask on logs, regulate snail and plant growth, and embody the pond's slow, sun-powered metabolism.",
  ),
  denizen(
    "large_fish",
    "Large Fish",
    "Large Fish",
    15_000_000_000_000,
    3_000_000,
    "🦈",
    "Bass and pike-shaped apex fish lurk in deeper water, culling weak swimmers and keeping midwater communities from overcrowding.",
  ),
  denizen(
    "waterfowl",
    "Waterfowl",
    "Waterfowl",
    250_000_000_000_000,
    15_000_000,
    "🦆",
    "Ducks and geese visit open water and marsh edges, grazing plants, stirring sediments, and importing nutrients from surrounding fields and forests.",
  ),
  denizen(
    "shore_mammals",
    "Shore Mammal",
    "Shore Mammals",
    5_000_000_000_000_000,
    100_000_000,
    "🦫",
    "Muskrats and beaver kin reshape shorelines, opening channels and lodges that add complexity, storage, and new niches for everyone downstream.",
  ),
  denizen(
    "hunting_birds",
    "Hunting Bird",
    "Hunting Birds",
    85_000_000_000_000_000,
    500_000_000,
    "🦅",
    "Herons, kingfishers, and raptors stake out perches, pulling fish and amphibians back into terrestrial food webs with each precise strike.",
  ),
  denizen(
    "great_mammals",
    "Great Mammal",
    "Great Mammals",
    488_000_000_000_000_000,
    1_000_000_000,
    "🦌",
    "Deer and other large herbivores drink at dawn, browse bank vegetation, and leave tracks and droppings that feed soil and shallow water alike.",
  ),
  denizen(
    "humans",
    "Human",
    "Humans",
    9_000_000_000_000_000_000,
    6_000_000_000,
    "🚶‍♂️",
    "People walk the rim, skip stones, and tend the pond's story—fishing, planting, and deciding which edges stay wild and which stay open.",
  ),
  denizen(
    "cryptids",
    "Cryptid",
    "Cryptids",
    160_000_000_000_000_000_000,
    40_000_000_000,
    "🫈",
    "Local lore places shy observers at the far shore: splashes too large for known fish, silhouettes in mist, and tales that keep the margins mysterious.",
  ),
  denizen(
    "spirits",
    "Spirit",
    "Spirits",
    4_000_000_000_000_000_000_000,
    300_000_000_000,
    "👻",
    "Old stories say certain pools hold guardians—will-o'-wisps, water watchers, and quiet presences felt more at dusk than seen by daylight.",
  ),
  denizen(
    "leviathans",
    "Leviathan",
    "Leviathans",
    60_000_000_000_000_000_000_000,
    1_000_000_000_000,
    "🐋",
    "At the scale of legend, something vast turns beneath the surface, displacing whole columns of water and reminding every smaller denizen who truly owns the deep.",
  ),
  denizen(
    "abyssals",
    "Abyssal",
    "Abyssals",
    1_200_000_000_000_000_000_000_000,
    10_000_000_000_000,
    "🦑",
    "Cold, lightless logic lives in the lowest bowl of the pond—strange patience, pressure, and hunger adapted to a world without sun.",
  ),
  denizen(
    "celestials",
    "Celestial",
    "Celestials",
    24_500_000_000_000_000_000_000_000,
    75_000_000_000_000,
    "✨",
    "Moonlight and star glow duplicate on the black mirror of the pond, linking open water to tides of sky, season, and migration overhead.",
  ),
  denizen(
    "transcendence",
    "Transcendence",
    "Transcendence",
    540_000_000_000_000_000_000_000_000,
    510_000_000_000_000,
    "♾️",
    "When every tier of life is present at once, the pond stops behaving like a puddle and starts reading as a single breathing whole—borderless, self-sustaining, complete.",
  ),
];

export const DENIZEN_IDS = new Set(DENIZENS.map((d) => d.id));

export const FIRST_DENIZEN_ID = DENIZENS[0]!.id;

export function getDenizenDef(id: string): DenizenDef | undefined {
  return DENIZENS.find((d) => d.id === id);
}

export function getDenizenIndex(id: string): number {
  return DENIZENS.findIndex((d) => d.id === id);
}

export function getOwnedDenizenCount(
  owned: Record<string, number>,
  id: string,
): number {
  const v = owned[id];
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return 0;
  const def = getDenizenDef(id);
  if (!def) return 0;
  return Math.min(Math.floor(v), def.maxOwned);
}

export function totalDenizensOwned(owned: Record<string, number>): number {
  let total = 0;
  for (const def of DENIZENS) {
    total += getOwnedDenizenCount(owned, def.id);
  }
  return total;
}

/** Next purchase cost: baseCost × 1.15^owned (first copy at base price). */
export function nextDenizenCost(
  def: DenizenDef,
  ownedCount: number,
): number | null {
  if (ownedCount >= def.maxOwned) return null;
  return Math.max(0, Math.round(def.baseCost * 1.15 ** ownedCount));
}

export function denizenTeaseEnergyThreshold(def: DenizenDef): number {
  return Math.ceil(def.baseCost * 0.5);
}

export function denizenFullRevealEnergyThreshold(def: DenizenDef): number {
  return Math.ceil(def.baseCost * 0.75);
}

/** @deprecated Use denizenTeaseEnergyThreshold */
export function denizenRevealEnergyThreshold(def: DenizenDef): number {
  return denizenTeaseEnergyThreshold(def);
}
