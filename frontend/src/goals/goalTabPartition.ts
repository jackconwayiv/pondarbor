import { goalPatchIsComplete, goalLastProgressAt } from "./goalCardLabels";
import { goalAppliesToday } from "./schedule";
import type { Goal } from "./types";

export type TodayTabId = "active" | "completed_overflow" | "projects" | "goals";

export type PartitionSplit = {
  completed: boolean;
  projects: boolean;
  goals: boolean;
};

export type PartitionResult = {
  tabs: Record<TodayTabId, Goal[]>;
  split: PartitionSplit;
};

export function dueTodayActiveGoals(goals: Goal[]): Goal[] {
  return goals.filter((g) => g.status === "active" && g.due_today && goalAppliesToday(g));
}

/** Cascade overflow when due-today active pool exceeds grid capacity. */
export function partitionDueTodayGoals(
  goals: Goal[],
  pageSize: number,
): PartitionResult {
  let pool = dueTodayActiveGoals(goals);
  const tabs: Record<TodayTabId, Goal[]> = {
    active: [],
    completed_overflow: [],
    projects: [],
    goals: [],
  };
  const split: PartitionSplit = { completed: false, projects: false, goals: false };

  if (pool.length > pageSize) {
    split.completed = true;
    tabs.completed_overflow = pool.filter((g) => goalPatchIsComplete(g));
    pool = pool.filter((g) => !goalPatchIsComplete(g));
  }
  if (pool.length > pageSize) {
    split.projects = true;
    tabs.projects = pool.filter((g) => g.kind === "one_time");
    pool = pool.filter((g) => g.kind !== "one_time");
  }
  if (pool.length > pageSize) {
    split.goals = true;
    tabs.goals = pool.filter((g) => g.kind === "continuous");
    pool = pool.filter((g) => g.kind === "chore");
  }
  tabs.active = pool;
  return { tabs, split };
}

export function sortByRecentProgress(goals: Goal[]): Goal[] {
  return [...goals].sort((a, b) => {
    const ta = goalLastProgressAt(a)?.getTime() ?? 0;
    const tb = goalLastProgressAt(b)?.getTime() ?? 0;
    return tb - ta;
  });
}

const STATUS_SORT: Record<Goal["status"], number> = {
  active: 0,
  paused: 1,
  completed: 2,
};

/** Goals Manager list: active → paused → completed, then title. */
export function sortManagerGoals(goals: Goal[]): Goal[] {
  return [...goals].sort((a, b) => {
    const sd = STATUS_SORT[a.status] - STATUS_SORT[b.status];
    if (sd !== 0) return sd;
    return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
  });
}

export function buildCompletedTabGoals(
  allGoals: Goal[],
  overflow: Goal[],
): Goal[] {
  const archived = allGoals.filter((g) => g.status === "completed");
  const byId = new Map<string, Goal>();
  for (const g of [...archived, ...overflow]) {
    byId.set(g.id, g);
  }
  return sortByRecentProgress([...byId.values()]);
}
