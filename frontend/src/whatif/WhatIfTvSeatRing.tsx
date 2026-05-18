import { Box } from "@chakra-ui/react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";

import { WhatIfDieFace } from "./WhatIfDieFace";
import type { WhatIfPlayer } from "./types";
import { whatifPlayerSeatIndex, whatifSeatRingColor } from "./whatifPlayerSeatColors";
import {
  subjectBoardSeatCount,
  subjectBoardSeatIsChallenge,
  subjectBoardSeatLabel,
} from "./whatifSubjectBoardUi";
import {
  fitSeatRingLabel,
  formatPlayerSeatLabel,
} from "./whatifTvSeatRingLabel";
import {
  annulusWedgePath,
  TV_SEAT_RING_CX,
  TV_SEAT_RING_CY,
  TV_SEAT_RING_R_INNER,
  wedgeLabelArcPath,
  wedgeLabelArcPathId,
  wedgeLabelRadius,
  wedgeMarkerOuterRingPath,
} from "./whatifTvSeatRingGeometry";

/** Challenge wedge on light scoreboard card — solid orange, white label. */
const CHALLENGE_WEDGE_FILL_DEFAULT = "var(--chakra-colors-nautical-solid, #E9A14A)";
const CHALLENGE_WEDGE_LABEL_DEFAULT = "#ffffff";
/** Challenge wedge when TV scoreboard card is challenge orange — soft fill, dark label. */
const CHALLENGE_WEDGE_FILL_ON_ORANGE_CARD = "var(--chakra-colors-nautical-subtle, #F7C78A)";
const CHALLENGE_WEDGE_LABEL_ON_ORANGE_CARD = "#18181b";

/** Visual scale for the whole ring (layout + SVG). */
const TV_SEAT_RING_DISPLAY_SCALE = 0.75;
const TV_SEAT_RING_MAX_WIDTH_REM = 28 * TV_SEAT_RING_DISPLAY_SCALE;
/** Pull layout in above/below the square ring box (Chakra spacing units). */
const TV_SEAT_RING_VERTICAL_TRIM_TOP = 3;
const TV_SEAT_RING_VERTICAL_TRIM_BOTTOM = 0;

type WhatIfTvSeatRingProps = {
  players: WhatIfPlayer[];
  markerIndex?: number | null;
  candidateSeatA?: number | null;
  candidateSeatB?: number | null;
  activeTurnSubjectPhase: boolean;
  /** Show die in ring center (subject pick or challenge “who to challenge” after roll). */
  showCenterDie?: boolean;
  /** TV scoreboard card uses `nautical.solid` during duel steps. */
  activeChallengeRound?: boolean;
  activePlayerId?: number | null;
  subjectDieValue?: number | null;
};

