import {
  bodySymbolForTileId,
  descriptorKeysForSign,
  ELEMENT_PAIR_PHRASES,
  MODE_PAIR_PHRASES,
  normalizeZodiacSign,
  signSymbolForSign,
  traitsForSign,
  type ElementDescriptorKey,
} from "./astroLexicon";
import type { ZodiacSignCardTile } from "./ZodiacSignCardsStrip";
import { formatHouseOrdinal, HOUSE_PLACEMENT_PHRASES } from "./zodiacHouseDescriptors";

export const INTERPRET_TILE_ORDER = [
  "sun",
  "moon",
  "rising",
  "mercury",
  "venus",
  "mars",
] as const;

export type InterpretWriteup = {
  planetSymbol: string | null;
  planetLabel: string;
  signSymbol: string | null;
  signName: string;
  houseOrdinal: string | null;
  /** Left column — planet domains and house emphasis. */
  planetHouseParagraphs: string[];
  /** Right callout — element and modality copy. */
  signParagraphs: string[];
  signTraitPhrases: readonly string[];
};

/** Comma-separated list with Oxford comma before the final “and”. */
export function joinEnglishList(items: readonly string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

export function signDisplayName(raw: string): string {
  const k = normalizeZodiacSign(raw);
  if (!k) {
    const t = raw.trim();
    return t ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : raw;
  }
  return k.charAt(0).toUpperCase() + k.slice(1);
}

function indefiniteArticleForElement(elementKey: ElementDescriptorKey): "a" | "an" {
  return elementKey === "air" || elementKey === "earth" ? "an" : "a";
}

function planetLabelForTile(tile: ZodiacSignCardTile): string {
  if (tile.id === "rising") return "Rising";
  return tile.label;
}

/** Procedural interpret-tab copy from a placement tile (sign, house, mode, element). */
export function buildInterpretWriteup(tile: ZodiacSignCardTile): InterpretWriteup | null {
  const signName = signDisplayName(tile.sign);
  const keys = descriptorKeysForSign(tile.sign);
  const traits = traitsForSign(tile.sign);
  if (!keys || !traits?.length) return null;

  const planet = planetLabelForTile(tile);
  const house = tile.house;
  const houseOrdinal = house != null ? formatHouseOrdinal(house) : null;
  const housePhrases =
    house != null && house >= 1 && house <= 12 ? HOUSE_PLACEMENT_PHRASES[house] : null;

  const elementArticle = indefiniteArticleForElement(keys.element);
  const elementTraits = joinEnglishList(ELEMENT_PAIR_PHRASES[keys.element]);
  const modalityVerbs = joinEnglishList(MODE_PAIR_PHRASES[keys.mode]);
  const domains = joinEnglishList(tile.bodyPhrases);
  const signAdjectives = joinEnglishList(traits);

  const planetHouseParagraphs: string[] = [
    `Your ${domains} are ${signAdjectives}.`,
  ];

  if (houseOrdinal != null && housePhrases?.length) {
    planetHouseParagraphs.push(
      `This ${signName} ${planet} influence is especially felt in matters of the ${houseOrdinal} house: ${joinEnglishList(housePhrases)}.`,
    );
  }

  const signParagraphs = [
    `As ${elementArticle} ${keys.element} sign, ${signName} brings an emphasis on ${elementTraits}.`,
    `As a ${keys.mode} sign, ${signName} influences you to ${modalityVerbs}.`,
  ];

  return {
    planetSymbol: bodySymbolForTileId(tile.id),
    planetLabel: planet,
    signSymbol: signSymbolForSign(tile.sign),
    signName,
    houseOrdinal,
    planetHouseParagraphs,
    signParagraphs,
    signTraitPhrases: traits,
  };
}

export function interpretTilesInOrder(tiles: ZodiacSignCardTile[]): ZodiacSignCardTile[] {
  const byId = new Map(tiles.map((t) => [t.id, t]));
  return INTERPRET_TILE_ORDER.map((id) => byId.get(id)).filter(
    (t): t is ZodiacSignCardTile => t != null,
  );
}
