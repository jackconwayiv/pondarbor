import type { ReactNode } from "react";

import ZodiacOverviewMiniTiles from "./ZodiacOverviewMiniTiles";
import type { ZodiacSignCardTile } from "./ZodiacSignCardsStrip";

export type ZodiacPlacementsMiniGridProps = {
  tiles: ZodiacSignCardTile[];
  activeTileId?: string;
  onSelect?: (tile: ZodiacSignCardTile) => void;
  tileWrapper?: (tile: ZodiacSignCardTile, node: ReactNode) => ReactNode;
};

/** Six placement shortcuts in a 3×2 grid (friend surfaces, profile preview). */
export default function ZodiacPlacementsMiniGrid({
  tiles,
  activeTileId = "",
  onSelect,
  tileWrapper,
}: ZodiacPlacementsMiniGridProps) {
  if (tiles.length === 0) return null;

  return (
    <ZodiacOverviewMiniTiles
      layout="grid"
      tiles={tiles}
      activeTileId={activeTileId}
      onSelect={onSelect ?? (() => {})}
      tileWrapper={tileWrapper}
    />
  );
}
