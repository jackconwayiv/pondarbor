import { interpretPlacementBodyForTileId } from "./astroLexicon";
import { placementTileIdFromAspectBody } from "./zodiacAspectFilters";

/**
 * Core life functions for chart bodies — aspect-agnostic planetary archetypes.
 * Used to label what each placement represents in pair themes and fallback copy.
 */
export type PlanetFunction = {
  noun: string;
};

const PLANET_FUNCTIONS: Record<string, PlanetFunction> = {
  sun: { noun: "identity" },
  moon: { noun: "emotions" },
  mercury: { noun: "communication" },
  venus: { noun: "relating" },
  mars: { noun: "action" },
  jupiter: { noun: "growth" },
  saturn: { noun: "structure" },
  uranus: { noun: "change" },
  neptune: { noun: "imagination" },
  pluto: { noun: "transformation" },
  ascendant: { noun: "persona" },
  midheaven: { noun: "public life" },
};

/** Sorted body keys joined with `|` for pair lookup. */
export function canonicalPairKey(bodyA: string, bodyB: string): string {
  return [bodyA, bodyB].sort().join("|");
}

/**
 * What two placements link in the chart — independent of aspect type.
 * Harmonious vs challenging framing lives in `zodiacAspectCopy.ts` per aspect.
 */
const ASPECT_PAIR_THEMES: Record<string, string> = {
  // anchor × anchor (21)
  "ascendant|mars": "persona and action",
  "ascendant|mercury": "persona and communication",
  "ascendant|midheaven": "persona and public life",
  "ascendant|moon": "persona and emotions",
  "ascendant|sun": "persona and identity",
  "ascendant|venus": "persona and relating",
  "mars|mercury": "action and communication",
  "mars|midheaven": "action and public life",
  "mars|moon": "emotions and action",
  "mars|sun": "identity and action",
  "mars|venus": "desire and relating",
  "mercury|midheaven": "communication and public life",
  "mercury|moon": "emotions and communication",
  "mercury|sun": "identity and communication",
  "mercury|venus": "communication and relating",
  "midheaven|moon": "emotions and public life",
  "midheaven|sun": "identity and public life",
  "midheaven|venus": "relating and public life",
  "moon|sun": "identity and emotions",
  "moon|venus": "emotions and relating",
  "sun|venus": "identity and relating",

  // anchor × outer — ascendant (5)
  "ascendant|jupiter": "persona and growth",
  "ascendant|saturn": "persona and structure",
  "ascendant|uranus": "persona and change",
  "ascendant|neptune": "persona and imagination",
  "ascendant|pluto": "persona and transformation",

  // anchor × outer — mars (5)
  "jupiter|mars": "action and growth",
  "mars|saturn": "action and structure",
  "mars|uranus": "action and change",
  "mars|neptune": "action and imagination",
  "mars|pluto": "action and transformation",

  // anchor × outer — mercury (5)
  "jupiter|mercury": "communication and growth",
  "mercury|saturn": "communication and structure",
  "mercury|uranus": "communication and change",
  "mercury|neptune": "communication and imagination",
  "mercury|pluto": "communication and transformation",

  // anchor × outer — midheaven (5)
  "jupiter|midheaven": "growth and public life",
  "midheaven|saturn": "structure and public life",
  "midheaven|uranus": "change and public life",
  "midheaven|neptune": "imagination and public life",
  "midheaven|pluto": "transformation and public life",

  // anchor × outer — moon (5)
  "jupiter|moon": "emotions and growth",
  "moon|saturn": "emotions and structure",
  "moon|uranus": "emotions and change",
  "moon|neptune": "emotions and imagination",
  "moon|pluto": "emotions and transformation",

  // anchor × outer — sun (5)
  "jupiter|sun": "identity and growth",
  "saturn|sun": "identity and structure",
  "sun|uranus": "identity and change",
  "neptune|sun": "identity and imagination",
  "pluto|sun": "identity and transformation",

  // anchor × outer — venus (5)
  "jupiter|venus": "relating and growth",
  "saturn|venus": "relating and structure",
  "uranus|venus": "relating and change",
  "neptune|venus": "relating and imagination",
  "pluto|venus": "relating and transformation",
};

/**
 * How each body expresses effort (active pole) and influence (receptive pole)
 * in cross-placement paragraphs — aspect-agnostic; tone comes from aspect templates.
 */
