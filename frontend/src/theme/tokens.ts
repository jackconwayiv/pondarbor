/**
 * UI Color System — implementation brief (structured roles; do not substitute freely).
 * Primary actions use lilypad; links/secondary use sky; structure uses navy/deep;
 * emphasis and destructive states use nautical (orange family).
 */
export const DESIGN = {
  /** Base layers */
  cloudWhite: "#F6F7F8",
  mediumGray: "#CBD1D8",
  surface: "#FFFFFF",
  surfaceTint: "#F6F7F8",
  warmTint: "#EEF1F4",
  borderNeutral: "#CBD1D8",

  /** Structure (global chrome, not ad-hoc components) */
  navy: "#0B2545",
  deep: "#3F4650",

  /** Sky triad */
  skyLight: "#CDE2F3",
  sky: "#7CB7DF",
  skyDark: "#4A86B8",
  skyHover: "#A8CDEA",
  skyActive: "#5D99C7",

  /** Lilypad triad */
  lilypadLight: "#DCEBC6",
  lilypad: "#B7D394",
  lilypadDark: "#7FA64E",
  lilypadHover: "#C6DEAA",
  lilypadActive: "#9EBD73",

  /** Nautical triad (orange family) */
  nauticalLight: "#F7C78A",
  nautical: "#E9A14A",
  nauticalDark: "#C9771E",
  nauticalHover: "#EDB26A",
  nauticalActive: "#D18932",

  /** Text on light */
  textPrimary: "#3F4650",
  textSecondary: "#5B6674",
} as const;

export const BRAND_COLORS = {
  lilypad: DESIGN.lilypadDark,
  skyBlue: DESIGN.sky,
  orange: DESIGN.nautical,
} as const;

export const BRAND_PALETTES = {
  lilypad: "lilypad",
  skyBlue: "sky",
  orange: "orange",
} as const;
