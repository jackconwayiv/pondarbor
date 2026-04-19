/**
 * Shared Chakra control styling for the dark QFF route shell (`QffLayout` bg `#0c0c0c`).
 * Use with raw `Button` / `IconButton` where `QffButton` is not used.
 */

/** Sidebar / list row — ghost variant. */
export const qffGhostRowButtonProps = {
  color: "#f0f0f0",
} as const;

/** Secondary destructive or outline actions (Delete, etc.). */
export const qffOutlineMutedButtonProps = {
  color: "#f5f5f5",
  borderColor: "#777",
  _hover: { bg: "rgba(255,255,255,0.08)" },
} as const;

/** DM area grid cells (outline + dark fill). */
export const qffGridCellButtonProps = {
  color: "#d4dcc8",
} as const;
