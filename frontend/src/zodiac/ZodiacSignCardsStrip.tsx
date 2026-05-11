import { Box, SimpleGrid, Text } from "@chakra-ui/react";
import { useState, type KeyboardEvent } from "react";

import { AppModal } from "../components/AppModal";
import { APP_TEXT_SIZES } from "../theme/typography";
import { bodySymbolForTileId, signSymbolForSign } from "./astroLexicon";
import { signCardAccent } from "./signCardAccent";
import ZodiacPlacementBodyContent from "./ZodiacPlacementBodyContent";

export type ZodiacSignCardTile = {
  id: string;
  label: string;
  sign: string;
  bodyHeading: string;
  bodyPhrases: readonly string[];
  /** When true, chart marks this point retrograde (planets only; not ascendant). */
  retrograde?: boolean;
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
      onTileOpen({
        id: tile.id,
        label: tile.label,
        sign: tile.sign,
        bodyHeading: tile.bodyHeading,
        bodyPhrases: tile.bodyPhrases,
      });
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
        {tileModels.map((t) => (
          <Box
            key={t.id}
            role="button"
            tabIndex={0}
            aria-haspopup={useExternal ? undefined : "dialog"}
            aria-expanded={useExternal ? undefined : detailId === t.id}
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
            onClick={() => openTile(t)}
            onKeyDown={(e) => onCardKeyDown(e, t)}
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
              fontSize={{ base: "lg", md: "2xl" }}
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