export function WhatIfTvSeatRing({
  players,
  markerIndex,
  candidateSeatA,
  candidateSeatB,
  activeTurnSubjectPhase,
  showCenterDie = false,
  activeChallengeRound = false,
  activePlayerId,
  subjectDieValue,
}: WhatIfTvSeatRingProps) {
  const P = players.length;
  const L = subjectBoardSeatCount(P);

  const activeSeatIndex =
    activePlayerId != null ? whatifPlayerSeatIndex(activePlayerId, players) : -1;

  const cand = useMemo(() => {
    if (
      !activeTurnSubjectPhase ||
      typeof candidateSeatA !== "number" ||
      typeof candidateSeatB !== "number"
    ) {
      return null;
    }
    return new Set<number>([candidateSeatA, candidateSeatB]);
  }, [activeTurnSubjectPhase, candidateSeatA, candidateSeatB]);

  const showDie =
    showCenterDie &&
    typeof subjectDieValue === "number" &&
    subjectDieValue >= 1 &&
    subjectDieValue <= 6;

  const ariaParts = useMemo(() => {
    const bits: string[] = [`Subject board, ${L} seats`];
    if (markerIndex != null) bits.push(`marker on seat ${Number(markerIndex) + 1}`);
    if (cand) bits.push("two candidate seats highlighted");
    if (activeSeatIndex >= 0) bits.push(`active player seat ${activeSeatIndex + 1}`);
    if (showDie) bits.push(`die showing ${subjectDieValue}`);
    return bits.join("; ");
  }, [L, markerIndex, cand, activeSeatIndex, showDie, subjectDieValue]);

  const svgRef = useRef<SVGSVGElement>(null);
  const [unitPx, setUnitPx] = useState(4);

  useLayoutEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setUnitPx(w / 100);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const toLabelPx = (viewBoxSize: number) => viewBoxSize * unitPx;

  if (P < 2) return null;

  const textFill = "#18181b";
  const mutedFill = "#71717a";
  const starFill = "var(--chakra-colors-orange-solid, #ea580c)";
  const playerWedgeFill = "var(--chakra-colors-bg-panel, #fafafa)";
  const wedgeStrokeDefault = "#18181b";
  const markerHighlightFill = "#d4d4d8";
  const dieSize = TV_SEAT_RING_R_INNER * 1.35 * 0.5;
  const challengeWedgeFill = activeChallengeRound
    ? CHALLENGE_WEDGE_FILL_ON_ORANGE_CARD
    : CHALLENGE_WEDGE_FILL_DEFAULT;
  const challengeWedgeLabelFill = activeChallengeRound
    ? CHALLENGE_WEDGE_LABEL_ON_ORANGE_CARD
    : CHALLENGE_WEDGE_LABEL_DEFAULT;

  return (
    <Box
      w="100%"
      maxW={`min(100%, ${TV_SEAT_RING_MAX_WIDTH_REM}rem)`}
      mx="auto"
      aspectRatio={1}
      mt={`-${TV_SEAT_RING_VERTICAL_TRIM_TOP}`}
      mb={`-${TV_SEAT_RING_VERTICAL_TRIM_BOTTOM}`}
    >
      <svg
        ref={svgRef}
        viewBox="0 0 100 100"
        width="100%"
        height="100%"
        role="img"
        aria-label={ariaParts}
        style={{ display: "block", fontSize: 0 }}
      >
        <defs>
          {Array.from({ length: L }, (_, seatIndex) => {
            const labelR = wedgeLabelRadius(seatIndex, L);
            return (
              <path
                key={`arc-${seatIndex}`}
                id={wedgeLabelArcPathId(seatIndex)}
                d={wedgeLabelArcPath(seatIndex, L, labelR)}
                fill="none"
              />
            );
          })}
        </defs>
        {Array.from({ length: L }, (_, seatIndex) => {
          const isMarker = markerIndex != null && Number(markerIndex) === seatIndex;
          const isCand = cand?.has(seatIndex) ?? false;
          const isChallenge = subjectBoardSeatIsChallenge(seatIndex, P);
          const isActiveTurn =
            activeSeatIndex >= 0 &&
            seatIndex === activeSeatIndex &&
            !isChallenge;

          const seatColor = whatifSeatRingColor(seatIndex);

          const fill = isChallenge ? challengeWedgeFill : isCand ? "#f4f4f5" : playerWedgeFill;
          const stroke = wedgeStrokeDefault;
          const strokeWidth = 0.55;
          const strokeDasharray = isCand ? "3 2.5" : undefined;

          const labelName = subjectBoardSeatLabel(players, seatIndex);
          const starSuffix = isActiveTurn ? " ★" : "";
          const labelText = isChallenge
            ? "Challenge"
            : `${formatPlayerSeatLabel(seatIndex, labelName)}${starSuffix}`;
          const labelR = wedgeLabelRadius(seatIndex, L);
          const { fontSize, displayText, truncated } = fitSeatRingLabel(labelText, L, labelR);
          const arcId = wedgeLabelArcPathId(seatIndex);
          const seatPrefix = `${seatIndex + 1} `;
          const labelPx = toLabelPx(fontSize);
          const seatNumPx = toLabelPx(fontSize * 0.82);

          return (
            <g key={seatIndex}>
              <path
                d={annulusWedgePath(seatIndex, L)}
                fill={fill}
                stroke={stroke}
                strokeWidth={strokeWidth}
                strokeDasharray={strokeDasharray}
                vectorEffect="non-scaling-stroke"
              />
              {isMarker ? (
                <path
                  d={wedgeMarkerOuterRingPath(seatIndex, L)}
                  fill={markerHighlightFill}
                  stroke="none"
                />
              ) : null}
              <text
                fill={textFill}
                fontWeight={600}
                aria-label={isActiveTurn ? "Active player's turn" : undefined}
              >
                <textPath
                  href={`#${arcId}`}
                  startOffset="50%"
                  textAnchor="middle"
                  style={{ fontSize: `${labelPx}px` }}
                >
                  {isChallenge ? (
                    <tspan fill={challengeWedgeLabelFill} style={{ fontSize: `${labelPx}px` }}>
                      {displayText}
                    </tspan>
                  ) : truncated ? (
                    <tspan fill={seatColor} style={{ fontSize: `${labelPx}px` }}>
                      {displayText}
                    </tspan>
                  ) : (
                    <>
                      <tspan fill={mutedFill} fontWeight={500} style={{ fontSize: `${seatNumPx}px` }}>
                        {seatPrefix}
                      </tspan>
                      <tspan fill={seatColor} fontWeight={600} style={{ fontSize: `${labelPx}px` }}>
                        {labelName}
                      </tspan>
                      {isActiveTurn ? (
                        <tspan fill={starFill} fontWeight={600} style={{ fontSize: `${labelPx}px` }}>
                          {" ★"}
                        </tspan>
                      ) : null}
                    </>
                  )}
                </textPath>
              </text>
            </g>
          );
        })}

        {showDie ? (
          <WhatIfDieFace
            value={subjectDieValue}
            size={dieSize}
            cx={TV_SEAT_RING_CX}
            cy={TV_SEAT_RING_CY}
            onDarkBackground={false}
          />
        ) : null}
      </svg>
    </Box>
  );
}
