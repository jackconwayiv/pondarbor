/** Glyph character creation — ids are emoji strings; must match backend `qff.glyph_class_map`. */

export type GlyphId = "⚔️" | "🔑" | "📖" | "❤️‍🩹";

export const GLYPH_IDS: GlyphId[] = ["⚔️", "🔑", "📖", "❤️‍🩹"];

export const GLYPH_DISPLAY: Record<
  GlyphId,
  { emoji: string; bannerLabel: string; tooltip: string }
> = {
  "⚔️": {
    emoji: "⚔️",
    bannerLabel: "BRAWLER",
    tooltip: "A fighter of alien invaders and rebellious robots.",
  },
  "🔑": {
    emoji: "🔑",
    bannerLabel: "SCAVENGER",
    tooltip: "A rogue with stealthy skills to fend for yourself.",
  },
  "📖": {
    emoji: "📖",
    bannerLabel: "OCCULTIST",
    tooltip: "A scholar of lost knowledge and magical power.",
  },
  "❤️‍🩹": {
    emoji: "❤️‍🩹",
    bannerLabel: "MENDER",
    tooltip: "A caretaker, steward, and fixer of the broken world.",
  },
};

const GLYPH_TO_SLUG: Record<GlyphId, string> = {
  "⚔️": "brawler",
  "🔑": "scavenger",
  "📖": "occultist",
  "❤️‍🩹": "mender",
};

export function classSlugForGlyph(g1: GlyphId): string | undefined {
  return GLYPH_TO_SLUG[g1];
}

/** Long-form class blurbs for the summary step (hard-coded; not loaded from the API). */
export const CLASS_SUMMARY_BY_SLUG: Record<string, { name: string; description: string }> = {
  brawler: {
    name: "Brawler",
    description: "A fighter of alien invaders and rebellious robots.",
  },
  scavenger: {
    name: "Scavenger",
    description: "A rogue with stealthy skills to fend for yourself.",
  },
  occultist: {
    name: "Occultist",
    description: "A scholar of lost knowledge and magical power.",
  },
  mender: {
    name: "Mender",
    description: "A caretaker, steward, and fixer of the broken world.",
  },
};
