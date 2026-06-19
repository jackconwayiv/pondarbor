import { bodySymbolForTileId, signDisplayName, signSymbolForSign } from "./astroLexicon";
import { aspectTypeLabel, ASPECT_TYPE_COPY, type AspectTypeKey } from "./zodiacAspectCopy";
import { buildAspectInterpretWriteup } from "./buildAspectInterpretWriteup";
import { buildHouseInterpretWriteup } from "./buildHouseInterpretWriteup";
import { buildInterpretPlacementTiles } from "./buildInterpretWriteup";
import { buildSignInterpretWriteup } from "./buildSignInterpretWriteup";
import type { NatalChartPayload } from "./chartTypes";
import type { ZodiacSignCardTile } from "./ZodiacSignCardsStrip";
import { interpretSubTabSelectedColors, signCardAccent } from "./signCardAccent";
import { filterAspectsForInterpret, type ChartAspectRow } from "./zodiacAspectFilters";
import { formatHouseRoman } from "./zodiacHouseDescriptors";
import { normalizedAspectFocus } from "./zodiacChartFocus";

export type InterpretPlacementPage = {
  kind: "placement";
  tile: ZodiacSignCardTile;
};

export type InterpretHousePage = {
  kind: "house";
  house: number;
};

export type InterpretSignPage = {
  kind: "sign";
  sign: string;
};

export type InterpretAspectPage = {
  kind: "aspect";
  aspect: ChartAspectRow;
};

export type InterpretPage =
  | InterpretPlacementPage
  | InterpretHousePage
  | InterpretSignPage
  | InterpretAspectPage;

export type InterpretSectionId = "planets" | "houses" | "signs" | "aspects";

export function interpretPageSection(page: InterpretPage): InterpretSectionId {
  if (page.kind === "placement") return "planets";
  if (page.kind === "house") return "houses";
  if (page.kind === "aspect") return "aspects";
  return "signs";
}

export type InterpretSectionNav = {
  id: InterpretSectionId;
  label: string;
  startIndex: number;
};

/** First page index per interpret section (only sections present in `pages`). */
export function buildInterpretSectionNav(pages: readonly InterpretPage[]): InterpretSectionNav[] {
  const out: InterpretSectionNav[] = [];
  const planetsIdx = pages.findIndex((p) => p.kind === "placement");
  if (planetsIdx >= 0) {
    out.push({ id: "planets", label: "Planets", startIndex: planetsIdx });
  }
  const housesIdx = pages.findIndex((p) => p.kind === "house");
  if (housesIdx >= 0) {
    out.push({ id: "houses", label: "Houses", startIndex: housesIdx });
  }
  const signsIdx = pages.findIndex((p) => p.kind === "sign");
  if (signsIdx >= 0) {
    out.push({ id: "signs", label: "Signs", startIndex: signsIdx });
  }
  const aspectsIdx = pages.findIndex((p) => p.kind === "aspect");
  if (aspectsIdx >= 0) {
    out.push({ id: "aspects", label: "Aspects", startIndex: aspectsIdx });
  }
  return out;
}

export function buildInterpretPages(
  chart: NatalChartPayload,
  options: { includeHouses: boolean; includeRising: boolean },
): InterpretPage[] {
  const pages: InterpretPage[] = buildInterpretPlacementTiles(chart, {
    includeRising: options.includeRising,
  }).map((tile) => ({
    kind: "placement" as const,
    tile,
  }));

  if (options.includeHouses) {
    for (let house = 1; house <= 12; house += 1) {
      pages.push({ kind: "house", house });
    }
  }

  const allSigns = [
    "aries",
    "taurus",
    "gemini",
    "cancer",
    "leo",
    "virgo",
    "libra",
    "scorpio",
    "sagittarius",
    "capricorn",
    "aquarius",
    "pisces",
  ] as const;

  for (const sign of allSigns) {
    const writeup = buildSignInterpretWriteup(sign, chart);
    if (!writeup) continue;
    if (writeup.ruledHouses.length === 0 && writeup.occupants.length === 0) continue;
    pages.push({ kind: "sign", sign });
  }

  const aspects = filterAspectsForInterpret(chart.aspects, {
    birthTimeUnknown: !options.includeRising,
  });
  for (const aspect of aspects) {
    if (!buildAspectInterpretWriteup(aspect, chart)) continue;
    pages.push({ kind: "aspect", aspect });
  }

  return pages;
}

/** Page index for a placement interpret page, or null if not in the pager. */
export function interpretPlacementPageIndex(
  pages: InterpretPage[],
  chartKey: string,
): number | null {
  const idx = pages.findIndex((p) => p.kind === "placement" && p.tile.id === chartKey);
  return idx >= 0 ? idx : null;
}

/** Page index for a house interpret page (1–12), or null if houses are not in the pager. */
export function interpretHousePageIndex(pages: InterpretPage[], house: number): number | null {
  const idx = pages.findIndex((p) => p.kind === "house" && p.house === house);
  return idx >= 0 ? idx : null;
}

