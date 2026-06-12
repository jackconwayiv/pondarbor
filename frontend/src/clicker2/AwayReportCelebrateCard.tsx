import { Box, CloseButton, Flex, Stack, Text } from "@chakra-ui/react";

import { MUTAGEN_CELEBRATE_CARD_CHROME } from "./clicker2ShopUi";
import { MUTAGEN_EMOJI } from "./mutagens";
import { FOSSIL_SHOP_CELEBRATE_CARD_CHROME } from "./specialtyTierColors";

import "./MilestoneCelebrateCard.css";

export type AwayReportCardId = "mutagen_collected" | "fae_energy";

type Props = {
  cardId: AwayReportCardId;
  message: string;
  emoji: string;
  onDismiss: () => void;
  motionPaused?: boolean;
};

export function awayReportMutagenMessage(count: number): string {
  if (count === 1) {
    return "1 mutagen was collected while you were away.";
  }
  return `${count} mutagens were collected while you were away.`;
}

export function awayReportFaeEnergyMessage(formattedEnergy: string): string {
  return `Your fae folk generated ${formattedEnergy} while you were away.`;
}

/** Fae away-report cards are hidden below this amount (energy is still granted). */
export const AWAY_REPORT_FAE_ENERGY_CARD_MIN = 100;

export function shouldShowAwayReportFaeEnergyCard(
  faeEnergyGenerated: number,
): boolean {
  return (
    Number.isFinite(faeEnergyGenerated) &&
    faeEnergyGenerated >= AWAY_REPORT_FAE_ENERGY_CARD_MIN
  );
}

export function AwayReportCelebrateCard({
  cardId,
  message,
  emoji,
  onDismiss,
  motionPaused = false,
}: Props) {
  const mutagenStyled = cardId === "mutagen_collected";

  return (
    <Box
      className={`pond2MilestoneCelebrateCard${motionPaused ? " pond2MilestoneCelebrateCard--paused" : ""}`}
      position="relative"
      minW={0}
      h="full"
      borderRadius="md"
      {...(mutagenStyled
        ? MUTAGEN_CELEBRATE_CARD_CHROME
        : FOSSIL_SHOP_CELEBRATE_CARD_CHROME)}
      color="gray.800"
      px={2.5}
      py={2}
    >
      <CloseButton
        position="absolute"
        top={0.5}
        right={0.5}
        size="sm"
        color="gray.700"
        _hover={{ bg: "blackAlpha.100" }}
        onClick={onDismiss}
        aria-label="Dismiss away report"
      />
      <Stack gap={0.5} pr={5}>
        <Flex gap="1" align="center">
          <Text fontSize="sm" lineHeight="1" aria-hidden flexShrink={0}>
            {emoji || (mutagenStyled ? MUTAGEN_EMOJI : "🌀")}
          </Text>
          <Text fontSize="xs" color="gray.700" fontStyle="italic" lineHeight="1.35">
            {message}
          </Text>
        </Flex>
      </Stack>
    </Box>
  );
}
