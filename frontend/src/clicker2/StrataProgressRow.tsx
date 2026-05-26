import { Box, Flex, Text } from "@chakra-ui/react";

import { CYCLE_LABEL, STRATUM_LABEL } from "./clicker2Copy";
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
}: {
  allTimeEnergyEarned: number;
  pondEra: number;
}) {
  if (!isStratumSystemUnlocked(allTimeEnergyEarned)) {
    return null;
  }

  const level = stratumLevelFromAllTimeEnergy(allTimeEnergyEarned);
  const progress = stratumProgressToNext(allTimeEnergyEarned);
  const remaining = energyToNextStratum(allTimeEnergyEarned);
  const nextLevel = level + 1;
  const progressPct = Math.round(progress * 100);

  return (
    <Box
      w="full"
      mb="2"
      px="2"
      py="1.5"
      borderWidth="1px"
      borderColor="lilypad.muted"
      borderRadius="md"
      bg="whiteAlpha.900"
    >
      <Flex justify="space-between" align="center" gap="2" mb="1">
        <Flex align="center" gap="2" minW="0">
          <Text fontSize="sm" fontWeight="semibold" color="lilypad.emphasized">
            {STRATUM_LABEL} {level}
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
          {formatEnergyAmount(remaining)} {ENERGY_EMOJI} to {STRATUM_LABEL} {nextLevel}
        </Text>
      </Flex>
      <Box
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progressPct}
        aria-label={`Progress toward ${STRATUM_LABEL} ${nextLevel}`}
        h="0.45rem"
        borderRadius="full"
        bg="lilypad.subtle"
        overflow="hidden"
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
}