const ASPECT_BODY_DYNAMIC: Record<
  string,
  { effort?: string; influence?: string; oppositionStrength?: string }
> = {
  sun: {
    effort: "express your identity and live from a clearer sense of purpose",
    influence: "confidence, vitality, and how you show up as yourself",
    oppositionStrength: "desire to express your identity and live from a clearer sense of purpose",
  },
  moon: {
    effort: "honor your feelings and emotional needs",
    influence: "inner security, comfort, and emotional well-being",
    oppositionStrength: "need to honor your feelings and emotional needs",
  },
  ascendant: {
    effort: "show up authentically and refine how you meet the world",
    influence: "first impressions, personal style, and social presence",
    oppositionStrength: "need to show up authentically and refine how you meet the world",
  },
  mercury: {
    effort: "think clearly, communicate thoughtfully, and stay curious",
    influence: "learning, conversation, and everyday decision-making",
    oppositionStrength: "desire to imagine, explore possibilities, and communicate intuitively",
  },
  venus: {
    effort: "express affection and align with what you value",
    influence: "relationships, pleasure, and sense of harmony",
    oppositionStrength: "pull toward affection, pleasure, and what you value",
  },
  mars: {
    effort: "act with courage, follow through, and assert yourself cleanly",
    influence: "drive, momentum, and how you pursue what you want",
    oppositionStrength: "impulse to act with courage, follow through, and assert yourself cleanly",
  },
  midheaven: {
    effort: "commit to your vocation and long-term direction",
    influence: "long-term ambitions, reputation, and sense of purpose",
    oppositionStrength: "focus on committing to your vocation and long-term direction",
  },
  jupiter: {
    effort: "expand your perspective and aim higher with good faith",
    influence: "growth, meaning, and openness to opportunity",
    oppositionStrength: "urge to expand your perspective and aim higher with good faith",
  },
  saturn: {
    effort: "build discipline, keep commitments, and work with limits patiently",
    influence: "structure, maturity, and what you build over time",
    oppositionStrength: "need for precision, discipline, and practical results",
  },
  uranus: {
    effort: "innovate, break stale patterns, and make room for change",
    influence: "freedom, originality, and capacity for breakthrough",
    oppositionStrength: "drive to innovate, break stale patterns, and make room for change",
  },
  neptune: {
    effort: "trust your imagination, compassion, and subtle intuition",
    influence: "creativity, spirituality, and sensitivity to what is unseen",
    oppositionStrength: "pull toward imagination, compassion, and subtle intuition",
  },
  pluto: {
    effort: "evolve, renew, or deepen your understanding of yourself",
    influence: "transformation, personal power, and psychological depth",
    oppositionStrength: "pressure to evolve, renew, or deepen your understanding of yourself",
  },
  chiron: {
    effort: "integrate what you have learned through experience",
    influence: "healing insight, mentorship, and meaningful contribution",
    oppositionStrength: "need to integrate what you have learned through experience",
  },
  north_node: {
    effort: "stretch toward unfamiliar strengths you are building over time",
    influence: "long-term growth and who you are becoming",
    oppositionStrength: "pull toward unfamiliar strengths you are building over time",
  },
  part_of_fortune: {
    effort: "follow what feels natural, nourishing, and well-timed",
    influence: "ease, flow, and embodied well-being",
    oppositionStrength: "desire to follow what feels natural, nourishing, and well-timed",
  },
};

type OppositionPairOverride = {
  conflictExtra?: string;
  integrationOutcome?: string;
};

/** Reserved pair copy; set `APPLY_OPPOSITION_PAIR_OVERRIDES` to enable. */
const APPLY_OPPOSITION_PAIR_OVERRIDES = false;

const OPPOSITION_PAIR_OVERRIDES: Record<string, OppositionPairOverride> = {
  "mercury|saturn": {
    conflictExtra:
      "At other times, a strong focus on rules, responsibilities, or criticism may limit your willingness to trust your own ideas.",
    integrationOutcome:
      "As you learn to balance imagination with discernment and intuition with practicality, your ideas gain structure while your responsibilities gain meaning.",
  },
};

export type OppositionCopySlots = {
  planetADomain: string;
  planetAStrength: string;
  planetBDomain: string;
  planetBStrength: string;
  conflictExtra?: string;
  integrationOutcome?: string;
};

