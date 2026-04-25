/**
 * UI Color System — implementation brief (structured roles; do not substitute freely).
 * Primary actions use teal; links/secondary use sky; structure uses navy/deep; success uses forest/lilypad; attention uses orange.
 */
export const DESIGN = {
  /** Base layers */
  almond: "#F5F1E8",
  surface: "#FFFFFF",
  surfaceTint: "#F8F5EE",
  warmTan: "#D2B48C",
  borderBrown: "#A68A64",

  /** Structure (global chrome, not ad-hoc components) */
  navy: "#0B1F3A",
  deep: "#123A5A",

  /** Interactive */
  teal: "#1F7A7A",
  tealHover: "#259494",
  tealActive: "#1A5F5F",
  sky: "#82C8E5",
  skyHover: "#6BBBDD",
  skyActive: "#4FAACD",

  /** Semantic */
  orange: "#C96A2B",
  orangeHover: "#E3A06E",
  orangeActive: "#8A4318",
  forest: "#1B4332",
  lilypad: "#6FB98F",

  /** Text on light */
  textPrimary: "#0B1F3A",
  textSecondary: "#123A5A",
} as const;

export const BRAND_COLORS = {
  lilypad: DESIGN.lilypad,
  skyBlue: DESIGN.sky,
  orange: DESIGN.orange,
} as const;

export const BRAND_PALETTES = {
  lilypad: "lilypad",
  skyBlue: "sky",
  orange: "orange",
} as const;
