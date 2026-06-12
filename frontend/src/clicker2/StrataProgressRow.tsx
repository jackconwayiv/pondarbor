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
  STRATA_PANEL_TOOLTIP,
  stratumCountHeading,
  TO_NEXT_STRATUM_PHRASE,
} from "./clicker2Copy";
import { DEPTH_SUMMARY_STRATA_HEADING_PROPS } from "./clicker2ShopUi";
import { ENERGY_EMOJI, formatEnergyAmountCompact } from "./formatEnergy";
import {
  FOSSIL_SHOP_CARD_GRADIENT,
  FOSSIL_SHOP_SAND_DEEP,
  FOSSIL_SHOP_TOOLTIP_SURFACE_PROPS,
} from "./specialtyTierColors";
import {
  energyToNextStratum,
  isStratumSystemUnlocked,
  stratumProgressToNext,
} from "./strata";

type StrataProgressRowProps = {
  allTimeEnergyEarned: number;
  pondEra: number;
  unfossilizedStrata: number;
  onCycleClick: () => void;
  canHoverFinePointer?: boolean;
  embedded?: boolean;
};

function StrataProgressRowContent({
  allTimeEnergyEarned,
  pondEra,
  unfossilizedStrata,
  onCycleClick,
  canHoverFinePointer = true,
  embedded = false,
}: StrataProgressRowProps) {
  const progress = stratumProgressToNext(allTimeEnergyEarned);
  const remaining = energyToNextStratum(allTimeEnergyEarned);
  const progressPct = Math.round(progress * 100);
  const canCycle = unfossilizedStrata > 0;
  const fossilStyled = embedded;

  const cycleButton = (
    <Button
      type="button"
      size="xs"
      flexShrink={0}
      disabled={!canCycle}
      variant={canCycle ? "solid" : "outline"}
      colorPalette={canCycle ? (fossilStyled ? "orange" : "sky") : "gray"}
      fontWeight={canCycle ? "semibold" : "normal"}
      bg={canCycle ? (fossilStyled ? "nautical.solid" : "sky.solid") : "gray.50"}
      borderWidth="1px"
      borderColor={
        canCycle
          ? fossilStyled
            ? "nautical.emphasized"
            : "sky.emphasized"
          : "gray.300"
      }
      color={canCycle ? "white" : "gray.500"}
      opacity={canCycle ? 1 : 0.55}
      boxShadow={
        canCycle
          ? fossilStyled
            ? "0 1px 3px rgba(201, 119, 30, 0.35)"
            : "0 1px 3px rgba(74, 134, 184, 0.35)"
          : "none"
      }
      _hover={
        canCycle
          ? {
              bg: fossilStyled ? "nautical.emphasized" : "sky.emphasized",
              borderColor: fossilStyled ? "nautical.emphasized" : "sky.emphasized",
            }
          : undefined
      }
      _active={
        canCycle
          ? {
              bg: fossilStyled ? "nautical.emphasized" : "sky.emphasized",
              borderColor: fossilStyled ? "nautical.emphasized" : "sky.emphasized",
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
  );

  const content = (
    <Flex
      direction="column"
      h={embedded ? "full" : undefined}
      w="full"
      minH="0"
      justify={embedded ? "space-between" : undefined}
      gap={embedded ? "1" : undefined}
    >
      <Flex align="center" justify="space-between" gap="2" w="full" minW="0">
        <Text
          {...(fossilStyled
            ? DEPTH_SUMMARY_STRATA_HEADING_PROPS
            : {
                fontSize: "sm",
                fontWeight: "semibold",
                color: "lilypad.emphasized",
              })}
          textAlign="left"
          minW="0"
          flexShrink={1}
        >
          {stratumCountHeading(unfossilizedStrata)}
        </Text>
        <Flex
          align="center"
          justify="flex-end"
          gap="2"
          flexShrink={0}
          textAlign="right"
          flexWrap="wrap"
        >
          {pondEra > 1 ? (
            <Text
              fontSize="xs"
              fontWeight="medium"
              color={fossilStyled ? "nautical.emphasized" : "gray.600"}
              whiteSpace="nowrap"
            >
              {CYCLE_LABEL} {pondEra}
            </Text>
          ) : null}
        </Flex>
      </Flex>
      <Flex
        align="center"
        gap="2"
        w="full"
        minW="0"
        mt={embedded ? undefined : "1"}
      >
        <Flex direction="column" flex="1" minW="0" gap="1">
          <Text
            fontSize="xs"
            color={fossilStyled ? "blackAlpha.700" : "gray.600"}
            fontVariantNumeric="tabular-nums"
            lineHeight="1.2"
          >
            {formatEnergyAmountCompact(remaining)} {ENERGY_EMOJI}{" "}
            {TO_NEXT_STRATUM_PHRASE}
          </Text>
          <Box
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPct}
            aria-label={`Progress ${TO_NEXT_STRATUM_PHRASE}`}
            w="full"
            h="0.45rem"
            borderRadius="full"
            bg={fossilStyled ? FOSSIL_SHOP_SAND_DEEP : "lilypad.subtle"}
            overflow="hidden"
            borderWidth={fossilStyled ? "1px" : undefined}
            borderColor={fossilStyled ? "blackAlpha.200" : undefined}
          >
            <Box
              h="full"
              w={`${progressPct}%`}
              borderRadius="full"
              bg={fossilStyled ? "nautical.solid" : "lilypad.solid"}
              transition="width 0.35s ease-out"
            />
          </Box>
        </Flex>
        {cycleButton}
      </Flex>
    </Flex>
  );

  const panel = embedded ? (
    <Box
      w="full"
      h="full"
      display="flex"
      flexDirection="column"
      cursor={canHoverFinePointer ? "help" : undefined}
    >
      {content}
    </Box>
  ) : (
    <Box
      w="full"
      mb="2"
      px="2"
      py="1.5"
      borderWidth="1px"
      borderColor="blackAlpha.200"
      borderRadius="md"
      bg={FOSSIL_SHOP_CARD_GRADIENT}
      cursor={canHoverFinePointer ? "help" : undefined}
    >
      {content}
    </Box>
  );

  if (!canHoverFinePointer) {
    return panel;
  }

  const tooltipSurfaceProps = fossilStyled
    ? { ...ecologyTooltipSurfaceProps, ...FOSSIL_SHOP_TOOLTIP_SURFACE_PROPS }
    : ecologyTooltipSurfaceProps;

  return (
    <TooltipRoot
      {...ecologyTooltipRootBaseProps}
      openDelay={400}
      positioning={{ placement: "top" }}
    >
      <TooltipTrigger asChild>{panel}</TooltipTrigger>
      <TooltipPositioner>
        <TooltipContent {...tooltipSurfaceProps} maxW="280px">
          {STRATA_PANEL_TOOLTIP}
        </TooltipContent>
      </TooltipPositioner>
    </TooltipRoot>
  );
}

export default function StrataProgressRow({
  allTimeEnergyEarned,
  embedded = false,
  ...contentProps
}: StrataProgressRowProps) {
  if (!embedded && !isStratumSystemUnlocked(allTimeEnergyEarned)) {
    return null;
  }

  return (
    <StrataProgressRowContent
      embedded={embedded}
      allTimeEnergyEarned={allTimeEnergyEarned}
      {...contentProps}
    />
  );
}
