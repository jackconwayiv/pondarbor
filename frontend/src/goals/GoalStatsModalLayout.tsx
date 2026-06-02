import { Box, Grid, Stack } from "@chakra-ui/react";
import type { ReactNode } from "react";

import type { Goal } from "./types";
import { GoalStatsModalBadge } from "./GoalStatsModalBadge";
import { GoalStatsPanel } from "./GoalStatsPanel";

type GoalStatsModalLayoutProps = {
  goal: Goal;
  milestoneBusyCheckpointId?: string | null;
  onMilestoneToggle?: (checkpointId: string, completed: boolean) => void;
  onBadgeHoldComplete: () => void;
  badgeHoldDisabled?: boolean;
  actions?: ReactNode;
  header?: ReactNode;
};

/** Stats panel (main column) with goal badge inline at top-right. */
export function GoalStatsModalLayout({
  goal,
  milestoneBusyCheckpointId = null,
  onMilestoneToggle,
  onBadgeHoldComplete,
  badgeHoldDisabled = false,
  actions,
  header,
}: GoalStatsModalLayoutProps) {
  return (
    <Stack gap="4" width="full">
      {header}
      <Grid
        templateColumns={{ base: "1fr", sm: "1fr auto" }}
        gap="4"
        alignItems="start"
        width="full"
      >
        <Stack gap="3" minW="0" order={{ base: 2, sm: 1 }}>
          <GoalStatsPanel
            goal={goal}
            milestoneBusyCheckpointId={milestoneBusyCheckpointId}
            onMilestoneToggle={onMilestoneToggle}
          />
        </Stack>
        <Box order={{ base: 1, sm: 2 }} justifySelf={{ base: "end", sm: "start" }} flexShrink={0}>
          <GoalStatsModalBadge
            goal={goal}
            onHoldComplete={onBadgeHoldComplete}
            holdDisabled={badgeHoldDisabled}
          />
        </Box>
      </Grid>
      {actions}
    </Stack>
  );
}
