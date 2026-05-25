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

export type BlossomRingPlacement = {
  emoji: string;
  left: number;
  top: number;
  ringIndex: number;
};

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
 * Place earned blossoms on concentric rings (inner first, then outward). Full
 * rings use every slot; the active partial ring spaces only its earned count.
 * Odd rings are half-step staggered to nest between neighbors.
 */
export function blossomRingPlacements(earnedCount: number): BlossomRingPlacement[] {
  const count = Math.min(Math.max(0, Math.floor(earnedCount)), BLOSSOM_RING_MAX);
  const out: BlossomRingPlacement[] = [];
  const ringCount = BLOSSOM_RING_CAPACITIES.length;
  let assigned = 0;

  for (let r = 0; r < ringCount && assigned < count; r++) {
    const cap = BLOSSOM_RING_CAPACITIES[r] ?? 0;
    if (cap <= 0) continue;

    const onRing = Math.min(cap, count - assigned);
    const isPartial = onRing < cap;
    const slotsForAngles = isPartial ? onRing : cap;
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

    for (let s = 0; s < onRing; s++) {
      const angle = angleOffset + (2 * Math.PI * s) / slotsForAngles;
      out.push({
        emoji: blossomEmojiAt(assigned),
        left: 50 + radiusX * Math.cos(angle),
        top: 50 + radiusY * Math.sin(angle),
        ringIndex: r,
      });
      assigned++;
    }
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
