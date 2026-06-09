import { Box, Flex } from "@chakra-ui/react";

import type { Goal } from "./types";
import { isDayPeriodGoal, isMonthPeriodGoal, isWeekPeriodGoal } from "./schedule";
import { GOALS_THEME } from "./theme";

export type PeriodSlots = {
  filled: number;
  total: number;
};

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

  if (isMonthPeriodGoal(goal)) {
    const total = goal.stats.month_target;
    if (total <= 0) return { filled: 0, total: 0 };
    return {
      filled: Math.min(goal.stats.month_actual, total),
      total,
    };
  }

  if (isWeekPeriodGoal(goal)) {
    const total = goal.stats.week_target;
    if (total <= 0) return { filled: 0, total: 0 };
    return {
      filled: Math.min(goal.stats.week_actual, total),
      total,
    };
  }

  if (isDayPeriodGoal(goal)) {
    const total = goal.stats.today_target;
    if (total <= 0) return { filled: 0, total: 0 };
    return {
      filled: Math.min(goal.stats.today_actual, total),
      total,
    };
  }

  return { filled: 0, total: 0 };
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
