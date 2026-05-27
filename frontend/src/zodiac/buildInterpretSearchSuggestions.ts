import {
  buildHouseInterpretWriteup,
  interpretPlacementChartKey,
} from "./buildHouseInterpretWriteup";
import type { InterpretPage } from "./buildInterpretPages";
import { buildInterpretWriteup } from "./buildInterpretWriteup";
import { buildSignInterpretWriteup } from "./buildSignInterpretWriteup";
import { chartPointDisplayLabel, signDisplayName } from "./astroLexicon";
import type { NatalChartPayload } from "./chartTypes";
import { formatHouseOrdinal } from "./zodiacHouseDescriptors";

function pushUnique(out: string[], phrase: string) {
  const key = phrase.trim().toLowerCase();
  if (!key) return;
  if (out.some((existing) => existing.toLowerCase() === key)) return;
  out.push(phrase);
}

/** Lowercase search phrases aligned with links and topics on the current interpret page. */
export function buildInterpretSearchSuggestions(
  page: InterpretPage,
  chart: NatalChartPayload,
): string[] {
  const out: string[] = [];

  if (page.kind === "placement") {
    const { tile } = page;
    const signName = signDisplayName(tile.sign).toLowerCase();
    const writeup = buildInterpretWriteup(tile, chart);

    if (tile.id === "rising") {
      pushUnique(out, `${signName} rising`);
      pushUnique(out, `rising in ${signName}`);
      pushUnique(out, "1st house");
      pushUnique(out, `${signName} sign`);
    } else {
      const planet = tile.label.toLowerCase();
      pushUnique(out, `${planet} in ${signName}`);
      pushUnique(out, `${signName} sign`);

      if (tile.house != null) {
        const ord = formatHouseOrdinal(tile.house);
        if (ord) {
          pushUnique(out, `${planet} in ${ord} house`);
          pushUnique(out, `${ord} house`);
        }
      }

      if (writeup) {
        for (const ruled of writeup.housesRuled) {
          const ruledOrd = formatHouseOrdinal(ruled.house);
          if (!ruledOrd) continue;
          pushUnique(out, `${ruledOrd} house`);
          pushUnique(out, `${planet} rules ${ruledOrd} house`);
        }
      }
    }
    return out;
  }

  if (page.kind === "house") {
    const writeup = buildHouseInterpretWriteup(page.house, chart);
    if (!writeup) return out;

    const ord = formatHouseOrdinal(page.house);
    if (ord) pushUnique(out, `${ord} house`);

    if (writeup.cuspSign && ord) {
      const cuspName = signDisplayName(writeup.cuspSign).toLowerCase();
      pushUnique(out, `${cuspName} on ${ord} house cusp`);
    }

    for (const link of writeup.rulerSignLinks) {
      if (link.placementChartKey) {
        const label = chartPointDisplayLabel(
          interpretPlacementChartKey(link.placementChartKey),
        ).toLowerCase();
        const rulerSign = signDisplayName(link.sign).toLowerCase();
        pushUnique(out, `${label} in ${rulerSign}`);
      } else {
        pushUnique(out, `${signDisplayName(link.sign).toLowerCase()} sign`);
      }
    }

    for (const occ of writeup.occupants) {
      pushUnique(out, `${occ.label.toLowerCase()} in ${occ.signName.toLowerCase()}`);
    }
    return out;
  }

  const signName = signDisplayName(page.sign).toLowerCase();
  pushUnique(out, signName);
  pushUnique(out, `${signName} sign`);

  const writeup = buildSignInterpretWriteup(page.sign, chart);
  if (!writeup) return out;

  for (const ruled of writeup.ruledHouses) {
    const ord = formatHouseOrdinal(ruled.house);
    if (ord) pushUnique(out, `${signName} on ${ord} house cusp`);
  }

  for (const occ of writeup.occupants) {
    pushUnique(out, `${occ.label.toLowerCase()} in ${signName}`);
  }

  return out;
}
