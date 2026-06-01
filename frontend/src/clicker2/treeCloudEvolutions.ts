import type { SpecialtyDef } from "./specialties";

/** Must match [fossilShop.ts](fossilShop.ts) `STRATIFIED_POND_SPECIALTY_ID`. */
const STRATIFIED_POND_SPECIALTY_ID = 679;

export const WOODED_SHORE_SPECIALTY_ID = 688;
export const GATHERING_CLOUDS_SPECIALTY_ID = 689;

export const TREE_SPECIALTY_DENIZEN_ID = "tree" as const;
export const CLOUD_SPECIALTY_DENIZEN_ID = "cloud" as const;

const TREE_SPECIALTY_ID_START = 690;
const CLOUD_SPECIALTY_ID_START = 705;

type ChainTier = {
  name: string;
  price: number;
  emoji: string;
  ecologyNote: string;
};

const TREE_TIERS: readonly ChainTier[] = [
  {
    name: "Pussy Willow",
    price: 400,
    emoji: "🌳",
    ecologyNote:
      "Soft catkins line the muddy margin—the first woody frame for a wooded shore.",
  },
  {
    name: "Speckled Alder",
    price: 40_000,
    emoji: "🌳",
    ecologyNote:
      "Alder roots knit the bank; nitrogen and shade begin to steady the shallows.",
  },
  {
    name: "Black Willow",
    price: 4_000_000,
    emoji: "🌳",
    ecologyNote:
      "Willow whips bend with the current, trapping silt where the pond meets land.",
  },
  {
    name: "River Birch",
    price: 400_000_000,
    emoji: "🌳",
    ecologyNote:
      "Peeling bark flashes along the inlet; roots drink the seep where water slows.",
  },
  {
    name: "Eastern Cottonwood",
    price: 40_000_000_000,
    emoji: "🌳",
    ecologyNote:
      "Cottonwood crowns the levee; summer seeds drift like snow across open water.",
  },
  {
    name: "Fremont Cottonwood",
    price: 4_000_000_000_000,
    emoji: "🌳",
    ecologyNote:
      "Broad crowns arch over backwaters, shading pools where heat once ruled.",
  },
  {
    name: "Black Cottonwood",
    price: 400_000_000_000_000,
    emoji: "🌳",
    ecologyNote:
      "Old cottonwoods tower at the outlet—fallen limbs become perch and cover below.",
  },
  {
    name: "Quaking Aspen",
    price: 40_000_000_000_000_000,
    emoji: "🌳",
    ecologyNote:
      "Aspen leaves tremble at the rim; light flickers through to the pond floor.",
  },
  {
    name: "Paper Birch",
    price: 4_000_000_000_000_000_000,
    emoji: "🌳",
    ecologyNote:
      "White trunks gleam at dusk; peeling scrolls litter the leaf litter at the edge.",
  },
  {
    name: "Oregon Ash",
    price: 400_000_000_000_000_000_000,
    emoji: "🌳",
    ecologyNote:
      "Ash holds the floodplain line—wet feet and winged seeds for the next high water.",
  },
  {
    name: "Silver Maple",
    price: 40_000_000_000_000_000_000_000,
    emoji: "🍁",
    ecologyNote:
      "Silver maple roots probe the bowl; autumn bronze mirrors on still afternoons.",
  },
  {
    name: "Red Maple",
    price: 4_000_000_000_000_000_000_000_000,
    emoji: "🍁",
    ecologyNote:
      "Crimson keys spin down in spring; the shore blazes before the first heat haze.",
  },
  {
    name: "Arizona Sycamore",
    price: 400_000_000_000_000_000_000_000_000,
    emoji: "🌳",
    ecologyNote:
      "Mottled sycamore limbs overhang the creek—broad shade and pale bark above the pool.",
  },
  {
    name: "Northern White Cedar",
    price: 40_000_000_000_000_000_000_000_000_000,
    emoji: "🌲",
    ecologyNote:
      "Cedar tapers rise from cool seeps; resinous boughs scent the fog off the water.",
  },
  {
    name: "Western Redcedar",
    price: 4_000_000_000_000_000_000_000_000_000_000,
    emoji: "🌲",
    ecologyNote:
      "Cathedral cedar at the pond's head—fallen fiber and shade for the deepest shore.",
  },
];

