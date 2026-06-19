import {
  chartPointDisplayLabel,
  interpretPlacementBodyForTileId,
  signDisplayName,
  traitsForSign,
} from "./astroLexicon";
import { joinEnglishList, interpretPlacementLeadSummaryForTileId } from "./buildInterpretWriteup";
import type { InterpretHouseOccupant } from "./buildHouseInterpretWriteup";
import type { NatalChartPayload } from "./chartTypes";
import { formatOrbAsDegMin } from "./chartAngles";
import { buildAspectHeadingParts } from "./InterpretAspectHeading";
import {
  aspectTypeLabel,
  ASPECT_TYPE_COPY,
  buildAspectCooperationLine,
  buildAspectIntro,
  buildAspectInteractionParagraph,
  buildAspectPlacementPhrase,
  buildOppositionConflictParagraph,
  buildOppositionIntegrationParagraph,
  type AspectTypeKey,
} from "./zodiacAspectCopy";
import {
  aspectBodyKeyFromPlacementTile,
  placementTileIdFromAspectBody,
  type ChartAspectRow,
} from "./zodiacAspectFilters";
import { ZODIAC_ASPECT_ANCHOR_BODIES } from "./zodiacDisplayConfig";
import {
  aspectEffortPhrase,
  aspectInfluencePhrase,
  oppositionCopySlots,
  planetFunctionForBody,
} from "./zodiacAspectLexicon";
import {
  aspectWithinInterpretOrb,
  buildAspectStrengthParagraph,
} from "./zodiacAspectStrength";

export type InterpretAspectWriteup = {
  title: string;
  paragraphs: string[];
  summaryText: string;
  orbDisplay: string;
  accentSignKey: string;
  occupants: InterpretHouseOccupant[];
};

function signForAspectBody(body: string, chart: NatalChartPayload): string | null {
  if (body === "ascendant") return chart.angles.ascendant?.sign ?? null;
  if (body === "midheaven") return chart.angles.midheaven?.sign ?? null;
  return chart.points[body]?.sign ?? null;
}

function labelForAspectBody(body: string): string {
  const tileId = placementTileIdFromAspectBody(body);
  const placement = interpretPlacementBodyForTileId(tileId);
  if (placement) {
    if (tileId === "rising") return "Rising";
    if (tileId === "midheaven") return "Midheaven";
    return placement.label;
  }
  return chartPointDisplayLabel(body);
}

function concernsPhrase(body: string): string {
  return planetFunctionForBody(body).noun;
}

function adjectivesPhrase(signKey: string, traitCap: number): string {
  const traits = traitsForSign(signKey);
  if (traits?.length) return joinEnglishList(traits.slice(0, traitCap));
  return signDisplayName(signKey).toLowerCase();
}

function orderedAspectBodies(
  aspect: ChartAspectRow,
  placementTileId?: string,
): { bodyFirst: string; bodySecond: string } {
  if (!placementTileId) {
    return { bodyFirst: aspect.body_a, bodySecond: aspect.body_b };
  }
  const pageBody = aspectBodyKeyFromPlacementTile(placementTileId);
  return {
    bodyFirst: pageBody,
    bodySecond: aspect.body_a === pageBody ? aspect.body_b : aspect.body_a,
  };
}

