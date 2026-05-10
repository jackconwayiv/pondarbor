import { Box, Flex, Heading, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import { useState, type KeyboardEvent } from "react";

import { AppModal } from "../components/AppModal";
import { APP_TEXT_SIZES } from "../theme/typography";
import {
  bodySymbolForTileId,
  modeElementLabelForSign,
  signSymbolForSign,
  traitsForSign,
} from "./astroLexicon";
import { signCardAccent } from "./signCardAccent";
import ZodiacPhraseCallouts from "./ZodiacPhraseCallouts";

export type ZodiacSignCardTile = {
  id: string;
  label: string;
  sign: string;
  bodyHeading: string;
  bodyPhrases: readonly string[];
};

const headingProps = {
  as: "h2" as const,
  size: "lg" as const,
  fontFamily: "heading",
  fontWeight: "bold",
  lineHeight: "short",
  color: "fg",
  mb: "3",
};

type Props = {
  tiles: ZodiacSignCardTile[];
  /** Defaults to two columns on small screens, three from `md` up. */
  gridColumns?: { base: number; md: number };
};

export default function ZodiacSignCardsStrip({
  tiles,
  gridColumns = { base: 2, md: 3 },
}: Props) {
  const [detailId, setDetailId] = useState<string | null>(null);

  const tileModels = tiles.map((t) => ({
    ...t,
    accent: signCardAccent(t.sign),
  }));

  const activeTile = detailId ? tileModels.find((t) => t.id === detailId) : undefined;
  const placementTraits = activeTile?.sign ? traitsForSign(activeTile.sign) : null;
  const placementModeElement = activeTile?.sign
    ? modeElementLabelForSign(activeTile.sign)
    : null;
  const modalAccent = activeTile ? signCardAccent(activeTile.sign) : null;

  const onCardKeyDown = (e: KeyboardEvent, id: string) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setDetailId(id);
    }
  };

  return (
    <>
      <SimpleGrid columns={gridColumns} gap={{ base: "3", md: "4" }} w="100%">
        {tileModels.map((t) => (
          <Box
            key={t.id}
            role="button"
            tabIndex={0}
            aria-haspopup="dialog"
            aria-expanded={detailId === t.id}
            aria-label={`${t.label}: ${t.sign}. Open details.`}
            cursor="pointer"
            borderLeftWidth="8px"
            borderLeftColor={t.accent.borderColor}
            borderWidth="1px"
            borderColor="border"
            borderRadius="xl"
            bg={t.accent.bg}
            p={{ base: "2.5", md: "3" }}
            boxShadow="sm"
            transition="box-shadow 0.15s ease"
            _hover={{ boxShadow: "md" }}
            _focusVisible={{
              outline: "2px solid",
              outlineColor: "fg",
              outlineOffset: "2px",
            }}
            onClick={() => setDetailId(t.id)}
            onKeyDown={(e) => onCardKeyDown(e, t.id)}
          >
            <Text fontSize={APP_TEXT_SIZES.label} fontWeight="semibold" color={t.accent.labelColor}>
              {bodySymbolForTileId(t.id) ? `${bodySymbolForTileId(t.id)} ` : ""}
              {t.label}
            </Text>
            <Box
              borderTopWidth="1px"
              borderColor="border"
              opacity={0.45}
              mt="1.5"
              mb="1.5"
            />
            <Text
              fontSize={{ base: "xl", md: "2xl" }}
              fontWeight="bold"
              fontFamily="heading"
              textTransform="capitalize"
              color={t.accent.valueColor}
              lineHeight="short"
              mt="1"
            >
              {signSymbolForSign(t.sign) ? `${signSymbolForSign(t.sign)} ` : ""}
              {t.sign}
            </Text>
          </Box>
        ))}
      </SimpleGrid>

      <AppModal
        open={detailId !== null}
        onOpenChange={(open) => {
          if (!open) setDetailId(null);
        }}
        showHeader={false}
        size="lg"
        contentProps={{
          bg: modalAccent?.bg ?? "bg.panel",
          cursor: "pointer",
          onClick: () => setDetailId(null),
          p: { base: "4", md: "5" },
        }}
      >
        {activeTile && modalAccent ? (
          <Box
            bg="bg.panel"
            borderWidth="1px"
            borderColor="border"
            borderRadius="xl"
            boxShadow="sm"
            p={{ base: "5", md: "6" }}
          >
            <Stack gap={{ base: "3", md: "4" }}>
              <Box>
                <Heading {...headingProps}>
                  {bodySymbolForTileId(activeTile.id) ? `${bodySymbolForTileId(activeTile.id)} ` : ""}
                  {activeTile.bodyHeading}
                </Heading>
                <Box as="ul" m="0" pl="5" color="fg" listStyleType="disc" listStylePosition="outside">
                  {activeTile.bodyPhrases.map((phrase) => (
                    <Text as="li" key={phrase} fontSize="xs" lineHeight="tall">
                      {phrase}
                    </Text>
                  ))}
                </Box>
              </Box>
              <Box>
                <Flex
                  align="baseline"
                  justify="space-between"
                  gap="3"
                  mb="3"
                  flexWrap="wrap"
                >
                  <Heading
                    {...headingProps}
                    mb="0"
                    textTransform="capitalize"
                    flex="1"
                    minW="0"
                  >
                    {signSymbolForSign(activeTile.sign) ? `${signSymbolForSign(activeTile.sign)} ` : ""}
                    {activeTile.sign}
                  </Heading>
                  {placementModeElement ? (
                    <Text
                      fontSize={APP_TEXT_SIZES.body}
                      color="fg.muted"
                      textAlign="right"
                      flexShrink={0}
                    >
                      ({placementModeElement})
                    </Text>
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
            </Stack>
          </Box>
        ) : null}
      </AppModal>
    </>
  );
}
