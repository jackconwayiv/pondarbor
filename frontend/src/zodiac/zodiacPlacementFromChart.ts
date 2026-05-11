import { BIG_THREE_BODY, PERSONAL_PLANETS_BODY } from "./astroLexicon";
import type { NatalChartPayload } from "./chartTypes";

export const PLACEMENT_PANE_CHART_KEYS = new Set([
  "sun",
  "moon",
  "ascendant",
  "mercury",
  "venus",
  "mars",
]);

/** True when chart marks this overview/placement tile as retrograde (not ascendant). */
export function isPlacementTileRetrograde(tileId: string, chart: NatalChartPayload): boolean {
  if (tileId === "rising") return false;
  return chart.points[tileId]?.retrograde === true;
}

/** House 1–12 for overview/placement tiles from chart (Rising uses ascendant house or 1). */
export function houseForPlacementTile(tileId: string, chart: NatalChartPayload): number | null {
  if (tileId === "rising") {
    const h = chart.angles.ascendant?.house;
    if (typeof h === "number" && h >= 1 && h <= 12) return h;
    return 1;
  }
  if (
    tileId === "sun" ||
    tileId === "moon" ||
    tileId === "mercury" ||
    tileId === "venus" ||
    tileId === "mars"
  ) {
    const h = chart.points[tileId]?.house;
    if (typeof h === "number" && h >= 1 && h <= 12) return h;
    return null;
  }
  return null;
}

export function houseOnTile(chart: NatalChartPayload, tileId: string): { house: number } | object {
  const h = houseForPlacementTile(tileId, chart);
  return h != null ? { house: h } : {};
}

function retroFlag(chart: NatalChartPayload, chartKey: string): { retrograde: true } | object {
  if (chartKey === "ascendant") return {};
  return chart.points[chartKey]?.retrograde === true ? { retrograde: true as const } : {};
}

export function zodiacTileFromChartBodyKey(
  chartKey: string,
  chart: NatalChartPayload,
): ZodiacSignCardTile | null {
  if (!PLACEMENT_PANE_CHART_KEYS.has(chartKey)) return null;

  if (chartKey === "ascendant") {
    const sign = chart.angles.ascendant?.sign;
    if (!sign) return null;
    return {
      id: "rising",
      label: BIG_THREE_BODY.rising.label,
      sign,
      bodyHeading: BIG_THREE_BODY.rising.bodyHeading,
      bodyPhrases: BIG_THREE_BODY.rising.bodyPhrases,
      ...houseOnTile(chart, "rising"),
    };
  }

  if (chartKey === "sun") {
    const sign = chart.points.sun?.sign;
    if (!sign) return null;
    return {
      id: "sun",
      label: BIG_THREE_BODY.sun.label,
      sign,
      bodyHeading: BIG_THREE_BODY.sun.bodyHeading,
      bodyPhrases: BIG_THREE_BODY.sun.bodyPhrases,
      ...retroFlag(chart, "sun"),
      ...houseOnTile(chart, "sun"),
    };
  }

  if (chartKey === "moon") {
    const sign = chart.points.moon?.sign;
    if (!sign) return null;
    return {
      id: "moon",
      label: BIG_THREE_BODY.moon.label,
      sign,
      bodyHeading: BIG_THREE_BODY.moon.bodyHeading,
      bodyPhrases: BIG_THREE_BODY.moon.bodyPhrases,
      ...retroFlag(chart, "moon"),
      ...houseOnTile(chart, "moon"),
    };
  }

  const personal = PERSONAL_PLANETS_BODY[chartKey as keyof typeof PERSONAL_PLANETS_BODY];
  if (!personal) return null;
  const sign = chart.points[chartKey]?.sign;
  if (!sign) return null;

  return {
    id: chartKey,
    label: personal.label,
    sign,
    bodyHeading: personal.bodyHeading,
    bodyPhrases: personal.bodyPhrases,
    ...retroFlag(chart, chartKey),
    ...houseOnTile(chart, chartKey),
  };
}
