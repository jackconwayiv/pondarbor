import { Box, Heading, HStack, Image, Stack, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";

import { pondarborLogoSrc } from "../publicAsset";
import { ONBOARDING_STEP_COUNT, type OnboardingStepNumber } from "./onboardingSteps";

const ONBOARDING_WORDMARK_FONT =
  '"Caprasimo", "Spinnaker", Verdana, Geneva, "DejaVu Sans", sans-serif';

export function OnboardingStepShell({
  step,
  title,
  children,
}: {
  step: OnboardingStepNumber;
  title: string;
  children: ReactNode;
}) {
  return (
    <Stack gap="4" w="100%">
      <Box
        borderRadius="lg"
        overflow="hidden"
        borderWidth="1px"
        borderColor="sky.emphasized"
        boxShadow="sm"
      >
        <Box
          bg="sky.emphasized"
          color="navy.fg"
          px={{ base: "4", md: "5" }}
          pt={{ base: "4", md: "5" }}
          pb="3"
          borderBottomWidth="3px"
          borderBottomColor="lilypad.solid"
        >
          <HStack gap="2.5" justify="center" align="center">
            <Image
              src={pondarborLogoSrc()}
              alt=""
              aria-hidden
              h={{ base: "2rem", md: "2.25rem" }}
              w="auto"
              objectFit="contain"
              display="block"
            />
            <Text
              as="span"
              fontFamily={ONBOARDING_WORDMARK_FONT}
              fontSize={{ base: "xl", md: "2xl" }}
              lineHeight="1.1"
              color="navy.fg"
            >
              Pond Arbor
            </Text>
          </HStack>
        </Box>

        <Stack
          gap="3"
          px={{ base: "4", md: "5" }}
          py={{ base: "4", md: "5" }}
          bg="sky.subtle"
          color="black"
        >
          <HStack gap="1.5" justify="center" aria-label={`Step ${step} of ${ONBOARDING_STEP_COUNT}`}>
            {Array.from({ length: ONBOARDING_STEP_COUNT }, (_, i) => {
              const stepIndex = i + 1;
              const completed = stepIndex < step;
              const current = stepIndex === step;
              return (
                <Box
                  key={i}
                  w={current ? "8px" : "6px"}
                  h={current ? "8px" : "6px"}
                  borderRadius="full"
                  bg={completed || current ? "lilypad.solid" : "sky.muted"}
                  borderWidth={current ? "2px" : "0"}
                  borderColor="black"
                  opacity={completed || current ? 1 : 0.55}
                  transition="width 0.12s ease, height 0.12s ease"
                />
              );
            })}
          </HStack>

          <Heading
            as="h1"
            fontFamily="heading"
            fontWeight="normal"
            fontSize={{ base: "lg", md: "xl" }}
            lineHeight="1.25"
            textAlign="center"
            color="black"
          >
            {title}
          </Heading>
        </Stack>
      </Box>

      <Box>{children}</Box>
    </Stack>
  );
}
