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
    "identity",
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
    "subconscious",
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
