import { Box, CloseButton, Flex, Stack, Text } from "@chakra-ui/react";

import { MUTAGEN_WARM_GRADIENT } from "./clicker2ShopUi";
import { MUTAGEN_EMOJI } from "./mutagens";
import {
  FOSSIL_SHOP_CARD_BORDER_WIDTH,
  FOSSIL_SHOP_CARD_GRADIENT,
} from "./specialtyTierColors";

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
      borderWidth={mutagenStyled ? "1px" : FOSSIL_SHOP_CARD_BORDER_WIDTH}
      borderColor={mutagenStyled ? "sky.border" : "blackAlpha.300"}
      background={mutagenStyled ? MUTAGEN_WARM_GRADIENT : FOSSIL_SHOP_CARD_GRADIENT}
      color="gray.800"
      px={2.5}
      py={2}
      shadow="md"
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
            {emoji || (mutagenStyled ? MUTAGEN_EMOJI : "🍥")}
          </Text>
          <Text fontSize="xs" color="gray.700" fontStyle="italic" lineHeight="1.35">
            {message}
          </Text>
        </Flex>
      </Stack>
    </Box>
  );
}
