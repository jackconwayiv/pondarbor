import { type UpgradeDef, type UpgradeFamily } from "./catalog";

/**
 * Marquee denizen glyphs on the pond. Matches `nodeType: "Denizen"` with `isMarquee: true`.
 */
export const MARQUEE_DENIZEN_STAGE_EMOJI: Record<string, string> = {
  pond_snails: "🐌",
  tadpoles: "🫧",
  dragonfly_nymph: "🦟",
  leeches: "🪱",
  crayfish: "🦞",
  minnows: "🐟",
  green_frogs: "🐸",
  water_striders: "🪰",
  diving_beetles: "🪲",
  bluegill: "🐠",
  pumpkinseed_sunfish: "🐡",
  painted_turtles: "🐢",
  salamanders: "🦎",
  perch: "🐟",
  largemouth_bass: "🎣",
  softshell_turtle: "🐢",
  bullfrogs: "🐸",
  muskrats: "🐀",
  catfish: "🐟",
  northern_pike: "🦈",
  snapping_turtle: "🐢",
  mallard_ducks: "🦆",
  great_blue_herons: "🐦‍⬛",
  canada_geese: "🪿",
  otters: "🦦",
  beavers: "🦫",
  bald_eagles: "🦅",
  bowfin: "🐟",
  mute_swans: "🦢",
};

/**
 * When owned, show one static emoji on the pond for habitat / hydrology milestones.
 */
export const POND_MILESTONE_EMOJI_UPGRADES: ReadonlyArray<{
  readonly upgradeId: string;
  readonly emoji: string;
}> = [
  { upgradeId: "lily_pads", emoji: "🪷" },
  { upgradeId: "pondweed", emoji: "🌿" },
  { upgradeId: "spawning_shallows", emoji: "🌱" },
  { upgradeId: "shallow_shelf", emoji: "🪨" },
  { upgradeId: "canopy_perch", emoji: "🌲" },
  { upgradeId: "breezy_surface", emoji: "🍃" },
  { upgradeId: "migrating_waterfowl", emoji: "🐤" },
  { upgradeId: "evening_chorus", emoji: "🎵" },
  { upgradeId: "rainwater_inflow", emoji: "🍁" },
  { upgradeId: "duckweed_mat", emoji: "🌿" },
  { upgradeId: "leaf_litter_bed", emoji: "🍂" },
  { upgradeId: "cool_spring_seep", emoji: "☘️" },
  { upgradeId: "zooplankton_bloom", emoji: "🪼" },
  { upgradeId: "pond_algae", emoji: "🦠" },
  { upgradeId: "decomposer_fungi", emoji: "🍄‍🟫" },
  { upgradeId: "calm_eddies", emoji: "💦" },
];

/** Single-character pond glyphs from `PondStage` (not milestone list / swimming denizens). */
const POND_STAGE_STATIC_EMOJI: Readonly<Record<string, string>> = {
  fallen_branch: "🪵",
  reed_fringe: "🌾",
  cattail_stand: "🌾",
  sunken_log: "🪵",
  tangled_roots: "🌿",
};

function milestoneEmojiForUpgradeId(upgradeId: string): string | undefined {
  const row = POND_MILESTONE_EMOJI_UPGRADES.find((m) => m.upgradeId === upgradeId);
  return row?.emoji;
}

/**
 * Emoji shown on the pond for this upgrade when owned (static glyph, milestone float, or
 * swimming denizen). Omits non-emoji visuals (midge dots, sun twinkles, rim SVGs, water-flea dots).
 */
export function pondStageEmojiForUpgrade(def: UpgradeDef): string | null {
  const fromStatic = POND_STAGE_STATIC_EMOJI[def.id];
  if (fromStatic) return fromStatic;
  const fromMilestone = milestoneEmojiForUpgradeId(def.id);
  if (fromMilestone) return fromMilestone;
  return stageEmojiForUpgrade(def);
}

function defaultDenizenEmojiByFamily(family: UpgradeFamily): string | null {
  switch (family) {
    case "Fish":
      return "🐟";
    case "Birds":
      return "🦆";
    case "Mammals":
      return "🦫";
    case "Herptiles":
      return "🐸";
    case "Invertebrates":
      return "🦐";
    default:
      return null;
  }
}

/** Pond layer: emoji for owned swimming / floating denizens. */
export function stageEmojiForUpgrade(def: UpgradeDef): string | null {
  if (def.nodeType !== "Denizen") return null;
  // Bottom-half dot swarm only in PondStage; no floating glyph.
  if (def.id === "water_fleas") return null;
  const fallback = defaultDenizenEmojiByFamily(def.family);
  return MARQUEE_DENIZEN_STAGE_EMOJI[def.id] ?? fallback;
}
