import { goalPatchIsComplete } from "./goalCardLabels";
import type { Goal } from "./types";

export const GOAL_SHIMMER_ADVANCE_MS = 4500;

/** ~25% of gold medals animate; rotating quarter advances with shimmerCursor. */
export function goalGoldShimmerAnimate(
  goal: Goal,
  sortedGoals: Goal[],
  shimmerCursor: number,
): boolean {
  if (!goalPatchIsComplete(goal)) return false;
  const goldGoals = sortedGoals.filter(goalPatchIsComplete);
  const goldIndex = goldGoals.findIndex((g) => g.id === goal.id);
  if (goldIndex < 0) return false;
  return goldIndex % 4 === shimmerCursor % 4;
}

export function goldIndexInSortedList(goalId: string, sortedGoals: Goal[]): number {
  const goldGoals = sortedGoals.filter(goalPatchIsComplete);
  return goldGoals.findIndex((g) => g.id === goalId);
}
