import { Badge, HStack, Stack, Text } from "@chakra-ui/react";

import type { Goal } from "./types";
import { goalStatsPanelHeading } from "./goalCardLabels";
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
      {goal.kind === "continuous" ? (
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
            <Text>
              Streak {goal.stats.streak_current}
              {goal.stats.streak_best > goal.stats.streak_current
                ? ` · best ${goal.stats.streak_best}`
                : ""}
            </Text>
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

      <HStack gap="2" flexWrap="wrap">
        <Badge size="sm" bg={GOALS_THEME.pineLight} color={GOALS_THEME.pineGreen}>
          {Math.round(goal.stats.pct_lifetime)}% overall
        </Badge>
        <Badge size="sm" bg={GOALS_THEME.lakeLight} color={GOALS_THEME.lakeBlue}>
          {Math.round(goal.stats.pct_last_30_days)}% last 30d
        </Badge>
        {goal.stats.days_since_last_progress > 0 ? (
          <Badge size="sm" variant="outline" borderColor={GOALS_THEME.textMuted}>
            {goal.stats.days_since_last_progress} days since progress
          </Badge>
        ) : null}
      </HStack>
    </Stack>
  );
}
