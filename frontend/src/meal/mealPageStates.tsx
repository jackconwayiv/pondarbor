import { HStack, Spinner, Stack, Text } from "@chakra-ui/react";
import PondButton from "../PondButton";
import { APP_TEXT_SIZES } from "../theme/typography";

export function MealLoading() {
  return (
    <HStack gap="2" align="center">
      <Spinner size="sm" colorPalette="lilypad" />
      <Text fontSize={APP_TEXT_SIZES.body} fontWeight="medium">
        Loading…
      </Text>
    </HStack>
  );
}

export function MealSessionReconnect({
  onRetry,
}: {
  onRetry: () => void;
}) {
  return (
    <Stack gap="2">
      <Text fontSize={APP_TEXT_SIZES.body}>
        Reconnecting your API session…
      </Text>
      <PondButton colorPalette="lilypad" onClick={() => void onRetry()}>
        Retry session sync
      </PondButton>
    </Stack>
  );
}

export function MealApprovalRequired() {
  return (
    <Text fontSize={APP_TEXT_SIZES.body} color="fg">
      Approval required to use Meal Maestro.
    </Text>
  );
}
