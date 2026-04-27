/**
 * When {@link PONDSTEAD_BASE_VISIBLE_COLUMNS} columns span the map viewport
 * width, the map matches the "wide" 9-tile default scale (9 columns visible
 * = full width at zoom 1).
 */
export const PONDSTEAD_BASE_VISIBLE_COLUMNS = 9;
const TILE_REM = 12;

/** Legacy static scale (9 columns at default root rem). Used for docs / proportion reference only. */
export const PONDSTEAD_TILE_SIZE = `${TILE_REM}rem`;
export const PONDSTEAD_BUILDING_SIZE = `${TILE_REM * 0.5}rem`;
export const PONDSTEAD_UNIT_SIZE = `${TILE_REM * 0.25}rem`;

/** 50% of tile edge (px). */
export function pondsteadBuildingSizePx(cellSizePx: number): number {
  return cellSizePx * 0.5;
}

/** 25% of tile edge (px). Used for quick unit/emoji size hints. */
export function pondsteadUnitSizePx(cellSizePx: number): number {
  return cellSizePx * 0.25;
}

/** ~18% of tile edge; corner unit glyphs in the top half. */
export function pondsteadCornerUnitGlyphPx(cellSizePx: number): number {
  return Math.max(10, Math.min(24, cellSizePx * 0.18));
}

/**
 * Emoji / label font (px) for unit stack buttons when up to three share one tile row.
 * Tighter than {@link pondsteadCornerUnitGlyphPx} on small tiles so glyphs stay inside the slot.
 */
export function pondsteadUnitStackGlyphPx(cellSizePx: number): number {
  const corner = pondsteadCornerUnitGlyphPx(cellSizePx);
  // Tile horizontal padding (~0.2rem × 2) + two flex gaps between three slots (~0.12rem × 2), in px-ish margin.
  const slotPx = Math.max(0, (cellSizePx - 12) / 3 - 1);
  const capped = Math.floor(slotPx * 0.95);
  return Math.min(corner, Math.max(8, capped));
}

/**
 * Resource node glyph in the top-right, drawn as a background layer (low z-index)
 * with {@link pointerEvents} none; units can overlay the same area.
 */
export function pondsteadResourceLayerGlyphPx(cellSizePx: number): number {
  return Math.max(11, Math.min(32, cellSizePx * 0.14));
}
