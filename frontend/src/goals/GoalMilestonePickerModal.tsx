import { Box, SimpleGrid, Stack, Text } from "@chakra-ui/react";

import { AppModal } from "../components/AppModal";
import PondButton from "../PondButton";
import type { Goal } from "./types";
import { GOALS_THEME } from "./theme";

const milestonePickerButtonProps = {
  borderRadius: "xl",
  border: "2px dashed",
  borderColor: GOALS_THEME.gold,
  bg: GOALS_THEME.goldLight,
  px: "3",
  py: "4",
  textAlign: "center" as const,
  fontWeight: "semibold",
  color: GOALS_THEME.textOnLight,
  cursor: "pointer",
  _hover: { bg: "#e8d48a" },
};

type GoalMilestonePickerModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal: Goal | null;
  onPickCheckpoint: (checkpointId: string) => void;
  onCompleteGoal: () => void;
  onOpenEdit: () => void;
};

export function GoalMilestonePickerModal({
  open,
  onOpenChange,
  goal,
  onPickCheckpoint,
  onCompleteGoal,
  onOpenEdit,
}: GoalMilestonePickerModalProps) {
  const openCheckpoints = goal?.checkpoints.filter((c) => !c.completed_at) ?? [];

  return (
    <AppModal
      open={open}
      onOpenChange={onOpenChange}
      title="Which checkpoint did you reach?"
      size="md"
    >
      <Stack gap="4">
        {!goal ? null : goal.checkpoints.length === 0 ? (
          <Stack gap="3">
            <Text color={GOALS_THEME.textMuted}>
              No checkpoints yet. Add one from the goal stats tab or edit the goal.
            </Text>
            <PondButton variant="outline" onClick={onOpenEdit}>
              Edit goal
            </PondButton>
          </Stack>
        ) : openCheckpoints.length === 0 ? (
          <Stack gap="3">
            <Text color={GOALS_THEME.textMuted}>
              Every checkpoint is done. You can complete the whole goal when you are ready.
            </Text>
            <Box
              as="button"
              width="full"
              {...milestonePickerButtonProps}
              bg={GOALS_THEME.patchGoldBg}
              borderColor={GOALS_THEME.patchGoldBorder}
              _hover={{ bg: GOALS_THEME.goldLight }}
              onClick={onCompleteGoal}
            >
              Complete this entire goal
            </Box>
          </Stack>
        ) : (
          <SimpleGrid columns={{ base: 1, sm: 2 }} gap="3">
            {openCheckpoints.map((cp) => (
              <Box
                key={cp.id}
                as="button"
                {...milestonePickerButtonProps}
                onClick={() => onPickCheckpoint(cp.id)}
              >
                {cp.title}
              </Box>
            ))}
            <Box
              as="button"
              {...milestonePickerButtonProps}
              bg={GOALS_THEME.patchGoldBg}
              borderColor={GOALS_THEME.patchGoldBorder}
              _hover={{ bg: GOALS_THEME.goldLight }}
              onClick={onCompleteGoal}
            >
              Complete this entire goal
            </Box>
          </SimpleGrid>
        )}
      </Stack>
    </AppModal>
  );
}
