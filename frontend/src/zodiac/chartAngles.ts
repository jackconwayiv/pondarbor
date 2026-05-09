/** Tropical zodiac: 0° Aries = 0 ... 30° per sign (same convention as the parser). */
const SIGNS = [
  "aries",
  "taurus",
  "gemini",
  "cancer",
  "leo",
  "virgo",
  "libra",
  "scorpio",
  "sagittarius",
  "capricorn",
  "aquarius",
  "pisces",
] as const;

export function signFromLongitudeDeg(lon: number): (typeof SIGNS)[number] {
  const x = ((lon % 360) + 360) % 360;
  return SIGNS[Math.min(11, Math.floor(x / 30))];
}

/** Degrees + minutes within the tropical sign only (no sign name). */
function tropicalDegMinInSign(lon: number): { signIdx: number; deg: number; min: number } {
  const x = ((lon % 360) + 360) % 360;
  let signIdx = Math.min(11, Math.floor(x / 30));
  const inSign = x - signIdx * 30;
  let deg = Math.floor(inSign + 1e-9);
  let min = Math.round((inSign - deg) * 60);
  if (min >= 60) {
    min = 0;
    deg += 1;
  }
  if (deg >= 30) {
    signIdx = (signIdx + 1) % 12;
    deg = 0;
  }
  return { signIdx, deg, min };
}

/** E.g. `28°17'` — position within sign (houses table still uses full form with sign name elsewhere). */
export function formatDegreesMinutesInSignOnly(lon: number): string {
  const { deg, min } = tropicalDegMinInSign(lon);
  return `${deg}°${min}'`;
}

/** E.g. `28°17' Pisces` — same tropical convention as the chart import parser. */
export function formatDegreesMinutesSign(lon: number): string {
  const { signIdx, deg, min } = tropicalDegMinInSign(lon);
  const name = SIGNS[signIdx];
  const title = name.charAt(0).toUpperCase() + name.slice(1);
  return `${deg}°${min}' ${title}`;
}

/** Orb arc only (no sign), e.g. `1°03'`. */
export function formatOrbAsDegMin(orbDeg: number): string {
  const abs = Math.abs(orbDeg);
  let deg = Math.floor(abs + 1e-9);
  let min = Math.round((abs - deg) * 60);
  if (min >= 60) {
    min = 0;
    deg += 1;
  }
  return `${deg}°${min}'`;
}
