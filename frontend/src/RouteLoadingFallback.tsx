import { Box, HStack, Stack } from "@chakra-ui/react";

import {
  PanelBlockSkeleton,
  PanelListRowSkeleton,
  SessionLoadingCard,
} from "./components/panelStatus";
import { PANEL_ENTRY_CARD_PROPS } from "./theme/typography";

export default function RouteLoadingFallback() {
  return (
    <SessionLoadingCard>
      <Stack gap="3">
        <HStack w="100%" gap="3" align="stretch">
          <Box w={{ base: "3.25rem", md: "3.5rem" }} />
          <Box {...PANEL_ENTRY_CARD_PROPS} flex="1">
            <PanelBlockSkeleton lines={1} showTitleLine />
          </Box>
          <Box w={{ base: "3.25rem", md: "3.5rem" }} />
        </HStack>
        <Box {...PANEL_ENTRY_CARD_PROPS}>
          <PanelListRowSkeleton rows={2} />
        </Box>
      </Stack>
    </SessionLoadingCard>
  );
}
