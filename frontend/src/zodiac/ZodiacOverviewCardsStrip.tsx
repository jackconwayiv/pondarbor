import { BIG_THREE_BODY, PERSONAL_PLANETS_BODY } from "./astroLexicon";
import ZodiacSignCardsStrip, { type ZodiacSignCardTile } from "./ZodiacSignCardsStrip";

/** Big three plus Mercury / Venus / Mars when all three signs exist on the chart — one unified grid. */
export default function ZodiacOverviewCardsStrip(props: {
  sunSign: string;
  moonSign: string;
  risingSign: string;
  mercurySign?: string | null;
  venusSign?: string | null;
  marsSign?: string | null;
}) {
  const tiles: ZodiacSignCardTile[] = [
    {
      id: "sun",
      label: BIG_THREE_BODY.sun.label,
      sign: props.sunSign,
      bodyHeading: BIG_THREE_BODY.sun.bodyHeading,
      bodyPhrases: BIG_THREE_BODY.sun.bodyPhrases,
    },
    {
      id: "moon",
      label: BIG_THREE_BODY.moon.label,
      sign: props.moonSign,
      bodyHeading: BIG_THREE_BODY.moon.bodyHeading,
      bodyPhrases: BIG_THREE_BODY.moon.bodyPhrases,
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
      },
      {
        id: "venus",
        label: PERSONAL_PLANETS_BODY.venus.label,
        sign: ven,
        bodyHeading: PERSONAL_PLANETS_BODY.venus.bodyHeading,
        bodyPhrases: PERSONAL_PLANETS_BODY.venus.bodyPhrases,
      },
      {
        id: "mars",
        label: PERSONAL_PLANETS_BODY.mars.label,
        sign: mar,
        bodyHeading: PERSONAL_PLANETS_BODY.mars.bodyHeading,
        bodyPhrases: PERSONAL_PLANETS_BODY.mars.bodyPhrases,
      },
    );
  }

  return <ZodiacSignCardsStrip tiles={tiles} gridColumns={{ base: 2, md: 3 }} />;
}
