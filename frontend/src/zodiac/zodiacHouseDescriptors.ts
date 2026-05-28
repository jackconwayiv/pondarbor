/** Headings and chip phrases for the placement-detail house section (houses 1–12). */

export const HOUSE_PLACEMENT_HEADING: Record<number, string> = {
  1: "1st House — Self",
  2: "2nd House — Resources",
  3: "3rd House — Communication",
  4: "4th House — Foundations",
  5: "5th House — Creation",
  6: "6th House — Service",
  7: "7th House — Partnership",
  8: "8th House — Transformation",
  9: "9th House — Expansion",
  10: "10th House — Achievement",
  11: "11th House — Community",
  12: "12th House — Transcendence",
};

export const HOUSE_PLACEMENT_PHRASES: Record<number, readonly string[]> = {
  1: [
    "your identity",
    "appearance",
    "approach",
    "instinct",
    "presence",
    "beginnings",
    "selfhood",
  ],
  2: [
    "values",
    "money",
    "possessions",
    "security",
    "stability",
    "worth",
    "survival",
  ],
  3: [
    "communication",
    "learning",
    "siblings",
    "curiosity",
    "language",
    "local environment",
    "mind",
  ],
  4: [
    "home",
    "family",
    "roots",
    "ancestry",
    "emotional foundation",
    "privacy",
    "belonging",
  ],
  5: [
    "creativity",
    "pleasure",
    "romance",
    "joy",
    "children",
    "self-expression",
    "play",
  ],
  6: [
    "work",
    "health",
    "routine",
    "discipline",
    "service",
    "improvement",
    "daily life",
  ],
  7: [
    "relationships",
    "partnership",
    "marriage",
    "balance",
    "contracts",
    "reflection",
    "others",
  ],
  8: [
    "intimacy",
    "death",
    "rebirth",
    "shared resources",
    "power",
    "vulnerability",
    "transformation",
  ],
  9: [
    "belief",
    "philosophy",
    "travel",
    "higher learning",
    "meaning",
    "wisdom",
    "exploration",
  ],
  10: [
    "career",
    "reputation",
    "ambition",
    "authority",
    "legacy",
    "public life",
    "mastery",
  ],
  11: [
    "friendship",
    "community",
    "networks",
    "ideals",
    "future",
    "collaboration",
    "causes",
  ],
  12: [
    "the subconscious",
    "solitude",
    "spirituality",
    "endings",
    "sacrifice",
    "hidden things",
    "surrender",
  ],
};

export function housePlacementSection(
  house: number,
): { heading: string; phrases: readonly string[] } | null {
  if (!Number.isInteger(house) || house < 1 || house > 12) return null;
  const heading = HOUSE_PLACEMENT_HEADING[house];
  const phrases = HOUSE_PLACEMENT_PHRASES[house];
  if (!heading || !phrases) return null;
  return { heading, phrases };
}

const HOUSE_ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"] as const;

/** Roman numeral for chart house 1–12 (overview card badge). */
export function formatHouseRoman(house: number): string | null {
  if (!Number.isInteger(house) || house < 1 || house > 12) return null;
  return HOUSE_ROMAN[house];
}

/** Emoji prefix for interpret house page headings (houses 1–12). */
export const HOUSE_EMOJI: Record<number, string> = {
  1: "🤩",
  2: "💰",
  3: "📖",
  4: "🏠",
  5: "🎨",
  6: "🛎️",
  7: "💍",
  8: "🗝️",
  9: "🗺️",
  10: "👔",
  11: "🌐",
  12: "🔮",
};

export function houseEmojiForHouse(house: number): string | null {
  if (!Number.isInteger(house) || house < 1 || house > 12) return null;
  return HOUSE_EMOJI[house] ?? null;
}

/** Short theme for interpret house page titles (suffix of `HOUSE_PLACEMENT_HEADING`). */
export const HOUSE_INTERPRET_THEME: Record<number, string> = {
  1: "Self",
  2: "Resources",
  3: "Communication",
  4: "Foundations",
  5: "Creation",
  6: "Service",
  7: "Partnership",
  8: "Transformation",
  9: "Expansion",
  10: "Achievement",
  11: "Community",
  12: "Transcendence",
};

/** Verbs for “where you seek to …” on interpret house pages. */
export const HOUSE_INTERPRET_SEEK_VERBS: Record<number, readonly string[]> = {
  1: ["present", "initiate", "embody", "assert", "express", "define", "meet the world"],
  2: ["earn", "save", "value", "build", "secure", "stabilize", "provide"],
  3: ["communicate", "learn", "ask", "connect", "observe", "articulate", "explore locally"],
  4: ["nurture", "belong", "root", "protect", "settle", "remember", "create sanctuary"],
  5: ["create", "play", "romance", "perform", "celebrate", "take risks", "express joy"],
  6: ["serve", "improve", "organize", "heal", "refine", "maintain", "support daily life"],
  7: ["partner", "commit", "negotiate", "balance", "relate", "cooperate", "mirror others"],
  8: ["merge", "transform", "share deeply", "trust", "release", "regenerate", "face shadow"],
  9: ["explore", "teach", "believe", "travel", "expand horizons", "seek meaning", "philosophize"],
  10: ["achieve", "lead", "build reputation", "strive", "command", "structure", "accomplish"],
  11: ["network", "collaborate", "envision", "contribute", "ally", "innovate", "belong to community"],
  12: ["surrender", "reflect", "transcend", "retreat", "imagine", "release", "commune with mystery"],
};

export function houseInterpretTheme(house: number): string | null {
  if (!Number.isInteger(house) || house < 1 || house > 12) return null;
  return HOUSE_INTERPRET_THEME[house] ?? null;
}

export function houseInterpretSeekVerbs(house: number): readonly string[] | null {
  if (!Number.isInteger(house) || house < 1 || house > 12) return null;
  return HOUSE_INTERPRET_SEEK_VERBS[house] ?? null;
}

/** Ordinal label for interpret copy, e.g. `7th`. */
export function formatHouseOrdinal(house: number): string | null {
  if (!Number.isInteger(house) || house < 1 || house > 12) return null;
  const suffix =
    house % 10 === 1 && house !== 11
      ? "st"
      : house % 10 === 2 && house !== 12
        ? "nd"
        : house % 10 === 3 && house !== 13
          ? "rd"
          : "th";
  return `${house}${suffix}`;
}
