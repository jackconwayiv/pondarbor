export const ASPECT_TYPE_COPY = {
  conjunction: {
    label: "Conjunction",
    angleDeg: 0,
    relationshipVerb: "merges with",
    outcomeLead: "These energies become closely intertwined and often operate as a unified force.",
    opportunityLine: "This conjunction blends these placements into a single focal point.",
    traitCap: 2,
    domainCap: 1,
  },
  sextile: {
    label: "Sextile",
    angleDeg: 60,
    relationshipVerb: "supports",
    outcomeLead: "Growth comes through consciously combining these energies.",
    opportunityLine: "This sextile provides you with an opportunity for growth.",
    traitCap: 2,
    domainCap: 1,
  },
  trine: {
    label: "Trine",
    angleDeg: 120,
    relationshipVerb: "aligns with",
    outcomeLead: "These energies tend to support and strengthen one another naturally.",
    opportunityLine: "This trine allows these qualities to flow together with ease.",
    traitCap: 2,
    domainCap: 1,
  },
  square: {
    label: "Square",
    angleDeg: 90,
    relationshipVerb: "challenges",
    outcomeLead: "Growth comes through resolving tension between these energies.",
    opportunityLine: "This square creates productive friction that can sharpen both sides.",
    traitCap: 2,
    domainCap: 1,
  },
  opposition: {
    label: "Opposition",
    angleDeg: 180,
    relationshipVerb: "opposes",
    outcomeLead: "Balance comes through integrating these opposing perspectives.",
    opportunityLine: "This opposition highlights a polarity you are learning to hold in balance.",
    traitCap: 2,
    domainCap: 1,
  },
  quincunx: {
    label: "Quincunx",
    angleDeg: 150,
    relationshipVerb: "sits awkwardly with",
    outcomeLead: "Growth comes through adjusting these energies until they can work together.",
    opportunityLine: "This quincunx asks you to reconcile two areas that do not meet naturally.",
    traitCap: 2,
    domainCap: 1,
  },
} as const;

export type AspectTypeKey = keyof typeof ASPECT_TYPE_COPY;

export const INTERPRETABLE_ASPECT_TYPES: readonly AspectTypeKey[] = [
  "conjunction",
  "sextile",
  "trine",
  "square",
  "opposition",
  "quincunx",
];

