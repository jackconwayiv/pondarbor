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

