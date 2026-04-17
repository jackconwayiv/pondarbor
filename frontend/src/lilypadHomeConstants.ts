import { keyframes } from "@emotion/react";

/** Shared lilypad “coin” look for home and games hub. */
export const LILYPAD_WEDGE_CLIP_PATH =
  "polygon(0% 0%, 43% 0%, 46% 12%, 48% 24%, 50% 36%, 52% 24%, 54% 12%, 57% 0%, 100% 0%, 100% 100%, 0% 100%)";

export const LILYPAD_HOVER_HINT_VISIBLE = {
  opacity: 1,
  maxHeight: "4.5rem",
} as const;

export const LILYPAD_FLOAT_KEYFRAMES = keyframes`
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-6px); }
`;
