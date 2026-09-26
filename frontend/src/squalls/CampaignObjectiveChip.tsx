import { Box, Text } from "@chakra-ui/react";

import {
  formatActiveObjectiveLine,
  type CampaignProgress,
} from "./squallsCampaign";
import { SQUALLS_HUD_COLORS } from "./squallsTheme";

type Props = {
  progress: CampaignProgress;
};

/** Sparse campaign objective chip for the adventure stripe. */
export default function CampaignObjectiveChip({ progress }: Props) {
  return (
    <Box
      w="100%"
      px={2}
      py={0.5}
      borderRadius="md"
      bg="rgba(0, 0, 0, 0.12)"
      borderWidth="1px"
      borderColor={SQUALLS_HUD_COLORS.panelBorder}
    >
      <Text
        fontSize="xs"
        fontWeight="medium"
        lineClamp={1}
        color={SQUALLS_HUD_COLORS.panelMuted}
      >
        {formatActiveObjectiveLine(progress)}
      </Text>
    </Box>
  );
}
