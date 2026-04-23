/**
 * Shared Chakra control styling for the dark QFF route shell (`QffLayout` bg `#0c0c0c`).
 * Use with raw `Button` / `IconButton` where `QffButton` is not used.
 */

/** Primary QFF content column: same width + horizontal padding as [`QffPlayersHandbookPage`](QffPlayersHandbookPage.tsx) (`/qff/handbook`) and the lobby. */
export const QFF_MAIN_CONTENT_PROPS = {
  w: "100%" as const,
  maxW: "3xl" as const,
  mx: "auto" as const,
  px: 4 as const,
} as const;

/** Wider play surface for [`QffPlayPage`](QffPlayPage.tsx) (`/qff/play`); not used for lobby/handbook. */
export const QFF_PLAY_PAGE_CONTENT_PROPS = {
  w: "100%" as const,
  maxW: "1200px" as const,
  mx: "auto" as const,
  px: { base: 2, md: 4 } as const,
} as const;

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
