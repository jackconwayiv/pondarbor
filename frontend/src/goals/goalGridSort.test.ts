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

function makeGoal(
  overrides: Omit<Partial<Goal>, "stats"> & Pick<Goal, "id"> & { stats?: Partial<Goal["stats"]> },
): Goal {
  const baseStats: Goal["stats"] = {
    streak_current: 0,
    streak_best: 0,
    pct_lifetime: 0,
    pct_last_30_days: 0,
    days_since_last_progress: 0,
    today_actual: 0,
    today_target: 1,
    week_actual: 0,
    week_target: 0,
    urgency_score: 0,
  };
  const { stats: statsOverrides, ...rest } = overrides;
  return {
    title: "Goal",
    description: "",
    kind: "continuous",
    status: "active",
    frequency_kind: "daily",
    frequency_count: 1,
    completed_at: null,
    last_check_in_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    checkpoints: [],
    can_undo: false,
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
