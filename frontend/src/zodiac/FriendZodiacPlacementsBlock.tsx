import type { ReactNode } from "react";

import ZodiacPlacementsMiniGrid from "./ZodiacPlacementsMiniGrid";
import type { ZodiacSignCardTile } from "./ZodiacSignCardsStrip";

export type FriendZodiacPlacementsBlockProps = {
  tiles: ZodiacSignCardTile[];
  onSelect?: (tile: ZodiacSignCardTile) => void;
  tileWrapper?: (tile: ZodiacSignCardTile, node: ReactNode) => ReactNode;
};

/** Compact labeled placement grid (Friends tab, friend/own profile). */
export default function FriendZodiacPlacementsBlock({
  tiles,
  onSelect,
  tileWrapper,
}: FriendZodiacPlacementsBlockProps) {
  if (tiles.length === 0) return null;

  return (
    <ZodiacPlacementsMiniGrid
      tiles={tiles}
      density="compact"
      onSelect={onSelect}
      tileWrapper={tileWrapper}
    />
  );
}
