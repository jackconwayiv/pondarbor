import { Box, Flex, SimpleGrid, Text } from "@chakra-ui/react";
import { useState, type KeyboardEvent } from "react";

import { AppModal } from "../components/AppModal";
import { APP_TEXT_SIZES } from "../theme/typography";
import { bodySymbolForTileId, signSymbolForSign } from "./astroLexicon";
import { signCardAccent } from "./signCardAccent";
import { formatHouseRoman } from "./zodiacHouseDescriptors";
import ZodiacPlacementBodyContent from "./ZodiacPlacementBodyContent";

/** Dark-card signs where the center Roman house reads better in white. */
const WHITE_HOUSE_ROMAN_SIGNS = new Set(["leo", "scorpio", "aquarius", "taurus"]);

function houseRomanColorForStripSign(sign: string): string {
  return WHITE_HOUSE_ROMAN_SIGNS.has(sign.trim().toLowerCase()) ? "#FFFFFF" : "fg";
}

export type ZodiacSignCardTile = {
  id: string;
  label: string;
  sign: string;
  bodyHeading: string;
  bodyPhrases: readonly string[];
  /** When true, chart marks this point retrograde (planets only; not ascendant). */
  retrograde?: boolean;
  /** Natal house (1–12) when known from chart; Rising defaults to 1 if missing. */
  house?: number;
};

type Props = {
  tiles: ZodiacSignCardTile[];
  /** Defaults to two columns on small screens, three from `md` up. */
  gridColumns?: { base: number; md: number };
  /**
   * When set, card opens this callback instead of the built-in modal (e.g. member page hosts its own `AppModal`).
   * When omitted, legacy `AppModal` is used (e.g. staff preview).
   */
  onTileOpen?: (tile: ZodiacSignCardTile) => void;
};

export default function ZodiacSignCardsStrip({
  tiles,
  gridColumns = { base: 2, md: 3 },
  onTileOpen,
}: Props) {
  const [detailId, setDetailId] = useState<string | null>(null);

  const tileModels = tiles.map((t) => ({
    ...t,
    accent: signCardAccent(t.sign),
  }));

  const activeTile = detailId ? tileModels.find((t) => t.id === detailId) : undefined;
  const modalAccent = activeTile ? signCardAccent(activeTile.sign) : null;

  const openTile = (tile: (typeof tileModels)[number]) => {
    if (onTileOpen) {
      const { accent: _accent, ...rest } = tile;
      onTileOpen(rest);
      return;
    }
    setDetailId(tile.id);
  };

  const onCardKeyDown = (e: KeyboardEvent, tile: (typeof tileModels)[number]) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openTile(tile);
    }
  };

  const useExternal = Boolean(onTileOpen);

  return (
    <>
      <SimpleGrid columns={gridColumns} gap={{ base: "3", md: "4" }} w="100%">
        {tileModels.map((t) => {
          const houseRoman = t.house != null ? formatHouseRoman(t.house) : null;
          const ariaHouse = t.house != null ? ` House ${t.house}.` : "";
          const ariaRetro = t.retrograde ? " Retrograde." : "";
          const ariaLabel = `${t.label}: ${t.sign}.${ariaHouse}${ariaRetro} Open details.`;
          return (
            <Box
              key={t.id}
              role="button"
              tabIndex={0}
              aria-haspopup={useExternal ? undefined : "dialog"}
              aria-expanded={useExternal ? undefined : detailId === t.id}
              aria-label={ariaLabel}
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
              onClick={() => openTile(t)}
              onKeyDown={(e) => onCardKeyDown(e, t)}
            >
              <Flex align="center" justify="space-between" gap="2" w="100%">
                <Flex align="center" minW="0" flex="1" gap="1" flexWrap="nowrap">
                  {bodySymbolForTileId(t.id) ? (
                    <Text
                      as="span"
                      fontSize={APP_TEXT_SIZES.label}
                      fontWeight="semibold"
                      color={t.accent.labelColor}
                      lineHeight="short"
                      flexShrink={0}
                    >
                      {bodySymbolForTileId(t.id)}
                    </Text>
                  ) : null}
                  <Text
                    as="span"
                    fontSize={APP_TEXT_SIZES.label}
                    fontWeight="semibold"
                    color={t.accent.labelColor}
                    lineHeight="short"
                    minW="0"
                    flex="1"
                    truncate
                  >
                    {t.label}
                  </Text>
                  {t.retrograde ? (
                    <Text
                      as="span"
                      fontSize="sm"
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
                <Text
                  fontSize="xs"
                  fontWeight="bold"
                  fontFamily="heading"
                  color={houseRomanColorForStripSign(t.sign)}
                  lineHeight="short"
                  flexShrink={0}
                  textAlign="right"
                  aria-hidden={!houseRoman}
                >
                  {houseRoman ?? ""}
                </Text>
              </Flex>
              <Box
                borderTopWidth="1px"
                borderColor="border"
                opacity={0.45}
                mt="1.5"
                mb="1.5"
              />
              <Flex align="center" justify="flex-start" gap="2" w="100%" flexWrap="wrap" mt="1">
                <Text
                  fontSize={{ base: "lg", md: "2xl" }}
                  fontWeight="bold"
                  fontFamily="heading"
                  textTransform="capitalize"
                  color={t.accent.valueColor}
                  lineHeight="short"
                  textAlign="start"
                >
                  {signSymbolForSign(t.sign) ? `${signSymbolForSign(t.sign)} ` : ""}
                  {t.sign}
                </Text>
              </Flex>
            </Box>
          );
        })}
      </SimpleGrid>

      {!onTileOpen ? (
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
          {activeTile && modalAccent ? <ZodiacPlacementBodyContent tile={activeTile} /> : null}
        </AppModal>
      ) : null}
    </>
  );
}
