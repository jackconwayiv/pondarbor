import {
  Box,
  Flex,
  Text,
  TooltipContent,
  TooltipPositioner,
  TooltipRoot,
  TooltipTrigger,
} from "@chakra-ui/react";

import {
  ecologyTooltipRootBaseProps,
  ecologyTooltipSurfaceProps,
} from "../clicker/ecologyUi.constants";

import {
  CYCLE_LABEL,
  STRATA_PANEL_TOOLTIP,
  stratumCountHeading,
  TO_NEXT_STRATA_PHRASE,
} from "./clicker2Copy";
import { ENERGY_EMOJI, formatEnergyAmount } from "./formatEnergy";
import {
  energyToNextStratum,
  isStratumSystemUnlocked,
  stratumLevelFromAllTimeEnergy,
  stratumProgressToNext,
} from "./strata";

export default function StrataProgressRow({
  allTimeEnergyEarned,
  pondEra,
  canHoverFinePointer = true,
}: {
  allTimeEnergyEarned: number;
  pondEra: number;
  canHoverFinePointer?: boolean;
}) {
  if (!isStratumSystemUnlocked(allTimeEnergyEarned)) {
    return null;
  }

  const level = stratumLevelFromAllTimeEnergy(allTimeEnergyEarned);
  const progress = stratumProgressToNext(allTimeEnergyEarned);
  const remaining = energyToNextStratum(allTimeEnergyEarned);
  const progressPct = Math.round(progress * 100);

  const panel = (
    <Box
      w="full"
      mb="2"
      px="2"
      py="1.5"
      borderWidth="1px"
      borderColor="lilypad.muted"
      borderRadius="md"
      bg="whiteAlpha.900"
      cursor={canHoverFinePointer ? "help" : undefined}
    >
      <Flex align="center" justify="space-between" gap="2" minW="0">
        <Flex align="center" gap="2" minW="0">
          <Text fontSize="sm" fontWeight="semibold" color="lilypad.emphasized">
            {stratumCountHeading(level)}
          </Text>
          {pondEra > 1 ? (
            <Text
              fontSize="xs"
              fontWeight="medium"
              color="gray.600"
              px="1.5"
              py="0.5"
              borderWidth="1px"
              borderColor="border"
              borderRadius="sm"
              bg="bg.subtle"
              flexShrink={0}
            >
              {CYCLE_LABEL} {pondEra}
            </Text>
          ) : null}
        </Flex>
        <Text
          fontSize="xs"
          color="gray.600"
          fontVariantNumeric="tabular-nums"
          textAlign="right"
          flexShrink={0}
        >
          {formatEnergyAmount(remaining)} {ENERGY_EMOJI} {TO_NEXT_STRATA_PHRASE}
        </Text>
      </Flex>
      <Box
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progressPct}
        aria-label={`Progress ${TO_NEXT_STRATA_PHRASE}`}
        h="0.45rem"
        borderRadius="full"
        bg="lilypad.subtle"
        overflow="hidden"
        mt="1"
      >
        <Box
          h="full"
          w={`${progressPct}%`}
          borderRadius="full"
          bg="lilypad.solid"
          transition="width 0.35s ease-out"
        />
      </Box>
    </Box>
  );

  if (!canHoverFinePointer) {
    return panel;
  }

  return (
    <TooltipRoot
      {...ecologyTooltipRootBaseProps}
      openDelay={400}
      positioning={{ placement: "top" }}
    >
      <TooltipTrigger asChild>{panel}</TooltipTrigger>
      <TooltipPositioner>
        <TooltipContent {...ecologyTooltipSurfaceProps} maxW="280px">
          {STRATA_PANEL_TOOLTIP}
        </TooltipContent>
      </TooltipPositioner>
    </TooltipRoot>
  );
}
