/**
 * Big-three tile accents: element + modality → branded lighter / base / darker fills
 * (orange, blue, green from DESIGN; air signs use gray light/medium/dark *base* grays).
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
 * Fire → orange triad; Water → sky blue triad; Earth → lilypad green triad;
 * Air → brand gray bases (Libra light, Aquarius medium, Gemini dark).
 * Cardinal = lighter, Fixed = base, Mutable = darker.
 */
export function signCardAccent(signRaw: string): SignCardAccent {
  const s = signRaw.trim().toLowerCase();
  const map: Record<string, SignCardAccent> = {
    // Fire — orange (nautical) triad
    aries: accentLines(DESIGN.nauticalLight, DESIGN.nautical),
    leo: accentLines(DESIGN.nautical, DESIGN.nauticalDark),
    sagittarius: accentLines(DESIGN.nauticalDark, "#B86A1A", true),

    // Air — gray bases + borders from brand gray scale
    libra: accentLines(DESIGN.grayLightBase, DESIGN.grayLightBorder),
    aquarius: accentLines(DESIGN.grayMediumBase, DESIGN.grayMediumBorder),
    gemini: accentLines(DESIGN.grayDarkBase, DESIGN.grayDarkBorder),

    // Water — sky blue triad
    cancer: accentLines(DESIGN.skyLight, DESIGN.sky),
    scorpio: accentLines(DESIGN.sky, DESIGN.skyDark),
    pisces: accentLines(DESIGN.skyDark, "#3D6FA3", true),

    // Earth — lilypad green triad
    capricorn: accentLines(DESIGN.lilypadLight, DESIGN.lilypad),
    taurus: accentLines(DESIGN.lilypad, DESIGN.lilypadDark),
    virgo: accentLines(DESIGN.lilypadDark, "#5F8329", true),
  };
  return map[s] ?? accentLines(DESIGN.skyLight, DESIGN.sky);
}
