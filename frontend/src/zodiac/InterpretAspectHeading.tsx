import { Heading, Text } from "@chakra-ui/react";
import type { ComponentProps } from "react";

import {
  bodySymbolForTileId,
  chartPointDisplayLabel,
  interpretPlacementBodyForTileId,
  signDisplayName,
} from "./astroLexicon";
import { formatOrbAsDegMin } from "./chartAngles";
import type { NatalChartPayload } from "./chartTypes";
import { INTERPRET_HEADING_SIZE } from "./interpretTypography";
import { aspectHeadingLabel, aspectSymbolForType } from "./zodiacAspectCopy";
import {
  aspectBodyKeyFromPlacementTile,
  aspectsForPlacementTile,
  placementTileIdFromAspectBody,
  type ChartAspectRow,
} from "./zodiacAspectFilters";

export type AspectHeadingBodyPart = {
  bodyKey: string;
  label: string;
  signName: string;
  glyph: string | null;
};

export type AspectHeadingParts = {
  firstBody: AspectHeadingBodyPart;
  aspect: { label: string; glyph: string | null };
  secondBody: AspectHeadingBodyPart;
  accessibleLabel: string;
};

function signKeyForAspectBody(body: string, chart: NatalChartPayload): string | null {
  if (body === "ascendant") return chart.angles.ascendant?.sign ?? null;
  if (body === "midheaven") return chart.angles.midheaven?.sign ?? null;
  return chart.points[body]?.sign ?? null;
}

function labelForAspectBody(body: string): string {
  const bodyTileId = placementTileIdFromAspectBody(body);
  const placement = interpretPlacementBodyForTileId(bodyTileId);
  if (placement) {
    if (bodyTileId === "rising") return "Rising";
    if (bodyTileId === "midheaven") return "Midheaven";
    return placement.label;
  }
  return chartPointDisplayLabel(body);
}

function bodyGlyphForAspectBody(body: string): string | null {
  return bodySymbolForTileId(placementTileIdFromAspectBody(body));
}

export function formatAspectBodyHeadingPhrase(body: AspectHeadingBodyPart): string {
  if (body.bodyKey === "ascendant") return `${body.signName} Rising`;
  if (body.bodyKey === "midheaven") return `${body.signName} Midheaven`;
  return `${body.label} in ${body.signName}`;
}

export function formatAspectHeadingText(parts: AspectHeadingParts): string {
  return `${formatAspectBodyHeadingPhrase(parts.firstBody)} ${parts.aspect.label} ${formatAspectBodyHeadingPhrase(parts.secondBody)}`;
}

export function buildAspectHeadingParts(
  aspect: ChartAspectRow,
  chart: NatalChartPayload,
  placementTileId?: string,
): AspectHeadingParts | null {
  let firstBodyKey: string;
  let secondBodyKey: string;

  if (placementTileId) {
    const pageBody = aspectBodyKeyFromPlacementTile(placementTileId);
    firstBodyKey = pageBody;
    secondBodyKey = aspect.body_a === pageBody ? aspect.body_b : aspect.body_a;
  } else {
    firstBodyKey = aspect.body_a;
    secondBodyKey = aspect.body_b;
  }

  const firstSignKey = signKeyForAspectBody(firstBodyKey, chart);
  const secondSignKey = signKeyForAspectBody(secondBodyKey, chart);
  if (!firstSignKey || !secondSignKey) return null;

  const firstLabel = labelForAspectBody(firstBodyKey);
  const secondLabel = labelForAspectBody(secondBodyKey);
  const aspectLabel = aspectHeadingLabel(aspect.type);
  const firstSignName = signDisplayName(firstSignKey);
  const secondSignName = signDisplayName(secondSignKey);

  const parts: AspectHeadingParts = {
    firstBody: {
      bodyKey: firstBodyKey,
      label: firstLabel,
      signName: firstSignName,
      glyph: bodyGlyphForAspectBody(firstBodyKey),
    },
    aspect: { label: aspectLabel, glyph: aspectSymbolForType(aspect.type) },
    secondBody: {
      bodyKey: secondBodyKey,
      label: secondLabel,
      signName: secondSignName,
      glyph: bodyGlyphForAspectBody(secondBodyKey),
    },
    accessibleLabel: "",
  };
  parts.accessibleLabel = formatAspectHeadingText(parts);
  return parts;
}

export function buildTightestPlacementAspectNote(
  tileId: string,
  chart: NatalChartPayload,
  options: { birthTimeUnknown: boolean },
): string | null {
  const aspects = aspectsForPlacementTile(tileId, chart, options);
  const tightest = aspects[0];
  if (!tightest || tightest.orb_deg >= 3) return null;

  const parts = buildAspectHeadingParts(tightest, chart, tileId);
  if (!parts) return null;

  const aspectLabel = aspectHeadingLabel(tightest.type).toLowerCase();
  const orb = formatOrbAsDegMin(tightest.orb_deg);
  return `A close ${aspectLabel} with ${formatAspectBodyHeadingPhrase(parts.secondBody)} (orb ${orb}) may be especially noticeable from this placement.`;
}

function glyphCalloutText(parts: AspectHeadingParts): string | null {
  const glyphs = [parts.firstBody.glyph, parts.aspect.glyph, parts.secondBody.glyph].filter(
    (glyph): glyph is string => glyph != null && glyph.length > 0,
  );
  if (glyphs.length === 0) return null;
  return glyphs.join(" ");
}

type Props = {
  parts: AspectHeadingParts;
  color?: string;
  calloutColor?: string;
  headingAs?: ComponentProps<typeof Heading>["as"];
  size?: ComponentProps<typeof Heading>["size"];
};

export default function InterpretAspectHeading({
  parts,
  color = "fg",
  calloutColor,
  headingAs = "h2",
  size = INTERPRET_HEADING_SIZE,
}: Props) {
  const glyphCallout = glyphCalloutText(parts);
  const resolvedCalloutColor = calloutColor ?? color;

  return (
    <Heading
      as={headingAs}
      size={size}
      fontFamily="heading"
      fontWeight="normal"
      lineHeight="short"
      color={color}
      mb="0"
      display="flex"
      flexWrap="wrap"
      alignItems="center"
      gap="1"
    >
      {glyphCallout ? (
        <Text
          as="span"
          color={resolvedCalloutColor}
          opacity={calloutColor ? undefined : 0.72}
          fontWeight="normal"
          aria-hidden="true"
          me="2.5"
        >
          {glyphCallout}
        </Text>
      ) : null}
      <Text as="span">{formatAspectHeadingText(parts)}</Text>
    </Heading>
  );
}
