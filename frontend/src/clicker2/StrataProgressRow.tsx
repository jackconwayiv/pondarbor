import {
  Box,
  Button,
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
  CYCLE_POND_BUTTON,
  FOSSILS_LABEL,
  STRATA_PANEL_TOOLTIP,
  stratumCountHeading,
  TO_NEXT_STRATA_PHRASE,
} from "./clicker2Copy";
import { FOSSIL_EMOJI } from "./fossilShop";
import { ENERGY_EMOJI, formatEnergyAmount } from "./formatEnergy";
import {
  energyToNextStratum,
  isStratumSystemUnlocked,
  stratumProgressToNext,
} from "./strata";

export default function StrataProgressRow({
  allTimeEnergyEarned,
  pondEra,
  unfossilizedStrata,
  fossils,
  onCycleClick,
  canHoverFinePointer = true,
}: {
  allTimeEnergyEarned: number;
  pondEra: number;
  unfossilizedStrata: number;
  fossils: number;
  onCycleClick: () => void;
  canHoverFinePointer?: boolean;
}) {
  if (!isStratumSystemUnlocked(allTimeEnergyEarned)) {
    return null;
  }

  const progress = stratumProgressToNext(allTimeEnergyEarned);
  const remaining = energyToNextStratum(allTimeEnergyEarned);
  const progressPct = Math.round(progress * 100);
  const canCycle = unfossilizedStrata > 0;

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
      <Flex align="center" justify="space-between" gap="2" minW="0" flexWrap="wrap">
        <Flex align="center" gap="2" minW="0">
          <Text fontSize="sm" fontWeight="semibold" color="lilypad.emphasized">
            {stratumCountHeading(unfossilizedStrata)}
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
          {fossils > 0 ? (
            <Text
              fontSize="xs"
              color="gray.600"
              flexShrink={0}
              fontVariantNumeric="tabular-nums"
            >
              {fossils.toLocaleString()} {FOSSILS_LABEL} {FOSSIL_EMOJI}
            </Text>
          ) : null}
        </Flex>
        <Flex align="center" gap="2" flexShrink={0}>
          <Text
            fontSize="xs"
            color="gray.600"
            fontVariantNumeric="tabular-nums"
            textAlign="right"
          >
            {formatEnergyAmount(remaining)} {ENERGY_EMOJI} {TO_NEXT_STRATA_PHRASE}
          </Text>
          <Button
            type="button"
            size="xs"
            flexShrink={0}
            disabled={!canCycle}
            variant={canCycle ? "solid" : "outline"}
            colorPalette={canCycle ? "sky" : "gray"}
            fontWeight={canCycle ? "semibold" : "normal"}
            bg={canCycle ? "sky.solid" : "gray.50"}
            borderWidth="1px"
            borderColor={canCycle ? "sky.emphasized" : "gray.300"}
            color={canCycle ? "white" : "gray.500"}
            opacity={canCycle ? 1 : 0.55}
            boxShadow={canCycle ? "0 1px 3px rgba(74, 134, 184, 0.35)" : "none"}
            _hover={
              canCycle
                ? {
                    bg: "sky.emphasized",
                    borderColor: "sky.emphasized",
                  }
                : undefined
            }
            _active={
              canCycle
                ? {
                    bg: "sky.emphasized",
                    borderColor: "sky.emphasized",
                  }
                : undefined
            }
            _disabled={{
              opacity: 0.55,
              cursor: "not-allowed",
              boxShadow: "none",
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (canCycle) onCycleClick();
            }}
          >
            {CYCLE_POND_BUTTON}
          </Button>
        </Flex>
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
