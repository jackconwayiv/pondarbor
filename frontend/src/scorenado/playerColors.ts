/** Chakra palette tokens for player column highlights (matches legacy Scorenado). */
export const SCORENADO_PLAYER_COLORS = [
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
  "cyan",
] as const;

/** Legacy card gradients: bright top-left → saturated bottom-right. */
export const SCORENADO_CARD_GRADIENTS: { from: string; to: string }[] = [
  { from: "red.100", to: "red.500" },
  { from: "orange.100", to: "orange.500" },
  { from: "yellow.100", to: "yellow.500" },
  { from: "green.100", to: "green.500" },
  { from: "blue.100", to: "blue.500" },
  { from: "purple.100", to: "purple.500" },
  { from: "pink.100", to: "pink.500" },
  { from: "cyan.100", to: "cyan.500" },
];

/** Category editor row backgrounds (legacy colorArray). */
export const SCORENADO_CATEGORY_ROW_COLORS = [
  "red.300",
  "orange.300",
  "yellow.300",
  "green.300",
  "blue.300",
  "purple.300",
  "pink.300",
  "cyan.300",
  "red.300",
  "orange.300",
  "yellow.300",
  "green.300",
] as const;

export function playerColorBg(token: string): string {
  if (!token || token.includes(".")) return token;
  return `${token}.200`;
}

export function cardGradientForIndex(index: number): { from: string; to: string } {
  const offset = 4;
  return SCORENADO_CARD_GRADIENTS[(index + offset) % SCORENADO_CARD_GRADIENTS.length];
}

export function categoryRowColor(index: number): string {
  return SCORENADO_CATEGORY_ROW_COLORS[index % SCORENADO_CATEGORY_ROW_COLORS.length];
}

/** Lighter category hue for template list cards (same index as categoryRowColor). */
export function categoryRowColorLight(index: number): string {
  return categoryRowColor(index).replace(".300", ".200");
}

/** Dashed border hue paired with categoryRowColorLight. */
export function categoryRowBorderColor(index: number): string {
  return categoryRowColor(index).replace(".300", ".500");
}
