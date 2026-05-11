import { BIG_THREE_BODY, PERSONAL_PLANETS_BODY } from "./astroLexicon";
import type { NatalChartPayload } from "./chartTypes";
import { isPlacementTileRetrograde } from "./zodiacPlacementFromChart";
import ZodiacSignCardsStrip, { type ZodiacSignCardTile } from "./ZodiacSignCardsStrip";

export type ZodiacOverviewTileSource = {
  sunSign: string;
  moonSign: string;
  risingSign: string;
  mercurySign?: string | null;
  venusSign?: string | null;
  marsSign?: string | null;
  /** When set, retrograde state is copied onto planet tiles. */
  natalChart?: NatalChartPayload | null;
};

/** Big three plus Mercury / Venus / Mars when all three signs exist on the chart — one unified grid. */
export function buildZodiacOverviewTiles(props: ZodiacOverviewTileSource): ZodiacSignCardTile[] {
  const chart = props.natalChart ?? null;
  const retro = (id: string) =>
    chart && isPlacementTileRetrograde(id, chart) ? ({ retrograde: true as const } as const) : {};

  const tiles: ZodiacSignCardTile[] = [
    {
      id: "sun",
      label: BIG_THREE_BODY.sun.label,
      sign: props.sunSign,
      bodyHeading: BIG_THREE_BODY.sun.bodyHeading,
      bodyPhrases: BIG_THREE_BODY.sun.bodyPhrases,
      ...retro("sun"),
    },
    {
      id: "moon",
      label: BIG_THREE_BODY.moon.label,
      sign: props.moonSign,
      bodyHeading: BIG_THREE_BODY.moon.bodyHeading,
      bodyPhrases: BIG_THREE_BODY.moon.bodyPhrases,
      ...retro("moon"),
    },
    {
      id: "rising",
      label: BIG_THREE_BODY.rising.label,
      sign: props.risingSign,
      bodyHeading: BIG_THREE_BODY.rising.bodyHeading,
      bodyPhrases: BIG_THREE_BODY.rising.bodyPhrases,
    },
  ];

  const merc = props.mercurySign?.trim();
  const ven = props.venusSign?.trim();
  const mar = props.marsSign?.trim();
  if (merc && ven && mar) {
    tiles.push(
      {
        id: "mercury",
        label: PERSONAL_PLANETS_BODY.mercury.label,
        sign: merc,
        bodyHeading: PERSONAL_PLANETS_BODY.mercury.bodyHeading,
        bodyPhrases: PERSONAL_PLANETS_BODY.mercury.bodyPhrases,
        ...retro("mercury"),
      },
      {
        id: "venus",
        label: PERSONAL_PLANETS_BODY.venus.label,
        sign: ven,
        bodyHeading: PERSONAL_PLANETS_BODY.venus.bodyHeading,
        bodyPhrases: PERSONAL_PLANETS_BODY.venus.bodyPhrases,
        ...retro("venus"),
      },
      {
        id: "mars",
        label: PERSONAL_PLANETS_BODY.mars.label,
        sign: mar,
        bodyHeading: PERSONAL_PLANETS_BODY.mars.bodyHeading,
        bodyPhrases: PERSONAL_PLANETS_BODY.mars.bodyPhrases,
        ...retro("mars"),
      },
    );
  }

  return tiles;
}

export default function ZodiacOverviewCardsStrip(
  props: ZodiacOverviewTileSource & { onTileOpen?: (tile: ZodiacSignCardTile) => void },
) {
  const tiles = buildZodiacOverviewTiles(props);

  return (
    <ZodiacSignCardsStrip
      tiles={tiles}
      gridColumns={{ base: 2, md: 3 }}
      onTileOpen={props.onTileOpen}
    />
  );
}
