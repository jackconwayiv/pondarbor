/** Seed catalog for Zodiackary copy; extend with planets, houses, aspects later. */

export type BigThreeKind = "sun" | "moon" | "rising";

export const BIG_THREE_BODY = {
  sun: {
    label: "Sun",
    modalTitle: "Sun sign",
    /** Large heading in the placement detail modal (body section). */
    bodyHeading: "Sun",
    bodyPhrases: [
      "core identity and overall sense of self",
      "essential personality and central character",
      "main motivations and life direction",
      "how you shine and express your purpose",
    ],
  },
  moon: {
    label: "Moon",
    modalTitle: "Moon sign",
    bodyHeading: "Moon",
    bodyPhrases: [
      "emotional world and instinctive responses",
      "subconscious habits and comfort patterns",
      "inner needs, safety, and self-soothing style",
      "how you process feelings and seek belonging",
    ],
  },
  rising: {
    label: "Rising",
    modalTitle: "Ascendant / Rising",
    bodyHeading: "Rising / Ascendant",
    bodyPhrases: [
      "first impressions and social presentation",
      "outward style and visible persona",
      "physical expression and body language",
      "how you approach new people and situations",
    ],
  },
} as const;

/** Mercury, Venus, Mars — same modal pattern as big three; placement uses `SIGN_TRAITS`. */
export const PERSONAL_PLANETS_BODY = {
  mercury: {
    label: "Mercury",
    bodyHeading: "Mercury",
    bodyPhrases: [
      "communication and how you express ideas",
      "thinking style and mental curiosity",
      "learning and everyday reasoning",
      "how you speak, write, and listen",
    ],
  },
  venus: {
    label: "Venus",
    bodyHeading: "Venus",
    bodyPhrases: [
      "love language and affection style",
      "values, pleasure, and comfort",
      "beauty, taste, and aesthetics",
      "relationship harmony and charm",
    ],
  },
  mars: {
    label: "Mars",
    bodyHeading: "Mars",
    bodyPhrases: [
      "drive, ambition, and follow-through",
      "how you assert yourself and handle conflict",
      "energy, courage, and initiative",
      "desire, passion, and pursuit style",
    ],
  },
} as const;

const SIGN_KEYS = [
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

export type ZodiacSignKey = (typeof SIGN_KEYS)[number];

export const SIGN_TRAITS: Record<ZodiacSignKey, readonly string[]> = {
  aries: ["fiery", "energetic", "pioneering", "bold", "confident", "courageous", "direct"],
  taurus: [
    "dependable",
    "patient",
    "unwavering",
    "practical",
    "hardworking",
    "loyal",
    "comfort-loving",
  ],
  gemini: [
    "adaptable",
    "witty",
    "curious",
    "sociable",
    "versatile",
    "open-minded",
    "playful",
  ],
  cancer: [
    "nurturing",
    "intuitive",
    "loyal",
    "sensitive",
    "protective",
    "compassionate",
    "devoted",
  ],
  leo: [
    "confident",
    "generous",
    "charismatic",
    "dramatic",
    "passionate",
    "loyal",
    "enthusiastic",
  ],
  virgo: [
    "meticulous",
    "analytical",
    "reliable",
    "organized",
    "practical",
    "dedicated",
    "supportive",
  ],
  libra: [
    "diplomatic",
    "charming",
    "balanced",
    "artistic",
    "harmonious",
    "social",
    "romantic",
  ],
  scorpio: [
    "intense",
    "intuitive",
    "passionate",
    "loyal",
    "transformative",
    "mysterious",
    "ambitious",
  ],
  sagittarius: [
    "adventurous",
    "optimistic",
    "freedom-loving",
    "curious",
    "honest",
    "humorous",
    "philosophical",
  ],
  capricorn: [
    "ambitious",
    "disciplined",
    "practical",
    "hardworking",
    "reliable",
    "patient",
    "focused",
  ],
  aquarius: [
    "intellectual",
    "independent",
    "humanitarian",
    "original",
    "progressive",
    "innovative",
    "eccentric",
  ],
  pisces: [
    "empathetic",
    "creative",
    "intuitive",
    "gentle",
    "compassionate",
    "artistic",
    "sensitive",
  ],
};

/** Quality (mode) and element for each sign — quadruplicities / triplicities. */
export const SIGN_MODE_ELEMENT: Record<
  ZodiacSignKey,
  { mode: "Cardinal" | "Fixed" | "Mutable"; element: "Fire" | "Earth" | "Air" | "Water" }
> = {
  aries: { mode: "Cardinal", element: "Fire" },
  taurus: { mode: "Fixed", element: "Earth" },
  gemini: { mode: "Mutable", element: "Air" },
  cancer: { mode: "Cardinal", element: "Water" },
  leo: { mode: "Fixed", element: "Fire" },
  virgo: { mode: "Mutable", element: "Earth" },
  libra: { mode: "Cardinal", element: "Air" },
  scorpio: { mode: "Fixed", element: "Water" },
  sagittarius: { mode: "Mutable", element: "Fire" },
  capricorn: { mode: "Cardinal", element: "Earth" },
  aquarius: { mode: "Fixed", element: "Air" },
  pisces: { mode: "Mutable", element: "Water" },
};

const SIGN_KEY_SET = new Set<string>(SIGN_KEYS);

/** Typographic dot-separated list (middle dot + spaces). */
export function joinDotPhrases(phrases: readonly string[]): string {
  return phrases.join(" · ");
}

export function normalizeZodiacSign(raw: string): ZodiacSignKey | null {
  const k = raw.trim().toLowerCase();
  return SIGN_KEY_SET.has(k) ? (k as ZodiacSignKey) : null;
}

export function traitsForSign(raw: string): readonly string[] | null {
  const k = normalizeZodiacSign(raw);
  return k ? SIGN_TRAITS[k] : null;
}

/** Display string like `Cardinal Air` for use in placement labels (e.g. "(Cardinal Air)"). */
export function modeElementLabelForSign(raw: string): string | null {
  const k = normalizeZodiacSign(raw);
  if (!k) return null;
  const { mode, element } = SIGN_MODE_ELEMENT[k];
  return `${mode} ${element}`;
}

/**
 * Text-presentation zodiac sign glyph (forces text form with U+FE0E where supported).
 * Returns null when the sign is unknown.
 */
export function signSymbolForSign(raw: string): string | null {
  const k = normalizeZodiacSign(raw);
  if (!k) return null;
  const text = "\uFE0E";
  const map: Record<ZodiacSignKey, string> = {
    aries: `\u2648${text}`,
    taurus: `\u2649${text}`,
    gemini: `\u264A${text}`,
    cancer: `\u264B${text}`,
    leo: `\u264C${text}`,
    virgo: `\u264D${text}`,
    libra: `\u264E${text}`,
    scorpio: `\u264F${text}`,
    sagittarius: `\u2650${text}`,
    capricorn: `\u2651${text}`,
    aquarius: `\u2652${text}`,
    pisces: `\u2653${text}`,
  };
  return map[k];
}

/** Text-style body glyph where possible; falls back to plain labels if unknown. */
export function bodySymbolForTileId(id: string): string | null {
  const text = "\uFE0E";
  const map: Record<string, string> = {
    sun: `\u2609${text}`,
    moon: `\u263D${text}`,
    rising: "AC",
    mercury: `\u263F${text}`,
    venus: `\u2640${text}`,
    mars: `\u2642${text}`,
  };
  return map[id] ?? null;
}
