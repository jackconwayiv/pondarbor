import { SimpleGrid } from "@chakra-ui/react";
import { useState } from "react";

import { AppModal } from "../components/AppModal";
import { signCardAccent } from "./signCardAccent";
import ZodiacPlacementBodyContent from "./ZodiacPlacementBodyContent";
import ZodiacSignCard from "./ZodiacSignCard";

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

  const openTile = (tile: ZodiacSignCardTile) => {
    if (onTileOpen) {
      onTileOpen(tile);
      return;
    }
    setDetailId(tile.id);
  };

  return (
    <>
      <SimpleGrid columns={gridColumns} gap={{ base: "3", md: "4" }} w="100%">
        {tileModels.map((t) => (
          <ZodiacSignCard
            key={t.id}
            tile={t}
            accent={t.accent}
            onOpen={openTile}
            interactive
          />
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
