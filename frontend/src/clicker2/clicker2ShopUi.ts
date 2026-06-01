import { DESIGN } from "../theme/tokens";

/** Sky light → lilypad dark; mutagen panel and mutate buttons. */
export const MUTAGEN_WARM_GRADIENT = `linear-gradient(135deg, ${DESIGN.skyLight} 0%, ${DESIGN.lilypadDark} 100%)`;

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
