/** Glyph character creation — ids are emoji strings; must match backend `qff.glyph_class_map`. */

export type GlyphId = "👽" | "🤖" | "🌡️" | "🏛️" | "🦠";

export const GLYPH_IDS: GlyphId[] = ["👽", "🤖", "🌡️", "🏛️", "🦠"];

export const GLYPH_DISPLAY: Record<
  GlyphId,
  { emoji: string; bannerLabel: string; tooltip: string }
> = {
  "👽": {
    emoji: "👽",
    bannerLabel: "ALIEN INVASION",
    tooltip:
      "You're light on your feet and adaptable to otherworldly challenges.",
  },
  "🤖": {
    emoji: "🤖",
    bannerLabel: "MACHINE REBELLION",
    tooltip:
      "You have a knack for machines, including mechanical locks and traps.",
  },
  "🌡️": {
    emoji: "🌡️",
    bannerLabel: "CLIMATE CATASTROPHE",
    tooltip:
      "You know your way around an environment of scarcity and decay.",
  },
  "🏛️": {
    emoji: "🏛️",
    bannerLabel: "COLLAPSE OF ORDER",
    tooltip:
      "You can influence people and command the attention of enemies.",
  },
  "🦠": {
    emoji: "🦠",
    bannerLabel: "GLOBAL PANDEMIC",
    tooltip:
      "Your knowledge of sickness and health makes you a natural healer.",
  },
};

/** Unordered pair → CharacterClass slug (same as backend `CLASSES_BY_PAIR`). */
function pairKey(a: GlyphId, b: GlyphId): string {
  return [a, b].sort((x, y) => x.localeCompare(y)).join("|");
}

const GLYPH_PAIR_TO_SLUG: Record<string, string> = {
  [pairKey("🏛️", "🏛️")]: "warlord",
  [pairKey("🌡️", "🌡️")]: "wastelander",
  [pairKey("👽", "👽")]: "ravager",
  [pairKey("🦠", "🦠")]: "medic",
  [pairKey("🤖", "🤖")]: "mechanist",
  [pairKey("🏛️", "🤖")]: "sentinel",
  [pairKey("🤖", "🦠")]: "splicer",
  [pairKey("🦠", "👽")]: "witness",
  [pairKey("👽", "🌡️")]: "runner",
  [pairKey("🌡️", "🏛️")]: "handler",
  [pairKey("🏛️", "🦠")]: "caretaker",
  [pairKey("🤖", "👽")]: "saboteur",
  [pairKey("🦠", "🌡️")]: "survivalist",
  [pairKey("👽", "🏛️")]: "liaison",
  [pairKey("🌡️", "🤖")]: "scavenger",
};

export function classSlugForGlyphs(g1: GlyphId, g2: GlyphId): string | undefined {
  return GLYPH_PAIR_TO_SLUG[pairKey(g1, g2)];
}

/** Long-form class blurbs for the summary step (hard-coded; not loaded from the API). */
export const CLASS_SUMMARY_BY_SLUG: Record<string, { name: string; description: string }> = {
  warlord: {
    name: "Warlord",
    description:
      "A commanding force who uses strength and presence to dominate enemies and rally allies.",
  },
  wastelander: {
    name: "Wastelander",
    description:
      "A hardened survivor who endures brutal conditions through sheer toughness and resilience.",
  },
  ravager: {
    name: "Ravager",
    description:
      "A relentless combatant who crashes into enemies and tears through them with speed and force.",
  },
  medic: {
    name: "Medic",
    description:
      "A battlefield healer who diagnoses, stabilizes, and restores allies through skill and awareness.",
  },
  mechanist: {
    name: "Mechanist",
    description:
      "A technical warrior who understands machines and dismantles them with force and precision.",
  },
  sentinel: {
    name: "Sentinel",
    description:
      "A vigilant defender who reads threats and holds the line against hostile machines.",
  },
  splicer: {
    name: "Splicer",
    description:
      "A resilient specialist who blends science and endurance to combat biological dangers.",
  },
  witness: {
    name: "Witness",
    description:
      "A survivor who has seen the truth and drives others to act through clarity and conviction.",
  },
  runner: {
    name: "Runner",
    description:
      "A mobile scout who navigates dangerous terrain and identifies threats before they strike.",
  },
  handler: {
    name: "Handler",
    description:
      "A strategic organizer who keeps allies supplied, coordinated, and ready for any challenge.",
  },
  caretaker: {
    name: "Caretaker",
    description:
      "A steady survivor who sustains and guides others through hardship with resilience and resolve.",
  },
  saboteur: {
    name: "Saboteur",
    description:
      "A precision operative who disrupts enemy systems through speed, skill, and technical insight.",
  },
  survivalist: {
    name: "Survivalist",
    description:
      "A resourceful survivor who withstands harsh environments through awareness and endurance.",
  },
  liaison: {
    name: "Liaison",
    description:
      "A cunning intermediary who moves between factions, using agility and charm to navigate danger.",
  },
  scavenger: {
    name: "Scavenger",
    description:
      "A scrappy opportunist who survives by recovering and repurposing what others leave behind.",
  },
};
