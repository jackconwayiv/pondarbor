import { describe, expect, it } from "vitest";

import { goalPatchIsComplete } from "./goalCardLabels";
import {
  optimisticCheckIn,
  optimisticMarkComplete,
  optimisticStripeAfterCheckIn,
} from "./optimisticGoalUpdate";
import type { Goal, GoalsStripe } from "./types";
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

const emptyStripe: GoalsStripe = {
  today_actual: 2,
  today_target: 3,
  week_actual: 1,
  week_target: 2,
  month_actual: 0,
  month_target: 0,
};

describe("optimisticCheckIn", () => {
  it("bumps today_actual for daily goals", () => {
    const goal = makeGoal({ id: "g1" });
    const next = optimisticCheckIn(goal);
    expect(next.stats.today_actual).toBe(1);
    expect(next.last_check_in_at).toBeTruthy();
    expect(next.can_undo).toBe(true);
    expect(next.stats.days_since_last_progress).toBe(0);
  });

  it("bumps week_actual for weekly goals", () => {
    const goal = makeGoal({
      id: "g1",
      schedule_interval_kind: "week",
      stats: { week_actual: 0, week_target: 1, today_actual: 0, today_target: 0 },
    });
    const next = optimisticCheckIn(goal);
    expect(next.stats.week_actual).toBe(1);
  });

  it("increments streak when check-in newly completes the period", () => {
    const goal = makeGoal({
      id: "g1",
      stats: { today_actual: 0, today_target: 1, streak_current: 2 },
    });
    const next = optimisticCheckIn(goal);
    expect(goalPatchIsComplete(next)).toBe(true);
    expect(next.stats.streak_current).toBe(3);
  });

  it("marks checkpoint completed for one-time goals", () => {
    const goal = makeGoal({
      id: "g1",
      kind: "one_time",
      checkpoints: [
        {
          id: "cp1",
          title: "Step",
          sort_order: 0,
          completed_at: null,
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
    });
    const next = optimisticCheckIn(goal, "cp1");
    expect(next.checkpoints[0]?.completed_at).toBeTruthy();
  });
});

describe("optimisticMarkComplete", () => {
  it("sets completed status and timestamp", () => {
    const goal = makeGoal({ id: "g1", kind: "one_time" });
    const next = optimisticMarkComplete(goal);
    expect(next.status).toBe("completed");
    expect(next.completed_at).toBeTruthy();
    expect(next.can_undo).toBe(true);
  });
});

describe("optimisticStripeAfterCheckIn", () => {
  it("increments today stripe for daily goals", () => {
    const goal = makeGoal({ id: "g1" });
    const next = optimisticStripeAfterCheckIn(emptyStripe, goal);
    expect(next.today_actual).toBe(3);
    expect(next.week_actual).toBe(1);
  });

  it("increments week stripe for weekly goals", () => {
    const goal = makeGoal({
      id: "g1",
      schedule_interval_kind: "week",
      frequency_count: 2,
      stats: { week_actual: 0, week_target: 2, today_actual: 0, today_target: 0 },
    });
    const next = optimisticStripeAfterCheckIn(emptyStripe, goal);
    expect(next.week_actual).toBe(2);
    expect(next.today_actual).toBe(2);
  });
});