function buildAspectInterpretation(
  bodyA: string,
  signA: string,
  bodyB: string,
  signB: string,
  aspectType: AspectTypeKey,
  typeCopy: (typeof ASPECT_TYPE_COPY)[AspectTypeKey],
): { paragraphs: string[]; summaryText: string } {
  const signNameA = signDisplayName(signA);
  const signNameB = signDisplayName(signB);
  const labelA = labelForAspectBody(bodyA);
  const labelB = labelForAspectBody(bodyB);

  const phraseA = buildAspectPlacementPhrase(bodyA, labelA, signNameA, "Your");
  const phraseB = buildAspectPlacementPhrase(bodyB, labelB, signNameB, "your");

  const intro = buildAspectIntro(aspectType, phraseA, phraseB);
  const paragraph1 = `${intro} ${typeCopy.opportunityLine}`;
  const paragraph2 = buildAspectCooperationLine(
    adjectivesPhrase(signA, typeCopy.traitCap),
    concernsPhrase(bodyA),
    typeCopy.relationshipVerb,
    adjectivesPhrase(signB, typeCopy.traitCap),
    concernsPhrase(bodyB),
    aspectType,
  );

  const paragraphs =
    aspectType === "opposition"
      ? (() => {
          const slots = oppositionCopySlots(bodyA, bodyB);
          return [
            paragraph1,
            paragraph2,
            buildOppositionConflictParagraph(slots),
            buildOppositionIntegrationParagraph(slots),
          ];
        })()
      : [
          paragraph1,
          paragraph2,
          buildAspectInteractionParagraph(aspectType, typeCopy, {
            effortFromFirst: aspectEffortPhrase(bodyA),
            influenceOnSecond: aspectInfluencePhrase(bodyB),
            effortFromSecond: aspectEffortPhrase(bodyB),
            influenceOnFirst: aspectInfluencePhrase(bodyA),
          }),
        ];
  return { paragraphs, summaryText: paragraphs.join(" ") };
}

function accentSignKeyForAspect(aspect: ChartAspectRow, chart: NatalChartPayload): string {
  const anchor =
    ZODIAC_ASPECT_ANCHOR_BODIES.has(aspect.body_a) ? aspect.body_a : aspect.body_b;
  return signForAspectBody(anchor, chart) ?? signForAspectBody(aspect.body_a, chart) ?? "aries";
}

export function buildAspectInterpretWriteup(
  aspect: ChartAspectRow,
  chart: NatalChartPayload,
  options?: { placementTileId?: string },
): InterpretAspectWriteup | null {
  const aspectType = aspect.type as AspectTypeKey;
  const typeCopy = ASPECT_TYPE_COPY[aspectType];
  if (!typeCopy) return null;
  if (!aspectWithinInterpretOrb(aspect)) return null;

  const { bodyFirst, bodySecond } = orderedAspectBodies(aspect, options?.placementTileId);
  const signFirst = signForAspectBody(bodyFirst, chart);
  const signSecond = signForAspectBody(bodySecond, chart);
  if (!signFirst || !signSecond) return null;

  const headingParts = buildAspectHeadingParts(aspect, chart, options?.placementTileId);
  const labelA = labelForAspectBody(aspect.body_a);
  const labelB = labelForAspectBody(aspect.body_b);
  const title =
    headingParts?.accessibleLabel ?? `${labelA} ${aspectTypeLabel(aspect.type)} ${labelB}`;

  const { paragraphs: coreParagraphs, summaryText: coreSummary } = buildAspectInterpretation(
    bodyFirst,
    signFirst,
    bodySecond,
    signSecond,
    aspectType,
    typeCopy,
  );
  const strengthParagraph = buildAspectStrengthParagraph(
    aspect.orb_deg,
    aspectType,
    aspect.body_a,
    aspect.body_b,
  );
  const paragraphs = [...coreParagraphs, strengthParagraph];
  const summaryText = `${coreSummary} ${strengthParagraph}`;

  const occupants = [aspect.body_a, aspect.body_b]
    .map((body) => {
      const tileId = placementTileIdFromAspectBody(body);
      return interpretPlacementLeadSummaryForTileId(tileId, chart);
    })
    .filter((occ): occ is InterpretHouseOccupant => occ != null);

  if (occupants.length < 2) return null;

  return {
    title,
    paragraphs,
    summaryText,
    orbDisplay: formatOrbAsDegMin(aspect.orb_deg),
    accentSignKey: accentSignKeyForAspect(aspect, chart),
    occupants,
  };
}
