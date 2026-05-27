import { Box, Flex, Grid, Text } from "@chakra-ui/react";
import type { KeyboardEvent } from "react";

import { APP_TEXT_SIZES } from "../theme/typography";
import { bodySymbolForTileId, signSymbolForSign } from "./astroLexicon";
import { signCardAccent } from "./signCardAccent";
import { formatHouseRoman } from "./zodiacHouseDescriptors";
import type { ZodiacSignCardTile } from "./ZodiacSignCardsStrip";

type Accent = ReturnType<typeof signCardAccent>;

export type ZodiacSignCardProps = {
  tile: ZodiacSignCardTile;
  accent: Accent;
  onOpen?: (tile: ZodiacSignCardTile) => void;
  /** When false, card is not interactive (no button role). */
  interactive?: boolean;
};

export default function ZodiacSignCard({
  tile,
  accent,
  onOpen,
  interactive = true,
}: ZodiacSignCardProps) {
  const houseRoman = tile.house != null ? formatHouseRoman(tile.house) : null;
  const ariaHouse = tile.house != null ? ` House ${tile.house}.` : "";
  const ariaLabel = `${tile.label}: ${tile.sign}.${ariaHouse}${
    interactive ? " Open details." : ""
  }`;

  const onCardKeyDown = (e: KeyboardEvent) => {
    if (!interactive || !onOpen) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen(tile);
    }
  };

  return (
    <Box
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={ariaLabel}
      cursor={interactive ? "pointer" : "default"}
      borderLeftWidth="8px"
      borderLeftColor={accent.borderColor}
      borderWidth="1px"
      borderColor="border"
      borderRadius="xl"
      bg={accent.bg}
      p={{ base: "2.5", md: "3" }}
      boxShadow="sm"
      transition="box-shadow 0.15s ease"
      _hover={interactive ? { boxShadow: "md" } : undefined}
      _focusVisible={
        interactive
          ? {
              outline: "2px solid",
              outlineColor: "fg",
              outlineOffset: "2px",
            }
          : undefined
      }
      onClick={interactive && onOpen ? () => onOpen(tile) : undefined}
      onKeyDown={onCardKeyDown}
      h="100%"
    >
      <Grid
        templateColumns="auto minmax(0, 1fr) auto"
        alignItems="center"
        gap="2"
        w="100%"
        columnGap="2"
      >
        {bodySymbolForTileId(tile.id) ? (
          <Text
            fontSize={APP_TEXT_SIZES.label}
            fontWeight="semibold"
            color={accent.labelColor}
            lineHeight="short"
          >
            {bodySymbolForTileId(tile.id)}
          </Text>
        ) : (
          <Box />
        )}
        <Flex
          align="center"
          justify="flex-start"
          gap="1"
          minW="0"
          w="100%"
          maxW="100%"
          flexWrap="nowrap"
          overflow="hidden"
        >
          <Text
            fontSize={APP_TEXT_SIZES.label}
            fontWeight="semibold"
            color={accent.labelColor}
            lineHeight="short"
            minW="0"
            flex="0 1 auto"
            truncate
          >
            {tile.label}
          </Text>
        </Flex>
        <Text
          fontSize="xs"
          fontWeight="normal"
          fontFamily="heading"
          color={accent.valueColor}
          lineHeight="short"
          textAlign="right"
          flexShrink={0}
          aria-hidden={!houseRoman}
        >
          {houseRoman ?? ""}
        </Text>
      </Grid>
      <Box borderTopWidth="1px" borderColor="border" opacity={0.45} mt="1.5" mb="1.5" />
      <Flex align="center" justify="flex-start" gap="2" w="100%" flexWrap="wrap" mt="1">
        <Text
          fontSize={{ base: "lg", md: "2xl" }}
          fontWeight="normal"
          fontFamily="heading"
          textTransform="capitalize"
          color={accent.valueColor}
          lineHeight="short"
          textAlign="start"
        >
          {signSymbolForSign(tile.sign) ? `${signSymbolForSign(tile.sign)} ` : ""}
          {tile.sign}
        </Text>
      </Flex>
    </Box>
  );
}
