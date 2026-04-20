import type { CalendarColor } from "./types";

/**
 * Deterministic palette bucket for an owner id, used when the source itself
 * doesn't pin a color. Keeps each person visually consistent across a month.
 */
export function paletteForOwner(ownerId: number): CalendarColor {
  const palettes: CalendarColor[] = ["lilypad", "sky", "nautical", "gray"];
  const idx = Math.abs(ownerId) % palettes.length;
  return palettes[idx];
}

export function chipStyles(color: CalendarColor) {
  return {
    bg: `${color}.subtle`,
    borderColor: `${color}.solid`,
    color: "black",
  } as const;
}
