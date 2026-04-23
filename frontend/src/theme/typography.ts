export const APP_TEXT_SIZES = {
  body: { base: "sm", md: "md" },
  label: { base: "sm", md: "md" },
  helper: { base: "xs", md: "sm" },
  meta: { base: "xs", md: "sm" },
} as const;

/** Inner column padding for mapped list cards (e.g. text beside image). */
export const MAPPED_CARD_PADDING_PROPS = {
  pt: { base: "2", md: "2" },
  px: { base: "2", md: "2" },
  pb: { base: "2", md: "2" },
} as const;

/** Padding (+ no outer margin) for mapped list cards that are a single outer shell (row spacing: parent `Stack` `gap`). */
export const MAPPED_LIST_CARD_OUTER_PROPS = {
  ...MAPPED_CARD_PADDING_PROPS,
} as const;

/** Vertical gap between mapped list rows (quotes, achievements, public quote list). */
export const MAPPED_LIST_STACK_GAP = "1" as const;

/** Closet tab stacks mix intro copy and item rows; slightly looser than `MAPPED_LIST_STACK_GAP`. */
export const MAPPED_CLOSET_TAB_STACK_GAP = "2" as const;

/**
 * Canonical placeholder styling for all app `Input` / `Textarea`: italic **`gray.400`**, inherit
 * surrounding font size (reads consistently next to labels and in dense forms).
 */
export const PANEL_FORM_PLACEHOLDER_PROPS = {
  _placeholder: {
    color: "gray.400",
    fontStyle: "italic",
    fontSize: "inherit",
  },
} as const;

/**
 * Placeholder-only spread for legacy call sites. Same as **`PANEL_FORM_PLACEHOLDER_PROPS`** —
 * prefer **`PANEL_FIELD_PROPS`** when adding bordered fields.
 */
export const FIELD_PLACEHOLDER_PROPS = PANEL_FORM_PLACEHOLDER_PROPS;

/** Bordered white fields + canonical placeholders (use for essentially all form controls on site panels). */
export const PANEL_FIELD_PROPS = {
  bg: "bg",
  borderWidth: "1px",
  borderColor: "border",
  borderRadius: "md",
  ...PANEL_FORM_PLACEHOLDER_PROPS,
} as const;

/**
 * Main content tray (replaces the older `gray.100` shell). Default width is `5xl` site-wide; same
 * shell pattern as `ClosetPage` (Community Closet).
 */
export const APP_SHELL_TRAY_PROPS = {
  maxW: "5xl",
  w: "100%",
  mx: "auto",
  bg: "bg.panel",
  borderWidth: "1px",
  borderColor: "border",
  borderRadius: "xl",
  boxShadow: "sm",
  overflow: "hidden",
} as const;

/**
 * Centered `5xl` column only — same width as `APP_SHELL_TRAY_PROPS` without the bordered tray
 * (home, games hub, and other full-bleed `bg` pages that are not wrapped in the panel shell).
 */
export const APP_SHELL_CONTENT_MAX_PROPS = {
  maxW: "5xl",
  w: "100%",
  mx: "auto",
} as const;

/**
 * Intro / summary blocks on the primary app tray. Matches Community Closet top intro cards
 * (`bg.panel`, no inner border; reads as one surface with the tray).
 */
export const PANEL_ENTRY_CARD_PROPS = {
  bg: "bg.panel",
  borderWidth: "0",
  borderRadius: "lg",
  p: { base: "2", md: "2" },
} as const;

/**
 * Panel cards that use `Card.Body` for content: set `Card.Root` to `p="0"` and spread this on
 * `Card.Body` so padding is exactly `2` on the body (avoids double padding with Chakra defaults).
 */
export const PANEL_ENTRY_CARD_BODY_PROPS = {
  p: "2",
} as const;

/** Nested editor block inside a card (style guide § nested blocks). */
export const PANEL_NESTED_BLOCK_PROPS = {
  borderWidth: "1px",
  borderColor: "border",
  borderRadius: "md",
  p: "2",
} as const;

/** Meal Maestro: full-card navigation targets (week/template list links). */
export const MEAL_NAV_LINK_CARD_PROPS = {
  cursor: "pointer",
  transition: "box-shadow 0.15s ease",
  _hover: { boxShadow: "md" },
} as const;

