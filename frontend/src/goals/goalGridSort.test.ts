import { describe, expect, it } from "vitest";

import { goalPatchIsComplete } from "./goalCardLabels";
import {
  clampGoalsPageIndex,
  GOALS_GRID_PAGE_SIZE,
  goalsGridPageCount,
  paginateGoals,
  sortGoalsForGrid,
} from "./goalGridSort";
import type { Goal } from "./types";
import { emptyGoalStats } from "./types";

function makeGoal(
  overrides: Omit<Partial<Goal>, "stats"> & Pick<Goal, "id"> & { stats?: Partial<Goal["stats"]> },
): Goal {
  const baseStats: Goal["stats"] = emptyGoalStats();
  const { stats: statsOverrides, ...rest } = overrides;
  return {
    title: "Goal",
    description: "",
    kind: "continuous",
    status: "active",
    schedule_interval_kind: "day",
    frequency_count: 1,
    schedule_weekday: null,
    schedule_interval_weeks: 2,
    schedule_interval_months: 2,
    schedule_month_day: null,
    completed_at: null,
    last_check_in_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    checkpoints: [],
    can_undo: false,
    due_today: true,
    ...rest,
    id: overrides.id,
    stats: { ...baseStats, ...statsOverrides },
  };
}

describe("sortGoalsForGrid", () => {
  it("puts incomplete goals before gold period-complete goals", () => {
    const done = makeGoal({
      id: "a",
      stats: { today_actual: 1, today_target: 1 },
    });
    const todo = makeGoal({ id: "b", stats: { today_actual: 0, today_target: 1 } });
    expect(goalPatchIsComplete(done)).toBe(true);
    expect(sortGoalsForGrid([done, todo]).map((g) => g.id)).toEqual(["b", "a"]);
  });

  it("preserves order within each group", () => {
    const g1 = makeGoal({ id: "1", stats: { today_actual: 0, today_target: 1 } });
    const g2 = makeGoal({ id: "2", stats: { today_actual: 0, today_target: 1 } });
    const gold1 = makeGoal({ id: "3", stats: { today_actual: 1, today_target: 1 } });
    const gold2 = makeGoal({ id: "4", stats: { today_actual: 1, today_target: 1 } });
    expect(sortGoalsForGrid([g1, gold1, g2, gold2]).map((g) => g.id)).toEqual([
      "1",
      "2",
      "3",
      "4",
    ]);
  });

  it("puts overdue chores before other incomplete goals", () => {
    const overdue = makeGoal({
      id: "overdue",
      kind: "chore",
      stats: {
        today_actual: 0,
        today_target: 1,
        chore_period_state: "overdue",
        days_overdue: 2,
      },
    });
    const todo = makeGoal({ id: "todo", stats: { today_actual: 0, today_target: 1 } });
    expect(sortGoalsForGrid([todo, overdue]).map((g) => g.id)).toEqual(["overdue", "todo"]);
  });

  it("treats zero day target as period complete on rest days", () => {
    const restDay = makeGoal({
      id: "rest",
      schedule_interval_kind: "weekdays",
      stats: { today_actual: 0, today_target: 0 },
    });
    expect(goalPatchIsComplete(restDay)).toBe(true);
  });
});

describe("pagination helpers", () => {
  it("paginates nine per page", () => {
    const goals = Array.from({ length: 10 }, (_, i) => makeGoal({ id: String(i) }));
    expect(goalsGridPageCount(goals.length)).toBe(2);
    expect(paginateGoals(goals, 0)).toHaveLength(GOALS_GRID_PAGE_SIZE);
    expect(paginateGoals(goals, 1)).toHaveLength(1);
  });

  it("clamps page index when list shrinks", () => {
    expect(clampGoalsPageIndex(3, 5)).toBe(0);
    expect(clampGoalsPageIndex(1, 15)).toBe(1);
  });
});
