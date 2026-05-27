import { BIG_THREE_BODY, PERSONAL_PLANETS_BODY } from "./astroLexicon";
import type { NatalChartPayload } from "./chartTypes";
import { houseOnTile } from "./zodiacPlacementFromChart";
import ZodiacSignCardsStrip, { type ZodiacSignCardTile } from "./ZodiacSignCardsStrip";

export type ZodiacOverviewTileSource = {
  sunSign: string;
  moonSign: string;
  /** Omit from the strip when empty (e.g. birth time unknown / no rising). */
  risingSign?: string | null;
  mercurySign?: string | null;
  venusSign?: string | null;
  marsSign?: string | null;
  natalChart?: NatalChartPayload | null;
};

/** Big three plus Mercury / Venus / Mars when all three signs exist on the chart — one unified grid. */
export function buildZodiacOverviewTiles(props: ZodiacOverviewTileSource): ZodiacSignCardTile[] {
  const chart = props.natalChart ?? null;
  const house = (id: string) => (chart ? houseOnTile(chart, id) : {});

  const tiles: ZodiacSignCardTile[] = [
    {
      id: "sun",
      label: BIG_THREE_BODY.sun.label,
      sign: props.sunSign,
      bodyHeading: BIG_THREE_BODY.sun.bodyHeading,
      bodyPhrases: BIG_THREE_BODY.sun.bodyPhrases,
      ...house("sun"),
    },
    {
      id: "moon",
      label: BIG_THREE_BODY.moon.label,
      sign: props.moonSign,
      bodyHeading: BIG_THREE_BODY.moon.bodyHeading,
      bodyPhrases: BIG_THREE_BODY.moon.bodyPhrases,
      ...house("moon"),
    },
  ];

  const rise = props.risingSign?.trim();
  if (rise) {
    tiles.push({
      id: "rising",
      label: BIG_THREE_BODY.rising.label,
      sign: rise,
      bodyHeading: BIG_THREE_BODY.rising.bodyHeading,
      bodyPhrases: BIG_THREE_BODY.rising.bodyPhrases,
      ...house("rising"),
    });
  }

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
        ...house("mercury"),
      },
      {
        id: "venus",
        label: PERSONAL_PLANETS_BODY.venus.label,
        sign: ven,
        bodyHeading: PERSONAL_PLANETS_BODY.venus.bodyHeading,
        bodyPhrases: PERSONAL_PLANETS_BODY.venus.bodyPhrases,
        ...house("venus"),
      },
      {
        id: "mars",
        label: PERSONAL_PLANETS_BODY.mars.label,
        sign: mar,
        bodyHeading: PERSONAL_PLANETS_BODY.mars.bodyHeading,
        bodyPhrases: PERSONAL_PLANETS_BODY.mars.bodyPhrases,
        ...house("mars"),
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
