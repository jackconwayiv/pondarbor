export type GoalKind = "one_time" | "continuous" | "chore";
export type GoalStatus = "active" | "completed" | "paused";
export type ScheduleIntervalKind =
  | "day"
  | "weekdays"
  | "weekday"
  | "week"
  | "weeks"
  | "month"
  | "months"
  | "month_day";

export type ChorePeriodState = "none" | "due" | "overdue";

export type Checkpoint = {
  id: string;
  title: string;
  sort_order: number;
  completed_at: string | null;
  created_at: string;
};

export type GoalStats = {
  streak_current: number;
  streak_best: number;
  pct_lifetime: number;
  pct_last_30_days: number;
  days_since_last_progress: number;
  today_actual: number;
  today_target: number;
  week_actual: number;
  week_target: number;
  month_actual: number;
  month_target: number;
  urgency_score: number;
  days_overdue: number;
  chore_period_state: ChorePeriodState;
  count_completed_on_time: number;
  count_completed_overdue: number;
  count_missed: number;
  count_completed: number;
  pct_completed_on_time: number;
  pct_completed_overdue: number;
  pct_completed_missed: number;
};

export function emptyGoalStats(overrides?: Partial<GoalStats>): GoalStats {
  return {
    streak_current: 0,
    streak_best: 0,
    pct_lifetime: 0,
    pct_last_30_days: 0,
    days_since_last_progress: 0,
    today_actual: 0,
    today_target: 0,
    week_actual: 0,
    week_target: 0,
    month_actual: 0,
    month_target: 0,
    urgency_score: 0,
    days_overdue: 0,
    chore_period_state: "none",
    count_completed_on_time: 0,
    count_completed_overdue: 0,
    count_missed: 0,
    count_completed: 0,
    pct_completed_on_time: 0,
    pct_completed_overdue: 0,
    pct_completed_missed: 0,
    ...overrides,
  };
}

export type Goal = {
  id: string;
  title: string;
  description: string;
  kind: GoalKind;
  status: GoalStatus;
  schedule_interval_kind: ScheduleIntervalKind;
  frequency_count: number;
  schedule_weekday: number | null;
  schedule_interval_weeks: number;
  schedule_interval_months: number;
  schedule_month_day: number | null;
  completed_at: string | null;
  last_check_in_at: string | null;
  created_at: string;
  updated_at: string;
  checkpoints: Checkpoint[];
  stats: GoalStats;
  can_undo: boolean;
  due_today: boolean;
};

export type GoalsStripe = {
  today_actual: number;
  today_target: number;
  week_actual: number;
  week_target: number;
  month_actual: number;
  month_target: number;
};

export type GoalsStatusCounts = Record<GoalStatus, number>;
export type GoalsKindCounts = Record<GoalKind, number>;

export type GoalsDashboard = {
  stripe: GoalsStripe;
  goals: Goal[];
  status: GoalStatus;
  status_counts: GoalsStatusCounts;
  kind_counts: GoalsKindCounts;
  kind_totals?: GoalsKindCounts;
  kind?: GoalKind | null;
  scope?: "all";
};

export type GoalsWorkspace = {
  stripe: GoalsStripe;
  goals: Goal[];
  status_counts: GoalsStatusCounts;
  kind_counts: GoalsKindCounts;
  kind_totals: GoalsKindCounts;
};

export type GoalCreatePayload = {
  title: string;
  description?: string;
  kind: GoalKind;
  schedule_interval_kind?: ScheduleIntervalKind;
  frequency_count?: number;
  schedule_weekday?: number | null;
  schedule_interval_weeks?: number;
  schedule_interval_months?: number;
  schedule_month_day?: number | null;
  checkpoints?: { title: string; sort_order?: number }[];
};

export type GoalPatchPayload = Partial<{
  title: string;
  description: string;
  kind: GoalKind;
  status: GoalStatus;
  schedule_interval_kind: ScheduleIntervalKind;
  frequency_count: number;
  schedule_weekday: number | null;
  schedule_interval_weeks: number;
  schedule_interval_months: number;
  schedule_month_day: number | null;
}>;
