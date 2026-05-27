import { Box, Flex, HStack, SimpleGrid, Text, VStack } from "@chakra-ui/react";
import type { KeyboardEvent, ReactNode } from "react";

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
  /** Six placements in a 3×2 grid (friend profile, friends tab, profile preview). */
  layout?: "wrap" | "row" | "grid";
  /** Optional wrapper per tile (e.g. router link on friend profile). */
  tileWrapper?: (tile: ZodiacSignCardTile, node: ReactNode) => ReactNode;
};

export default function ZodiacOverviewMiniTiles({
  tiles,
  activeTileId,
  onSelect,
  fillRow = false,
  layout,
  tileWrapper,
}: Props) {
  const resolvedLayout = layout ?? (fillRow ? "row" : "wrap");
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
      <Flex align="center" justify="center" gap="1" w="100%" minW="0" flexWrap="nowrap">
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
        {t.retrograde ? (
          <Text
            as="span"
            fontSize="0.65rem"
            color="fg.muted"
            fontWeight="normal"
            lineHeight="1"
            flexShrink={0}
            aria-hidden="true"
          >
            Я
          </Text>
        ) : null}
      </Flex>
    );
    const signLine = (
      <Flex align="center" justify="center" gap="1" w="100%" minW="0">
        <Text
          fontSize="0.65rem"
          fontWeight="normal"
          color={accent.valueColor}
          lineHeight="1"
          flexShrink={0}
        >
          {signSym ?? "·"}
        </Text>
        <Text
          fontSize="0.65rem"
          fontWeight="normal"
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
        w={resolvedLayout === "row" || resolvedLayout === "grid" ? "100%" : undefined}
        aria-label={`${t.label} in ${t.sign}${t.retrograde ? ", retrograde" : ""}`}
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
        minW={resolvedLayout === "row" || resolvedLayout === "grid" ? "0" : "2.25rem"}
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

    const wrapped = tileWrapper ? tileWrapper(t, tileBtn) : tileBtn;

    if (resolvedLayout === "row") {
      return (
        <Box key={t.id} flex="1" minW="0" display="flex" justifyContent="stretch">
          {wrapped}
        </Box>
      );
    }
    return (
      <Box key={t.id} w={resolvedLayout === "grid" ? "100%" : undefined}>
        {wrapped}
      </Box>
    );
  });

  if (resolvedLayout === "grid") {
    return (
      <SimpleGrid
        columns={3}
        gap={{ base: "1.5", md: "2" }}
        w="100%"
        role="group"
        aria-label="Placement shortcuts"
      >
        {row}
      </SimpleGrid>
    );
  }

  if (resolvedLayout === "row") {
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
