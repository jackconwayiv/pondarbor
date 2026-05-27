import { Box, Flex, HStack, SimpleGrid, Text, VStack } from "@chakra-ui/react";
import type { KeyboardEvent, ReactNode } from "react";

import { bodySymbolForTileId, signDisplayName, signSymbolForSign } from "./astroLexicon";
import { signCardAccent } from "./signCardAccent";
import type { ZodiacSignCardTile } from "./ZodiacSignCardsStrip";
import { formatHouseRoman } from "./zodiacHouseDescriptors";

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
  /** Friend surfaces: labeled tiles on mobile, tighter padding. */
  density?: "default" | "compact";
};

export default function ZodiacOverviewMiniTiles({
  tiles,
  activeTileId,
  onSelect,
  fillRow = false,
  layout,
  tileWrapper,
  density = "default",
}: Props) {
  const compact = density === "compact";
  const resolvedLayout = layout ?? (fillRow ? "row" : "wrap");
  const labelFontSize = compact ? "0.6rem" : "0.65rem";
  const tilePx = compact ? "1" : "1.5";
  const tilePy = compact ? "1" : "1.5";
  const showTextOnMobile = compact;

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
    const signName = signDisplayName(t.sign) ?? t.sign;
    const houseRoman = t.house != null ? formatHouseRoman(t.house) : null;
    const active = t.id === activeTileId;
    const labelLine = (
      <Flex align="center" justify="center" gap="1" w="100%" minW="0" flexWrap="nowrap">
        <Text
          fontSize={labelFontSize}
          fontWeight="semibold"
          color={accent.labelColor}
          lineHeight="1"
          flexShrink={0}
          aria-hidden={compact ? true : undefined}
        >
          {bodySym ?? "·"}
        </Text>
        <Text
          fontSize={labelFontSize}
          fontWeight="semibold"
          color={accent.labelColor}
          lineHeight="1"
          display={showTextOnMobile ? "inline" : { base: "none", md: "inline" }}
          truncate
        >
          {t.label}
        </Text>
      </Flex>
    );
    const signLine = (
      <Flex align="center" justify="center" gap="1" w="100%" minW="0">
        <Text
          fontSize={labelFontSize}
          fontWeight="normal"
          color={accent.valueColor}
          lineHeight="1"
          flexShrink={0}
          aria-hidden={compact ? true : undefined}
        >
          {signSym ?? "·"}
        </Text>
        <Text
          fontSize={labelFontSize}
          fontWeight="normal"
          color={accent.valueColor}
          lineHeight="1"
          display={showTextOnMobile ? "inline" : { base: "none", md: "inline" }}
          textTransform="capitalize"
          truncate
        >
          {signName}
        </Text>
      </Flex>
    );

    const tileBtn = (
      <Box
        role="button"
        tabIndex={0}
        position="relative"
        w={resolvedLayout === "row" || resolvedLayout === "grid" ? "100%" : undefined}
        aria-label={
          houseRoman
            ? `${t.label} in ${signName}, ${houseRoman} House`
            : `${t.label} in ${signName}`
        }
        aria-current={active ? "true" : undefined}
        cursor="pointer"
        borderLeftWidth="3px"
        borderLeftColor={accent.borderColor}
        borderWidth="1px"
        borderColor={active ? "fg" : "border"}
        borderRadius="md"
        bg={accent.bg}
        px={tilePx}
        py={tilePy}
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
        {houseRoman ? (
          <Text
            position="absolute"
            top="0.5"
            right="1"
            fontSize="0.55rem"
            fontWeight="medium"
            fontFamily="heading"
            color={accent.valueColor}
            lineHeight="1"
            aria-hidden="true"
          >
            {houseRoman}
          </Text>
        ) : null}
        <VStack gap={compact ? "0.25" : "0.5"} w="100%" align="stretch">
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

  const gridGap = compact ? { base: "1", md: "1.5" } : { base: "1.5", md: "2" };

  if (resolvedLayout === "grid") {
    return (
      <SimpleGrid
        columns={3}
        gap={gridGap}
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
        gap={gridGap}
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
