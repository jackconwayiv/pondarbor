import { Box } from "@chakra-ui/react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { WhatIfDieFace } from "./WhatIfDieFace";
import type { WhatIfNpc, WhatIfPlayer } from "./types";
import { humanPlayerNumber, seatOccupantAt } from "./whatifRingLayout";
import { whatifSeatRingColor } from "./whatifPlayerSeatColors";
import {
  physicalSeatIndexForPlayer,
  ringLayoutFromSession,
  subjectBoardSeatIsChallenge,
  subjectBoardSeatIsNpc,
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
  TV_SEAT_RING_R_OUTER,
  wedgeLabelArcPath,
  wedgeLabelArcPathId,
  wedgeLabelRadius,
  wedgeMarkerOuterRingPath,
} from "./whatifTvSeatRingGeometry";
import { WhatIfTvVotingTimerRing } from "./whatifVotingTimerRing";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/** Challenge wedge on light scoreboard card — solid orange, white label. */
const CHALLENGE_WEDGE_FILL_DEFAULT = "var(--chakra-colors-nautical-solid, #E9A14A)";
const CHALLENGE_WEDGE_LABEL_DEFAULT = "#ffffff";
/** Challenge wedge when TV scoreboard card is challenge orange — soft fill, dark label. */
const CHALLENGE_WEDGE_FILL_ON_ORANGE_CARD = "var(--chakra-colors-nautical-subtle, #F7C78A)";
const CHALLENGE_WEDGE_LABEL_ON_ORANGE_CARD = "#18181b";

const PLAYER_WEDGE_FILL = "var(--chakra-colors-bg-panel, #fafafa)";
const NPC_WEDGE_FILL = "#f3f4f6";
/** Die-roll subject options (A/B) — radial fill inner (green) → outer (white). */
const CANDIDATE_WEDGE_GRADIENT_ID = "whatif-candidate-wedge-fill";
const CANDIDATE_WEDGE_GRADIENT_INNER = "var(--chakra-colors-teal-solid, #b7d394)";
const CANDIDATE_WEDGE_GRADIENT_OUTER = "#ffffff";
const CANDIDATE_WEDGE_FILL = `url(#${CANDIDATE_WEDGE_GRADIENT_ID})`;

/** Visual scale for the whole ring (layout + SVG). */
const TV_SEAT_RING_DISPLAY_SCALE = 0.75;
const TV_SEAT_RING_MAX_WIDTH_REM = 28 * TV_SEAT_RING_DISPLAY_SCALE;
const TV_SEAT_RING_VERTICAL_TRIM_TOP = 3;
const TV_SEAT_RING_VERTICAL_TRIM_BOTTOM = 0;

type WhatIfTvSeatRingProps = {
  players: WhatIfPlayer[];
  npcs?: WhatIfNpc[];
  markerIndex?: number | null;
  candidateSeatA?: number | null;
  candidateSeatB?: number | null;
  activeTurnSubjectPhase: boolean;
  showCenterDie?: boolean;
  activeChallengeRound?: boolean;
  activePlayerId?: number | null;
  subjectDieValue?: number | null;
  votingTimer?: {
    deadlineIso: string | null;
    pauseRemainingSeconds: number | null;
    paused: boolean;
    allVotesIn?: boolean;
    fallbackNowMs: number;
  } | null;
};

