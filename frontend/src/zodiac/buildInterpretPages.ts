import { buildInterpretPlacementTiles } from "./buildInterpretWriteup";
import { buildSignInterpretWriteup } from "./buildSignInterpretWriteup";
import type { NatalChartPayload } from "./chartTypes";
import type { ZodiacSignCardTile } from "./ZodiacSignCardsStrip";

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

export type InterpretPage = InterpretPlacementPage | InterpretHousePage | InterpretSignPage;

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

export function interpretPageLabel(page: InterpretPage): string {
  if (page.kind === "placement") return page.tile.label;
  if (page.kind === "sign") return page.sign.replace(/\b\w/g, (c) => c.toUpperCase());
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
