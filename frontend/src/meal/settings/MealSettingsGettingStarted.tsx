import { Card, Heading, HStack, Stack, Text } from "@chakra-ui/react";
import PondButton from "../../PondButton";
import {
  APP_TEXT_SIZES,
  PANEL_ENTRY_CARD_BODY_PROPS,
  PANEL_ENTRY_CARD_PROPS,
} from "../../theme/typography";

type MealSettingsGettingStartedProps = {
  setupCompleted: boolean;
  onRunWizard: () => void;
};

export function MealSettingsGettingStarted({
  setupCompleted,
  onRunWizard,
}: MealSettingsGettingStartedProps) {
  return (
    <Stack gap="2">
      <Heading as="h3" size="sm">
        Getting started
      </Heading>
      <Card.Root {...PANEL_ENTRY_CARD_PROPS} p="0">
        <Card.Body {...PANEL_ENTRY_CARD_BODY_PROPS}>
          <Stack gap="3">
            <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
              Configure Meal Maestro here. Use the Plan, Meals, and Pantry tabs for day-to-day
              work — weekly planning, your recipe library, and what you have on hand.
            </Text>
            {setupCompleted ? (
              <Text fontSize={APP_TEXT_SIZES.meta} color="fg.muted">
                Setup completed — re-run the wizard anytime to review your choices.
              </Text>
            ) : null}
            <HStack>
              <PondButton size="sm" colorPalette="lilypad" onClick={onRunWizard}>
                Run setup wizard
              </PondButton>
            </HStack>
          </Stack>
        </Card.Body>
      </Card.Root>
    </Stack>
  );
}
