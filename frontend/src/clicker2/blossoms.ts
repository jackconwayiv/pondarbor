import { countMilestonesReached } from "./milestones";

/** Milestones earned → one blossom per this many milestones (floor division). */
export const BLOSSOMS_PER_MILESTONE = 5;

/** Maximum blossom slots reserved in the pond ring layout. */
export const BLOSSOM_RING_MAX = 100;

/** Cyclic pond-ring emojis (one code point each). */
export const BLOSSOM_RING_EMOJIS = [
  "🪷",
  "🌺",
  "🌼",
  "🌸",
  "🌹",
  "🌻",
  "🪻",
  "🌷",
  "🏵️",
] as const;

export const BLOSSOM_RING_EMOJI_CYCLE = BLOSSOM_RING_EMOJIS.join("");

const BLOSSOM_CYCLE_LEN = BLOSSOM_RING_EMOJIS.length;

/** Inner → outer: 25 + 25 + 25 + 25 = 100 fixed slots. */
export const BLOSSOM_RING_CAPACITIES: readonly number[] = [25, 25, 25, 25];

/** Horizontal reach of each ring (unchanged when stretching vertically). */
const BLOSSOM_RING_INNER_RADIUS_X_PCT = 38;
const BLOSSOM_RING_OUTER_RADIUS_X_PCT = 52;
/** Taller ellipse axis so rings have more room above/below the pond. */
const BLOSSOM_RING_INNER_RADIUS_Y_PCT = 48;
const BLOSSOM_RING_OUTER_RADIUS_Y_PCT = 64;

export type BlossomSlotCoord = {
  left: number;
  top: number;
  ringIndex: number;
};

export type BlossomRingPlacement = {
  emoji: string;
  left: number;
  top: number;
  ringIndex: number;
};

/**
 * Earn order → slot index (0–99); fixed permutation (seed 0x50e4d Fisher–Yates).
 * Do not change without visual intent.
 */
export const BLOSSOM_SLOT_FILL_ORDER: readonly number[] = [
  12, 62, 81, 42, 21, 34, 97, 35, 25, 19, 89, 80, 98, 30, 41, 90, 31, 45, 20,
  86, 61, 1, 17, 11, 48, 23, 28, 22, 10, 0, 4, 33, 55, 26, 32, 65, 13, 38, 2,
  6, 16, 40, 9, 50, 77, 83, 73, 96, 70, 57, 8, 36, 93, 51, 60, 74, 49, 53, 24,
  58, 46, 79, 59, 44, 14, 67, 3, 18, 27, 76, 71, 87, 5, 43, 29, 52, 39, 75,
  99, 78, 37, 47, 66, 95, 82, 85, 88, 69, 7, 91, 56, 92, 63, 54, 84, 94, 68,
  72, 15, 64,
];

/** Canonical halo anchors in legacy inner→outer ring order (slot index 0–99). */
export function buildBlossomSlotCoordinates(): readonly BlossomSlotCoord[] {
  const ringCount = BLOSSOM_RING_CAPACITIES.length;
  const out: BlossomSlotCoord[] = [];

  for (let r = 0; r < ringCount; r++) {
    const cap = BLOSSOM_RING_CAPACITIES[r] ?? 0;
    if (cap <= 0) continue;

    const t = ringCount <= 1 ? 0 : r / (ringCount - 1);
    const radiusX =
      ringCount <= 1
        ? BLOSSOM_RING_INNER_RADIUS_X_PCT
        : BLOSSOM_RING_INNER_RADIUS_X_PCT +
          t * (BLOSSOM_RING_OUTER_RADIUS_X_PCT - BLOSSOM_RING_INNER_RADIUS_X_PCT);
    const radiusY =
      ringCount <= 1
        ? BLOSSOM_RING_INNER_RADIUS_Y_PCT
        : BLOSSOM_RING_INNER_RADIUS_Y_PCT +
          t * (BLOSSOM_RING_OUTER_RADIUS_Y_PCT - BLOSSOM_RING_INNER_RADIUS_Y_PCT);
    const angleOffset = (r % 2 === 1 ? Math.PI / cap : 0) - Math.PI / 2;

    for (let s = 0; s < cap; s++) {
      const angle = angleOffset + (2 * Math.PI * s) / cap;
      out.push({
        left: 50 + radiusX * Math.cos(angle),
        top: 50 + radiusY * Math.sin(angle),
        ringIndex: r,
      });
    }
  }

  return out;
}

export const BLOSSOM_SLOT_COORDS: readonly BlossomSlotCoord[] =
  buildBlossomSlotCoordinates();

export function blossomCountFromMilestoneTotal(milestoneCount: number): number {
  return Math.floor(Math.max(0, milestoneCount) / BLOSSOMS_PER_MILESTONE);
}

export function blossomCountFromMilestones(
  milestonesReached: Record<string, number>,
): number {
  return blossomCountFromMilestoneTotal(countMilestonesReached(milestonesReached));
}

export function blossomEmojiAt(index: number): string {
  if (BLOSSOM_CYCLE_LEN <= 0) return "🪷";
  const i = ((index % BLOSSOM_CYCLE_LEN) + BLOSSOM_CYCLE_LEN) % BLOSSOM_CYCLE_LEN;
  return BLOSSOM_RING_EMOJIS[i] ?? "🪷";
}

/**
 * Place earned blossoms on fixed halo slots via {@link BLOSSOM_SLOT_FILL_ORDER}
 * (pseudo-random scatter, deterministic for all players).
 */
export function blossomRingPlacements(earnedCount: number): BlossomRingPlacement[] {
  const count = Math.min(Math.max(0, Math.floor(earnedCount)), BLOSSOM_RING_MAX);
  const out: BlossomRingPlacement[] = [];

  for (let i = 0; i < count; i++) {
    const slot = BLOSSOM_SLOT_FILL_ORDER[i]!;
    const coord = BLOSSOM_SLOT_COORDS[slot]!;
    out.push({
      emoji: blossomEmojiAt(i),
      left: coord.left,
      top: coord.top,
      ringIndex: coord.ringIndex,
    });
  }

  return out;
}

/** @deprecated Prefer blossomRingPlacements for layout. */
export function blossomRingGlyphs(count: number): string[] {
  return blossomRingPlacements(count).map((p) => p.emoji);
}

/** Compact joined string (timeline-style) for tests/debug. */
export function blossomRingJoined(count: number): string {
  return blossomRingGlyphs(count).join("");
}
