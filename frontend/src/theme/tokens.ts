/**
 * UI Color System — implementation brief (structured roles; do not substitute freely).
 * Primary actions use teal; links/secondary use sky; structure uses navy/deep; success uses forest/lilypad; attention uses orange.
 */
function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.trim().replace(/^#/, "");
  if (h.length !== 6) throw new Error(`Expected 6-digit hex, got: ${hex}`);
  const r = Number.parseInt(h.slice(0, 2), 16);
  const g = Number.parseInt(h.slice(2, 4), 16);
  const b = Number.parseInt(h.slice(4, 6), 16);
  return { r, g, b };
}

function rgbToHex(rgb: { r: number; g: number; b: number }): string {
  const to2 = (n: number) => clampByte(n).toString(16).padStart(2, "0").toUpperCase();
  return `#${to2(rgb.r)}${to2(rgb.g)}${to2(rgb.b)}`;
}

/** Linear mix: t=0 => a, t=1 => b */
function mixHex(a: string, b: string, t: number): string {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  const tt = Math.max(0, Math.min(1, t));
  return rgbToHex({
    r: A.r + (B.r - A.r) * tt,
    g: A.g + (B.g - A.g) * tt,
    b: A.b + (B.b - A.b) * tt,
  });
}

function lighten(hex: string, t: number): string {
  return mixHex(hex, "#FFFFFF", t);
}

function darken(hex: string, t: number): string {
  return mixHex(hex, "#000000", t);
}

export const DESIGN = {
  /** Base layers */
  almond: "#D3CAB6",
  surface: "#FFFFFF",
  surfaceTint: lighten("#D3CAB6", 0.2),
  warmTan: darken("#D3CAB6", 0.08),
  borderBrown: darken("#D3CAB6", 0.22),

  /** Structure (global chrome, not ad-hoc components) */
  navy: "#0B1F3A",
  deep: "#123A5A",

  /** Interactive */
  teal: "#77B5AD",
  tealHover: lighten("#77B5AD", 0.14),
  tealActive: darken("#77B5AD", 0.12),
  sky: "#94C4EC",
  skyHover: lighten("#94C4EC", 0.14),
  skyActive: darken("#94C4EC", 0.12),

  /** Semantic */
  orange: "#BE744C",
  orangeHover: lighten("#BE744C", 0.14),
  orangeActive: darken("#BE744C", 0.12),
  forest: "#526651",
  lilypad: "#90A67C",

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
