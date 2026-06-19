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

/** Midheaven / MC — interpret-tab placement page only (not overview tiles). */
export const MIDHEAVEN_BODY = {
  label: "Midheaven",
  bodyHeading: "Midheaven / MC",
  bodyPhrases: [
    "career path and public reputation",
    "vocation and long-term ambitions",
    "how you're seen professionally",
    "legacy and achievement in the world",
  ],
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

/** Jupiter through Part of Fortune — interpret-tab placement pages only. */
export const EXTENDED_INTERPRET_PLACEMENT_BODY = {
  jupiter: {
    label: "Jupiter",
    bodyHeading: "Jupiter",
    bodyPhrases: [
      "growth, faith, and philosophical outlook",
      "expansion, opportunity, and where you aim higher",
      "meaning, optimism, and moral vision",
      "belief, exploration, and generosity of spirit",
    ],
  },
  saturn: {
    label: "Saturn",
    bodyHeading: "Saturn",
    bodyPhrases: [
      "structure, discipline, and long-term commitment",
      "responsibility, boundaries, and what you build over time",
      "maturity, endurance, and earned authority",
      "accountability, limits, and lessons with patience",
    ],
  },
  uranus: {
    label: "Uranus",
    bodyHeading: "Uranus",
    bodyPhrases: [
      "liberation, change, and breaking old patterns",
      "innovation, disruption, and unconventional thinking",
      "freedom, originality, and sudden insight",
      "awakening, independence, and progressive impulse",
    ],
  },
  neptune: {
    label: "Neptune",
    bodyHeading: "Neptune",
    bodyPhrases: [
      "dreams, imagination, and subtle perception",
      "spirituality, dissolution, and what's hard to pin down",
      "compassion, mystery, and idealistic longing",
      "inspiration, art, and surrender to something larger",
    ],
  },
  pluto: {
    label: "Pluto",
    bodyHeading: "Pluto",
    bodyPhrases: [
      "transformation, power, and deep renewal",
      "intensity, shadow work, and what must be released",
      "regeneration, truth, and psychological depth",
      "compulsion, catharsis, and evolutionary force",
    ],
  },
  chiron: {
    label: "Chiron",
    bodyHeading: "Chiron",
    bodyPhrases: [
      "healing insight rooted in lived experience",
      "mentorship, integration, and teaching from what you've worked through",
      "vulnerability as a source of wisdom",
      "bridging hurt and meaningful contribution",
    ],
  },
  north_node: {
    label: "North Node",
    bodyHeading: "North Node",
    bodyPhrases: [
      "growth you're stretching toward over time",
      "less familiar strengths you're building",
      "qualities you're invited to practice and develop",
      "long-term direction and who you're becoming",
    ],
  },
  part_of_fortune: {
    label: "Part of Fortune",
    bodyHeading: "Part of Fortune",
    bodyPhrases: [
      "ease, flow, and where life clicks",
      "natural luck and embodied well-being",
      "blending body, heart, and circumstance",
      "simple pleasures and sustainable happiness",
    ],
  },
} as const;

export type ExtendedInterpretPlacementKey = keyof typeof EXTENDED_INTERPRET_PLACEMENT_BODY;

export function interpretPlacementBodyForTileId(
  tileId: string,
): { label: string; bodyHeading: string; bodyPhrases: readonly string[] } | null {
  if (tileId === "sun" || tileId === "moon" || tileId === "rising") {
    return BIG_THREE_BODY[tileId];
  }
  if (tileId === "midheaven") {
    return MIDHEAVEN_BODY;
  }
  if (tileId in PERSONAL_PLANETS_BODY) {
    return PERSONAL_PLANETS_BODY[tileId as keyof typeof PERSONAL_PLANETS_BODY];
  }
  if (tileId in EXTENDED_INTERPRET_PLACEMENT_BODY) {
    return EXTENDED_INTERPRET_PLACEMENT_BODY[tileId as ExtendedInterpretPlacementKey];
  }
  return null;
}

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

export type ModeDescriptorKey = "cardinal" | "fixed" | "mutable";
export type ElementDescriptorKey = "fire" | "earth" | "air" | "water";

/** Lowercase API keys → display label for descriptor chips. */
export const MODE_DESCRIPTOR_LABEL: Record<ModeDescriptorKey, string> = {
  cardinal: "Cardinal",
  fixed: "Fixed",
  mutable: "Mutable",
};

export const ELEMENT_DESCRIPTOR_LABEL: Record<ElementDescriptorKey, string> = {
  fire: "Fire",
  earth: "Earth",
  air: "Air",
  water: "Water",
};

export const MODE_DESCRIPTOR_COPY: Record<
  ModeDescriptorKey,
  { heading: string; bodyPhrases: readonly string[] }
> = {
  cardinal: {
    heading: "Cardinal mode",
    bodyPhrases: [
      "Starts seasons",
      "First out the gate",
      "Push · spark · open",
      "Action over polish",
      "New cycles",
      "Restless when idle",
    ],
  },
  fixed: {
    heading: "Fixed mode",
    bodyPhrases: [
      "Middle of the season",
      "Hold the line",
      "Depth · loyalty · stamina",
      "Slow to pivot",
      "Steady groove",
      "Comfort in repetition",
    ],
  },
  mutable: {
    heading: "Mutable mode",
    bodyPhrases: [
      "Ends seasons",
      "Bridge and blend",
      "Tweak · adapt · hand off",
      "Many threads",
      "Flexible timing",
      "Loose ends welcome",
    ],
  },
};

export const ELEMENT_DESCRIPTOR_COPY: Record<
  ElementDescriptorKey,
  { heading: string; bodyPhrases: readonly string[] }
> = {
  fire: {
    heading: "Fire element",
    bodyPhrases: [
      "Heat · spark · nerve",
      "Outward motion",
      "Gut truth",
      "Courage",
      "Enthusiasm",
      "Burn bright",
    ],
  },
  earth: {
    heading: "Earth element",
    bodyPhrases: [
      "Hands · soil · schedule",
      "Proof over hype",
      "Build slow",
      "Senses first",
      "Practical care",
      "Stay grounded",
    ],
  },
  air: {
    heading: "Air element",
    bodyPhrases: [
      "Words · ideas · airwaves",
      "Compare · name · share",
      "Social oxygen",
      "Curiosity",
      "Patterns",
      "Keep it clever",
    ],
  },
  water: {
    heading: "Water element",
    bodyPhrases: [
      "Tide · mood · memory",
      "Feel first",
      "Soft signals",
      "Merge · absorb",
      "Belonging",
      "Depth needs edges",
    ],
  },
};

/** Member signs in display order for combo canvas headings, e.g. `Mutable (Gemini, …)`. */
export const MODE_PAIR_MEMBER_LIST: Record<ModeDescriptorKey, string> = {
  cardinal: "Aries, Cancer, Libra, Capricorn",
  fixed: "Taurus, Leo, Scorpio, Aquarius",
  mutable: "Gemini, Virgo, Sagittarius, Pisces",
};

export const ELEMENT_PAIR_MEMBER_LIST: Record<ElementDescriptorKey, string> = {
  fire: "Aries, Leo, Sagittarius",
  earth: "Capricorn, Taurus, Virgo",
  air: "Libra, Aquarius, Gemini",
  water: "Cancer, Scorpio, Pisces",
};

/** Mode adjectives — shared by all signs with that mode (Cardinal Air, Cardinal Water, …). */
export const MODE_PAIR_PHRASES: Record<ModeDescriptorKey, readonly string[]> = {
  cardinal: ["begin", "initiate", "lead", "activate"],
  fixed: ["sustain", "stabilize", "endure", "resist"],
  mutable: ["adapt", "transition", "evolve", "release"],
};

/** Element adjectives — shared by all signs with that element. */
export const ELEMENT_PAIR_PHRASES: Record<ElementDescriptorKey, readonly string[]> = {
  fire: ["passion", "energy", "courage", "action", "inspiration", "confidence", "vision"],
  earth: ["stability", "practicality", "reliability", "structure", "patience", "work", "results"],
  air: ["intellect", "communication", "curiosity", "logic", "ideas", "connection", "perspective"],
  water: ["emotion", "intuition", "sensitivity", "depth", "instinct", "empathy", "imagination"],
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

export function signDisplayName(raw: string): string {
  const k = normalizeZodiacSign(raw);
  if (!k) {
    const t = raw.trim();
    return t ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : raw;
  }
  return k.charAt(0).toUpperCase() + k.slice(1);
}

/** Traditional epithet for interpret sign headings (e.g. “the Ram”). */
export const SIGN_EPITHET: Record<ZodiacSignKey, string> = {
  aries: "the Ram",
  taurus: "the Bull",
  gemini: "the Twins",
  cancer: "the Crab",
  leo: "the Lion",
  virgo: "the Virgin",
  libra: "the Scales",
  scorpio: "the Scorpion",
  sagittarius: "the Archer",
  capricorn: "the Goat",
  aquarius: "the Water-Bearer",
  pisces: "the Fish",
};

/** Sign emoji shown on interpret sign pages (after the heading). */
export const SIGN_EMOJI: Record<ZodiacSignKey, string> = {
  aries: "\u{1F40F}",
  taurus: "\u{1F402}",
  gemini: "\u{1F46F}",
  cancer: "\u{1F980}",
  leo: "\u{1F981}",
  virgo: "\u{1F469}",
  libra: "\u2696\uFE0F",
  scorpio: "\u{1F982}",
  sagittarius: "\u{1F3F9}",
  capricorn: "\u{1F410}",
  aquarius: "\u{1F3FA}",
  pisces: "\u{1F41F}",
};

/** e.g. “Aries the Ram”, “Aquarius the Water-Bearer” for interpret sign page titles. */
export function signInterpretHeading(raw: string): string | null {
  const k = normalizeZodiacSign(raw);
  if (!k) return null;
  return `${signDisplayName(k)} ${SIGN_EPITHET[k]}`;
}

export function signEmojiForSign(raw: string): string | null {
  const k = normalizeZodiacSign(raw);
  if (!k) return null;
  return SIGN_EMOJI[k];
}

/** e.g. “You are a Pisces!” / “You are an Aries!” (Sun sign lead-in). */
export function youAreSignHeading(signRaw: string): string | null {
  const name = signDisplayName(signRaw);
  if (!name.trim()) return null;
  const article = /^[aeiou]/i.test(name) ? "an" : "a";
  return `You are ${article} ${name}!`;
}

/** Sign rulers for house cusps (Pluto→Scorpio, Uranus→Aquarius, not Mars/Saturn). */
export const SIGN_MODERN_RULING_PLANET: Record<ZodiacSignKey, string> = {
  aries: "Mars",
  taurus: "Venus",
  gemini: "Mercury",
  cancer: "Moon",
  leo: "Sun",
  virgo: "Mercury",
  libra: "Venus",
  scorpio: "Pluto",
  sagittarius: "Jupiter",
  capricorn: "Saturn",
  aquarius: "Uranus",
  pisces: "Neptune",
};

const RULER_PLANET_TO_CHART_KEY: Record<string, string> = {
  Mars: "mars",
  Venus: "venus",
  Mercury: "mercury",
  Moon: "moon",
  Sun: "sun",
  Jupiter: "jupiter",
  Saturn: "saturn",
  Uranus: "uranus",
  Neptune: "neptune",
  Pluto: "pluto",
};

export function modernRulingPlanetForSign(raw: string): string | null {
  const sign = normalizeZodiacSign(raw);
  return sign ? SIGN_MODERN_RULING_PLANET[sign] : null;
}

export function chartKeyForRulerPlanet(planetName: string): string | null {
  return RULER_PLANET_TO_CHART_KEY[planetName] ?? null;
}

/** Modern house-ruler planet name for a chart point key (`mercury` → `Mercury`), if any. */
export function rulerPlanetNameForChartKey(chartKey: string): string | null {
  const key = chartKey === "rising" ? "ascendant" : chartKey;
  for (const [planet, k] of Object.entries(RULER_PLANET_TO_CHART_KEY)) {
    if (k === key) return planet;
  }
  return null;
}

function formatChartPointLabel(chartKey: string): string {
  const body = interpretPlacementBodyForTileId(
    chartKey === "ascendant" ? "rising" : chartKey,
  );
  if (body) return body.label;
  return chartKey.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Domain themes for “{Planet} emphasizes …” bullets on interpret house pages. */
export const PLANET_HOUSE_ACT_PHRASES: Record<string, readonly string[]> = {
  sun: BIG_THREE_BODY.sun.bodyPhrases,
  moon: BIG_THREE_BODY.moon.bodyPhrases,
  mercury: PERSONAL_PLANETS_BODY.mercury.bodyPhrases,
  venus: PERSONAL_PLANETS_BODY.venus.bodyPhrases,
  mars: PERSONAL_PLANETS_BODY.mars.bodyPhrases,
  jupiter: [
    "growth and faith",
    "expansion and opportunity",
    "meaning and optimism",
    "belief and exploration",
  ],
  saturn: [
    "structure and discipline",
    "responsibility and limits",
    "maturity and endurance",
    "accountability and time",
  ],
  uranus: [
    "liberation and change",
    "innovation and disruption",
    "freedom and originality",
    "awakening and breakthrough",
  ],
  neptune: [
    "dreams and imagination",
    "spirituality and dissolution",
    "compassion and mystery",
    "inspiration and surrender",
  ],
  pluto: [
    "transformation and power",
    "depth and regeneration",
    "shadow and rebirth",
    "intensity and truth",
  ],
  chiron: [
    "healing and woundedness",
    "mentorship and integration",
    "vulnerability and wisdom",
  ],
  ceres: ["nurturing", "cycles of loss and return", "sustenance and care"],
  pallas: ["strategy", "pattern recognition", "creative intelligence"],
  juno: ["commitment", "partnership contracts", "loyalty and equality"],
  vesta: ["focus", "devotion", "sacred work and retreat"],
  north_node: ["destiny and growth", "karmic direction", "evolutionary pull"],
  south_node: ["past patterns", "familiar gifts", "release and habit"],
  lilith: ["raw instinct", "taboo and autonomy", "unfiltered desire"],
  part_of_fortune: ["ease and flow", "natural luck", "embodied well-being"],
  midheaven: MIDHEAVEN_BODY.bodyPhrases,
};

export function chartPointDisplayLabel(chartKey: string): string {
  return formatChartPointLabel(chartKey);
}

export function planetHouseActPhrases(chartKey: string): readonly string[] | null {
  return PLANET_HOUSE_ACT_PHRASES[chartKey] ?? null;
}

export function descriptorKeysForSign(
  raw: string,
): { mode: ModeDescriptorKey; element: ElementDescriptorKey } | null {
  const sign = normalizeZodiacSign(raw);
  if (!sign) return null;
  const { mode, element } = SIGN_MODE_ELEMENT[sign];
  const modeKey = mode.toLowerCase() as ModeDescriptorKey;
  const elementKey = element.toLowerCase() as ElementDescriptorKey;
  return { mode: modeKey, element: elementKey };
}

/** Headings + chip lists for the mode/element combo canvas (procedural from mode + element keys). */
export function modeElementPairPageSections(raw: string): {
  modeLabel: string;
  modeMembers: string;
  modePhrases: readonly string[];
  elementLabel: string;
  elementMembers: string;
  elementPhrases: readonly string[];
} | null {
  const keys = descriptorKeysForSign(raw);
  if (!keys) return null;
  const modeLabel = MODE_DESCRIPTOR_LABEL[keys.mode];
  const elementLabel = ELEMENT_DESCRIPTOR_LABEL[keys.element];
  return {
    modeLabel,
    modeMembers: MODE_PAIR_MEMBER_LIST[keys.mode],
    modePhrases: MODE_PAIR_PHRASES[keys.mode],
    elementLabel,
    elementMembers: ELEMENT_PAIR_MEMBER_LIST[keys.element],
    elementPhrases: ELEMENT_PAIR_PHRASES[keys.element],
  };
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
    midheaven: "MC",
    mercury: `\u263F${text}`,
    venus: `\u2640${text}`,
    mars: `\u2642${text}`,
    jupiter: `\u2643${text}`,
    saturn: `\u2644${text}`,
    uranus: `\u2645${text}`,
    neptune: `\u2646${text}`,
    pluto: `\u2647${text}`,
    chiron: `\u26B7${text}`,
    north_node: `\u260A${text}`,
    part_of_fortune: `\u2295${text}`,
  };
  return map[id] ?? null;
}
