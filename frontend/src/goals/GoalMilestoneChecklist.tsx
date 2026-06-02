import { Box, Checkbox, Stack, Text } from "@chakra-ui/react";

import type { Goal } from "./types";
import { GOALS_THEME } from "./theme";

type GoalMilestoneChecklistProps = {
  goal: Goal;
  disabled?: boolean;
  busyCheckpointId?: string | null;
  onToggle?: (checkpointId: string, completed: boolean) => void;
};

export function GoalMilestoneChecklist({
  goal,
  disabled = false,
  busyCheckpointId = null,
  onToggle,
}: GoalMilestoneChecklistProps) {
  const readOnly = disabled || !onToggle;

  return (
    <Stack gap="2">
      <Text fontSize="sm" fontWeight="semibold" color={GOALS_THEME.textOnLight}>
        Checkpoints
      </Text>
      <Stack gap="1.5" as="ul" listStyleType="none" m="0" p="0">
        {goal.checkpoints.map((cp) => {
          const checked = cp.completed_at != null;
          const rowBusy = busyCheckpointId === cp.id;
          const interactive = !readOnly && !rowBusy;
          return (
            <Box
              as="li"
              key={cp.id}
              py="2.5"
              px="2"
              borderRadius="lg"
              _hover={
                interactive
                  ? { bg: GOALS_THEME.lakeLight }
                  : undefined
              }
            >
              <Checkbox.Root
                checked={checked}
                disabled={readOnly || rowBusy}
                colorPalette="teal"
                alignItems="flex-start"
                gap="3"
                width="full"
                onCheckedChange={(d) => {
                  if (readOnly || rowBusy || !onToggle) return;
                  onToggle(cp.id, d.checked === true);
                }}
              >
                <Checkbox.HiddenInput />
                <Checkbox.Control flexShrink={0} boxSize="5" mt="0.5">
                  <Checkbox.Indicator />
                </Checkbox.Control>
                <Checkbox.Label
                  fontSize="md"
                  lineHeight="tall"
                  color={GOALS_THEME.textOnLight}
                  opacity={checked ? 0.85 : 1}
                  textDecoration={checked ? "line-through" : "none"}
                  pt="0.5"
                >
                  {cp.title}
                </Checkbox.Label>
              </Checkbox.Root>
            </Box>
          );
        })}
      </Stack>
    </Stack>
  );
}
