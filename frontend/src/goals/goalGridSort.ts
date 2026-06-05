import { goalPatchIsComplete } from "./goalCardLabels";
import type { Goal } from "./types";

/** Incomplete medals first; gold / period-complete last (stable within each group). */
export function sortGoalsForGrid(goals: Goal[]): Goal[] {
  const incomplete: Goal[] = [];
  const complete: Goal[] = [];
  for (const goal of goals) {
    if (goalPatchIsComplete(goal)) complete.push(goal);
    else incomplete.push(goal);
  }
  return [...incomplete, ...complete];
}

export const GOALS_GRID_PAGE_SIZE = 9;

export function paginateGoals(goals: Goal[], pageIndex: number): Goal[] {
  const start = pageIndex * GOALS_GRID_PAGE_SIZE;
  return goals.slice(start, start + GOALS_GRID_PAGE_SIZE);
}

export function goalsGridPageCount(goalCount: number): number {
  if (goalCount <= 0) return 1;
  return Math.ceil(goalCount / GOALS_GRID_PAGE_SIZE);
}

export function clampGoalsPageIndex(pageIndex: number, goalCount: number): number {
  const pageCount = goalsGridPageCount(goalCount);
  return Math.min(Math.max(0, pageIndex), pageCount - 1);
}
