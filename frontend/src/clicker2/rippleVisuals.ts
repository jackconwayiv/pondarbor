import {
  CLICK_SPECIALTY_DENIZEN_ID,
  getSpecialtyDef,
} from "./specialties";
import { isRetiredWindSpecialtyId } from "./retiredWindEvolutions";

/** Denizen chains whose evolutions affect click / ripple power (excludes pairings). */
export const RIPPLE_VISUAL_EVOLUTION_DENIZEN_IDS = [
  "ripples",
  CLICK_SPECIALTY_DENIZEN_ID,
] as const;

/** Animation start opacity with no qualifying evolutions (legacy baseline). */
export const RIPPLE_VISUAL_OPACITY_START_MIN = 0.5;
/** Brighter peak at full Ripples + Click reflection progression. */
export const RIPPLE_VISUAL_OPACITY_START_MAX = 0.65;

/** Ring border alpha with no qualifying evolutions (legacy baseline). */
export const RIPPLE_VISUAL_BORDER_ALPHA_MIN = 0.45;
/** Brighter peak at full progression. */
export const RIPPLE_VISUAL_BORDER_ALPHA_MAX = 0.55;

/** Owned Ripples + Click reflection evolutions needed to reach max visibility. */
export const RIPPLE_VISUAL_EVOLUTIONS_FOR_MAX = 30;

const OPACITY_START_STEP =
  (RIPPLE_VISUAL_OPACITY_START_MAX - RIPPLE_VISUAL_OPACITY_START_MIN) /
  RIPPLE_VISUAL_EVOLUTIONS_FOR_MAX;
const BORDER_ALPHA_STEP =
  (RIPPLE_VISUAL_BORDER_ALPHA_MAX - RIPPLE_VISUAL_BORDER_ALPHA_MIN) /
  RIPPLE_VISUAL_EVOLUTIONS_FOR_MAX;

export type RippleVisualStyle = {
  opacityStart: number;
  borderAlpha: number;
  evolutionCount: number;
};

export function ownedClickRippleVisualEvolutionCount(
  ownedSpecialties: Record<number, boolean>,
): number {
  let count = 0;
  for (const [rawId, owned] of Object.entries(ownedSpecialties)) {
    if (!owned) continue;
    const id = Number(rawId);
    if (!Number.isFinite(id) || isRetiredWindSpecialtyId(id)) continue;
    const def = getSpecialtyDef(id);
    if (!def) continue;
    if (
      def.denizenId === "ripples" ||
      def.denizenId === CLICK_SPECIALTY_DENIZEN_ID
    ) {
      count += 1;
    }
  }
  return count;
}

export function rippleVisualStyleFromEvolutionCount(
  evolutionCount: number,
): RippleVisualStyle {
  const count = Math.max(0, Math.floor(evolutionCount));
  const steps = Math.min(count, RIPPLE_VISUAL_EVOLUTIONS_FOR_MAX);
  return {
    evolutionCount: count,
    opacityStart: Math.min(
      RIPPLE_VISUAL_OPACITY_START_MAX,
      RIPPLE_VISUAL_OPACITY_START_MIN + steps * OPACITY_START_STEP,
    ),
    borderAlpha: Math.min(
      RIPPLE_VISUAL_BORDER_ALPHA_MAX,
      RIPPLE_VISUAL_BORDER_ALPHA_MIN + steps * BORDER_ALPHA_STEP,
    ),
  };
}

export function rippleVisualStyleFromOwnedSpecialties(
  ownedSpecialties: Record<number, boolean>,
): RippleVisualStyle {
  return rippleVisualStyleFromEvolutionCount(
    ownedClickRippleVisualEvolutionCount(ownedSpecialties),
  );
}