/** Page index for a sign interpret page (e.g. `aries`), or null if not in the pager. */
export function interpretSignPageIndex(pages: InterpretPage[], sign: string): number | null {
  const idx = pages.findIndex((p) => p.kind === "sign" && p.sign === sign);
  return idx >= 0 ? idx : null;
}

/** Page index for an aspect interpret page, or null if not in the pager. */
export function interpretAspectPageIndex(
  pages: InterpretPage[],
  aspect: ChartAspectRow,
): number | null {
  const focus = normalizedAspectFocus(aspect.body_a, aspect.body_b, aspect.type);
  const idx = pages.findIndex((p) => {
    if (p.kind !== "aspect") return false;
    const other = normalizedAspectFocus(p.aspect.body_a, p.aspect.body_b, p.aspect.type);
    return (
      other.bodyLo === focus.bodyLo &&
      other.bodyHi === focus.bodyHi &&
      other.type === focus.type
    );
  });
  return idx >= 0 ? idx : null;
}

export function interpretPageLabel(
  page: InterpretPage,
  chart: NatalChartPayload,
): string {
  if (page.kind === "placement") return page.tile.label;
  if (page.kind === "sign") return signDisplayName(page.sign);
  if (page.kind === "aspect") {
    return buildAspectInterpretWriteup(page.aspect, chart)?.title ?? aspectTypeLabel(page.aspect.type);
  }
  const n = page.house;
  const suffix =
    n % 10 === 1 && n % 100 !== 11
      ? "st"
      : n % 10 === 2 && n % 100 !== 12
        ? "nd"
        : n % 10 === 3 && n % 100 !== 13
          ? "rd"
          : "th";
  return `${n}${suffix} House`;
}

/** Stable `Tabs.Trigger` value for a page within its section. */
export function interpretPageSubTabValue(page: InterpretPage): string {
  if (page.kind === "placement") return page.tile.id;
  if (page.kind === "house") return `house-${page.house}`;
  if (page.kind === "aspect") {
    const focus = normalizedAspectFocus(page.aspect.body_a, page.aspect.body_b, page.aspect.type);
    return `aspect-${focus.bodyLo}-${focus.bodyHi}-${focus.type}`;
  }
  return page.sign;
}

/** Sign key driving `signCardAccent` for this page (matches interpret page chrome). */
export function interpretPageAccentSignKey(
  page: InterpretPage,
  chart: NatalChartPayload,
): string {
  if (page.kind === "placement") return page.tile.sign;
  if (page.kind === "sign") return page.sign;
  if (page.kind === "aspect") {
    return buildAspectInterpretWriteup(page.aspect, chart)?.accentSignKey ?? "aries";
  }
  return buildHouseInterpretWriteup(page.house, chart)?.cuspSign ?? "aries";
}

export type InterpretPageSubTab = {
  pageIndex: number;
  value: string;
  /** Planet/sign glyph or house roman numeral shown on the tab. */
  tabLabel: string;
  /** Full name for `aria-label` / `title` (e.g. Sun, 1st House, Leo). */
  ariaLabel: string;
  /** Selected tab fill — matches interpret page outer frame (`accent.bg`). */
  selectedBg: string;
  /** Selected tab label color — readable on `selectedBg`. */
  selectedColor: string;
  /** Selected tab outline — interpret page border accent. */
  selectedBorderColor: string;
};

/** Visible sub-tab glyph: planet symbol, house roman numeral, or sign symbol. */
export function interpretPageSubTabGlyph(page: InterpretPage, chart: NatalChartPayload): string {
  if (page.kind === "placement") {
    return bodySymbolForTileId(page.tile.id) ?? page.tile.label;
  }
  if (page.kind === "house") {
    return formatHouseRoman(page.house) ?? String(page.house);
  }
  if (page.kind === "aspect") {
    const typeCopy = ASPECT_TYPE_COPY[page.aspect.type as AspectTypeKey];
    return typeCopy ? `${typeCopy.angleDeg}°` : "°";
  }
  return signSymbolForSign(page.sign) ?? interpretPageLabel(page, chart);
}

/** Sub-tabs for one section (planets, houses, or signs), in pager order. */
export function buildInterpretPageSubTabs(
  pages: readonly InterpretPage[],
  sectionId: InterpretSectionId,
  chart: NatalChartPayload,
): InterpretPageSubTab[] {
  const out: InterpretPageSubTab[] = [];
  pages.forEach((p, pageIndex) => {
    if (interpretPageSection(p) !== sectionId) return;
    const accent = signCardAccent(interpretPageAccentSignKey(p, chart));
    const selected = interpretSubTabSelectedColors(accent);
    out.push({
      pageIndex,
      value: interpretPageSubTabValue(p),
      tabLabel: interpretPageSubTabGlyph(p, chart),
      ariaLabel: interpretPageLabel(p, chart),
      selectedBg: selected.bg,
      selectedColor: selected.color,
      selectedBorderColor: selected.borderColor,
    });
  });
  return out;
}
