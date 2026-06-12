import { describe, expect, it } from "vitest";

import {
  formatGoalLastProgressRelative,
  formatGoalLocalTime,
  goalPatchIsSilverProgressToday,
  goalPatchShellStyle,
  isCrossPeriodMultiPartGoal,
} from "./goalCardLabels";
import { GOALS_THEME } from "./theme";
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

describe("isCrossPeriodMultiPartGoal", () => {
  it("treats daily multi-count as not cross-period", () => {
    const goal = makeGoal({
      id: "d",
      frequency_count: 3,
      stats: { today_target: 3, today_actual: 1 },
    });
    expect(isCrossPeriodMultiPartGoal(goal)).toBe(false);
  });

  it("treats weekly multi-count as cross-period", () => {
    const goal = makeGoal({
      id: "w",
      schedule_interval_kind: "week",
      frequency_count: 3,
      stats: { week_target: 3, week_actual: 1, today_actual: 1 },
    });
    expect(isCrossPeriodMultiPartGoal(goal)).toBe(true);
  });

  it("treats checkpoint projects as cross-period", () => {
    const goal = makeGoal({
      id: "p",
      kind: "one_time",
      checkpoints: [
        {
          id: "c1",
          title: "A",
          sort_order: 0,
          completed_at: null,
          created_at: "2026-01-01T00:00:00Z",
        },
        {
          id: "c2",
          title: "B",
          sort_order: 1,
          completed_at: null,
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
    });
    expect(isCrossPeriodMultiPartGoal(goal)).toBe(true);
  });
});

describe("goalPatchShellStyle silver progress today", () => {
  it("uses silver for weekly multi-part with check-in today", () => {
    const goal = makeGoal({
      id: "w",
      schedule_interval_kind: "week",
      frequency_count: 3,
      stats: { week_target: 3, week_actual: 1, today_actual: 1 },
    });
    expect(goalPatchIsSilverProgressToday(goal)).toBe(true);
    const style = goalPatchShellStyle(goal);
    expect(style.bg).toBe(GOALS_THEME.patchSilverBg);
    expect(style.borderStyle).toBeUndefined();
  });

  it("keeps green for daily multi-count with partial today", () => {
    const goal = makeGoal({
      id: "d",
      frequency_count: 3,
      stats: { today_target: 3, today_actual: 1 },
    });
    expect(goalPatchIsSilverProgressToday(goal)).toBe(false);
    expect(goalPatchShellStyle(goal).bg).toBe(GOALS_THEME.patchOngoingBg);
  });
});

describe("goalPatchShellStyle paused", () => {
  it("uses matte gray dashed outline for paused goals", () => {
    const goal = makeGoal({ id: "p", status: "paused" });
    const style = goalPatchShellStyle(goal);
    expect(style.bg).toBe(GOALS_THEME.patchPausedBg);
    expect(style.borderColor).toBe(GOALS_THEME.patchPausedBorder);
    expect(style.borderStyle).toBe("dashed");
    expect(style.flat).toBe(true);
  });
});

describe("formatGoalLastProgressRelative", () => {
  const now = new Date(2026, 5, 12, 15, 0, 0);

  it("shows local time when progress was today", () => {
    const at = new Date(2026, 5, 12, 6, 45, 0);
    expect(formatGoalLastProgressRelative(at, now)).toBe(formatGoalLocalTime(at));
    expect(formatGoalLastProgressRelative(at, now)).toMatch(/6:45am/i);
  });

  it("shows Yesterday", () => {
    const at = new Date(2026, 5, 11, 12, 0, 0);
    expect(formatGoalLastProgressRelative(at, now)).toBe("Yesterday");
  });

  it("shows N days ago", () => {
    const at = new Date(2026, 5, 10, 12, 0, 0);
    expect(formatGoalLastProgressRelative(at, now)).toBe("2 days ago");
  });

  it("shows N weeks ago", () => {
    const at = new Date(2026, 5, 1, 12, 0, 0);
    expect(formatGoalLastProgressRelative(at, now)).toBe("1 week ago");
    const twoWeeks = new Date(2026, 4, 26, 12, 0, 0);
    expect(formatGoalLastProgressRelative(twoWeeks, now)).toBe("2 weeks ago");
  });

  it("shows N months ago", () => {
    const at = new Date(2026, 3, 12, 12, 0, 0);
    expect(formatGoalLastProgressRelative(at, now)).toBe("2 months ago");
  });

  it("shows more than a year ago", () => {
    const at = new Date(2024, 5, 12, 12, 0, 0);
    expect(formatGoalLastProgressRelative(at, now)).toBe("More than a year ago");
  });
});
