import { describe, expect, it } from "vitest";

import { emptyGoalStats } from "./types";
import type { Goal } from "./types";
import {
  buildCompletedTabGoals,
  dueTodayActiveGoals,
  partitionDueTodayGoals,
} from "./goalTabPartition";
import { GOALS_GRID_PAGE_SIZE } from "./goalGridSort";

function makeGoal(overrides: Partial<Goal> & { id: string }): Goal {
  const { id, title, ...rest } = overrides;
  return {
    id,
    title: title ?? id,
    description: "",
    kind: "continuous",
    status: "active",
    schedule_interval_kind: "day",
    frequency_count: 1,
    schedule_weekday: null,
    schedule_interval_weeks: 1,
    schedule_interval_months: 2,
    schedule_month_day: null,
    completed_at: null,
    last_check_in_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    checkpoints: [],
    stats: emptyGoalStats({ today_target: 1 }),
    can_undo: false,
    due_today: true,
    ...rest,
  };
}

describe("dueTodayActiveGoals", () => {
  it("excludes continuous goals that do not apply today", () => {
    const applies = makeGoal({ id: "yes", stats: emptyGoalStats({ today_target: 1 }) });
    const offDay = makeGoal({
      id: "no",
      schedule_interval_kind: "weekday",
      schedule_weekday: 0,
      due_today: true,
      stats: emptyGoalStats({ today_target: 0, week_target: 1 }),
    });
    expect(dueTodayActiveGoals([applies, offDay])).toEqual([applies]);
  });
});

describe("partitionDueTodayGoals", () => {
  it("keeps all on active when count <= page size", () => {
    const goals = [makeGoal({ id: "a" }), makeGoal({ id: "b" })];
    const { tabs, split } = partitionDueTodayGoals(goals, GOALS_GRID_PAGE_SIZE);
    expect(split).toEqual({ completed: false, projects: false, goals: false });
    expect(tabs.active).toHaveLength(2);
    expect(tabs.completed_overflow).toHaveLength(0);
  });

  it("splits completed overflow first when pool > 9", () => {
    const goals = Array.from({ length: 10 }, (_, i) =>
      makeGoal({
        id: String(i),
        stats: emptyGoalStats(
          i === 0 ? { today_actual: 1, today_target: 1 } : { today_target: 1 },
        ),
      }),
    );
    const { tabs, split } = partitionDueTodayGoals(goals, GOALS_GRID_PAGE_SIZE);
    expect(split.completed).toBe(true);
    expect(tabs.completed_overflow).toHaveLength(1);
    expect(tabs.active).toHaveLength(9);
  });

  it("cascades projects then goals", () => {
    const dueStats = emptyGoalStats({ today_target: 1 });
    const goals: Goal[] = [];
    for (let i = 0; i < 12; i++) {
      goals.push(
        makeGoal({
          id: `c-${i}`,
          kind: "continuous",
          stats: dueStats,
        }),
      );
    }
    for (let i = 0; i < 8; i++) {
      goals.push(
        makeGoal({
          id: `p-${i}`,
          kind: "one_time",
          stats: dueStats,
        }),
      );
    }
    for (let i = 0; i < 5; i++) {
      goals.push(
        makeGoal({
          id: `h-${i}`,
          kind: "chore",
          stats: dueStats,
        }),
      );
    }
    const { tabs, split } = partitionDueTodayGoals(goals, 9);
    expect(split.projects).toBe(true);
    expect(split.goals).toBe(true);
    expect(tabs.projects.every((g) => g.kind === "one_time")).toBe(true);
    expect(tabs.goals.every((g) => g.kind === "continuous")).toBe(true);
    expect(tabs.active.every((g) => g.kind === "chore")).toBe(true);
    expect(tabs.active.length).toBeLessThanOrEqual(9);
  });
});

describe("buildCompletedTabGoals", () => {
  it("merges archived and overflow without duplicates", () => {
    const archived = makeGoal({
      id: "arch",
      status: "completed",
      completed_at: "2026-06-01T12:00:00Z",
      due_today: false,
    });
    const overflow = makeGoal({
      id: "gold",
      stats: emptyGoalStats({ today_actual: 1, today_target: 1 }),
      last_check_in_at: "2026-06-02T12:00:00Z",
    });
    const merged = buildCompletedTabGoals([archived, overflow], [overflow]);
    expect(merged).toHaveLength(2);
    expect(merged[0]!.id).toBe("gold");
  });
});
