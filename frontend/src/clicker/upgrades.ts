export type UpgradeDef = {
  id: number;
  name: string;
  description: string;
  cost: number;
  maxLevel: number;
  /** Energy per second while owned (stacking if multiple levels existed). */
  passive?: number;
  /** Added to each tap’s base +1 energy when owned. */
  click?: number;
  /** Other upgrade ids that must be owned before purchase. */
  requires?: number[];
};

/**
 * Michigan pond ladder: nutrients → plants → grazers → algae/midges → surface hunter & forage fish.
 * Total passive at max: 5.25/s (N+P 1.0 + others 4.25).
 */
export const UPGRADES: UpgradeDef[] = [
  {
    id: 1,
    name: "Nitrogen",
    description:
      "A key building block of life—dissolved in the water, it helps plants and algae turn sunlight into leaves and green growth.",
    cost: 50,
    maxLevel: 1,
    passive: 0.5,
  },
  {
    id: 2,
    name: "Phosphorus",
    description:
      "Often arrives with soil from the watershed—along with nitrogen it fertilizes the whole pond, from microscopic algae up through rooted plants.",
    cost: 50,
    maxLevel: 1,
    passive: 0.5,
  },
  {
    id: 3,
    name: "Algae",
    description:
      "Microscopic plants in the water and a soft green film on rocks and stems—the first harvest of sunlight that feeds tiny animals, insects, and snails.",
    cost: 200,
    maxLevel: 1,
    click: 1,
    requires: [1, 2],
  },
  {
    id: 4,
    name: "Duckweed",
    description:
      "Tiny round leaves that drift in mats on the surface—ducks eat it, shade cools the water below, and it ties up nutrients before they sink.",
    cost: 75,
    maxLevel: 1,
    passive: 0.25,
    requires: [1, 2],
  },
  {
    id: 5,
    name: "Pondweed",
    description:
      "Ribbon-like leaves under the surface, rooted in the bottom—fish weave through them, and tadpoles hide in the warm, weedy edges.",
    cost: 200,
    maxLevel: 1,
    passive: 0.25,
    requires: [4],
  },
  {
    id: 6,
    name: "Coontail",
    description:
      "Feathery, branching stems that float in dense tangles—often not rooted in mud, it shelters aquatic insects and baby fish in the interior of the weed bed.",
    cost: 500,
    maxLevel: 1,
    passive: 0.25,
    requires: [5],
  },
  {
    id: 7,
    name: "Lily",
    description:
      "Broad floating leaves and summer flowers rooted in the muck—dragonflies land there, frogs rest at the edge, and sunfish nest in the shade underneath.",
    cost: 800,
    maxLevel: 1,
    passive: 0.5,
    requires: [6],
  },
  {
    id: 8,
    name: "Snail",
    description:
      "Slow grazers that scrape algae and film off plants and stones—recycling nutrients and leaving trails other small animals follow.",
    cost: 400,
    maxLevel: 1,
    passive: 0.25,
    requires: [4],
  },
  {
    id: 9,
    name: "Tadpole",
    description:
      "Frog and toad larvae in the shallows—many graze algae or debris; legs and lungs arrive as the pond edges thicken with plants.",
    cost: 600,
    maxLevel: 1,
    passive: 0.5,
    requires: [5],
  },
  {
    id: 10,
    name: "Midge swarm",
    description:
      "Mostly non-biting midges—worm-like larvae burrow in soft sediment; adults emerge in swarms and become easy meals for birds and fish.",
    cost: 300,
    maxLevel: 1,
    passive: 0.5,
    requires: [3],
  },
  {
    id: 11,
    name: "Water strider",
    description:
      "Insects that skate on surface tension—picking off anything trapped in the film, they link the underwater world to what falls from the air above.",
    cost: 600,
    maxLevel: 1,
    passive: 0.5,
    requires: [10],
  },
  {
    id: 12,
    name: "Minnow",
    description:
      "Small schooling fish in open water and edges—they snap up insects from below and tie the insect layer to larger predators up the chain.",
    cost: 1000,
    maxLevel: 1,
    passive: 1.25,
    requires: [10, 7],
  },
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

export function getLevel(owned: Record<string, number>, id: number): number {
  const n = owned[idKey(id)];
  return typeof n === "number" && n > 0 ? n : 0;
}

/** Cost for the next purchase; `null` if maxed. */
export function nextPurchaseCost(def: UpgradeDef, currentLevel: number): number | null {
  if (currentLevel >= def.maxLevel) return null;
  return def.cost;
}

export function prerequisitesMet(def: UpgradeDef, owned: Record<string, number>): boolean {
  if (!def.requires?.length) return true;
  return def.requires.every((rid) => getLevel(owned, rid) >= 1);
}

export function totalPassivePerSecond(owned: Record<string, number>): number {
  let total = 0;
  for (const u of UPGRADES) {
    if (getLevel(owned, u.id) > 0 && u.passive != null) {
      total += u.passive;
    }
  }
  return total;
}

export function totalClickBonus(owned: Record<string, number>): number {
  let total = 0;
  for (const u of UPGRADES) {
    if (getLevel(owned, u.id) > 0 && u.click != null) {
      total += u.click;
    }
  }
  return total;
}

export function canAfford(energy: number, cost: number): boolean {
  return energy >= cost;
}

/** Energy needed to reveal an upgrade in the shop (50% of cost, rounded down). */
export function revealEnergyThreshold(def: UpgradeDef): number {
  return Math.floor(def.cost / 2);
}

/**
 * Shop shows an upgrade when prerequisites are met and either:
 * - it was previously revealed (sticky), or
 * - current energy meets the 50% reveal threshold.
 */
export function shouldShowUpgradeInShop(
  def: UpgradeDef,
  currentLevel: number,
  energy: number,
  owned: Record<string, number>,
  revealed: Record<string, boolean>,
): boolean {
  const cost = nextPurchaseCost(def, currentLevel);
  if (cost === null) return false;
  if (!prerequisitesMet(def, owned)) return false;
  const key = idKey(def.id);
  if (revealed[key]) return true;
  return energy >= revealEnergyThreshold(def);
}
