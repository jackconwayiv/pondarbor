import type { Goal } from "./types";
import {
  GOAL_KIND_ONE_TIME_LABEL,
  ordinalDay,
  weekdayLabel,
} from "./goalCopy";
import { periodSlotsForGoal } from "./GoalPeriodSockets";
import {
  choreSupportsOverdue,
  isDayPeriodGoal,
  isWeekPeriodGoal,
  periodBucketForInterval,
} from "./schedule";
import { GOALS_THEME } from "./theme";

export function isOngoingKind(goal: Goal): boolean {
  return goal.kind === "continuous" || goal.kind === "chore";
}

export { choreSupportsOverdue };

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
  options?: { locked?: boolean; busy?: boolean },
): boolean {
  if (options?.busy || options?.locked) return true;
  if (goal.status !== "active") return true;
  if (isOngoingKind(goal) && goalPatchIsComplete(goal)) return true;
  return false;
}

function isMultiCountOngoing(goal: Goal): boolean {
  return isOngoingKind(goal) && goal.frequency_count > 1;
}

function markProgressWithCount(goal: Goal): string {
  const { filled, total } = periodSlotsForGoal(goal);
  const t = Math.max(1, total);
  return `Mark progress (${Math.min(filled, t)} / ${t})`;
}

/** Gold stats-modal action label (check-in / mark progress). */
export function goalStatsGoldButtonLabel(goal: Goal): string {
  if (goal.kind === "one_time") return markProgressWithCount(goal);
  if (isMultiCountOngoing(goal)) {
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
  if (total === 0 && isOngoingKind(goal)) return true;
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
  return "OVERDUE";
}

export function goalPatchOverdueSublabel(goal: Goal): string | null {
  if (!goalPatchOverdueLabel(goal)) return null;
  const days = goal.stats.days_overdue;
  if (days <= 0) return null;
  return `${days} day${days === 1 ? "" : "s"} overdue`;
}

export type GoalPatchShellStyle = {
  borderColor: string;
  bg: string;
  borderStyle?: "solid" | "dashed";
  /** Skip drop shadow (paused patches). */
  flat?: boolean;
};

/** Checkpoint projects or week/month multi-count goals (not N× per day). */
export function isCrossPeriodMultiPartGoal(goal: Goal): boolean {
  if (goal.kind === "one_time") return goal.checkpoints.length > 0;
  if (!isOngoingKind(goal)) return false;
  if (isDayPeriodGoal(goal) && goal.frequency_count > 1) return false;
  const { total } = periodSlotsForGoal(goal);
  return total >= 2;
}

function localCalendarDayMs(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function calendarDaysSince(at: Date, now: Date): number {
  return Math.round((localCalendarDayMs(now) - localCalendarDayMs(at)) / 86_400_000);
}

export function goalPatchHasProgressToday(goal: Goal): boolean {
  if (goal.stats.today_actual > 0) return true;
  const at = goalLastProgressAt(goal);
  if (!at) return false;
  return calendarDaysSince(at, new Date()) === 0;
}

export function goalPatchIsSilverProgressToday(goal: Goal): boolean {
  return (
    goal.status === "active" &&
    !goalPatchIsComplete(goal) &&
    isCrossPeriodMultiPartGoal(goal) &&
    goalPatchHasProgressToday(goal)
  );
}

export function goalPatchShellStyle(goal: Goal): GoalPatchShellStyle {
  if (goalPatchIsComplete(goal)) {
    return {
      borderColor: GOALS_THEME.patchGoldBorder,
      bg: GOALS_THEME.patchGoldBg,
    };
  }
  if (goal.status === "paused") {
    return {
      borderColor: GOALS_THEME.patchPausedBorder,
      bg: GOALS_THEME.patchPausedBg,
      borderStyle: "dashed",
      flat: true,
    };
  }
  if (goalPatchIsSilverProgressToday(goal)) {
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
    isWeekPeriodGoal(goal) &&
    goal.stats.week_target > 0 &&
    goal.stats.week_actual < goal.stats.week_target;
  const overdueChore =
    goal.kind === "chore" && goal.stats.chore_period_state === "overdue";
  return behind || weekBehind || overdueChore;
}

/** Local time for progress logged today, e.g. 6:45am. */
export function formatGoalLocalTime(value: Date): string {
  const raw = value.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return raw.replace(" AM", "am").replace(" PM", "pm");
}

/** Relative last-progress label (local calendar-day buckets). */
export function formatGoalLastProgressRelative(at: Date, now = new Date()): string {
  const days = calendarDaysSince(at, now);
  if (days <= 0) return formatGoalLocalTime(at);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
  }
  if (days < 365) {
    const months = Math.floor(days / 30);
    return months === 1 ? "1 month ago" : `${months} months ago`;
  }
  return "More than a year ago";
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
  const at = goalLastProgressAt(goal);
  if (!at) return null;
  return formatGoalLastProgressRelative(at);
}

export function goalCompletedMedalLabel(goal: Goal): string | null {
  if (goal.status !== "completed") return null;
  return formatGoalDate(goal.completed_at) ?? "—";
}

/** Second line on gold ongoing/chore medals (period satisfied, still active). */
export function goalContinuousPeriodStreakLabel(goal: Goal): string | null {
  if (!isOngoingKind(goal) || !goalPatchIsComplete(goal)) return null;
  const n = goal.stats.streak_current;
  const bucket = periodBucketForInterval(goal.schedule_interval_kind);
  const period = bucket === "month" ? "month" : bucket === "week" ? "week" : "day";
  return `${n} ${period} streak`;
}

/** Stats modal column heading for ongoing goals (frequency label). */
export function goalStatsPanelHeading(goal: Goal): string {
  return frequencyLabel(goal);
}

function timesLabel(n: number): string {
  return n === 1 ? "1×" : `${n}×`;
}

export function frequencyLabel(goal: Goal): string {
  if (goal.kind === "one_time") {
    const { filled, total } = periodSlotsForGoal(goal);
    if (goal.checkpoints.length > 0) return `${filled}/${total} progress`;
    return GOAL_KIND_ONE_TIME_LABEL;
  }
  const n = goal.frequency_count;
  const count = timesLabel(n);
  switch (goal.schedule_interval_kind) {
    case "day":
      return n === 1 ? "Daily" : `${count} every day`;
    case "weekdays":
      return n === 1 ? "Weekdays" : `${count} weekdays`;
    case "week":
      return n === 1 ? "Weekly" : `${count} every week`;
    case "month":
      return n === 1 ? "Every month" : `${count} every month`;
    case "weeks": {
      const interval = goal.schedule_interval_weeks || 2;
      if (interval <= 1) return n === 1 ? "Weekly" : `${count} every week`;
      return `${count} every ${interval} weeks`;
    }
    case "months": {
      const interval = goal.schedule_interval_months || 2;
      if (interval <= 1) return n === 1 ? "Every month" : `${count} every month`;
      return `${count} every ${interval} months`;
    }
    case "weekday": {
      const day = goal.schedule_weekday;
      const interval = goal.schedule_interval_weeks || 1;
      if (day == null) return "Scheduled weekday";
      if (interval <= 1) {
        return n === 1 ? `Every ${weekdayLabel(day)}` : `${count} every ${weekdayLabel(day)}`;
      }
      return `${count} every ${interval} weeks on ${weekdayLabel(day)}`;
    }
    case "month_day": {
      const dom = goal.schedule_month_day;
      if (dom == null) return "Monthly schedule";
      return n === 1
        ? `Monthly on the ${ordinalDay(dom)}`
        : `${count} monthly on the ${ordinalDay(dom)}`;
    }
    default:
      return "";
  }
}
