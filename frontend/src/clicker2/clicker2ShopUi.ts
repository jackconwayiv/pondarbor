import { DESIGN } from "../theme/tokens";

import { FOSSIL_SHOP_SAND } from "./specialtyTierColors";

/** Sky light → lilypad dark; mutagen panel and mutate buttons. */
export const MUTAGEN_WARM_GRADIENT = `linear-gradient(135deg, ${DESIGN.skyLight} 0%, ${DESIGN.lilypadDark} 100%)`;

/** Headline-strip celebrate cards (mutagen away reports, mutation milestones). */
export const MUTAGEN_CELEBRATE_CARD_CHROME = {
  borderWidth: "1px",
  borderColor: "sky.border",
  background: MUTAGEN_WARM_GRADIENT,
  shadow: "md",
} as const;

/** Denizens / Evolutions column headings in the Redux shop. */
export const CLICKER2_SHOP_SECTION_HEADING_PROPS = {
  as: "h2",
  fontSize: "xs",
  fontWeight: "bold",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "lilypad.solid",
  lineHeight: "1.2",
} as const;

/** Fossil Shop collapsible heading (brand orange / nautical). */
export const FOSSIL_SHOP_SECTION_HEADING_PROPS = {
  ...CLICKER2_SHOP_SECTION_HEADING_PROPS,
  color: "nautical.solid",
} as const;

/** Mutagen / strata half-headings in the depth summary card (aligned typographic scale). */
export const DEPTH_SUMMARY_SECTION_HEADING_PROPS = {
  as: "h2",
  fontSize: "sm",
  fontWeight: "semibold",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  lineHeight: "1.2",
} as const;

export const DEPTH_SUMMARY_MUTAGEN_HEADING_PROPS = {
  ...DEPTH_SUMMARY_SECTION_HEADING_PROPS,
  color: "lilypad.solid",
} as const;

export const DEPTH_SUMMARY_STRATA_HEADING_PROPS = {
  ...DEPTH_SUMMARY_SECTION_HEADING_PROPS,
  color: "nautical.solid",
} as const;

/** Full-screen cycle interstitial fossil shop title. */
export const FOSSIL_SHOP_INTERSTITIAL_HEADING_PROPS = {
  ...FOSSIL_SHOP_SECTION_HEADING_PROPS,
  fontSize: { base: "md", md: "lg" },
  letterSpacing: "0.03em",
} as const;

/** Fossil shop tree node footprint (square cards via aspect-ratio). */
export const FOSSIL_SHOP_TREE_NODE_MAX_W = "6.5rem";

/** Inner padding for fossil shop purchase cards (thick border + carved inset). */
export const FOSSIL_SHOP_CARD_INNER_PADDING = "2";

/** Sandy chip for fossil counts on the strata half of the depth summary card. */
export const CLICKER2_FOSSIL_STAT_CHIP_TEXT_PROPS = {
  as: "span",
  fontSize: "xs",
  fontWeight: "medium",
  color: "nautical.emphasized",
  px: "1.5",
  py: "0.5",
  borderWidth: "1px",
  borderColor: "blackAlpha.300",
  borderRadius: "sm",
  bg: FOSSIL_SHOP_SAND,
  whiteSpace: "nowrap",
  fontVariantNumeric: "tabular-nums",
} as const;

/** Soft sky chip for mutagen counts (matches gradient start on mutagen half). */
export const CLICKER2_MUTAGEN_STAT_CHIP_TEXT_PROPS = {
  as: "span",
  fontSize: "xs",
  fontWeight: "medium",
  color: "lilypad.emphasized",
  px: "1.5",
  py: "0.5",
  borderWidth: "1px",
  borderColor: "sky.border",
  borderRadius: "sm",
  bg: "sky.subtle",
  whiteSpace: "nowrap",
  fontVariantNumeric: "tabular-nums",
} as const;