export type AspectPairTheme = {
  theme: string;
};

export type AspectPairParts = {
  themeA: string;
  themeB: string;
  effort: string;
  influence: string;
};

function splitPairTheme(theme: string): [string, string] {
  const idx = theme.indexOf(" and ");
  if (idx === -1) return [theme, "integration"];
  return [theme.slice(0, idx), theme.slice(idx + 5)];
}

export function planetFunctionForBody(bodyKey: string): PlanetFunction {
  const direct = PLANET_FUNCTIONS[bodyKey];
  if (direct) return direct;

  const tileId = placementTileIdFromAspectBody(bodyKey);
  const placement = interpretPlacementBodyForTileId(tileId);
  if (placement?.bodyPhrases[0]) {
    const first = placement.bodyPhrases[0]!.split(/\s+/)[0]?.toLowerCase();
    if (first) return { noun: first };
  }
  return { noun: bodyKey.replace(/_/g, " ") };
}

export function aspectPairTheme(bodyA: string, bodyB: string): AspectPairTheme {
  const theme = ASPECT_PAIR_THEMES[canonicalPairKey(bodyA, bodyB)];
  if (theme) return { theme };

  const funcA = planetFunctionForBody(bodyA).noun;
  const funcB = planetFunctionForBody(bodyB).noun;
  return { theme: `${funcA} and ${funcB}` };
}

/** @deprecated Use `aspectPairTheme`. */
export const sextilePairTheme = aspectPairTheme;

export function oppositionStrengthPhrase(bodyKey: string): string {
  const entry = ASPECT_BODY_DYNAMIC[bodyKey];
  if (entry?.oppositionStrength) return entry.oppositionStrength;
  return `focus on ${planetFunctionForBody(bodyKey).noun}`;
}

export function oppositionCopySlots(bodyA: string, bodyB: string): OppositionCopySlots {
  const override = APPLY_OPPOSITION_PAIR_OVERRIDES
    ? OPPOSITION_PAIR_OVERRIDES[canonicalPairKey(bodyA, bodyB)]
    : undefined;
  return {
    planetADomain: planetFunctionForBody(bodyA).noun,
    planetAStrength: oppositionStrengthPhrase(bodyA),
    planetBDomain: planetFunctionForBody(bodyB).noun,
    planetBStrength: oppositionStrengthPhrase(bodyB),
    conflictExtra: override?.conflictExtra,
    integrationOutcome: override?.integrationOutcome,
  };
}

export function aspectEffortPhrase(bodyKey: string): string {
  const entry = ASPECT_BODY_DYNAMIC[bodyKey];
  if (entry?.effort) return entry.effort;
  const noun = planetFunctionForBody(bodyKey).noun;
  return `engage your ${noun} with intention and care`;
}

export function aspectInfluencePhrase(bodyKey: string): string {
  const entry = ASPECT_BODY_DYNAMIC[bodyKey];
  if (entry?.influence) return entry.influence;
  const tileId = placementTileIdFromAspectBody(bodyKey);
  const placement = interpretPlacementBodyForTileId(tileId);
  if (placement?.bodyPhrases[0]) return placement.bodyPhrases[0]!;
  return planetFunctionForBody(bodyKey).noun;
}

/** @deprecated Use `aspectEffortPhrase`. */
export const sextileEffortPhrase = aspectEffortPhrase;

/** @deprecated Use `aspectInfluencePhrase`. */
export const sextileInfluencePhrase = aspectInfluencePhrase;

export function aspectPairParts(bodyA: string, bodyB: string): AspectPairParts {
  return aspectPairPartsOrdered(bodyA, bodyB);
}

/** Pair themes with effort from the first body and influence from the second. */
export function aspectPairPartsOrdered(
  bodyFirst: string,
  bodySecond: string,
): AspectPairParts {
  const { theme } = aspectPairTheme(bodyFirst, bodySecond);
  const [themeA, themeB] = splitPairTheme(theme);
  return {
    themeA,
    themeB,
    effort: aspectEffortPhrase(bodyFirst),
    influence: aspectInfluencePhrase(bodySecond),
  };
}

export function isHandAuthoredAspectPair(bodyA: string, bodyB: string): boolean {
  return canonicalPairKey(bodyA, bodyB) in ASPECT_PAIR_THEMES;
}
