import { Badge, HStack, Stack, Text } from "@chakra-ui/react";

import type { Goal } from "./types";
import {
  goalLastProgressLabel,
  goalStatsPanelHeading,
  isOngoingKind,
} from "./goalCardLabels";
import { GoalMilestoneChecklist } from "./GoalMilestoneChecklist";
import { GOALS_THEME } from "./theme";

type GoalStatsPanelProps = {
  goal: Goal;
  milestoneBusyCheckpointId?: string | null;
  onMilestoneToggle?: (checkpointId: string, completed: boolean) => void;
};

export function GoalStatsPanel({
  goal,
  milestoneBusyCheckpointId = null,
  onMilestoneToggle,
}: GoalStatsPanelProps) {
  return (
    <Stack gap="3">
      {isOngoingKind(goal) ? (
        <>
          <Text fontSize="sm" fontWeight="semibold" color={GOALS_THEME.textOnLight}>
            {goalStatsPanelHeading(goal)}
          </Text>
          <Stack gap="1" fontSize="sm" color={GOALS_THEME.textMuted}>
            <Text>
              Today {goal.stats.today_actual}/{goal.stats.today_target || "—"}
            </Text>
            <Text>
              This week {goal.stats.week_actual}/{goal.stats.week_target || "—"}
            </Text>
            {goal.stats.month_target > 0 ? (
              <Text>
                This month {goal.stats.month_actual}/{goal.stats.month_target}
              </Text>
            ) : null}
            <Text>
              Streak {goal.stats.streak_current}
              {goal.stats.streak_best > goal.stats.streak_current
                ? ` · best ${goal.stats.streak_best}`
                : ""}
            </Text>
            {goal.kind === "chore" &&
            goal.stats.count_completed_on_time +
              goal.stats.count_completed_overdue +
              goal.stats.count_missed >
              0 ? (
              <>
                <Text pt="1">
                  On time {Math.round(goal.stats.pct_completed_on_time)}% · Overdue{" "}
                  {Math.round(goal.stats.pct_completed_overdue)}% · Missed{" "}
                  {Math.round(goal.stats.pct_completed_missed)}%
                </Text>
                <Text fontSize="xs">
                  {goal.stats.count_completed_on_time} on time ·{" "}
                  {goal.stats.count_completed_overdue} overdue · {goal.stats.count_missed}{" "}
                  missed
                </Text>
              </>
            ) : null}
          </Stack>
        </>
      ) : goal.checkpoints.length > 0 ? (
        <GoalMilestoneChecklist
          goal={goal}
          busyCheckpointId={milestoneBusyCheckpointId}
          onToggle={onMilestoneToggle}
          disabled={!onMilestoneToggle}
        />
      ) : (
        <Text fontSize="sm" color={GOALS_THEME.textMuted}>
          No checkpoints yet — add one below or mark the goal complete
        </Text>
      )}

      <Text fontSize="sm" color={GOALS_THEME.textMuted}>
        Last progress {goalLastProgressLabel(goal) ?? "—"}
      </Text>

      <HStack gap="2" flexWrap="wrap">
        <Badge size="sm" bg={GOALS_THEME.pineLight} color={GOALS_THEME.pineGreen}>
          {Math.round(goal.stats.pct_lifetime)}% overall
        </Badge>
        <Badge size="sm" bg={GOALS_THEME.lakeLight} color={GOALS_THEME.lakeBlue}>
          {Math.round(goal.stats.pct_last_30_days)}% last 30d
        </Badge>
      </HStack>
    </Stack>
  );
}
