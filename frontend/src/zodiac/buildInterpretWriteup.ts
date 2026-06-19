import {
  bodySymbolForTileId,
  descriptorKeysForSign,
  ELEMENT_DESCRIPTOR_LABEL,
  type ElementDescriptorKey,
  interpretPlacementBodyForTileId,
  MODE_DESCRIPTOR_LABEL,
  type ModeDescriptorKey,
  signDisplayName,
  signSymbolForSign,
  traitsForSign,
} from "./astroLexicon";
import type { NatalChartPayload } from "./chartTypes";
import type { ZodiacSignCardTile } from "./ZodiacSignCardsStrip";
import {
  houseOnTile,
  isPlacementTileRetrograde,
} from "./zodiacPlacementFromChart";
import { housesRuledByPlacement } from "./buildHouseInterpretWriteup";
import { formatHouseOrdinal, HOUSE_PLACEMENT_PHRASES } from "./zodiacHouseDescriptors";

export const INTERPRET_TILE_ORDER = [
  "sun",
  "moon",
  "rising",
  "mercury",
  "venus",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
  "pluto",
  "midheaven",
  "chiron",
  "north_node",
  "part_of_fortune",
] as const;

export type InterpretPlanetDomainsLead = {
  /** Placement body from the page heading (Sun, Moon, Rising, …). */
  placementPlanet: string;
  signName: string;
  isRising: boolean;
  isMidheaven: boolean;
  domainPhrases: readonly string[];
  adjectivePhrases: readonly string[];
};

export type InterpretWriteup = {
  planetSymbol: string | null;
  planetLabel: string;
  signSymbol: string | null;
  signName: string;
  houseOrdinal: string | null;
  /** True when this placement is retrograde in the member's chart (interpret tab only). */
  retrograde: boolean;
  /** Left column — “With your … in …, your … manifest as …”. */
  planetDomainsLead: InterpretPlanetDomainsLead;
  /** Left column — house emphasis; links to that house's interpret page when present. */
  houseFollowUp: { house: number; text: string } | null;
  /** Houses this body rules as lord of the sign on the cusp (modern rulers). */
  housesRuled: { house: number; cuspSign: string; text: string }[];
  /** Right callout — modality, element, verbs, and element descriptors in one sentence. */
  signCalloutParagraph: string;
  /** Right callout chips — per-sign adjectives (`SIGN_TRAITS`). */
  signAdjectivePhrases: readonly string[];
};

