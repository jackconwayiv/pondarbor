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

/** Almost-white almond sand — fossil shop interstitial tray. */
export const FOSSIL_SHOP_ALMOND_BG = "#FAF8F4";

/** Softer sandy surround behind the fossil shop tray. */
export const FOSSIL_SHOP_BACKDROP_BG = "#EBE4D8";

/** Fossil Shop card background (shop + stats). */
export const FOSSIL_SHOP_CARD_GRADIENT = `linear-gradient(to bottom right, ${FOSSIL_SHOP_SAND} 0%, ${FOSSIL_SHOP_SAND_MID} 50%, ${FOSSIL_SHOP_SAND_DEEP} 100%)`;

/** Unpurchased fossil shop tree / for-sale cards before ownership. */
export const FOSSIL_SHOP_CARD_UNPURCHASED_GRADIENT =
  "linear-gradient(to bottom right, #ECECEC 0%, #DDDDDD 50%, #CECECE 100%)";

/** Unpurchased fossil shop nodes when the player cannot afford the fossil cost. */
export const FOSSIL_SHOP_CARD_UNAFFORDABLE_GRADIENT =
  "linear-gradient(to bottom right, #A8A8A8 0%, #888888 50%, #686868 100%)";

export function fossilShopCardBackgroundGradient(
  owned: boolean,
  forSale: boolean,
  canAffordFossils: boolean,
): string {
  if (owned) return FOSSIL_SHOP_CARD_GRADIENT;
  if (forSale && !canAffordFossils) return FOSSIL_SHOP_CARD_UNAFFORDABLE_GRADIENT;
  return FOSSIL_SHOP_CARD_UNPURCHASED_GRADIENT;
}

/** Fossil Shop card outline (shop + stats). */
export const FOSSIL_SHOP_CARD_BORDER_WIDTH = "6px";

/** Headline-strip celebrate cards (fae away reports, pond cycle / fossil shop milestones). */
export const FOSSIL_SHOP_CELEBRATE_CARD_CHROME = {
  borderWidth: FOSSIL_SHOP_CARD_BORDER_WIDTH,
  borderColor: "blackAlpha.300",
  background: FOSSIL_SHOP_CARD_GRADIENT,
  shadow: "md",
} as const;

/** Carved-into-sandstone inset shadows for fossil shop nodes (deepen on hover). */
export const FOSSIL_SHOP_CARD_INSET_SHADOW =
  "inset 0 2px 5px rgba(72, 56, 38, 0.2), inset 0 1px 2px rgba(72, 56, 38, 0.14), inset 0 -1px 1px rgba(255, 248, 240, 0.45)";

export const FOSSIL_SHOP_CARD_INSET_SHADOW_HOVER =
  "inset 0 4px 9px rgba(72, 56, 38, 0.26), inset 0 2px 4px rgba(72, 56, 38, 0.18), inset 0 -1px 1px rgba(255, 248, 240, 0.3)";

export const FOSSIL_SHOP_CARD_INSET_SHADOW_ACTIVE =
  "inset 0 5px 12px rgba(72, 56, 38, 0.32), inset 0 3px 6px rgba(72, 56, 38, 0.22), inset 0 -1px 1px rgba(255, 248, 240, 0.2)";

/** Lighter fill inside the petroglyph dashed inner frame. */
export const FOSSIL_SHOP_PETROGLYPH_INNER_BG = FOSSIL_SHOP_ALMOND_BG;

/** Dashed inner frame on petroglyph slot cards, inside the thick fossil border. */
export const FOSSIL_SHOP_PETROGLYPH_INNER_BORDER_PROPS = {
  position: "absolute" as const,
  inset: "4px",
  zIndex: 0,
  bg: FOSSIL_SHOP_PETROGLYPH_INNER_BG,
  borderWidth: "1px",
  borderStyle: "dashed" as const,
  borderColor: "black",
  borderRadius: "sm",
  pointerEvents: "none" as const,
  "aria-hidden": true,
} as const;

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
