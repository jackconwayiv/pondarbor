/** Fifteen specialty card backgrounds (tier 1 → 15). */
export const SPECIALTY_TIER_COLORS: readonly string[] = [
  "#EAF4DC", // Pale Sage
  "#DCEBC6", // Crisp Sprout
  "#CBE3BD", // Soft Mint
  "#B7D9CA", // Pale Teal
  "#C1E3ED", // Sky Tint
  "#CDE2F3", // Glass Blue
  "#BDD3ED", // Periwinkle Dew
  "#C6CBF2", // Pale Lavender
  "#DBC4EE", // Soft Orchid
  "#EBC0E5", // Dusty Rose
  "#F5C2CD", // Muted Coral
  "#F8C6B2", // Soft Apricot
  "#F7C78A", // Solar Cream
  "#F5D69D", // Light Amber
  "#EED9A6", // Champagne Gold
];

/** When tier index − 1 is missing (tier 1), gradient starts here. */
export const SPECIALTY_TIER_GRADIENT_START_FALLBACK = "#ffffff";

/** Sandy light brown — fossil shop cards and purchase tooltips. */
export const FOSSIL_SHOP_SAND = "#EDE4D3";
export const FOSSIL_SHOP_SAND_MID = "#E3D4BC";
export const FOSSIL_SHOP_SAND_DEEP = "#D9C7A8";

/** Fossil Shop card background (shop + stats). */
export const FOSSIL_SHOP_CARD_GRADIENT = `linear-gradient(to bottom right, ${FOSSIL_SHOP_SAND} 0%, ${FOSSIL_SHOP_SAND_MID} 50%, ${FOSSIL_SHOP_SAND_DEEP} 100%)`;

/** Fossil Shop card outline (shop + stats). */
export const FOSSIL_SHOP_CARD_BORDER_WIDTH = "6px";

/** Hover / mobile help tooltips for fossil-shop purchases. */
export const FOSSIL_SHOP_TOOLTIP_SURFACE_PROPS = {
  bg: FOSSIL_SHOP_SAND,
  color: "black",
  borderWidth: "1px",
  borderColor: "black",
  borderStyle: "solid" as const,
  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.12)",
} as const;

export function specialtyTierColor(tierIndex: number): string {
  const clamped = Math.max(0, Math.min(14, tierIndex));
  return SPECIALTY_TIER_COLORS[clamped] ?? SPECIALTY_TIER_COLORS[0]!;
}

/** Top-left → bottom-right gradient from tier (n−1) to tier (n+1). */
export function specialtyTierGradient(tierIndex: number): string {
  const i = Math.max(0, Math.min(14, tierIndex));
  const start =
    i > 0
      ? SPECIALTY_TIER_COLORS[i - 1]!
      : SPECIALTY_TIER_GRADIENT_START_FALLBACK;
  const end =
    i < SPECIALTY_TIER_COLORS.length - 1
      ? SPECIALTY_TIER_COLORS[i + 1]!
      : SPECIALTY_TIER_COLORS[i]!;
  return `linear-gradient(to bottom right, ${start}, ${end})`;
}
