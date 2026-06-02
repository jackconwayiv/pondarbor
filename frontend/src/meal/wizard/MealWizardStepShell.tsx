import { Box, HStack, Heading, Stack, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { APP_TEXT_SIZES } from "../../theme/typography";
import {
  MEAL_WIZARD_STEP_HEADINGS,
  MEAL_WIZARD_STEP_ORDER,
  type MealWizardStepId,
} from "./mealWizardSteps";

export function MealWizardStepShell({
  stepId,
  helper,
  children,
}: {
  stepId: MealWizardStepId;
  helper?: ReactNode;
  children: ReactNode;
}) {
  const idx = MEAL_WIZARD_STEP_ORDER.indexOf(stepId);
  return (
    <Stack gap="4">
      <Stack gap="2">
        <HStack gap="3" align="center">
          <HStack gap="1" aria-hidden="true">
            {MEAL_WIZARD_STEP_ORDER.map((id, i) => (
              <Box
                key={id}
                w="6px"
                h="6px"
                borderRadius="full"
                bg={i <= idx ? "lilypad.solid" : "bg.muted"}
                opacity={i <= idx ? 1 : 0.35}
              />
            ))}
          </HStack>
          <Heading as="h2" size="md" color="fg">
            {MEAL_WIZARD_STEP_HEADINGS[stepId]}
          </Heading>
        </HStack>
        {helper ? (
          <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted" lineHeight="snug">
            {helper}
          </Text>
        ) : null}
      </Stack>
      <Box>{children}</Box>
    </Stack>
  );
}
