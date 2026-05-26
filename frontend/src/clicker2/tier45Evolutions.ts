/** Unlock owned count for tier-4.5 denizen evolutions (between tiers at 50 and 100). */
export const DENIZEN_TIER45_UNLOCK_OWNED = 75;

/** Sediment tier-4.5 (Cracial Glape). */
export const SEDIMENT_CRACIAL_GLAPE_SPECIALTY_ID = 652;

/** Tier-4.5 specialty ids 653–674 (ripples through transcendence). */
export const DENIZEN_TIER45_SPECIALTY_IDS = {
  ripples: 653,
  fungi: 654,
  microbes: 655,
  zooplankton: 656,
  aquatic_plants: 657,
  invertebrates: 658,
  small_swimmers: 659,
  amphibians: 660,
  small_fish: 661,
  reptiles: 662,
  large_fish: 663,
  waterfowl: 664,
  shore_mammals: 665,
  hunting_birds: 666,
  great_mammals: 667,
  humans: 668,
  cryptids: 669,
  spirits: 670,
  leviathans: 671,
  abyssals: 672,
  celestials: 673,
  transcendence: 674,
} as const;

export type Tier45EvolutionCopy = {
  name: string;
  ecologyNote: string;
};

export const DENIZEN_TIER45_COPY: Record<string, Tier45EvolutionCopy> = {
  ripples: {
    name: "Standing Wave",
    ecologyNote:
      "A persistent pulse holds at the meniscus where wind and inflow meet, sending train after train of rings across the open bowl. The surface learns a rhythm stronger than any single splash.",
  },
  fungi: {
    name: "Mycelial Mat",
    ecologyNote:
      "Hyphae knit a living carpet through drowned litter, softening wood and leaves into food the whole bottom can share. The mat turns debris into steady fuel for grazers above.",
  },
  microbes: {
    name: "Biofilm Bloom",
    ecologyNote:
      "Sticky colonies coat stones and stems, trapping nutrients and oxygen in a thin living varnish. Every submerged surface becomes a workshop for recycling dissolved matter.",
  },
  zooplankton: {
    name: "Diel Drift",
    ecologyNote:
      "Swarms rise at dusk and sink by day, shuttling energy through the water column in a quiet commute. Vertical migration stitches surface light to deeper hunger.",
  },
  aquatic_plants: {
    name: "Canopy Gap",
    ecologyNote:
      "Sunlight slips between floating leaves and submerged blades, lighting pockets where algae and fry crowd the bright stripes. Gaps in the canopy become nurseries for the whole pond.",
  },
  invertebrates: {
    name: "Burrow Rim",
    ecologyNote:
      "Snails and nymphs rework the mud-water edge, aerating pores and grazing films where predators hunt in miniature. The rim of the bed hums with small industry.",
  },
  small_swimmers: {
    name: "Shoal Flash",
    ecologyNote:
      "Minnows turn as one when a shadow passes, silvering the shallows before vanishing into weed. Flashing schools move energy from plankton to larger mouths in an instant.",
  },
  amphibians: {
    name: "Vernal Edge",
    ecologyNote:
      "Frogs gather where bank vegetation meets open water, breeding in warm shallows while adults patrol the margin for insects. The edge becomes a corridor between land and pond.",
  },
  small_fish: {
    name: "Littoral Rush",
    ecologyNote:
      "Sunfish surge through stems and snags at the rim, ambushing prey that thought the weeds were safe. Structure-rich littoral zones pack productivity into armored flesh.",
  },
  reptiles: {
    name: "Sun Deck",
    ecologyNote:
      "Turtles and kin haul onto logs and stones, basking until plates and scales drink enough heat to hunt again. Floating decks of wood become solar panels for cold blood.",
  },
  large_fish: {
    name: "Thermocline Hunt",
    ecologyNote:
      "Apex fish patrol the boundary between warm cap and cold deep, striking upward when prey blunder through the gradient. The thermocline is a moving wall of teeth.",
  },
  waterfowl: {
    name: "Splash Down",
    ecologyNote:
      "Ducks and geese cannonball into open water, stirring sediment and scattering rings that carry nutrients from bank to center. Every landing rewrites the surface for a moment.",
  },
  shore_mammals: {
    name: "Bank Terrace",
    ecologyNote:
      "Muskrat channels and beaver terraces step the shoreline down in shelves of mud and chew. Each terrace traps silt and creates a new shelf for plants and fry.",
  },
  hunting_birds: {
    name: "Strike Zone",
    ecologyNote:
      "Herons and kingfishers stake out perches where shallows meet cover, pulling fish from the pond into the air with each strike. The strike zone concentrates predation along the rim.",
  },
  great_mammals: {
    name: "Trail Crossing",
    ecologyNote:
      "Deer and other heavy visitors ford at dawn, packing mud and leaving droppings that feed the bank and shallow water alike. Crossings import forest nutrients to the bowl.",
  },
  humans: {
    name: "Stone Skip",
    ecologyNote:
      "A practiced hand sends discs of stone hopping across the film, each impact seeding rings that overlap and fade. Human play disturbs the surface like a small storm.",
  },
  cryptids: {
    name: "Glint Pool",
    ecologyNote:
      "Something flashes too large beneath the mirror surface, leaving only widening rings and stories told at the far shore. Glints in the pool keep the margins mysterious.",
  },
  spirits: {
    name: "Willow Mist",
    ecologyNote:
      "Cool breath off the bank beads the meniscus at dusk, and rings spread without a visible stone. Mist and story move across the water when daylight thins.",
  },
  leviathans: {
    name: "Pressure Dome",
    ecologyNote:
      "A vast body rolls beneath the surface, doming the film upward before long waves roll outward. Pressure from below reminds every smaller denizen who owns the deep.",
  },
  abyssals: {
    name: "Cold Seeps",
    ecologyNote:
      "Chill water slides along the lowest bowl, feeding strange patience and hunger adapted to darkness. Cold seeps link the pond floor to logic older than sun.",
  },
  celestials: {
    name: "Zenith Gleam",
    ecologyNote:
      "At high sun or bright moon the basin mirrors the sky until a breath of wind shatters the gleam into rings. Celestial light duplicates on the pond and sends pulses outward.",
  },
  transcendence: {
    name: "Whole Breath",
    ecologyNote:
      "Every tier of life exhales at once, and the surface rises and falls as if the pond itself were breathing. The whole basin moves together in one slow shared rhythm.",
  },
};

export function denizenHasTier45Insert(denizenId: string): boolean {
  return (
    denizenId === "sediment" ||
    Object.prototype.hasOwnProperty.call(DENIZEN_TIER45_SPECIALTY_IDS, denizenId)
  );
}

export function tier45SpecialtyIdForDenizen(denizenId: string): number {
  if (denizenId === "sediment") return SEDIMENT_CRACIAL_GLAPE_SPECIALTY_ID;
  const id =
    DENIZEN_TIER45_SPECIALTY_IDS[
      denizenId as keyof typeof DENIZEN_TIER45_SPECIALTY_IDS
    ];
  if (id == null) {
    throw new Error(`tier45SpecialtyIdForDenizen: unknown denizen ${denizenId}`);
  }
  return id;
}
