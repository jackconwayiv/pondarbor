import { Box, Flex, Heading, Stack, Text } from "@chakra-ui/react";
import type { KeyboardEvent } from "react";

import {
  bodySymbolForTileId,
  modeElementLabelForSign,
  signSymbolForSign,
  traitsForSign,
} from "./astroLexicon";
import { signCardAccent } from "./signCardAccent";
import { formatHouseRoman, housePlacementSection } from "./zodiacHouseDescriptors";
import ZodiacHousePhraseCallouts from "./ZodiacHousePhraseCallouts";
import ZodiacPhraseCallouts from "./ZodiacPhraseCallouts";
import type { ZodiacSignCardTile } from "./ZodiacSignCardsStrip";

const headingProps = {
  as: "h2" as const,
  size: "lg" as const,
  fontFamily: "heading",
  fontWeight: "bold",
  lineHeight: "short",
  color: "fg",
  mb: "3",
};

export default function ZodiacPlacementBodyContent({
  tile,
  showCardChrome = true,
  onOpenModeElementDetail,
}: {
  tile: ZodiacSignCardTile;
  /** When false, omit panel chrome for embedding in a parent canvas (member Zodiac page). */
  showCardChrome?: boolean;
  /** When set, `(Cardinal Air)` (etc.) is one interactive control that opens the combo descriptor in the parent canvas. */
  onOpenModeElementDetail?: () => void;
}) {
  const modalAccent = signCardAccent(tile.sign);
  const placementTraits = traitsForSign(tile.sign);
  const modeElementLabel = modeElementLabelForSign(tile.sign);
  const modeElementParen = modeElementLabel ? `(${modeElementLabel})` : null;
  const houseSection = tile.house != null ? housePlacementSection(tile.house) : null;

  const onComboKeyDown = (e: KeyboardEvent) => {
    if (!onOpenModeElementDetail) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpenModeElementDetail();
    }
  };

  const inner = (
      <Stack gap={{ base: "3", md: "4" }}>
        <Box>
          <Flex
            align="baseline"
            justify="space-between"
            gap="2"
            w="100%"
            mb={tile.retrograde ? "2" : "3"}
          >
            <Heading
              {...headingProps}
              mb="0"
              display="flex"
              alignItems="baseline"
              gap="2"
              flex="1"
              minW="0"
              flexWrap="nowrap"
            >
              {bodySymbolForTileId(tile.id) ? (
                <Box as="span" flexShrink={0} lineHeight="short">
                  {bodySymbolForTileId(tile.id)}
                </Box>
              ) : null}
              <Box
                as="span"
                flex="1"
                minW="0"
                overflow="hidden"
                textOverflow="ellipsis"
                whiteSpace="nowrap"
              >
                {tile.bodyHeading}
              </Box>
              {tile.retrograde ? (
                <Text
                  as="span"
                  fontSize="sm"
                  color="fg.muted"
                  fontWeight="normal"
                  lineHeight="1"
                  flexShrink={0}
                  aria-label="Retrograde"
                >
                  Я
                </Text>
              ) : null}
            </Heading>
            <Text
              as="span"
              fontFamily="heading"
              fontWeight="bold"
              fontSize={{ base: "sm", md: "md" }}
              color="fg.muted"
              lineHeight="short"
              flexShrink={0}
              textAlign="right"
            >
              {tile.house != null ? formatHouseRoman(tile.house) ?? "" : ""}
            </Text>
          </Flex>
          {tile.retrograde ? (
            <Text
              fontSize={{ base: "xs", md: "md" }}
              color="fg"
              lineHeight="tall"
              mb="3"
            >
              {
                "This retrograde planet's energies are manifested through inward processing before outward expression, which could result in a more reflective, delayed, or unconventional experience of the planet's themes:"
              }
            </Text>
          ) : null}
          <Box as="ul" m="0" pl="5" color="fg" listStyleType="disc" listStylePosition="outside">
            {tile.bodyPhrases.map((phrase) => (
              <Text
                as="li"
                key={phrase}
                fontSize={{ base: "xs", md: "md" }}
                lineHeight="tall"
              >
                {phrase}
              </Text>
            ))}
          </Box>
        </Box>
        <Box>
          <Flex align="baseline" justify="space-between" gap="3" mb="3" flexWrap="wrap">
            <Heading
              {...headingProps}
              mb="0"
              textTransform="capitalize"
              flex="1"
              minW="0"
            >
              {signSymbolForSign(tile.sign) ? `${signSymbolForSign(tile.sign)} ` : ""}
              {tile.sign}
            </Heading>
            {modeElementParen ? (
              onOpenModeElementDetail ? (
                <Text
                  as="span"
                  role="button"
                  tabIndex={0}
                  flexShrink={0}
                  fontSize="sm"
                  fontWeight="medium"
                  color="fg.muted"
                  cursor="pointer"
                  textDecoration="underline"
                  textDecorationThickness="1px"
                  textUnderlineOffset="2px"
                  _hover={{ color: "fg" }}
                  _focusVisible={{
                    outline: "2px solid",
                    outlineColor: "fg",
                    outlineOffset: "2px",
                    borderRadius: "sm",
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenModeElementDetail();
                  }}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    onComboKeyDown(e);
                  }}
                >
                  {modeElementParen}
                </Text>
              ) : (
                <Text flexShrink={0} fontSize="sm" color="fg.muted">
                  {modeElementParen}
                </Text>
              )
            ) : null}
          </Flex>
          {placementTraits ? (
            <ZodiacPhraseCallouts
              phrases={placementTraits}
              accentBorderColor={modalAccent.borderColor}
            />
          ) : (
            <Text fontSize="sm" color="fg.muted">
              No curated traits for this placement yet.
            </Text>
          )}
        </Box>
        {houseSection ? (
          <Box>
            <Heading {...headingProps}>{houseSection.heading}</Heading>
            <ZodiacHousePhraseCallouts phrases={houseSection.phrases} />
          </Box>
        ) : null}
      </Stack>
  );

  if (!showCardChrome) {
    return inner;
  }

  return (
    <Box
      bg="bg.panel"
      borderWidth="1px"
      borderColor="border"
      borderRadius="xl"
      boxShadow="sm"
      p={{ base: "5", md: "6" }}
    >
      {inner}
    </Box>
  );
}
