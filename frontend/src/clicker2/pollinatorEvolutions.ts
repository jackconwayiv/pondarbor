import { specialtyCatalogPrice } from "./evolutionPrices.generated";
import type { SpecialtyDef, SpecialtyEffect } from "./specialties";

export const POLLINATOR_SPECIALTY_DENIZEN_ID = "pollinator" as const;

export const POLLINATOR_SPECIALTY_ID_START = 632;

export const POLLINATOR_MECHANIC_TEXT =
  "Gain bonus EpS for each Blossom you have.";

/** percentPerBlossom × blossomCount → additive % EpS per owned card. */
export const POLLINATOR_EPS_PERCENT_PER_BLOSSOM = 0.01;

const POLLINATOR_ENTRIES: readonly {
  name: string;
  emoji: string;
  ecologyNote: string;
}[] = [
  {
    name: "Mosquito",
    emoji: "🦟",
    ecologyNote:
      "Mosquitoes trace the pond edge, linking surface film to the first blossom visitors.",
  },
  {
    name: "Bumblebee",
    emoji: "🐝",
    ecologyNote:
      "Bumblebees lumber between lily pads, shaking pollen into the water's bright fringe.",
  },
  {
    name: "Ant",
    emoji: "🐜",
    ecologyNote:
      "Ant columns march the bank, harvesting sweet spill from flowers at the rim.",
  },
  {
    name: "Beetle",
    emoji: "🪲",
    ecologyNote:
      "Shining beetles skim the shallows, grazing algae beside open blossoms.",
  },
  {
    name: "Moth",
    emoji: "🦋",
    ecologyNote:
      "Night moths spiral the pond light, pairing pale wings with pond bloom.",
  },
  {
    name: "Wasp",
    emoji: "🐝",
    ecologyNote:
      "Wasps patrol the shoreline, defending nectar lanes between reed and rose.",
  },
  {
    name: "Fly",
    emoji: "🪰",
    ecologyNote:
      "Flies cloud the warm shallows, recycling bloom fall into living soup.",
  },
  {
    name: "Ladybug",
    emoji: "🐞",
    ecologyNote:
      "Ladybugs gather on stems, keeping aphid blooms from overrunning the margin.",
  },
  {
    name: "Caterpillar",
    emoji: "🐛",
    ecologyNote:
      "Caterpillars chew through pad undersides, slow engines of future flight.",
  },
  {
    name: "Butterfly",
    emoji: "🦋",
    ecologyNote:
      "Butterflies cross the open water, stitching color from shore to shore.",
  },
  {
    name: "Nectar Bat",
    emoji: "🦇",
    ecologyNote:
      "Nectar bats skim dusk pools, drinking blossom scent above the mirror.",
  },
  {
    name: "Hummingbird",
    emoji: "🦜",
    ecologyNote:
      "Hummingbirds hover the inlet, sipping red blooms at the waterline.",
  },
  {
    name: "Oriole",
    emoji: "🐦‍⬛",
    ecologyNote:
      "Orioles flash through willow, calling over beds of pond-edge flowers.",
  },
  {
    name: "Dove",
    emoji: "🕊️",
    ecologyNote:
      "Doves drink at the shallows, soft wings stirring petals on the surface.",
  },
  {
    name: "Gecko",
    emoji: "🦎",
    ecologyNote:
      "Geckos hunt the warm stones, snapping midges drawn to blossom light.",
  },
  {
    name: "Shrew",
    emoji: "🦔",
    ecologyNote:
      "Shrews rustle through sedge, harvesting insects from the bloom belt.",
  },
  {
    name: "Honeycreeper",
    emoji: "🦚",
    ecologyNote:
      "Honeycreepers probe tubular blooms, bright throats above the pond glass.",
  },
  {
    name: "Fruit Bat",
    emoji: "🦇",
    ecologyNote:
      "Fruit bats spill seeds from fig and palm, planting the next ring of flowers.",
  },
  {
    name: "Monitor Lizard",
    emoji: "🦎",
    ecologyNote:
      "Monitor lizards bask on logs, ruling the sunny arc of blossom cover.",
  },
  {
    name: "Golden Possum",
    emoji: "🦔",
    ecologyNote:
      "Golden possums raid night blooms, carrying pollen through the moonlit shore.",
  },
];

/** Unlock tier i → 5 × (i + 1) Blossoms. */
export function pollinatorUnlockBlossoms(tierIndex: number): number {
  return 5 * (tierIndex + 1);
}

/**
 * Price anchors: 1e5, 1e6, 1e7, 1e10, 1e14, then 100 × 10^n with n += 3 per tier (1e17, 1e20, …).
 */
export function pollinatorPriceAtTier(tierIndex: number): number {
  if (tierIndex <= 0) return 100_000;
  if (tierIndex === 1) return 1_000_000;
  if (tierIndex === 2) return 10_000_000;
  if (tierIndex === 3) return 10_000_000_000;
  if (tierIndex === 4) return 100_000_000_000_000;
  const exponent = 15 + (tierIndex - 5) * 3;
  return 100 * 10 ** exponent;
}

export const POLLINATOR_PRICE_ANCHORS: readonly number[] = Array.from(
  { length: POLLINATOR_ENTRIES.length },
  (_, i) => pollinatorPriceAtTier(i),
);

const POLLINATOR_EFFECT: SpecialtyEffect = {
  type: "eps_percent_per_blossom",
  percentPerBlossom: POLLINATOR_EPS_PERCENT_PER_BLOSSOM,
};

function pollinatorSpecialty(tierIndex: number): SpecialtyDef {
  const entry = POLLINATOR_ENTRIES[tierIndex]!;
  const id = POLLINATOR_SPECIALTY_ID_START + tierIndex;
  return {
    id,
    name: entry.name,
    denizenId: POLLINATOR_SPECIALTY_DENIZEN_ID,
    unlockOwned: 0,
    unlockBlossoms: pollinatorUnlockBlossoms(tierIndex),
    pollinatorEmoji: entry.emoji,
    price: specialtyCatalogPrice(id),
    effect: POLLINATOR_EFFECT,
    effectText: POLLINATOR_MECHANIC_TEXT,
    ecologyNote: entry.ecologyNote,
  };
}

export function buildPollinatorChain(): SpecialtyDef[] {
  return POLLINATOR_ENTRIES.map((_, i) => pollinatorSpecialty(i));
}

export function specialtiesForPollinatorChain(
  specialties: readonly SpecialtyDef[],
): SpecialtyDef[] {
  return specialties.filter(
    (s) => s.denizenId === POLLINATOR_SPECIALTY_DENIZEN_ID,
  );
}
