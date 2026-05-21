import { Box, HStack, Heading, Stack, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";

import { APP_TEXT_SIZES } from "../../theme/typography";
import type { WizardPageId } from "./wizardSteps";
import { WIZARD_PAGE_HEADINGS } from "./wizardSteps";

export function WizardStepShell({
  pageId,
  hasPrior,
  hasNext,
  helper,
  children,
}: {
  pageId: WizardPageId;
  hasPrior: boolean;
  hasNext: boolean;
  helper?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Stack gap="4">
      <Stack gap="2">
        <HStack gap="3" align="center">
          <HStack gap="1" aria-hidden="true">
            <PageHintDot active={hasPrior} />
            <PageHintDot active />
            <PageHintDot active={hasNext} />
          </HStack>
          <Heading as="h2" size="md" color="fg">
            {WIZARD_PAGE_HEADINGS[pageId]}
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

function PageHintDot({ active }: { active: boolean }) {
  return (
    <Box
      w="6px"
      h="6px"
      borderRadius="full"
      bg={active ? "lilypad.solid" : "bg.muted"}
      opacity={active ? 1 : 0.35}
    />
  );
}
