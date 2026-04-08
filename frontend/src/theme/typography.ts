export const APP_TEXT_SIZES = {
  body: { base: "sm", md: "md" },
  label: { base: "sm", md: "md" },
  helper: { base: "xs", md: "sm" },
  meta: { base: "xs", md: "sm" },
} as const;

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