/** Comma-separated list with Oxford comma before the final “and”. */
export function joinEnglishList(items: readonly string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function planetLabelForTile(tile: ZodiacSignCardTile): string {
  if (tile.id === "rising") return "Rising";
  if (tile.id === "midheaven") return "Midheaven";
  return tile.label;
}

/** Readable mode/element clauses for sign callouts (not raw verb lists from `MODE_PAIR_PHRASES`). */
const SIGN_CALLOUT_MODE: Record<ModeDescriptorKey, string> = {
  cardinal: "initiative and forward motion",
  fixed: "steadiness and depth",
  mutable: "adaptability, change, and flexibility",
};

const SIGN_CALLOUT_ELEMENT: Record<ElementDescriptorKey, string> = {
  fire: "passion, courage, and drive",
  earth: "practicality, patience, and tangible results",
  air: "ideas, communication, and curiosity",
  water: "emotion, intuition, and empathy",
};

/** Modality + element callout shared by placement sign cards and sign interpret pages. */
export function buildSignCalloutParagraph(signKey: string): string | null {
  const signName = signDisplayName(signKey);
  const keys = descriptorKeysForSign(signKey);
  if (!keys) return null;

  const modeLabel = MODE_DESCRIPTOR_LABEL[keys.mode];
  const elementLabel = ELEMENT_DESCRIPTOR_LABEL[keys.element];
  const modeClause = SIGN_CALLOUT_MODE[keys.mode];
  const elementClause = SIGN_CALLOUT_ELEMENT[keys.element];
  const traits = traitsForSign(signKey);

  if (!traits?.length) {
    return `${signName} is a ${modeLabel} ${elementLabel} sign, with ${modeClause} expressed through ${elementClause}.`;
  }

  const traitPhrase = joinEnglishList(traits.slice(0, 4));
  return `${signName} is a ${modeLabel} ${elementLabel} sign—often ${traitPhrase}, with ${modeClause} expressed through ${elementClause}.`;
}

/** Procedural interpret-tab copy from a placement tile (sign, house, mode, element). */
export function buildInterpretWriteup(
  tile: ZodiacSignCardTile,
  chart: NatalChartPayload,
): InterpretWriteup | null {
  const signName = signDisplayName(tile.sign);
  const keys = descriptorKeysForSign(tile.sign);
  const traits = traitsForSign(tile.sign);
  if (!keys || !traits?.length) return null;

  const planet = planetLabelForTile(tile);
  const house = tile.house;
  const houseOrdinal = house != null ? formatHouseOrdinal(house) : null;
  const housePhrases =
    house != null && house >= 1 && house <= 12 ? HOUSE_PLACEMENT_PHRASES[house] : null;

  const signCalloutParagraph = buildSignCalloutParagraph(tile.sign);
  if (!signCalloutParagraph) return null;

  let houseFollowUp: { house: number; text: string } | null = null;
  if (tile.id === "rising") {
    const traitPhrase = joinEnglishList(traits);
    houseFollowUp = {
      house: 1,
      text: `Your Rising sign or Ascendant is the sign on your 1st House cusp—the one ascending over the eastern horizon at your birth. ${signName} Rising gives the impression of someone who is ${traitPhrase}.`,
    };
  } else if (tile.id === "midheaven") {
    const traitPhrase = joinEnglishList(traits);
    houseFollowUp = {
      house: 10,
      text: `Your Midheaven or MC is the sign at the top of your chart—the cusp of your 10th House. ${signName} Midheaven shapes how you meet the world through career and public life, giving a ${traitPhrase} cast to your reputation and ambitions.`,
    };
  } else if (house != null && houseOrdinal != null && housePhrases?.length) {
    const houseThemes = joinEnglishList(housePhrases);
    const text = `Your ${planet} in ${signName} directs its energy into the ${houseOrdinal} House with a focus on ${houseThemes}.`;
    houseFollowUp = { house, text };
  }

  const displayHouseOrdinal =
    tile.id === "rising" || tile.id === "midheaven" ? null : houseOrdinal;

  return {
    planetSymbol: bodySymbolForTileId(tile.id),
    planetLabel: planet,
    signSymbol: signSymbolForSign(tile.sign),
    signName,
    houseOrdinal: displayHouseOrdinal,
    retrograde: isPlacementTileRetrograde(tile.id, chart),
    planetDomainsLead: {
      placementPlanet: planet,
      signName,
      isRising: tile.id === "rising",
      isMidheaven: tile.id === "midheaven",
      domainPhrases: tile.bodyPhrases,
      adjectivePhrases: traits,
    },
    houseFollowUp,
    housesRuled: housesRuledByPlacement(chart, tile.id),
    signCalloutParagraph,
    signAdjectivePhrases: traits,
  };
}

/** Plain-text placement lead paragraph (matches `InterpretPlanetDomainsLeadText` on placement pages). */
export function formatPlanetDomainsLeadText(lead: InterpretPlanetDomainsLead): string {
  const domains = joinEnglishList(lead.domainPhrases);
  const adjectives = joinEnglishList(lead.adjectivePhrases);
  if (lead.isRising) {
    return `With ${lead.signName} Rising, your ${domains} manifest as ${adjectives}.`;
  }
  if (lead.isMidheaven) {
    return `With ${lead.signName} Midheaven, your ${domains} manifest as ${adjectives}.`;
  }
  return `With your ${lead.placementPlanet} in ${lead.signName}, your ${domains} manifest as ${adjectives}.`;
}

export function interpretPlacementTileForId(
  tileId: string,
  chart: NatalChartPayload,
): ZodiacSignCardTile | null {
  if (!(INTERPRET_TILE_ORDER as readonly string[]).includes(tileId)) return null;
  return interpretTileFromChart(tileId as (typeof INTERPRET_TILE_ORDER)[number], chart);
}

/** Full placement-page lead copy for a chart-backed interpret tile id (`pluto`, `rising`, …). */
export function interpretPlacementLeadSummaryForTileId(
  tileId: string,
  chart: NatalChartPayload,
): {
  chartKey: string;
  label: string;
  sign: string;
  signName: string;
  summary: string;
} | null {
  const tile = interpretPlacementTileForId(tileId, chart);
  if (!tile) return null;
  const writeup = buildInterpretWriteup(tile, chart);
  if (!writeup) return null;
  return {
    chartKey: tile.id,
    label: writeup.planetLabel,
    sign: tile.sign,
    signName: writeup.signName,
    summary: formatPlanetDomainsLeadText(writeup.planetDomainsLead),
  };
}

export function interpretTilesInOrder(tiles: ZodiacSignCardTile[]): ZodiacSignCardTile[] {
  const byId = new Map(tiles.map((t) => [t.id, t]));
  return INTERPRET_TILE_ORDER.map((id) => byId.get(id)).filter(
    (t): t is ZodiacSignCardTile => t != null,
  );
}

function interpretTileFromChart(
  tileId: (typeof INTERPRET_TILE_ORDER)[number],
  chart: NatalChartPayload,
): ZodiacSignCardTile | null {
  const body = interpretPlacementBodyForTileId(tileId);
  if (!body) return null;

  if (tileId === "rising") {
    const sign = chart.angles.ascendant?.sign;
    if (!sign) return null;
    return {
      id: "rising",
      label: body.label,
      sign,
      bodyHeading: body.bodyHeading,
      bodyPhrases: body.bodyPhrases,
      ...houseOnTile(chart, "rising"),
    };
  }

  if (tileId === "midheaven") {
    const sign = chart.angles.midheaven?.sign;
    if (!sign) return null;
    return {
      id: "midheaven",
      label: body.label,
      sign,
      bodyHeading: body.bodyHeading,
      bodyPhrases: body.bodyPhrases,
      ...houseOnTile(chart, "midheaven"),
    };
  }

  const sign = chart.points[tileId]?.sign;
  if (!sign) return null;
  return {
    id: tileId,
    label: body.label,
    sign,
    bodyHeading: body.bodyHeading,
    bodyPhrases: body.bodyPhrases,
    ...houseOnTile(chart, tileId),
  };
}

/** Placement tiles for the interpret pager (chart-backed; not limited to overview cards). */
export function buildInterpretPlacementTiles(
  chart: NatalChartPayload,
  options: { includeRising: boolean },
): ZodiacSignCardTile[] {
  const ids = INTERPRET_TILE_ORDER.filter((id) => {
    if (id === "rising" || id === "midheaven") return options.includeRising;
    return true;
  });
  return ids
    .map((id) => interpretTileFromChart(id, chart))
    .filter((t): t is ZodiacSignCardTile => t != null);
}
