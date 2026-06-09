import { Stack, Text } from "@chakra-ui/react";

import { goalPatchOverdueLabel, goalPatchOverdueSublabel } from "./goalCardLabels";
import { GOALS_THEME } from "./theme";
import type { Goal } from "./types";

/** Bold overdue line above the chore title inside a patch. */
export function GoalPatchOverdueHeader({ goal }: { goal: Goal }) {
  const label = goalPatchOverdueLabel(goal);
  if (!label) return null;
  const sublabel = goalPatchOverdueSublabel(goal);
  return (
    <Stack gap="0" align="center" width="full">
      <Text
        fontSize="2xs"
        fontWeight="bold"
        color={GOALS_THEME.patchChoreBorder}
        lineHeight="short"
        letterSpacing="0.04em"
      >
        {label}
      </Text>
      {sublabel ? (
        <Text fontSize="2xs" color={GOALS_THEME.textMuted} lineHeight="short">
          {sublabel}
        </Text>
      ) : null}
    </Stack>
  );
}
