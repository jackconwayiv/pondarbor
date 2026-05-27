import {
  bodySymbolForTileId,
  descriptorKeysForSign,
  ELEMENT_PAIR_PHRASES,
  interpretPlacementBodyForTileId,
  MODE_PAIR_PHRASES,
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
  "chiron",
  "north_node",
  "part_of_fortune",
] as const;

export type InterpretPlanetDomainsLead = {
  /** Placement body from the page heading (Sun, Moon, Rising, …). */
  placementPlanet: string;
  signName: string;
  isRising: boolean;
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
  return tile.label;
}

/** Modality + element callout shared by placement sign cards and sign interpret pages. */
export function buildSignCalloutParagraph(signKey: string): string | null {
  const signName = signDisplayName(signKey);
  const keys = descriptorKeysForSign(signKey);
  if (!keys) return null;
  const modalityVerbs = joinEnglishList(MODE_PAIR_PHRASES[keys.mode]);
  const elementDescriptors = joinEnglishList(ELEMENT_PAIR_PHRASES[keys.element]);
  return `As a ${keys.mode} ${keys.element} sign, the ${signName} influence is to ${modalityVerbs} through ${elementDescriptors}.`;
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
  if (house != null && houseOrdinal != null && housePhrases?.length) {
    const houseThemes = joinEnglishList(housePhrases);
    const placementInSign =
      tile.id === "rising" ? `Your Rising in ${signName}` : `Your ${planet} in ${signName}`;
    const text = `${placementInSign} directs its energy into the ${houseOrdinal} House with a focus on ${houseThemes}.`;
    houseFollowUp = { house, text };
  }

  return {
    planetSymbol: bodySymbolForTileId(tile.id),
    planetLabel: planet,
    signSymbol: signSymbolForSign(tile.sign),
    signName,
    houseOrdinal,
    retrograde: isPlacementTileRetrograde(tile.id, chart),
    planetDomainsLead: {
      placementPlanet: planet,
      signName,
      isRising: tile.id === "rising",
      domainPhrases: tile.bodyPhrases,
      adjectivePhrases: traits,
    },
    houseFollowUp,
    housesRuled: housesRuledByPlacement(chart, tile.id, tile.sign),
    signCalloutParagraph,
    signAdjectivePhrases: traits,
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
  const ids = INTERPRET_TILE_ORDER.filter((id) => id !== "rising" || options.includeRising);
  return ids
    .map((id) => interpretTileFromChart(id, chart))
    .filter((t): t is ZodiacSignCardTile => t != null);
}
