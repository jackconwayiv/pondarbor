import { BIG_THREE_BODY, PERSONAL_PLANETS_BODY } from "./astroLexicon";
import type { NatalChartPayload } from "./chartTypes";
import type { ZodiacSignCardTile } from "./ZodiacSignCardsStrip";

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
  };
}
