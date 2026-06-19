import { Box, Flex, Stack, Text } from "@chakra-ui/react";
import type { KeyboardEvent } from "react";

import { BIG_THREE_BODY, PERSONAL_PLANETS_BODY } from "./astroLexicon";
import type { NatalChartPayload } from "./chartTypes";
import { signCardAccent } from "./signCardAccent";
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
  props: ZodiacOverviewTileSource & {
    onTileOpen?: (tile: ZodiacSignCardTile) => void;
    onInterpretClick?: () => void;
  },
) {
  const tiles = buildZodiacOverviewTiles(props);
  const interpretAccent = signCardAccent(props.sunSign);

  const onInterpretKeyDown = (e: KeyboardEvent) => {
    if (!props.onInterpretClick) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      props.onInterpretClick();
    }
  };

  return (
    <Stack gap="4" w="100%">
      <ZodiacSignCardsStrip
        tiles={tiles}
        gridColumns={{ base: 2, md: 3 }}
        onTileOpen={props.onTileOpen}
      />
      {props.onInterpretClick ? (
        <Box
          as="button"
          w="100%"
          borderRadius="xl"
          borderWidth="1px"
          borderColor={interpretAccent.borderColor}
          borderLeftWidth="4px"
          borderLeftColor={interpretAccent.borderColor}
          bg={interpretAccent.bg}
          py={{ base: "4", md: "5" }}
          px={{ base: "4", md: "6" }}
          textAlign="center"
          cursor="pointer"
          transition="box-shadow 0.15s ease, transform 0.15s ease"
          boxShadow="sm"
          _hover={{
            boxShadow: "md",
            transform: "translateY(-1px)",
          }}
          _active={{
            transform: "translateY(0)",
            boxShadow: "sm",
          }}
          _focusVisible={{
            outline: "2px solid",
            outlineColor: "fg",
            outlineOffset: "2px",
          }}
          onClick={props.onInterpretClick}
          onKeyDown={onInterpretKeyDown}
        >
          <Flex align="center" justify="center" gap="2">
            <Text
              as="span"
              fontSize={{ base: "xl", md: "2xl" }}
              lineHeight="1"
              color={interpretAccent.labelColor}
              aria-hidden="true"
            >
              ›
            </Text>
            <Text
              fontSize={{ base: "lg", md: "xl" }}
              fontFamily="heading"
              fontWeight="normal"
              lineHeight="short"
              color={interpretAccent.labelColor}
            >
              Interpret your chart
            </Text>
          </Flex>
        </Box>
      ) : null}
    </Stack>
  );
}
