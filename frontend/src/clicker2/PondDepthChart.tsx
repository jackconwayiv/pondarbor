import { Box, Text } from "@chakra-ui/react";
import { memo, useEffect, useMemo, useRef, useState } from "react";

import "./PondDepthChart.css";

import type { DenizenDef } from "./denizens";
import { getOwnedDenizenCount } from "./denizens";
import DenizenMutateButton from "./DenizenMutateButton";
import {
  getMutationLevel,
  shouldShowDenizenMutationLevel,
} from "./mutagens";
import {
  depthZoneBackground,
  depthZoneLabelOnDark,
  POND_DEPTH_CHART_MAX_VISIBLE_ROWS,
  partitionTimelineByDenizen,
} from "./pondDepthChartModel";

function PondDepthChart({
  timeline,
  ownedDenizens,
  denizenMutationLevels,
  mutagenUnlocked,
  mutagensBank,
  onMutate,
  canHoverFinePointer = true,
}: {
  timeline: readonly string[];
  ownedDenizens: Record<string, number>;
  denizenMutationLevels: Record<string, number>;
  mutagenUnlocked: boolean;
  mutagensBank: number;
  onMutate: (def: DenizenDef) => void;
  canHoverFinePointer?: boolean;
}) {
  const rows = useMemo(
    () => partitionTimelineByDenizen(timeline),
    [timeline],
  );
  const [pulseNewest, setPulseNewest] = useState(false);
  const prevLenRef = useRef(timeline.length);
  const newestEmoji = timeline[0] ?? "";

  useEffect(() => {
    if (timeline.length > prevLenRef.current) {
      setPulseNewest(true);
      const id = window.setTimeout(() => setPulseNewest(false), 2_500);
      prevLenRef.current = timeline.length;
      return () => window.clearTimeout(id);
    }
    prevLenRef.current = timeline.length;
  }, [timeline.length]);

  if (timeline.length === 0 || rows.length === 0) return null;

  return (
    <Box
      className="pondDepthChart"
      role="region"
      aria-label="Pond depth by denizen type"
    >
      {rows.map((row) => {
        const isNewestRow =
          pulseNewest && newestEmoji.length > 0 && row.def.emoji === newestEmoji;
        const onDarkZone = depthZoneLabelOnDark(row.zoneIndex);
        const owned = getOwnedDenizenCount(ownedDenizens, row.def.id);
        const mutationLevel = getMutationLevel(
          denizenMutationLevels,
          row.def.id,
        );
        const showMutationLevel = shouldShowDenizenMutationLevel(
          row.def.id,
          owned,
          denizenMutationLevels,
          mutagenUnlocked,
        );

        return (
          <Box
            key={row.def.id}
            className={
              isNewestRow
                ? "pondDepthChartBand pondDepthChartBand--new"
                : "pondDepthChartBand"
            }
            style={{ background: depthZoneBackground(row.zoneIndex) }}
            aria-label={
              showMutationLevel
                ? `${row.def.namePlural}, level ${mutationLevel}, ${row.count.toLocaleString()} purchases`
                : `${row.def.namePlural}, ${row.count.toLocaleString()} purchases`
            }
          >
            <Box className="pondDepthChartLabelCol">
              <Text
                as="span"
                className={
                  onDarkZone
                    ? "pondDepthChartLabel pondDepthChartLabel--onDark"
                    : "pondDepthChartLabel"
                }
              >
                {row.def.namePlural.toUpperCase()}
              </Text>
              {showMutationLevel ? (
                <Text
                  as="span"
                  className={
                    onDarkZone
                      ? "pondDepthChartLevel pondDepthChartLevel--onDark"
                      : "pondDepthChartLevel"
                  }
                >
                  Level: {mutationLevel}
                </Text>
              ) : null}
              <DenizenMutateButton
                def={row.def}
                owned={owned}
                mutationLevel={mutationLevel}
                mutagensBank={mutagensBank}
                mutagenUnlocked={mutagenUnlocked}
                onMutate={onMutate}
                canHoverFinePointer={canHoverFinePointer}
                compact
                className="pondDepthChartMutate"
              />
            </Box>
            <Box className="pondDepthChartTrackWrap">
              <Box className="pondDepthChartGlyphs" aria-hidden>
                {row.glyphLines
                  .slice(0, POND_DEPTH_CHART_MAX_VISIBLE_ROWS)
                  .map((line, lineIndex) => (
                    <Text
                      key={lineIndex}
                      as="span"
                      className="pondDepthChartGlyphLine"
                    >
                      {line}
                    </Text>
                  ))}
              </Box>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

export default memo(PondDepthChart);
