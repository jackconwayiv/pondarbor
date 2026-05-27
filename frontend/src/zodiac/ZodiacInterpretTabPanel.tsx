import { Box, Flex, Grid, Heading, HStack, Stack, Text } from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";

import PondButton from "../PondButton";
import { APP_TEXT_SIZES } from "../theme/typography";
import { bodySymbolForTileId } from "./astroLexicon";
import { buildInterpretWriteup, interpretTilesInOrder } from "./buildInterpretWriteup";
import { signCardAccent } from "./signCardAccent";
import type { ZodiacSignCardTile } from "./ZodiacSignCardsStrip";
import ZodiacPhraseCallouts from "./ZodiacPhraseCallouts";

export type ZodiacInterpretTabPanelProps = {
  tiles: ZodiacSignCardTile[];
};

function SymbolPrefix({
  symbol,
  label,
}: {
  symbol: string | null;
  label: string;
}) {
  return (
    <HStack as="span" display="inline-flex" gap="1.5" alignItems="center">
      {symbol ? (
        <Text as="span" aria-hidden="true">
          {symbol}
        </Text>
      ) : null}
      <Text as="span">{label}</Text>
    </HStack>
  );
}

function InterpretTitle({
  writeup,
}: {
  writeup: NonNullable<ReturnType<typeof buildInterpretWriteup>>;
}) {
  const { planetSymbol, planetLabel, signSymbol, signName, houseOrdinal } = writeup;

  return (
    <Heading
      as="h2"
      size="lg"
      fontFamily="heading"
      lineHeight="short"
      color="fg"
      display="flex"
      flexWrap="wrap"
      alignItems="center"
      gap={{ base: "1", md: "1.5" }}
    >
      <SymbolPrefix symbol={planetSymbol} label={planetLabel} />
      <Text as="span" fontWeight="normal" color="fg.muted">
        in
      </Text>
      <SymbolPrefix symbol={signSymbol} label={signName} />
      {houseOrdinal != null ? (
        <>
          <Text as="span" fontWeight="normal" color="fg.muted">
            in the
          </Text>
          <Text as="span">{houseOrdinal} House</Text>
        </>
      ) : null}
    </Heading>
  );
}

export default function ZodiacInterpretTabPanel({ tiles }: ZodiacInterpretTabPanelProps) {
  const orderedTiles = useMemo(() => interpretTilesInOrder(tiles), [tiles]);
  const [pageIndex, setPageIndex] = useState(0);

  useEffect(() => {
    setPageIndex(0);
  }, [orderedTiles]);

  const safeIndex =
    orderedTiles.length > 0 ? Math.min(pageIndex, orderedTiles.length - 1) : 0;
  const tile = orderedTiles[safeIndex];
  const writeup = tile ? buildInterpretWriteup(tile) : null;
  const accent = tile ? signCardAccent(tile.sign) : null;
  const planetSymbol = tile ? bodySymbolForTileId(tile.id) : null;

  if (orderedTiles.length === 0 || !tile || !writeup || !accent) {
    return (
      <Text fontSize={APP_TEXT_SIZES.body} color="fg.muted" lineHeight="tall">
        Placement data is not available for interpretation yet.
      </Text>
    );
  }

  const atStart = safeIndex === 0;
  const atEnd = safeIndex === orderedTiles.length - 1;

  return (
    <Stack gap="4" w="100%">
      <HStack justify="space-between" align="center" w="100%" flexWrap="wrap" gap="2">
        <PondButton
          size="sm"
          variant="outline"
          colorPalette="sky"
          disabled={atStart}
          onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
        >
          Back
        </PondButton>
        <HStack gap="1.5" fontSize={APP_TEXT_SIZES.helper} color="fg.muted" fontWeight="medium">
          {planetSymbol ? (
            <Text as="span" aria-hidden="true">
              {planetSymbol}
            </Text>
          ) : null}
          <Text as="span">
            {tile.label} · {safeIndex + 1} of {orderedTiles.length}
          </Text>
        </HStack>
        <PondButton
          size="sm"
          variant="outline"
          colorPalette="sky"
          disabled={atEnd}
          onClick={() =>
            setPageIndex((i) => Math.min(orderedTiles.length - 1, i + 1))
          }
        >
          Next
        </PondButton>
      </HStack>

      <Box
        borderRadius="xl"
        bg={accent.bg}
        p={{ base: "4", md: "5" }}
        minH={{ base: "240px", md: "260px" }}
      >
        <Box
          bg="bg.panel"
          borderWidth="1px"
          borderColor="border"
          borderRadius="xl"
          boxShadow="sm"
          p={{ base: "5", md: "6" }}
        >
          <Grid
            templateColumns={{ base: "1fr", md: "2fr 1fr" }}
            gap={{ base: "5", md: "6" }}
            alignItems="start"
            w="100%"
          >
            <Stack gap="4" minW="0">
              <InterpretTitle writeup={writeup} />
              {writeup.planetHouseParagraphs.map((paragraph) => (
                  <Text
                    key={paragraph}
                    fontSize={{ base: "sm", md: "md" }}
                    lineHeight="tall"
                    color="fg"
                  >
                    {paragraph}
                  </Text>
                ))}
              </Stack>

              <Box
                borderRadius="xl"
                borderWidth="1px"
                borderColor={accent.borderColor}
                borderLeftWidth="3px"
                borderLeftColor={accent.borderColor}
                bg={accent.bg}
                p={{ base: "4", md: "5" }}
                minW="0"
              >
                <Flex align="center" gap="2" mb="3" flexWrap="wrap">
                  {writeup.signSymbol ? (
                    <Text fontSize="xl" lineHeight="1" aria-hidden="true">
                      {writeup.signSymbol}
                    </Text>
                  ) : null}
                  <Heading
                    as="h3"
                    size="md"
                    fontFamily="heading"
                    lineHeight="short"
                    color={accent.labelColor}
                    textTransform="capitalize"
                    mb="0"
                  >
                    {writeup.signName}
                  </Heading>
                </Flex>
                <Stack gap="3" mb="4">
                  {writeup.signParagraphs.map((paragraph) => (
                    <Text
                      key={paragraph}
                      fontSize={{ base: "xs", md: "sm" }}
                      lineHeight="tall"
                      color={accent.valueColor}
                    >
                      {paragraph}
                    </Text>
                  ))}
                </Stack>
                <ZodiacPhraseCallouts
                  phrases={writeup.signTraitPhrases}
                  accentBorderColor={accent.borderColor}
                />
              </Box>
          </Grid>
        </Box>
      </Box>
    </Stack>
  );
}
