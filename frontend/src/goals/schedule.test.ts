import { describe, expect, it } from "vitest";

import { goalAppliesToday } from "./schedule";
import type { Goal } from "./types";
import { emptyGoalStats } from "./types";

function makeGoal(
  overrides: Omit<Partial<Goal>, "stats"> & Pick<Goal, "id"> & { stats?: Partial<Goal["stats"]> },
): Goal {
  const baseStats = emptyGoalStats();
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

describe("goalAppliesToday", () => {
  it("returns false for weekday schedule when today_target is 0", () => {
    const goal = makeGoal({
      id: "mon",
      schedule_interval_kind: "weekday",
      schedule_weekday: 0,
      stats: { today_target: 0, week_target: 1 },
    });
    expect(goalAppliesToday(goal)).toBe(false);
  });

  it("returns true for weekly schedule when week_target is positive", () => {
    const goal = makeGoal({
      id: "w",
      schedule_interval_kind: "week",
      stats: { today_target: 0, week_target: 2 },
    });
    expect(goalAppliesToday(goal)).toBe(true);
  });

  it("returns true for non-continuous goals", () => {
    const goal = makeGoal({
      id: "c",
      kind: "chore",
      stats: { today_target: 0 },
    });
    expect(goalAppliesToday(goal)).toBe(true);
  });
});
