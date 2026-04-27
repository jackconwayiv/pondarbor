export type PondsteadViewMode = "narrow" | "medium" | "wide";

/** How many map columns are intended to fit across the map viewport (before pinch zoom). */
export const PONDSTEAD_VIEW_VISIBLE_COLUMNS: Record<PondsteadViewMode, 3 | 6 | 9> = {
  narrow: 3,
  medium: 6,
  wide: 9,
};
