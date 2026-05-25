import { Box, Flex, Stack, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";

import "./Clicker2MobileHud.css";

import { ENERGY_EMOJI, formatEnergyRate } from "./formatEnergy";
import RollingEnergyCounter from "./RollingEnergyCounter";

export default function Clicker2MobileHud({
  syncedEnergy,
  energyPerSecond,
  anchorMs,
  displayText,
  statsButton,
  savedBannerKey = 0,
  ongoingWeatherEmoji = null,
}: {
  syncedEnergy: number;
  energyPerSecond: number;
  anchorMs: number;
  displayText: string;
  statsButton: ReactNode;
  savedBannerKey?: number;
  /** Rain or wind boost emoji shown after the energy/sec readout while active. */
  ongoingWeatherEmoji?: string | null;
}) {
  const showSavedIndicator = savedBannerKey > 0;

  return (
    <Flex
      className="click2MobileHud"
      align="flex-start"
      justify="space-between"
      gap="3"
      px="3"
      pb="2"
      flexShrink={0}
    >
      <Stack gap="0" align="flex-start" minW="0" flex="1">
        <RollingEnergyCounter
          syncedEnergy={syncedEnergy}
          energyPerSecond={energyPerSecond}
          anchorMs={anchorMs}
          displayText={displayText}
          fontSize="2xl"
        />
        <Flex align="center" gap="1" flexWrap="wrap">
          <Text fontSize="sm" color="gray.700">
            {formatEnergyRate(energyPerSecond)} {ENERGY_EMOJI} per second
          </Text>
          {ongoingWeatherEmoji ? (
            <Text
              as="span"
              fontSize="sm"
              lineHeight="1"
              aria-hidden
            >
              {ongoingWeatherEmoji}
            </Text>
          ) : null}
        </Flex>
      </Stack>
      <Stack gap="1" align="flex-end" flexShrink={0}>
        {statsButton}
        <Box
          display="flex"
          alignItems="center"
          justifyContent="flex-end"
          minH="1rem"
        >
          <Text
            key={
              showSavedIndicator
                ? `saved-indicator-${savedBannerKey}`
                : "saved-indicator-slot"
            }
            as="span"
            className={showSavedIndicator ? "pond2SavedBanner" : undefined}
            role={showSavedIndicator ? "status" : undefined}
            aria-hidden={!showSavedIndicator}
            fontSize="xs"
            fontWeight="bold"
            color="black"
            visibility={showSavedIndicator ? "visible" : "hidden"}
          >
            Saved
          </Text>
        </Box>
      </Stack>
    </Flex>
  );
}
