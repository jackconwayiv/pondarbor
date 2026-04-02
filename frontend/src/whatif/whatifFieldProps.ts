import { FIELD_PLACEHOLDER_PROPS } from "../theme/typography";

/** Shared field look aligned with quotes inputs (bordered, on white `bg`). */
export const whatifInputProps = {
  ...FIELD_PLACEHOLDER_PROPS,
  bg: "bg",
  borderWidth: "1px",
  borderColor: "border",
  borderRadius: "md",
} as const;
