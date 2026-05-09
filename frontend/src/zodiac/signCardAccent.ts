/**
 * Big-three tile accents: each sign maps to a core brand hex from `DESIGN` / gray bases.
 *
 * Grays (Many Grays bases): Gemini light, Libra medium (“base”), Aquarius dark.
 * Core palette: orange / blue / green nautical–sky–lilypad triads.
 */

import { DESIGN } from "../theme/tokens";

export type SignCardAccent = {
  bg: string;
  borderColor: string;
  /** Ensures readable contrast on `bg` */
  labelColor: string;
  valueColor: string;
};

function accentLines(
  bg: string,
  borderColor: string,
  lightText?: boolean,
): SignCardAccent {
  if (lightText) {
    return {
      bg,
      borderColor,
      labelColor: "rgba(255,255,255,0.88)",
      valueColor: "#FFFFFF",
    };
  }
  return {
    bg,
    borderColor,
    labelColor: DESIGN.textSecondary,
    valueColor: DESIGN.textPrimary,
  };
}

/**
 * Air: three gray *base* columns from the brand grays.
 * Fire: light / base / dark orange. Water: light / base / dark blue. Earth: light / base / dark green.
 */
export function signCardAccent(signRaw: string): SignCardAccent {
  const s = signRaw.trim().toLowerCase();
  const map: Record<string, SignCardAccent> = {
    // Fire — orange triad
    sagittarius: accentLines(DESIGN.nauticalLight, DESIGN.nautical),
    aries: accentLines(DESIGN.nautical, DESIGN.nauticalDark),
    leo: accentLines(DESIGN.nauticalDark, "#B86A1A", true),

    // Air — light / medium / dark gray (base row of each column)
    gemini: accentLines(DESIGN.grayLightBase, DESIGN.grayLightBorder),
    libra: accentLines(DESIGN.grayMediumBase, DESIGN.grayMediumBorder),
    aquarius: accentLines(DESIGN.grayDarkBase, DESIGN.grayDarkBorder),

    // Water — light / base / dark blue
    pisces: accentLines(DESIGN.skyLight, DESIGN.sky),
    cancer: accentLines(DESIGN.sky, DESIGN.skyDark),
    scorpio: accentLines(DESIGN.skyDark, "#3D6FA3", true),

    // Earth — light / base / dark green
    virgo: accentLines(DESIGN.lilypadLight, DESIGN.lilypad),
    capricorn: accentLines(DESIGN.lilypad, DESIGN.lilypadDark),
    taurus: accentLines(DESIGN.lilypadDark, "#5F8329", true),
  };
  return map[s] ?? accentLines(DESIGN.skyLight, DESIGN.sky);
}
