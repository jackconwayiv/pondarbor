/** TV voting countdown ring — keep WHATIF_VOTING_DEADLINE_SECONDS in sync with backend. */

import { useEffect, useMemo, useState } from "react";

import {
  TV_SEAT_RING_CX,
  TV_SEAT_RING_CY,
  TV_SEAT_RING_TIMER_R_MID,
  TV_SEAT_RING_TIMER_STROKE_WIDTH,
} from "./whatifTvSeatRingGeometry";

/** Matches `backend/whatif/constants.py` VOTING_DEADLINE_SECONDS. */
export const WHATIF_VOTING_DEADLINE_SECONDS = 60;
export const WHATIF_VOTING_TIMER_URGENT_SECONDS = 10;

const TIMER_PROGRESS_COLOR = "var(--chakra-colors-teal-solid, #b7d394)";
const TIMER_URGENT_COLOR = "var(--chakra-colors-nautical-solid, #e9a14a)";
const TIMER_URGENT_CHALLENGE_COLOR = "var(--chakra-colors-red-solid, #dc2626)";
const TIMER_PAUSED_COLOR = "var(--chakra-colors-sky-solid, #7cb7df)";

export function votingTimerHasStarted(deadlineIso: string | null | undefined): boolean {
  return typeof deadlineIso === "string" && deadlineIso.trim().length > 0;
}

/** Hand pause/resume: timer started, or paused (deadline cleared while frozen). */
export function votingPauseControlsAvailable(
  deadlineIso: string | null | undefined,
  votingPaused: boolean,
): boolean {
  return votingPaused || votingTimerHasStarted(deadlineIso);
}

export type VotingTimerRingState =
  | { visible: false }
  | { visible: true; progress: number; urgent: boolean; paused: boolean };

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

export function getVotingTimerRingState(opts: {
  deadlineIso: string | null | undefined;
  pauseRemainingSeconds: number | null | undefined;
  nowMs: number;
  paused: boolean;
  /** When true, hide the ring (do not show a full ring for “all votes in”). */
  allVotesIn?: boolean;
}): VotingTimerRingState {
  const { deadlineIso, pauseRemainingSeconds, nowMs, paused, allVotesIn } = opts;

  if (paused) {
    if (!votingPauseControlsAvailable(deadlineIso, true)) {
      return { visible: false };
    }
    const remaining =
      typeof pauseRemainingSeconds === "number" && Number.isFinite(pauseRemainingSeconds)
        ? Math.max(0, pauseRemainingSeconds)
        : 0;
    const progress = clamp01(1 - remaining / WHATIF_VOTING_DEADLINE_SECONDS);
    return { visible: true, progress, urgent: false, paused: true };
  }

  if (allVotesIn) {
    return { visible: false };
  }

  if (!votingTimerHasStarted(deadlineIso)) {
    return { visible: false };
  }
  const endMs = new Date(deadlineIso!).getTime();
  if (!Number.isFinite(endMs)) {
    return { visible: false };
  }
  const secsLeft = (endMs - nowMs) / 1000;
  const progress = secsLeft <= 0 ? 1 : clamp01(1 - secsLeft / WHATIF_VOTING_DEADLINE_SECONDS);
  const urgent = secsLeft > 0 && secsLeft <= WHATIF_VOTING_TIMER_URGENT_SECONDS;
  return { visible: true, progress, urgent, paused: false };
}

export function votingTimerRingCircumference(): number {
  return 2 * Math.PI * TV_SEAT_RING_TIMER_R_MID;
}

export type WhatIfVotingTimerInput = {
  deadlineIso: string | null;
  pauseRemainingSeconds: number | null;
  paused: boolean;
  /** Hide ring when every eligible voter has voted (full ring only for “Time’s up!”). */
  allVotesIn?: boolean;
  /** Parent clock at 1 Hz; used when prefers-reduced-motion. */
  fallbackNowMs: number;
};

/** ViewBox units; matches seat-ring label scale (see `toLabelPx` in WhatIfTvSeatRing). */
const PAUSED_LABEL_VIEWBOX_SIZE = 4.25 * 0.75 * 0.75 * 0.95;

export type WhatIfTvVotingTimerRingProps = {
  votingTimer: WhatIfVotingTimerInput | null;
  activeChallengeRound?: boolean;
  reduceMotion?: boolean;
  /** SVG user-unit → px scale from seat ring layout measure. */
  unitPx: number;
};

function useSmoothNowMs(enabled: boolean, fallbackNowMs: number, reduceMotion: boolean): number {
  const [smoothNowMs, setSmoothNowMs] = useState(fallbackNowMs);

  useEffect(() => {
    if (!enabled || reduceMotion) {
      setSmoothNowMs(fallbackNowMs);
      return;
    }
    let frameId = 0;
    const tick = () => {
      setSmoothNowMs(Date.now());
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [enabled, reduceMotion, fallbackNowMs]);

  return reduceMotion ? fallbackNowMs : smoothNowMs;
}

/** Clockwise progress annulus in seat-ring SVG coordinates (aria-hidden). */
export function WhatIfTvVotingTimerRing({
  votingTimer,
  activeChallengeRound = false,
  reduceMotion = false,
  unitPx,
}: WhatIfTvVotingTimerRingProps) {
  const controlsActive = votingTimer
    ? votingPauseControlsAvailable(votingTimer.deadlineIso, votingTimer.paused)
    : false;

  const nowMs = useSmoothNowMs(
    !!votingTimer && controlsActive,
    votingTimer?.fallbackNowMs ?? Date.now(),
    reduceMotion,
  );

  const ringState = useMemo(
    () =>
      votingTimer
        ? getVotingTimerRingState({
            deadlineIso: votingTimer.deadlineIso,
            pauseRemainingSeconds: votingTimer.pauseRemainingSeconds,
            nowMs,
            paused: votingTimer.paused,
            allVotesIn: votingTimer.allVotesIn,
          })
        : { visible: false as const },
    [votingTimer, nowMs],
  );

  if (!ringState.visible) return null;

  const circumference = votingTimerRingCircumference();
  const filled = ringState.progress * circumference;
  const progressStroke = ringState.paused
    ? TIMER_PAUSED_COLOR
    : ringState.urgent
      ? activeChallengeRound
        ? TIMER_URGENT_CHALLENGE_COLOR
        : TIMER_URGENT_COLOR
      : TIMER_PROGRESS_COLOR;
  const rotate = `rotate(-90 ${TV_SEAT_RING_CX} ${TV_SEAT_RING_CY})`;

  return (
    <g aria-hidden>
      <circle
        cx={TV_SEAT_RING_CX}
        cy={TV_SEAT_RING_CY}
        r={TV_SEAT_RING_TIMER_R_MID}
        fill="none"
        stroke={progressStroke}
        strokeWidth={TV_SEAT_RING_TIMER_STROKE_WIDTH}
        strokeLinecap="butt"
        strokeDasharray={`${filled} ${circumference}`}
        transform={rotate}
        style={{ transition: "stroke 0.25s ease-out" }}
      />
      {ringState.paused ? (
        <text
          x={TV_SEAT_RING_CX}
          y={TV_SEAT_RING_CY}
          fill={TIMER_PAUSED_COLOR}
          textAnchor="middle"
          dominantBaseline="middle"
          style={{
            fontSize: `${PAUSED_LABEL_VIEWBOX_SIZE * unitPx}px`,
            fontWeight: 700,
            letterSpacing: "0.1em",
          }}
        >
          PAUSED
        </text>
      ) : null}
    </g>
  );
}
