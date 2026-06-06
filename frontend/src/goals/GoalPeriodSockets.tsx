import { Box, Flex } from "@chakra-ui/react";

import type { Goal } from "./types";
import { GOALS_THEME } from "./theme";

export type PeriodSlots = {
  filled: number;
  total: number;
};

function isWeekPeriodKind(goal: Goal): boolean {
  return (
    goal.frequency_kind === "weekly" ||
    goal.frequency_kind === "times_per_week" ||
    goal.frequency_kind === "on_weekday"
  );
}

function isMonthPeriodKind(goal: Goal): boolean {
  return (
    goal.frequency_kind === "monthly" ||
    goal.frequency_kind === "times_per_month" ||
    goal.frequency_kind === "every_n_months" ||
    goal.frequency_kind === "on_month_day"
  );
}

/** How many completions vs target for the goal's current period (day, week, or month). */
export function periodSlotsForGoal(goal: Goal): PeriodSlots {
  if (goal.kind === "one_time") {
    const checkpoints = goal.checkpoints;
    if (checkpoints.length > 0) {
      const milestoneDone = checkpoints.filter((c) => c.completed_at).length;
      const goalDone = goal.status === "completed" ? 1 : 0;
      return {
        filled: milestoneDone + goalDone,
        total: checkpoints.length + 1,
      };
    }
    return {
      filled: goal.status === "completed" ? 1 : 0,
      total: 1,
    };
  }

  if (isMonthPeriodKind(goal)) {
    const total = Math.max(1, goal.stats.month_target);
    return {
      filled: Math.min(goal.stats.month_actual, total),
      total,
    };
  }

  if (isWeekPeriodKind(goal)) {
    const total = Math.max(1, goal.stats.week_target);
    return {
      filled: Math.min(goal.stats.week_actual, total),
      total,
    };
  }

  const total = Math.max(1, goal.stats.today_target);
  return {
    filled: Math.min(goal.stats.today_actual, total),
    total,
  };
}

type GoalPeriodSocketsProps = {
  slots: PeriodSlots;
  /** Smaller dots for circular badge cards. */
  size?: "sm" | "md";
};

export function GoalPeriodSockets({ slots, size = "md" }: GoalPeriodSocketsProps) {
  const { filled, total } = slots;
  if (total < 2) return null;

  const dot = size === "sm" ? "2" : "2.5";
  const gap = size === "sm" ? "1" : "1.5";

  return (
    <Flex
      gap={gap}
      flexWrap="wrap"
      justify="center"
      maxW="full"
      aria-label={`${filled} of ${total} completed this period`}
    >
      {Array.from({ length: total }, (_, i) => (
        <Box
          key={i}
          w={dot}
          h={dot}
          borderRadius="full"
          flexShrink={0}
          bg={i < filled ? GOALS_THEME.socketFilled : GOALS_THEME.socketEmpty}
          borderWidth="1px"
          borderColor={i < filled ? GOALS_THEME.patchGoldBorder : GOALS_THEME.socketEmptyBorder}
        />
      ))}
    </Flex>
  );
}
