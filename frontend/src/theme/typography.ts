export const APP_TEXT_SIZES = {
  body: { base: "sm", md: "md" },
  label: { base: "sm", md: "md" },
  helper: { base: "xs", md: "sm" },
  meta: { base: "xs", md: "sm" },
} as const;

/** Shared look for input/textarea placeholders (faint + clearly not real values). */
export const FIELD_PLACEHOLDER_PROPS = {
  _placeholder: {
    color: "gray.500",
    fontStyle: "italic",
    opacity: 0.72,
    fontSize: "sm",
  },
} as const;

