import { Box, Stack, Text } from "@chakra-ui/react";

import type { Goal } from "./types";
import {
  goalCompletedMedalLabel,
  goalPatchIsComplete,
  goalPatchShellStyle,
} from "./goalCardLabels";
import { GOALS_THEME } from "./theme";
import { GoalLongPressRing } from "./GoalLongPressRing";
import { GoalPatchCircle } from "./GoalPatchCircle";
import { GoalPeriodSockets, periodSlotsForGoal } from "./GoalPeriodSockets";

const MODAL_PATCH_SIZE = "7.5rem";

type GoalStatsModalBadgeProps = {
  goal: Goal;
  onHoldComplete: () => void;
  holdDisabled?: boolean;
};

/** Goal patch for the stats modal (top-right beside stats); hold to log progress. */
export function GoalStatsModalBadge({
  goal,
  onHoldComplete,
  holdDisabled = false,
}: GoalStatsModalBadgeProps) {
  const complete = goalPatchIsComplete(goal);
  const patchStyle = goalPatchShellStyle(goal);

  return (
    <Box w={MODAL_PATCH_SIZE} h={MODAL_PATCH_SIZE} flexShrink={0}>
      <GoalLongPressRing
        layout="circle"
        holdDisabled={holdDisabled}
        onTap={() => {}}
        onHoldComplete={onHoldComplete}
      >
        <GoalPatchCircle
          goldShimmer={complete}
          patchStyle={patchStyle}
          w="100%"
          h="100%"
          px="2"
          py="2"
          textAlign="center"
        >
          <Stack gap="1.5" align="center" width="full" maxW="full">
            <Text
              fontWeight="bold"
              color={GOALS_THEME.textOnLight}
              fontSize="xs"
              lineClamp={3}
              lineHeight="short"
              width="full"
            >
              {goal.title}
            </Text>
            {goal.status === "completed" ? (
              <Text fontSize="xs" color={GOALS_THEME.textMuted}>
                {goalCompletedMedalLabel(goal)}
              </Text>
            ) : (
              <GoalPeriodSockets slots={periodSlotsForGoal(goal)} size="sm" />
            )}
          </Stack>
        </GoalPatchCircle>
      </GoalLongPressRing>
    </Box>
  );
}
