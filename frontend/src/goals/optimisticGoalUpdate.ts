import { goalPatchIsComplete, isOngoingKind } from "./goalCardLabels";
import {
  goalAppliesToDayStripe,
  goalAppliesToMonthStripe,
  goalAppliesToWeekStripe,
  isDayPeriodGoal,
  isMonthPeriodGoal,
  isWeekPeriodGoal,
} from "./schedule";
import type { Goal, GoalsStripe } from "./types";

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
  } else if (isDayPeriodGoal(goal)) {
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
