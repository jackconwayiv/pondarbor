/**
 * Big-three tile accents: each sign maps to a Pond brand palette tier (base / dark / light).
 */

export type SignCardAccent = {
  bg: string;
  borderColor: string;
};

/**
 * Fire → nautical / orange; Air → neutral surfaces + deep; Water → sky / pond / navy;
 * Earth → lilypad / teal / forest greens.
 */
export function signCardAccent(signRaw: string): SignCardAccent {
  const s = signRaw.trim().toLowerCase();
  const map: Record<string, SignCardAccent> = {
    // Fire — red / orange family
    aries: { bg: "nautical.subtle", borderColor: "nautical.border" },
    leo: { bg: "nautical.subtle", borderColor: "orange.emphasized" },
    sagittarius: { bg: "orange.subtle", borderColor: "orange.border" },
    // Air — gray family
    libra: { bg: "bg.muted", borderColor: "border" },
    aquarius: { bg: "deep.subtle", borderColor: "deep.border" },
    gemini: { bg: "bg.subtle", borderColor: "border.muted" },
    // Water — blue family
    cancer: { bg: "pond.subtle", borderColor: "pond.border" },
    scorpio: { bg: "navy.subtle", borderColor: "navy.border" },
    pisces: { bg: "sky.subtle", borderColor: "sky.border" },
    // Earth — green family
    capricorn: { bg: "teal.muted", borderColor: "teal.border" },
    taurus: { bg: "forest.subtle", borderColor: "forest.border" },
    virgo: { bg: "lilypad.subtle", borderColor: "lilypad.border" },
  };
  return map[s] ?? { bg: "sky.subtle", borderColor: "sky.border" };
}
