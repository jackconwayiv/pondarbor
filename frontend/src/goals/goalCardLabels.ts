import type { FrequencyKind, Goal } from "./types";
import {
  GOAL_KIND_ONE_TIME_LABEL,
  ordinalDay,
  weekdayLabel,
} from "./goalCopy";
import { periodSlotsForGoal } from "./GoalPeriodSockets";
import { GOALS_THEME } from "./theme";

const CHORE_OVERDUE_FREQUENCIES = new Set<FrequencyKind>([
  "on_weekday",
  "on_month_day",
  "weekly",
  "times_per_week",
  "weekdays",
  "monthly",
  "times_per_month",
  "every_n_months",
]);

export function isOngoingKind(goal: Goal): boolean {
  return goal.kind === "continuous" || goal.kind === "chore";
}

export function choreSupportsOverdue(goal: Goal): boolean {
  return goal.kind === "chore" && CHORE_OVERDUE_FREQUENCIES.has(goal.frequency_kind);
}

/** Patch/badge shell: gold when complete; green ongoing / orange chore / blue completable when in progress. */
/** Completed goals are read-only after the 10-minute undo window. */
export function isCompletedGoalLocked(goal: Goal): boolean {
  return goal.status === "completed" && !goal.can_undo;
}

/** Completed goals: stats view only (no edit tab). */
export function isGoalModalStatsOnly(goal: Goal): boolean {
  return goal.status === "completed";
}

export function showMarkGoalCompleteButton(goal: Goal): boolean {
  if (goal.status !== "active") return false;
  if (goal.kind === "chore") return false;
  if (isOngoingKind(goal) && goalPatchIsComplete(goal)) return false;
  return true;
}

/** Hold-to-progress on badge (grid or stats modal). */
export function goalHoldProgressDisabled(
  goal: Goal,
  options?: { locked?: boolean; busy?: boolean; managerMode?: boolean },
): boolean {
  if (options?.busy || options?.locked || options?.managerMode) return true;
  if (goal.status !== "active") return true;
  if (isOngoingKind(goal) && goalPatchIsComplete(goal)) return true;
  return false;
}

function isTimesPerPeriodOngoing(goal: Goal): boolean {
  return (
    isOngoingKind(goal) &&
    (goal.frequency_kind === "times_per_day" ||
      goal.frequency_kind === "times_per_week" ||
      goal.frequency_kind === "times_per_month")
  );
}

function markProgressWithCount(goal: Goal): string {
  const { filled, total } = periodSlotsForGoal(goal);
  const t = Math.max(1, total);
  return `Mark progress (${Math.min(filled, t)} / ${t})`;
}

/** Gold stats-modal action label (check-in / mark progress). */
export function goalStatsGoldButtonLabel(goal: Goal): string {
  if (goal.kind === "one_time") return markProgressWithCount(goal);
  if (isTimesPerPeriodOngoing(goal)) {
    const { filled, total } = periodSlotsForGoal(goal);
    if (total >= 2 && filled < total - 1) return markProgressWithCount(goal);
    return goal.kind === "chore" ? "Complete chore today" : "Mark complete today";
  }
  return goal.kind === "chore" ? "Complete chore today" : "Complete today";
}

export function goalPatchIsComplete(goal: Goal): boolean {
  if (goal.status === "completed") return true;
  if (goal.status !== "active") return false;
  const { filled, total } = periodSlotsForGoal(goal);
  return total > 0 && filled >= total;
}

export function goalPatchOverdueLabel(goal: Goal): string | null {
  if (
    goal.kind !== "chore" ||
    !choreSupportsOverdue(goal) ||
    goal.stats.chore_period_state !== "overdue"
  ) {
    return null;
  }
  return "Overdue";
}

export function goalPatchOverdueSublabel(goal: Goal): string | null {
  if (!goalPatchOverdueLabel(goal)) return null;
  const days = goal.stats.days_overdue;
  if (days <= 0) return null;
  return `${days} day${days === 1 ? "" : "s"} overdue`;
}

export function goalPatchShellStyle(goal: Goal): { borderColor: string; bg: string } {
  if (goalPatchIsComplete(goal)) {
    return {
      borderColor: GOALS_THEME.patchGoldBorder,
      bg: GOALS_THEME.patchGoldBg,
    };
  }
  if (goal.status === "paused") {
    return {
      borderColor: GOALS_THEME.patchSilverBorder,
      bg: GOALS_THEME.patchSilverBg,
    };
  }
  if (goal.kind === "chore") {
    return {
      borderColor: GOALS_THEME.patchChoreBorder,
      bg: GOALS_THEME.patchChoreBg,
    };
  }
  if (goal.kind === "continuous") {
    return {
      borderColor: GOALS_THEME.patchOngoingBorder,
      bg: GOALS_THEME.patchOngoingBg,
    };
  }
  return {
    borderColor: GOALS_THEME.patchCompletableBorder,
    bg: GOALS_THEME.patchCompletableBg,
  };
}

