import { getOwnedCount, type UpgradeDef } from "./catalog";

/**
 * Legacy PondStage emoji placement helpers.
 *
 * Snapshot of the previous layout logic before we introduced non-overlapping scatter.
 * Keep this around so we can quickly regress/reuse anchor behavior.
 */

/** FNV-1a 32-bit — stable layout/motion from upgrade id (order of unlock must not reflow the pond). */
export function hash32(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Percent anchors inside the clipped pond; spread from catalog order + hash so neighbors rarely overlap. */
export function denizenStageAnchor(upgradeId: string): { left: number; top: number } {
  const h = hash32(upgradeId);
  const left = 18 + (h % 64);
  const top = 28 + ((h >>> 9) % 50);
  return { left, top };
}

export function denizenFloatTiming(upgradeId: string): { dur: string; delay: string } {
  const h = hash32(upgradeId);
  const durSec = 4.55 + (h % 37) / 10;
  const delaySec = ((h >>> 18) % 50) / 10;
  return { dur: `${durSec.toFixed(2)}s`, delay: `${delaySec.toFixed(2)}s` };
}

/** Top-right quadrant of the bowl (visually sparse); jitter stays off the far corner (sunken 🪵). */
export function shallowShelfMilestoneAnchor(): { left: number; top: number } {
  const h = hash32("milestone_shallow_shelf_anchor");
  return {
    left: 62 + (h % 18),
    top: 14 + ((h >>> 10) % 22),
  };
}

/** Bottom band, middle-right — benthic decomposer vibe. */
export function decomposerFungiMilestoneAnchor(): { left: number; top: number } {
  const h = hash32("milestone_decomposer_fungi_anchor");
  return {
    left: 58 + (h % 14),
    top: 78 + ((h >>> 10) % 9),
  };
}

/** Far right of the bowl — column / margin algae read. */
export function pondAlgaeMilestoneAnchor(): { left: number; top: number } {
  const h = hash32("milestone_pond_algae_anchor");
  return {
    left: 86 + (h % 7),
    top: 36 + ((h >>> 10) % 14),
  };
}

/** Upper bowl, middle-right — slack-water / surface film. */
export function calmEddiesMilestoneAnchor(): { left: number; top: number } {
  const h = hash32("milestone_calm_eddies_anchor");
  return {
    left: 62 + (h % 10),
    top: 12 + ((h >>> 10) % 12),
  };
}

/** Stable % anchor for `fallen_branch` wood emoji — hash-based, biased toward littoral edge. */
export const FALLEN_BRANCH_WOOD_ANCHOR = (() => {
  const a = denizenStageAnchor("fallen_branch");
  return { left: Math.min(a.left, 22), top: Math.max(a.top, 62) };
})();

/** `reed_fringe` sheaf — hash-based, biased toward the right littoral. */
export function reedFringeSheafAnchor(): { left: number; top: number } {
  const a = denizenStageAnchor("reed_fringe");
  return { left: Math.max(a.left, 76), top: Math.min(Math.max(a.top, 36), 58) };
}

export const REED_FRINGE_SHEAF_ANCHOR = reedFringeSheafAnchor();

/** `cattail_stand` — sheaf of rice (🌾), stable anchor near top center of the bowl. */
export const CATTAIL_STAND_SHEAF_ANCHOR = (() => {
  const h = hash32("cattail_stand");
  return {
    left: 44 + (h % 13),
    top: 9 + ((h >>> 8) % 7),
  };
})();

/** When reeds are owned, park tadpoles just left of the sheaf; otherwise default anchor. */
export function tadpolesStageAnchor(
  ownedUpgrades: Record<string, number>,
): { left: number; top: number } {
  const base = denizenStageAnchor("tadpoles");
  if (getOwnedCount(ownedUpgrades, "reed_fringe") < 1) return base;
  const reed = reedFringeSheafAnchor();
  const h = hash32("tadpoles_near_reed");
  return {
    left: Math.max(32, reed.left - 9 - (h % 4)),
    top: Math.min(72, Math.max(34, reed.top + (h % 7) - 3)),
  };
}

export function minnowsStageAnchor(): { left: number; top: number } {
  const h = hash32("minnows_stage_anchor");
  return {
    left: 20 + (h % 14),
    top: 24 + ((h >>> 9) % 16),
  };
}

export type DenizenMotion = "fish" | "turtle" | "herp" | "float" | "still";

const TURTLE_DENIZEN_IDS = new Set([
  "painted_turtles",
  "softshell_turtle",
  "snapping_turtle",
]);

export function denizenMotionFor(def: UpgradeDef): DenizenMotion {
  if (def.id === "tadpoles") return "still";
  if (def.family === "Fish") return "fish";
  if (TURTLE_DENIZEN_IDS.has(def.id)) return "turtle";
  if (def.family === "Herptiles") return "herp";
  return "float";
}

