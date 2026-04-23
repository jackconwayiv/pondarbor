import { Box, Stack, Text } from "@chakra-ui/react";
import { PanelBlockSkeleton } from "../components/panelStatus";
import PondButton from "../PondButton";
import { APP_TEXT_SIZES, PANEL_ENTRY_CARD_PROPS } from "../theme/typography";

export function MealLoading() {
  return (
    <Box {...PANEL_ENTRY_CARD_PROPS} w="100%">
      <PanelBlockSkeleton lines={3} showTitleLine />
    </Box>
  );
}

export function MealSessionReconnect({
  onRetry,
}: {
  onRetry: () => void;
}) {
  return (
    <Box {...PANEL_ENTRY_CARD_PROPS} w="100%">
      <Stack gap="3" align="flex-start">
        <Text fontSize={APP_TEXT_SIZES.body} fontWeight="semibold">
          Reconnecting your API session…
        </Text>
        <PondButton colorPalette="teal" onClick={() => void onRetry()}>
          Retry session sync
        </PondButton>
      </Stack>
    </Box>
  );
}

export function MealApprovalRequired() {
  return (
    <Box {...PANEL_ENTRY_CARD_PROPS} w="100%">
      <Text fontSize={APP_TEXT_SIZES.body} color="fg">
        Approval required to use Meal Maestro.
      </Text>
    </Box>
  );
}