export function aspectTypeLabel(type: string): string {
  const copy = ASPECT_TYPE_COPY[type as AspectTypeKey];
  if (copy) return copy.label;
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Short verb-style label for interpret aspect headings (e.g. Conjunct, not Conjunction). */
export function aspectHeadingLabel(type: string): string {
  const map: Record<AspectTypeKey, string> = {
    conjunction: "Conjunct",
    sextile: "Sextile",
    trine: "Trine",
    square: "Square",
    opposition: "Opposite",
    quincunx: "Quincunx",
  };
  return map[type as AspectTypeKey] ?? aspectTypeLabel(type);
}

/** Text-style aspect glyph for interpret UI; falls back to angle for unknown types. */
export function aspectSymbolForType(type: string): string | null {
  const text = "\uFE0E";
  const map: Record<AspectTypeKey, string> = {
    conjunction: `\u260C${text}`,
    opposition: `\u260D${text}`,
    trine: "\u25B3",
    square: "\u25A1",
    sextile: `\u26B9${text}`,
    quincunx: "150\u00B0",
  };
  const glyph = map[type as AspectTypeKey];
  if (glyph) return glyph;
  const copy = ASPECT_TYPE_COPY[type as AspectTypeKey];
  if (copy) return `${copy.angleDeg}\u00B0`;
  return null;
}

export function buildAspectPlacementPhrase(
  body: string,
  label: string,
  signName: string,
  possessive: "Your" | "your",
): string {
  if (body === "ascendant") return `${possessive} Rising in ${signName}`;
  if (body === "midheaven") return `${possessive} Midheaven in ${signName}`;
  return `${possessive} ${label} in ${signName}`;
}

export function buildAspectIntro(
  aspectType: AspectTypeKey,
  phraseA: string,
  phraseB: string,
): string {
  switch (aspectType) {
    case "conjunction":
      return `${phraseA} is conjunct ${phraseB}.`;
    case "sextile":
      return `${phraseA} forms a sextile with ${phraseB}.`;
    case "trine":
      return `${phraseA} trines ${phraseB}.`;
    case "square":
      return `${phraseA} squares ${phraseB}.`;
    case "opposition":
      return `${phraseA} opposes ${phraseB}.`;
    case "quincunx":
      return `${phraseA} forms a quincunx with ${phraseB}.`;
  }
}

export function buildAspectCooperationLine(
  adjectivesA: string,
  concernsA: string,
  relationshipVerb: string,
  adjectivesB: string,
  concernsB: string,
  aspectType?: AspectTypeKey,
): string {
  if (aspectType === "opposition") {
    return `Your ${adjectivesA} approach to ${concernsA} and your ${adjectivesB} approach to ${concernsB}.`;
  }
  return `Your ${adjectivesA} approach to ${concernsA} ${relationshipVerb} your ${adjectivesB} approach to ${concernsB}.`;
}

export function buildOppositionConflictParagraph(slots: {
  planetAStrength: string;
  planetBStrength: string;
  conflictExtra?: string;
}): string {
  const extra = slots.conflictExtra ? ` ${slots.conflictExtra}` : "";
  return `These energies may sometimes pull you in different directions. At times, your ${slots.planetAStrength} can seem at odds with your ${slots.planetBStrength}.${extra} Growth comes from recognizing the value of both perspectives.`;
}

export function buildOppositionIntegrationParagraph(slots: {
  planetADomain: string;
  planetBDomain: string;
  integrationOutcome?: string;
}): string {
  const lead =
    slots.integrationOutcome ??
    `As you develop balance between these energies, your ${slots.planetADomain} can inform your ${slots.planetBDomain}, while your ${slots.planetBDomain} provides grounding and perspective for your ${slots.planetADomain}.`;
  return `${lead} Over time, what first feels like a contradiction can become a source of greater awareness and maturity.`;
}

export function buildAspectInteractionParagraph(
  aspectType: AspectTypeKey,
  typeCopy: (typeof ASPECT_TYPE_COPY)[AspectTypeKey],
  dynamics: {
    effortFromFirst: string;
    influenceOnSecond: string;
    effortFromSecond: string;
    influenceOnFirst: string;
  },
): string {
  const { effortFromFirst, influenceOnSecond, effortFromSecond, influenceOnFirst } = dynamics;
  const lead = typeCopy.outcomeLead;

  switch (aspectType) {
    case "conjunction":
      return `${lead} When you ${effortFromFirst}, your ${influenceOnSecond} often strengthens. Likewise, when you ${effortFromSecond}, your ${influenceOnFirst} can deepen.`;
    case "sextile":
      return `${lead} When you ${effortFromFirst}, you may find new support for your ${influenceOnSecond}. Likewise, when you ${effortFromSecond}, you can strengthen your ${influenceOnFirst}.`;
    case "trine":
      return `${lead} As you ${effortFromFirst}, your ${influenceOnSecond} tend to flow more easily. Likewise, as you ${effortFromSecond}, your ${influenceOnFirst} tend to strengthen naturally.`;
    case "square":
      return `${lead} When you ${effortFromFirst}, friction around your ${influenceOnSecond} can become a source of growth. Likewise, when you ${effortFromSecond}, tension around your ${influenceOnFirst} may sharpen.`;
    case "quincunx":
      return `${lead} When you ${effortFromFirst}, you may need to reconcile this with your ${influenceOnSecond}. Likewise, when you ${effortFromSecond}, you may need to adapt around your ${influenceOnFirst}.`;
    case "opposition":
      throw new Error("Use buildOppositionConflictParagraph and buildOppositionIntegrationParagraph");
  }
}
