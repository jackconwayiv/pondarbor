/** Keep in sync with backend/goals/validation.py */
export const GOAL_TITLE_MAX = 255;
export const GOAL_DESCRIPTION_MAX = 2000;
export const CHECKPOINT_TITLE_MAX = 255;
export const FREQUENCY_COUNT_MIN = 1;
export const FREQUENCY_COUNT_MAX = 99;

export function clampFrequencyCount(n: number): number {
  if (!Number.isFinite(n)) return FREQUENCY_COUNT_MIN;
  return Math.min(FREQUENCY_COUNT_MAX, Math.max(FREQUENCY_COUNT_MIN, Math.trunc(n)));
}
