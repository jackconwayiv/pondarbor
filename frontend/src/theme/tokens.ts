/**
 * UI Color System — implementation brief (structured roles; do not substitute freely).
 * Primary actions use lilypad; links/secondary use sky; structure uses navy/deep;
 * emphasis and destructive states use nautical (orange family).
 */
export const DESIGN = {
  /** Base layers */
  cloudWhite: "#F6F7F8",
  /** Brand gray scale (light / medium / dark column bases) */
  grayLightBase: "#E5E7EB",
  grayMediumBase: "#CBD1D8",
  grayDarkBase: "#9CA3AF",
  grayLightBorder: "#D1D5DB",
  grayMediumBorder: "#9CA3AF",
  grayDarkBorder: "#6B7280",
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

export type BrandColorSwatch = {
  name: string;
  hex: string;
  role?: string;
};

export type BrandColorGroup = {
  title: string;
  description?: string;
  swatches: readonly BrandColorSwatch[];
};

/** App-wide brand colors for docs / About page (single source of truth). */
export const BRAND_COLOR_GROUPS: readonly BrandColorGroup[] = [
  {
    title: "Core palettes",
    description:
      "Lilypad for primary actions, sky for links and secondary UI, nautical for emphasis and alerts.",
    swatches: [
      { name: "Lilypad", hex: BRAND_COLORS.lilypad, role: "Primary" },
      { name: "Sky", hex: BRAND_COLORS.skyBlue, role: "Secondary" },
      { name: "Nautical", hex: BRAND_COLORS.orange, role: "Emphasis" },
    ],
  },
  {
    title: "Lilypad triad",
    swatches: [
      { name: "Light", hex: DESIGN.lilypadLight },
      { name: "Base", hex: DESIGN.lilypad },
      { name: "Dark", hex: DESIGN.lilypadDark },
      { name: "Hover", hex: DESIGN.lilypadHover },
      { name: "Active", hex: DESIGN.lilypadActive },
    ],
  },
  {
    title: "Sky triad",
    swatches: [
      { name: "Light", hex: DESIGN.skyLight },
      { name: "Base", hex: DESIGN.sky },
      { name: "Dark", hex: DESIGN.skyDark },
      { name: "Hover", hex: DESIGN.skyHover },
      { name: "Active", hex: DESIGN.skyActive },
    ],
  },
  {
    title: "Nautical triad",
    swatches: [
      { name: "Light", hex: DESIGN.nauticalLight },
      { name: "Base", hex: DESIGN.nautical },
      { name: "Dark", hex: DESIGN.nauticalDark },
      { name: "Hover", hex: DESIGN.nauticalHover },
      { name: "Active", hex: DESIGN.nauticalActive },
    ],
  },
  {
    title: "Structure",
    description: "Global chrome and text structure.",
    swatches: [
      { name: "Navy", hex: DESIGN.navy },
      { name: "Deep", hex: DESIGN.deep },
      { name: "Text primary", hex: DESIGN.textPrimary },
      { name: "Text secondary", hex: DESIGN.textSecondary },
    ],
  },
  {
    title: "Neutrals",
    swatches: [
      { name: "Surface", hex: DESIGN.surface },
      { name: "Cloud white", hex: DESIGN.cloudWhite },
      { name: "Gray light", hex: DESIGN.grayLightBase },
      { name: "Gray medium", hex: DESIGN.grayMediumBase },
      { name: "Gray dark", hex: DESIGN.grayDarkBase },
      { name: "Border neutral", hex: DESIGN.borderNeutral },
    ],
  },
];
