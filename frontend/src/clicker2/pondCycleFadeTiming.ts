/** Fade to white before applying pond cycle state. */
export const POND_CYCLE_FADE_IN_MS = 1_000;
/** Full white hold while the new era loads behind the overlay. */
export const POND_CYCLE_HOLD_MS = 2_000;
/** Fade back to the game view. */
export const POND_CYCLE_FADE_OUT_MS = 1_000;

export const POND_CYCLE_FADE_TOTAL_MS =
  POND_CYCLE_FADE_IN_MS + POND_CYCLE_HOLD_MS + POND_CYCLE_FADE_OUT_MS;