const CLOUD_TIERS: readonly ChainTier[] = [
  {
    name: "Cumulus Cloud",
    price: 30,
    emoji: "☁️",
    ecologyNote:
      "Fair-weather heaps stack above the pond—bright convection and brief shade.",
  },
  {
    name: "Stratus Cloud",
    price: 3_000,
    emoji: "☁️",
    ecologyNote:
      "A gray sheet dulls the meniscus; light spreads soft and even across the basin.",
  },
  {
    name: "Fog Clouds",
    price: 300_000,
    emoji: "🌫️",
    ecologyNote:
      "Fog pools in the hollow; the shore vanishes until sun burns the veil away.",
  },
  {
    name: "Cirrus Cloud",
    price: 30_000_000,
    emoji: "☁️",
    ecologyNote:
      "Ice filaments streak high overhead—harbingers of change still days away.",
  },
  {
    name: "Altostratus Cloud",
    price: 3_000_000_000,
    emoji: "☁️",
    ecologyNote:
      "A milky deck slides in; the pond takes on the color of a muted sky.",
  },
  {
    name: "Altocumulus Cloud",
    price: 300_000_000_000,
    emoji: "☁️",
    ecologyNote:
      "Rippled patches quilt the heavens—wind aloft but the surface barely stirred.",
  },
  {
    name: "Stratocumulus Cloud",
    price: 30_000_000_000_000,
    emoji: "☁️",
    ecologyNote:
      "Low lumps march in ranks; broken sunbeams race across the open water.",
  },
  {
    name: "Cirrostratus Cloud",
    price: 3_000_000_000_000_000,
    emoji: "☁️",
    ecologyNote:
      "Thin ice haze rings the sun; halos promise weather on the way.",
  },
  {
    name: "Cirrocumulus Cloud",
    price: 300_000_000_000_000_000,
    emoji: "☁️",
    ecologyNote:
      "Mackerel sky at noon—fine ripples of cloud and the pond below both shimmer.",
  },
  {
    name: "Nimbostratus Cloud",
    price: 30_000_000_000_000_000_000,
    emoji: "☁️",
    ecologyNote:
      "Rain curtains draw across the horizon; the basin drinks from a slow, steady sky.",
  },
  {
    name: "Cumulus Congestus",
    price: 3_000_000_000_000_000_000_000,
    emoji: "☁️",
    ecologyNote:
      "Towering heads boil upward—updrafts strong enough to rock the lily pads.",
  },
  {
    name: "Lenticular Cloud",
    price: 300_000_000_000_000_000_000_000,
    emoji: "☁️",
    ecologyNote:
      "Lens clouds cap the distant ridge; still air below, wild winds above.",
  },
  {
    name: "Mammatus Cloud",
    price: 30_000_000_000_000_000_000_000_000,
    emoji: "☁️",
    ecologyNote:
      "Pouched undersides sag after the storm—odd calm while the sky still remembers thunder.",
  },
  {
    name: "Shelf Cloud",
    price: 3_000_000_000_000_000_000_000_000_000,
    emoji: "☁️",
    ecologyNote:
      "A leading edge rolls overhead; gust front and silver light sweep the pond.",
  },
  {
    name: "Cumulonimbus Cloud",
    price: 300_000_000_000_000_000_000_000_000_000,
    emoji: "☁️",
    ecologyNote:
      "Anvils spread at the ceiling of the world—lightning, rain, and the pond in between.",
  },
];

export const TREE_SPECIALTY_IDS: readonly number[] = TREE_TIERS.map(
  (_, i) => TREE_SPECIALTY_ID_START + i,
);

export const CLOUD_SPECIALTY_IDS: readonly number[] = CLOUD_TIERS.map(
  (_, i) => CLOUD_SPECIALTY_ID_START + i,
);

function productionPercentForTierIndex(tierIndex: number): number {
  if (tierIndex < 3) return 1;
  if (tierIndex < 6) return 2;
  if (tierIndex < 9) return 3;
  if (tierIndex < 12) return 4;
  return 5;
}

function buildFossilGate(
  id: number,
  name: string,
  chainLabel: string,
  ecologyNote: string,
  emoji: string,
): SpecialtyDef {
  return {
    id,
    name,
    denizenId: "fossil",
    unlockOwned: 0,
    price: 0,
    priceFossils: 25,
    fossilShopOnly: true,
    requiresOwnedSpecialtyId: STRATIFIED_POND_SPECIALTY_ID,
    effect: { type: "production_percent", percent: 0 },
    effectText: `Unlocks ${chainLabel} evolutions.`,
    ecologyNote,
    pollinatorEmoji: emoji,
  };
}

function buildProductionChain(
  denizenId: typeof TREE_SPECIALTY_DENIZEN_ID | typeof CLOUD_SPECIALTY_DENIZEN_ID,
  tiers: readonly ChainTier[],
  idStart: number,
  gateId: number,
): SpecialtyDef[] {
  return tiers.map((tier, index) => {
    const id = idStart + index;
    const percent = productionPercentForTierIndex(index);
    return {
      id,
      name: tier.name,
      denizenId,
      unlockOwned: 0,
      price: tier.price,
      requiresOwnedSpecialtyId:
        index === 0 ? gateId : idStart + index - 1,
      effect: { type: "production_percent", percent },
      effectText: `Your entire pond is ${percent}% more efficient`,
      ecologyNote: tier.ecologyNote,
      pollinatorEmoji: tier.emoji,
    };
  });
}

export function buildTreeCloudFossilGates(): SpecialtyDef[] {
  return [
    buildFossilGate(
      WOODED_SHORE_SPECIALTY_ID,
      "Wooded Shore",
      "Tree",
      "Riparian trees take hold along the shore. Trees join the evolution shop.",
      "🌲",
    ),
    buildFossilGate(
      GATHERING_CLOUDS_SPECIALTY_ID,
      "Gathering Clouds",
      "Cloud",
      "Sky signs gather above the basin. Clouds join the evolution shop.",
      "☁️",
    ),
  ];
}

export function buildTreeChain(): SpecialtyDef[] {
  return buildProductionChain(
    TREE_SPECIALTY_DENIZEN_ID,
    TREE_TIERS,
    TREE_SPECIALTY_ID_START,
    WOODED_SHORE_SPECIALTY_ID,
  );
}

export function buildCloudChain(): SpecialtyDef[] {
  return buildProductionChain(
    CLOUD_SPECIALTY_DENIZEN_ID,
    CLOUD_TIERS,
    CLOUD_SPECIALTY_ID_START,
    GATHERING_CLOUDS_SPECIALTY_ID,
  );
}