export function goalIsUrgent(goal: Goal): boolean {
  const behind =
    isOngoingKind(goal) &&
    goal.stats.today_target > 0 &&
    goal.stats.today_actual < goal.stats.today_target;
  const weekBehind =
    isOngoingKind(goal) &&
    (goal.frequency_kind === "weekly" || goal.frequency_kind === "times_per_week") &&
    goal.stats.week_target > 0 &&
    goal.stats.week_actual < goal.stats.week_target;
  const overdueChore =
    goal.kind === "chore" && goal.stats.chore_period_state === "overdue";
  return behind || weekBehind || overdueChore;
}

/** Local calendar date (MM/DD/YY). */
export function formatGoalDate(value: Date | string | null): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yy = String(d.getFullYear() % 100).padStart(2, "0");
  return `${mm}/${dd}/${yy}`;
}

/** Latest check-in, checkpoint completion, or goal completion (matches backend stats). */
export function goalLastProgressAt(goal: Goal): Date | null {
  const times: number[] = [];
  const add = (iso: string | null) => {
    if (!iso) return;
    const t = new Date(iso).getTime();
    if (!Number.isNaN(t)) times.push(t);
  };
  add(goal.last_check_in_at);
  add(goal.completed_at);
  for (const cp of goal.checkpoints) add(cp.completed_at);
  if (times.length === 0) return null;
  return new Date(Math.max(...times));
}

export function goalLastProgressLabel(goal: Goal): string | null {
  return formatGoalDate(goalLastProgressAt(goal));
}

export function goalCompletedMedalLabel(goal: Goal): string | null {
  if (goal.status !== "completed") return null;
  return formatGoalDate(goal.completed_at) ?? "—";
}

/** Second line on gold ongoing/chore medals (period satisfied, still active). */
export function goalContinuousPeriodStreakLabel(goal: Goal): string | null {
  if (!isOngoingKind(goal) || !goalPatchIsComplete(goal)) return null;
  const n = goal.stats.streak_current;
  const isWeek =
    goal.frequency_kind === "weekly" ||
    goal.frequency_kind === "times_per_week" ||
    goal.frequency_kind === "on_weekday";
  const isMonth =
    goal.frequency_kind === "monthly" ||
    goal.frequency_kind === "times_per_month" ||
    goal.frequency_kind === "every_n_months" ||
    goal.frequency_kind === "on_month_day";
  const period = isMonth ? "month" : isWeek ? "week" : "day";
  return `${n} ${period} streak`;
}

/** Stats modal column heading for ongoing goals (frequency label). */
export function goalStatsPanelHeading(goal: Goal): string {
  return frequencyLabel(goal);
}

export function frequencyLabel(goal: Goal): string {
  if (goal.kind === "one_time") {
    const { filled, total } = periodSlotsForGoal(goal);
    if (goal.checkpoints.length > 0) return `${filled}/${total} progress`;
    return GOAL_KIND_ONE_TIME_LABEL;
  }
  const n = goal.frequency_count;
  switch (goal.frequency_kind) {
    case "daily":
      return "Daily";
    case "weekly":
      return "Weekly";
    case "weekdays":
      return "Weekdays";
    case "monthly":
      return "Every month";
    case "times_per_day":
      return `${n}× per day`;
    case "times_per_week":
      return `${n}× per week`;
    case "times_per_month":
      return `${n}× per month`;
    case "every_n_months": {
      const interval = goal.schedule_interval_months || 1;
      if (interval <= 1) return "Every month";
      return `Every ${interval} months`;
    }
    case "on_weekday": {
      const day = goal.schedule_weekday;
      const interval = goal.schedule_interval_weeks || 1;
      if (day == null) return "Scheduled weekday";
      if (interval <= 1) return `Every ${weekdayLabel(day)}`;
      return `Every ${interval} weeks on ${weekdayLabel(day)}`;
    }
    case "on_month_day": {
      const dom = goal.schedule_month_day;
      if (dom == null) return "Monthly schedule";
      return `Monthly on the ${ordinalDay(dom)}`;
    }
    default:
      return "";
  }
}
