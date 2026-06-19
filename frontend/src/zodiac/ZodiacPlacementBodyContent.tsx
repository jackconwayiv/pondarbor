import { Box, Flex, Heading, Stack, Text } from "@chakra-ui/react";
import type { KeyboardEvent } from "react";

import PondButton from "../PondButton";
import {
  bodySymbolForTileId,
  modeElementLabelForSign,
  signSymbolForSign,
  traitsForSign,
} from "./astroLexicon";
import { signCardAccent } from "./signCardAccent";
import { housePlacementSection } from "./zodiacHouseDescriptors";
import ZodiacHousePhraseCallouts from "./ZodiacHousePhraseCallouts";
import ZodiacPhraseCallouts from "./ZodiacPhraseCallouts";
import type { ZodiacSignCardTile } from "./ZodiacSignCardsStrip";

const headingProps = {
  as: "h2" as const,
  size: "lg" as const,
  fontFamily: "heading",
  lineHeight: "short",
  color: "fg",
  mb: "3",
};

export default function ZodiacPlacementBodyContent({
  tile,
  showCardChrome = true,
  onOpenModeElementDetail,
  onLearnMore,
}: {
  tile: ZodiacSignCardTile;
  /** When false, omit panel chrome for embedding in a parent canvas (member Zodiac page). */
  showCardChrome?: boolean;
  /** When set, `(Cardinal Air)` (etc.) is one interactive control that opens the combo descriptor in the parent canvas. */
  onOpenModeElementDetail?: () => void;
  /** When set, shows a right-aligned control that opens full interpret copy for this placement. */
  onLearnMore?: () => void;
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
            align="center"
            justify="space-between"
            gap="2"
            flexWrap="wrap"
            w="100%"
            mb="3"
          >
            <Heading
              {...headingProps}
              mb="0"
              flex="1"
              minW="0"
              maxW="100%"
              overflow="hidden"
              textOverflow="ellipsis"
              whiteSpace="nowrap"
            >
              {bodySymbolForTileId(tile.id) ? `${bodySymbolForTileId(tile.id)} ` : ""}
              {tile.bodyHeading}
            </Heading>
            {onLearnMore ? (
              <PondButton
                size="sm"
                variant="outline"
                flexShrink={0}
                onClick={onLearnMore}
              >
                Learn More
              </PondButton>
            ) : null}
          </Flex>
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
