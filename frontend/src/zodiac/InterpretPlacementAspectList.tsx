import { Box, Stack, Text } from "@chakra-ui/react";
import type { KeyboardEvent } from "react";

import { APP_TEXT_SIZES } from "../theme/typography";
import { buildAspectInterpretWriteup } from "./buildAspectInterpretWriteup";
import InterpretAspectHeading, { buildAspectHeadingParts } from "./InterpretAspectHeading";
import InterpretAspectSummary from "./InterpretAspectSummary";
import { interpretAspectPageIndex, type InterpretPage } from "./buildInterpretPages";
import type { NatalChartPayload } from "./chartTypes";
import { signCardAccent } from "./signCardAccent";
import {
  aspectsForPlacementTile,
  type ChartAspectRow,
} from "./zodiacAspectFilters";

type Props = {
  tileId: string;
  chart: NatalChartPayload;
  pages: InterpretPage[];
  birthTimeUnknown: boolean;
  onGoToPage: (pageIndex: number) => void;
};

function AspectRow({
  aspect,
  chart,
  placementTileId,
  pageIndex,
  onGoToPage,
}: {
  aspect: ChartAspectRow;
  chart: NatalChartPayload;
  placementTileId: string;
  pageIndex: number;
  onGoToPage: (pageIndex: number) => void;
}) {
  const writeup = buildAspectInterpretWriteup(aspect, chart, { placementTileId });
  const headingParts = buildAspectHeadingParts(aspect, chart, placementTileId);
  if (!writeup || !headingParts) return null;

  const accent = signCardAccent(writeup.accentSignKey);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onGoToPage(pageIndex);
    }
  };

  return (
    <Box
      role="button"
      tabIndex={0}
      aria-label={`Open ${headingParts.accessibleLabel} interpretation.`}
      cursor="pointer"
      borderLeftWidth="3px"
      borderLeftColor={accent.borderColor}
      borderWidth="1px"
      borderColor={accent.borderColor}
      borderRadius="lg"
      bg={accent.bg}
      p="3"
      transition="box-shadow 0.15s ease"
      _hover={{ boxShadow: "md" }}
      _focusVisible={{
        outline: "2px solid",
        outlineColor: "fg",
        outlineOffset: "2px",
      }}
      onClick={() => onGoToPage(pageIndex)}
      onKeyDown={onKeyDown}
    >
      <Stack gap="1" w="100%">
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="flex-start"
          gap="2"
          flexWrap="wrap"
        >
          <InterpretAspectHeading
            parts={headingParts}
            color={accent.labelColor}
            calloutColor={accent.valueColor}
            headingAs="h3"
          />
          <Text fontSize={APP_TEXT_SIZES.meta} color={accent.valueColor} whiteSpace="nowrap">
            orb {writeup.orbDisplay}
          </Text>
        </Box>
        <InterpretAspectSummary
          paragraphs={writeup.paragraphs}
          previewOnly
          color={accent.valueColor}
        />
      </Stack>
    </Box>
  );
}

export default function InterpretPlacementAspectList({
  tileId,
  chart,
  pages,
  birthTimeUnknown,
  onGoToPage,
}: Props) {
  const aspects = aspectsForPlacementTile(tileId, chart, { birthTimeUnknown });
  const rows = aspects
    .map((aspect) => ({
      aspect,
      pageIndex: interpretAspectPageIndex(pages, aspect),
    }))
    .filter((row): row is { aspect: ChartAspectRow; pageIndex: number } => row.pageIndex != null);

  if (rows.length === 0) return null;

  return (
    <Stack gap="3" w="100%">
      {rows.map(({ aspect, pageIndex }) => (
        <AspectRow
          key={`${aspect.body_a}-${aspect.type}-${aspect.body_b}`}
          aspect={aspect}
          chart={chart}
          placementTileId={tileId}
          pageIndex={pageIndex}
          onGoToPage={onGoToPage}
        />
      ))}
    </Stack>
  );
}
