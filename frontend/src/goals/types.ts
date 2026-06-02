export type GoalKind = "one_time" | "continuous";
export type GoalStatus = "active" | "completed" | "paused";
export type FrequencyKind = "daily" | "weekly" | "times_per_day" | "times_per_week";

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
  urgency_score: number;
};

export type Goal = {
  id: string;
  title: string;
  description: string;
  kind: GoalKind;
  status: GoalStatus;
  frequency_kind: FrequencyKind;
  frequency_count: number;
  completed_at: string | null;
  last_check_in_at: string | null;
  created_at: string;
  updated_at: string;
  checkpoints: Checkpoint[];
  stats: GoalStats;
  can_undo: boolean;
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

export type GoalsDashboard = {
  stripe: GoalsStripe;
  goals: Goal[];
  status: GoalStatus;
  status_counts: GoalsStatusCounts;
};

export type GoalCreatePayload = {
  title: string;
  description?: string;
  kind: GoalKind;
  frequency_kind?: FrequencyKind;
  frequency_count?: number;
  checkpoints?: { title: string; sort_order?: number }[];
};

export type GoalPatchPayload = Partial<{
  title: string;
  description: string;
  kind: GoalKind;
  status: GoalStatus;
  frequency_kind: FrequencyKind;
  frequency_count: number;
}>;
