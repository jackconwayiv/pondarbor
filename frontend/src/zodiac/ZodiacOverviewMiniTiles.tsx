import { Box, Flex, HStack, Text, VStack } from "@chakra-ui/react";
import type { KeyboardEvent } from "react";

import { bodySymbolForTileId, signSymbolForSign } from "./astroLexicon";
import { signCardAccent } from "./signCardAccent";
import type { ZodiacSignCardTile } from "./ZodiacSignCardsStrip";

type Props = {
  tiles: ZodiacSignCardTile[];
  /** When empty, no tile is shown as current. */
  activeTileId: string;
  onSelect: (tile: ZodiacSignCardTile) => void;
  /** Equal-width cells across the full row (member Zodiac overview). */
  fillRow?: boolean;
};

export default function ZodiacOverviewMiniTiles({
  tiles,
  activeTileId,
  onSelect,
  fillRow = false,
}: Props) {
  const onKeyDown = (e: KeyboardEvent, tile: ZodiacSignCardTile) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(tile);
    }
  };

  const row = tiles.map((t) => {
    const accent = signCardAccent(t.sign);
    const bodySym = bodySymbolForTileId(t.id);
    const signSym = signSymbolForSign(t.sign);
    const active = t.id === activeTileId;
    const labelLine = (
      <Flex align="center" justify="center" gap="1" w="100%" minW="0">
        <Text
          fontSize="0.65rem"
          fontWeight="semibold"
          color={accent.labelColor}
          lineHeight="1"
          flexShrink={0}
        >
          {bodySym ?? "·"}
        </Text>
        <Text
          fontSize="0.65rem"
          fontWeight="semibold"
          color={accent.labelColor}
          lineHeight="1"
          display={{ base: "none", md: "inline" }}
          truncate
        >
          {t.label}
        </Text>
      </Flex>
    );
    const signLine = (
      <Flex align="center" justify="center" gap="1" w="100%" minW="0">
        <Text
          fontSize="0.65rem"
          fontWeight="bold"
          color={accent.valueColor}
          lineHeight="1"
          flexShrink={0}
        >
          {signSym ?? "·"}
        </Text>
        <Text
          fontSize="0.65rem"
          fontWeight="bold"
          color={accent.valueColor}
          lineHeight="1"
          display={{ base: "none", md: "inline" }}
          textTransform="capitalize"
          truncate
        >
          {t.sign}
        </Text>
      </Flex>
    );

    const tileBtn = (
      <Box
        role="button"
        tabIndex={0}
        w={fillRow ? "100%" : undefined}
        aria-label={`${t.label} in ${t.sign}`}
        aria-current={active ? "true" : undefined}
        cursor="pointer"
        borderLeftWidth="3px"
        borderLeftColor={accent.borderColor}
        borderWidth="1px"
        borderColor={active ? "fg" : "border"}
        borderRadius="md"
        bg={accent.bg}
        px="1.5"
        py="1.5"
        minW={fillRow ? "0" : "2.25rem"}
        lineHeight="1"
        boxShadow={active ? "md" : "sm"}
        transition="box-shadow 0.12s ease, border-color 0.12s ease"
        _hover={{ boxShadow: "md" }}
        _focusVisible={{
          outline: "2px solid",
          outlineColor: "fg",
          outlineOffset: "2px",
        }}
        onClick={() => onSelect(t)}
        onKeyDown={(e) => onKeyDown(e, t)}
      >
        <VStack gap="0.5" w="100%" align="stretch">
          {labelLine}
          {signLine}
        </VStack>
      </Box>
    );

    if (fillRow) {
      return (
        <Box key={t.id} flex="1" minW="0" display="flex" justifyContent="stretch">
          {tileBtn}
        </Box>
      );
    }
    return (
      <Box key={t.id}>
        {tileBtn}
      </Box>
    );
  });

  if (fillRow) {
    return (
      <Flex
        w="100%"
        gap={{ base: "1.5", md: "2" }}
        alignItems="stretch"
        role="group"
        aria-label="Placement shortcuts"
      >
        {row}
      </Flex>
    );
  }

  return (
    <HStack
      gap="1"
      flexWrap="wrap"
      justifyContent="flex-end"
      alignItems="flex-start"
      flexShrink={0}
      aria-label="Placement shortcuts"
    >
      {row}
    </HStack>
  );
}
