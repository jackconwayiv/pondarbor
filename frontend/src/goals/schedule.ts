import type { Goal, ScheduleIntervalKind } from "./types";

export type PeriodBucket = "day" | "week" | "month";

export function periodBucketForInterval(kind: ScheduleIntervalKind): PeriodBucket {
  if (kind === "day" || kind === "weekdays") return "day";
  if (kind === "month" || kind === "months" || kind === "month_day") return "month";
  return "week";
}

export function isDayPeriodGoal(goal: Goal): boolean {
  return periodBucketForInterval(goal.schedule_interval_kind) === "day";
}

export function isWeekPeriodGoal(goal: Goal): boolean {
  return periodBucketForInterval(goal.schedule_interval_kind) === "week";
}

export function isMonthPeriodGoal(goal: Goal): boolean {
  return periodBucketForInterval(goal.schedule_interval_kind) === "month";
}

const CHORE_OVERDUE_INTERVALS = new Set<ScheduleIntervalKind>([
  "weekday",
  "month_day",
  "week",
  "weeks",
  "weekdays",
  "month",
  "months",
]);

export function choreSupportsOverdue(goal: Goal): boolean {
  return goal.kind === "chore" && CHORE_OVERDUE_INTERVALS.has(goal.schedule_interval_kind);
}

export function goalAppliesToDayStripe(goal: Goal): boolean {
  return (
    (goal.kind === "continuous" || goal.kind === "chore") &&
    goal.status === "active" &&
    (goal.schedule_interval_kind === "day" || goal.schedule_interval_kind === "weekdays")
  );
}

export function goalAppliesToWeekStripe(goal: Goal): boolean {
  return (
    (goal.kind === "continuous" || goal.kind === "chore") &&
    goal.status === "active" &&
    (goal.schedule_interval_kind === "week" ||
      goal.schedule_interval_kind === "weeks" ||
      goal.schedule_interval_kind === "weekday")
  );
}

export function goalAppliesToMonthStripe(goal: Goal): boolean {
  return (
    (goal.kind === "continuous" || goal.kind === "chore") &&
    goal.status === "active" &&
    isMonthPeriodGoal(goal)
  );
}

/** Continuous goals: today is an actionable check-in day (matches backend goal_applies_today). */
export function goalAppliesToday(goal: Goal): boolean {
  if (goal.kind !== "continuous") return true;
  const kind = goal.schedule_interval_kind;
  if (kind === "day" || kind === "weekdays" || kind === "weekday" || kind === "month_day") {
    return goal.stats.today_target > 0;
  }
  if (kind === "week" || kind === "weeks") return goal.stats.week_target > 0;
  if (kind === "month" || kind === "months") return goal.stats.month_target > 0;
  return false;
}
