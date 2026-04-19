/** Glyph character creation — canonical ids match backend `qff.glyph_class_map`. */

export type GlyphId = "war" | "survival" | "study" | "devotion";

export const GLYPH_IDS: GlyphId[] = ["war", "survival", "study", "devotion"];

export const GLYPH_DISPLAY: Record<
  GlyphId,
  { emoji: string; step1Label: string; step2Label: string; tooltip: string }
> = {
  war: {
    emoji: "⚔️",
    step1Label: "WAR",
    step2Label: "COMBAT",
    tooltip:
      "Grants access to heavier weapons and armor, and improves your ability to deal physical damage.",
  },
  survival: {
    emoji: "🪶",
    step1Label: "SURVIVAL",
    step2Label: "FINESSE",
    tooltip:
      "Improves stealth, dodging, and initiative, and grants access to light finesse weapons.",
  },
  study: {
    emoji: "📖",
    step1Label: "STUDY",
    step2Label: "MAGIC",
    tooltip:
      "Improves your knowledge of foes and magic items, and grants access to damaging magic spells.",
  },
  devotion: {
    emoji: "🕯️",
    step1Label: "DEVOTION",
    step2Label: "SERVICE",
    tooltip:
      "Grants access to supportive magic spells, and heightens your awareness of your surroundings.",
  },
};

/** Ordered pair → CharacterClass slug (same as backend `GLYPH_PAIR_TO_SLUG`). */
const PAIR_KEY = (a: GlyphId, b: GlyphId) => `${a}|${b}`;

const GLYPH_PAIR_TO_SLUG: Record<string, string> = {
  [PAIR_KEY("war", "war")]: "bulwark",
  [PAIR_KEY("survival", "survival")]: "scoundrel",
  [PAIR_KEY("study", "study")]: "magister",
  [PAIR_KEY("devotion", "devotion")]: "devotee",
  [PAIR_KEY("war", "survival")]: "skirmisher",
  [PAIR_KEY("survival", "war")]: "wayfarer",
  [PAIR_KEY("war", "study")]: "savant",
  [PAIR_KEY("study", "war")]: "spellblade",
  [PAIR_KEY("war", "devotion")]: "warden",
  [PAIR_KEY("devotion", "war")]: "champion",
  [PAIR_KEY("survival", "study")]: "virtuoso",
  [PAIR_KEY("study", "survival")]: "tinker",
  [PAIR_KEY("survival", "devotion")]: "firebrand",
  [PAIR_KEY("devotion", "survival")]: "seeker",
  [PAIR_KEY("study", "devotion")]: "physicker",
  [PAIR_KEY("devotion", "study")]: "visionary",
};

export function classSlugForGlyphs(g1: GlyphId, g2: GlyphId): string | undefined {
  return GLYPH_PAIR_TO_SLUG[PAIR_KEY(g1, g2)];
}

/** Long-form class blurbs for the summary step (hard-coded; not loaded from the API). */
export const CLASS_SUMMARY_BY_SLUG: Record<string, { name: string; description: string }> = {
  bulwark: {
    name: "Bulwark",
    description:
      "A brutal frontliner who overwhelms enemies with sheer force, heavy armor, and relentless pressure.",
  },
  scoundrel: {
    name: "Scoundrel",
    description:
      "A stealthy finesse fighter who relies on speed, evasion, and quick strikes.",
  },
  magister: {
    name: "Magister",
    description: "A dedicated spellcaster focused on magical damage and arcane knowledge.",
  },
  devotee: {
    name: "Devotee",
    description:
      "A supportive mystic focused on awareness, protection, and sustaining magic.",
  },
  skirmisher: {
    name: "Skirmisher",
    description:
      "A fast, aggressive fighter who blends force with mobility and precision.",
  },
  wayfarer: {
    name: "Wayfarer",
    description:
      "A capable survivor who combines martial skill with adaptability and awareness.",
  },
  savant: {
    name: "Savant",
    description: "A battle-mage who pairs physical force with destructive magic.",
  },
  spellblade: {
    name: "Spellblade",
    description:
      "A close-range combatant who combines weapon skill with offensive spells.",
  },
  warden: {
    name: "Warden",
    description:
      "A durable protector who mixes martial strength with awareness and support magic.",
  },
  champion: {
    name: "Champion",
    description:
      "A devoted frontliner who holds the line, absorbs pressure, and rallies those beside them.",
  },
  virtuoso: {
    name: "Virtuoso",
    description:
      "A clever arcane duelist who uses finesse, precision, and magical control.",
  },
  tinker: {
    name: "Tinker",
    description:
      "A nimble problem-solver who mixes practical knowledge, quick hands, and magic.",
  },
  firebrand: {
    name: "Firebrand",
    description:
      "A swift zealot who fights with speed, conviction, and relentless pressure.",
  },
  seeker: {
    name: "Seeker",
    description: "An alert scout who uses finesse and awareness to pursue hidden things.",
  },
  physicker: {
    name: "Physicker",
    description:
      "A healer and support caster with deep practical and magical knowledge.",
  },
  visionary: {
    name: "Visionary",
    description:
      "An insightful mystic who blends devotion, knowledge, and supernatural perception.",
  },
};
