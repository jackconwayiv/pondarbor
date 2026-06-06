import { goalPatchIsComplete, isOngoingKind } from "./goalCardLabels";
import type { FrequencyKind, Goal, GoalsStripe } from "./types";

function isWeekPeriodGoal(goal: Goal): boolean {
  return (
    goal.frequency_kind === "weekly" ||
    goal.frequency_kind === "times_per_week" ||
    goal.frequency_kind === "on_weekday"
  );
}

function isMonthPeriodGoal(goal: Goal): boolean {
  return (
    goal.frequency_kind === "monthly" ||
    goal.frequency_kind === "times_per_month" ||
    goal.frequency_kind === "every_n_months" ||
    goal.frequency_kind === "on_month_day"
  );
}

function goalAppliesToDayStripe(goal: Goal): boolean {
  return (
    isOngoingKind(goal) &&
    goal.status === "active" &&
    (goal.frequency_kind === "daily" ||
      goal.frequency_kind === "times_per_day" ||
      goal.frequency_kind === "weekdays" ||
      goal.frequency_kind === "on_weekday")
  );
}

function goalAppliesToWeekStripe(goal: Goal): boolean {
  return (
    isOngoingKind(goal) &&
    goal.status === "active" &&
    (goal.frequency_kind === "weekly" || goal.frequency_kind === "times_per_week")
  );
}

function goalAppliesToMonthStripe(goal: Goal): boolean {
  return (
    isOngoingKind(goal) &&
    goal.status === "active" &&
    isMonthPeriodGoal(goal)
  );
}

/** Apply a check-in locally before the API responds. */
export function optimisticCheckIn(goal: Goal, checkpointId?: string): Goal {
  const now = new Date().toISOString();
  const wasComplete = goalPatchIsComplete(goal);

  if (checkpointId) {
    const checkpoints = goal.checkpoints.map((cp) =>
      cp.id === checkpointId ? { ...cp, completed_at: cp.completed_at ?? now } : cp,
    );
    const next: Goal = {
      ...goal,
      checkpoints,
      last_check_in_at: now,
      can_undo: true,
      updated_at: now,
    };
    const nowComplete = goalPatchIsComplete(next);
    if (!wasComplete && nowComplete) {
      return {
        ...next,
        stats: { ...next.stats, days_since_last_progress: 0 },
      };
    }
    return next;
  }

  if (!isOngoingKind(goal)) return goal;

  const stats = { ...goal.stats };
  if (isMonthPeriodGoal(goal)) {
    stats.month_actual += 1;
  } else if (isWeekPeriodGoal(goal)) {
    stats.week_actual += 1;
  } else {
    stats.today_actual += 1;
  }
  stats.days_since_last_progress = 0;
  if (goal.kind === "chore" && stats.chore_period_state === "overdue") {
    stats.chore_period_state = "none";
    stats.days_overdue = 0;
  }

  const next: Goal = {
    ...goal,
    stats,
    last_check_in_at: now,
    can_undo: true,
    updated_at: now,
  };
  const nowComplete = goalPatchIsComplete(next);
  if (!wasComplete && nowComplete) {
    next.stats = { ...next.stats, streak_current: next.stats.streak_current + 1 };
  }
  return next;
}

/** Mark a goal completed locally before the API responds. */
export function optimisticMarkComplete(goal: Goal): Goal {
  const now = new Date().toISOString();
  return {
    ...goal,
    status: "completed",
    completed_at: now,
    can_undo: true,
    updated_at: now,
    stats: { ...goal.stats, days_since_last_progress: 0 },
  };
}

/** Bump header stripe counts for an ongoing check-in. */
export function optimisticStripeAfterCheckIn(stripe: GoalsStripe, goal: Goal): GoalsStripe {
  if (!isOngoingKind(goal) || goal.status !== "active") return stripe;
  const next = { ...stripe };
  if (goalAppliesToDayStripe(goal)) next.today_actual += 1;
  if (goalAppliesToWeekStripe(goal)) next.week_actual += 1;
  if (goalAppliesToMonthStripe(goal)) next.month_actual += 1;
  return next;
}

export function isTimesPerFrequency(kind: FrequencyKind): boolean {
  return kind === "times_per_day" || kind === "times_per_week" || kind === "times_per_month";
}