export function WhatIfTvSeatRing({
  players,
  npcs = [],
  markerIndex,
  candidateSeatA,
  candidateSeatB,
  activeTurnSubjectPhase,
  showCenterDie = false,
  activeChallengeRound = false,
  activePlayerId,
  subjectDieValue,
  votingTimer = null,
}: WhatIfTvSeatRingProps) {
  const { layout, playerIds, p, e, l: L } = useMemo(
    () => ringLayoutFromSession(players, npcs),
    [players, npcs],
  );

  const activePhysicalSeat =
    activePlayerId != null ? physicalSeatIndexForPlayer(players, npcs, activePlayerId) : -1;

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
    if (activePhysicalSeat >= 0) bits.push(`active player on wedge ${activePhysicalSeat + 1}`);
    if (showDie) bits.push(`die showing ${subjectDieValue}`);
    return bits.join("; ");
  }, [L, markerIndex, cand, activePhysicalSeat, showDie, subjectDieValue]);

  const svgRef = useRef<SVGSVGElement>(null);
  const [unitPx, setUnitPx] = useState(4);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(REDUCED_MOTION);
    const update = () => setPrefersReducedMotion(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

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

  if (players.length < 2) return null;

  const textFill = "#18181b";
  const mutedFill = "#71717a";
  const starFill = "var(--chakra-colors-orange-solid, #ea580c)";
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
          <radialGradient
            id={CANDIDATE_WEDGE_GRADIENT_ID}
            gradientUnits="userSpaceOnUse"
            cx={TV_SEAT_RING_CX}
            cy={TV_SEAT_RING_CY}
            r={TV_SEAT_RING_R_OUTER}
          >
            <stop
              offset={TV_SEAT_RING_R_INNER / TV_SEAT_RING_R_OUTER}
              stopColor={CANDIDATE_WEDGE_GRADIENT_INNER}
            />
            <stop offset={1} stopColor={CANDIDATE_WEDGE_GRADIENT_OUTER} />
          </radialGradient>
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
          const isChallenge = subjectBoardSeatIsChallenge(seatIndex, p, e);
          const isNpc = subjectBoardSeatIsNpc(players, npcs, seatIndex);
          const isActiveTurn = activePhysicalSeat >= 0 && seatIndex === activePhysicalSeat && !isChallenge;

          const occ = seatOccupantAt(layout, seatIndex, L, p);
          const joinSeatIdx =
            occ?.kind === "player" ? playerIds.indexOf(occ.id) : -1;
          const seatColor = joinSeatIdx >= 0 ? whatifSeatRingColor(joinSeatIdx) : mutedFill;

          let fill = PLAYER_WEDGE_FILL;
          if (isChallenge) fill = challengeWedgeFill;
          else if (isCand) fill = CANDIDATE_WEDGE_FILL;
          else if (isNpc) fill = NPC_WEDGE_FILL;

          const stroke = wedgeStrokeDefault;
          const strokeWidth = 0.55;

          const labelName = subjectBoardSeatLabel(players, npcs, seatIndex);
          const starSuffix = isActiveTurn ? " ★" : "";
          const humanNum =
            occ?.kind === "player" ? humanPlayerNumber(occ.id, playerIds) : null;
          const labelText = isChallenge
            ? "Challenge"
            : isNpc
              ? labelName
              : humanNum != null
                ? `${formatPlayerSeatLabel(humanNum, labelName)}${starSuffix}`
                : `${labelName}${starSuffix}`;
          const labelR = wedgeLabelRadius(seatIndex, L);
          const { fontSize, displayText, truncated } = fitSeatRingLabel(labelText, L, labelR);
          const arcId = wedgeLabelArcPathId(seatIndex);
          const labelPx = toLabelPx(fontSize);
          const seatNumPx = toLabelPx(fontSize * 0.82);
          const seatPrefix = humanNum != null ? `${humanNum} ` : "";

          return (
            <g key={seatIndex}>
              <path
                d={annulusWedgePath(seatIndex, L)}
                fill={fill}
                stroke={stroke}
                strokeWidth={strokeWidth}
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
                    <tspan
                      fill={isNpc ? textFill : seatColor}
                      fontStyle={isNpc ? "italic" : undefined}
                      style={{ fontSize: `${labelPx}px` }}
                    >
                      {displayText}
                    </tspan>
                  ) : isNpc ? (
                    <tspan
                      fill={textFill}
                      fontStyle="italic"
                      fontWeight={600}
                      style={{ fontSize: `${labelPx}px` }}
                    >
                      {labelName}
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

        <WhatIfTvVotingTimerRing
          votingTimer={votingTimer}
          activeChallengeRound={activeChallengeRound}
          reduceMotion={prefersReducedMotion}
          unitPx={unitPx}
        />

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
