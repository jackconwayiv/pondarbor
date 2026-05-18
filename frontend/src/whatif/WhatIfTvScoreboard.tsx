import { Box, HStack, Stack, Text } from "@chakra-ui/react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import type { WhatIfPlayer } from "./types";
import { WhatIfPlayerFace } from "./whatifPlayerFace";
import { whatifPlayerSeatIndex } from "./whatifPlayerSeatColors";
import "./whatifScoreboard.css";
import {
  buildScoreboardPlayerScores,
  getAnimatedDisplayScore,
  getScoreboardRevealPhase,
  isScoreboardDeltaEntering,
  shouldShowScoreboardDelta,
  sortScoreboardRows,
  sortScoreboardRowsFinalPreservingTies,
  usePreRevealScoreboardOrder,
  type ScoreboardRevealPhase,
} from "./whatifScoreboardRevealAnimation";
import {
  formatRoundScoreDelta,
  scoreboardCompetitionRanks,
  scoreboardRowMedalGradient,
} from "./whatifScoreboardUi";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

type WhatIfTvScoreboardProps = {
  players: WhatIfPlayer[];
  status: string | undefined;
  roundScores: Record<string, number> | undefined;
  revealedAt: string | null | undefined;
  nowMs: number;
  joinOrderPlayers: WhatIfPlayer[];
  viewerPlayerId: number | null;
  activeChallengeRound: boolean;
  tvMutedColor: string;
};

export function WhatIfTvScoreboard({
  players,
  status,
  roundScores,
  revealedAt,
  nowMs,
  joinOrderPlayers,
  viewerPlayerId,
  activeChallengeRound,
  tvMutedColor,
}: WhatIfTvScoreboardProps) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const rowRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const lastRowTopsRef = useRef<Map<number, number>>(new Map());
  const reorderFlipStartedRef = useRef(false);
  const revealedAtRef = useRef(revealedAt);

  useEffect(() => {
    const mq = window.matchMedia(REDUCED_MOTION);
    const update = () => setPrefersReducedMotion(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const isPostResults = status === "post_results";
  const animateReveal = isPostResults && !!revealedAt && !prefersReducedMotion;

  const phase: ScoreboardRevealPhase | null = animateReveal
    ? getScoreboardRevealPhase(revealedAt, nowMs)
    : null;

  const playerScores = useMemo(
    () => buildScoreboardPlayerScores(players, roundScores),
    [players, roundScores],
  );

  const usePreRevealOrder = animateReveal && usePreRevealScoreboardOrder(phase);

  const settleOrderRows = useMemo(
    () => sortScoreboardRows(playerScores, true),
    [playerScores],
  );

  const sortedRows = useMemo(() => {
    if (!animateReveal || usePreRevealOrder) {
      return sortScoreboardRows(playerScores, !!usePreRevealOrder);
    }
    return sortScoreboardRowsFinalPreservingTies(playerScores, settleOrderRows);
  }, [animateReveal, usePreRevealOrder, playerScores, settleOrderRows]);

  const orderKey = sortedRows.map((r) => r.id).join(",");

  const rankByPlayerId = useMemo(() => {
    if (animateReveal && usePreRevealOrder) {
      return scoreboardCompetitionRanks(
        playerScores.map((r) => ({ id: r.id, score: r.preRevealScore })),
      );
    }
    return scoreboardCompetitionRanks(players);
  }, [animateReveal, usePreRevealOrder, playerScores, players]);

  const staticRows = useMemo(() => {
    if (animateReveal) return null;
    return [...players].sort(
      (a, b) => b.score - a.score || a.display_name.localeCompare(b.display_name),
    );
  }, [animateReveal, players]);

  useEffect(() => {
    if (revealedAtRef.current !== revealedAt) {
      revealedAtRef.current = revealedAt;
      reorderFlipStartedRef.current = false;
      lastRowTopsRef.current = new Map();
    }
  }, [revealedAt]);

  useLayoutEffect(() => {
    if (!animateReveal) return;

    const prevTops = lastRowTopsRef.current;

    if (phase === "reorder" && !reorderFlipStartedRef.current && prevTops.size > 0) {
      reorderFlipStartedRef.current = true;
      const deltas = new Map<number, number>();

      for (const [id, el] of rowRefs.current) {
        const prevTop = prevTops.get(id);
        if (prevTop == null) continue;
        const nextTop = el.getBoundingClientRect().top;
        const dy = prevTop - nextTop;
        if (Math.abs(dy) > 0.5) deltas.set(id, dy);
      }

      if (deltas.size > 0) {
        for (const [id, dy] of deltas) {
          const el = rowRefs.current.get(id);
          if (!el) continue;
          el.style.transform = `translateY(${dy}px)`;
          el.style.transition = "none";
        }

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            for (const [id] of deltas) {
              const el = rowRefs.current.get(id);
              if (!el) continue;
              const handleEnd = () => {
                el.removeEventListener("transitionend", handleEnd);
                el.style.transition = "";
                el.style.transform = "";
              };
              el.addEventListener("transitionend", handleEnd);
              el.style.transition = "transform 500ms ease-out";
              el.style.transform = "translateY(0)";
            }
          });
        });
      }
    }

    const tops = new Map<number, number>();
    for (const [id, el] of rowRefs.current) {
      tops.set(id, el.getBoundingClientRect().top);
    }
    lastRowTopsRef.current = tops;
  }, [animateReveal, phase, orderKey, sortedRows.length]);

  if (players.length === 0) {
    return (
      <Text color={tvMutedColor} fontSize="clamp(1rem, 2.2vh, 1.2rem)" textAlign="center" py="2">
        —
      </Text>
    );
  }

  if (!animateReveal && staticRows) {
    return (
      <Stack gap="2" w="100%" pt="1">
        {staticRows.map((p) => {
          const seatIndex = whatifPlayerSeatIndex(p.id, joinOrderPlayers);
          const placement = rankByPlayerId[p.id];
          const medalBg = scoreboardRowMedalGradient(placement);
          const roundDelta =
            isPostResults ? Number(roundScores?.[String(p.id)] ?? 0) : 0;
          return (
            <ScoreboardRow
              key={p.id}
              rowRef={(el) => {
                if (el) rowRefs.current.set(p.id, el);
                else rowRefs.current.delete(p.id);
              }}
              medalBg={medalBg}
              seatIndex={seatIndex}
              player={p}
              viewerPlayerId={viewerPlayerId}
              displayName={p.display_name}
              displayScore={p.score}
              roundDelta={roundDelta}
              showDelta={roundDelta !== 0}
              deltaEntering={false}
              flipClassName=""
              activeChallengeRound={activeChallengeRound}
              tvMutedColor={tvMutedColor}
            />
          );
        })}
      </Stack>
    );
  }

  const effectivePhase = prefersReducedMotion ? "done" : phase;

  return (
    <Stack gap="2" w="100%" pt="1">
      {sortedRows.map((row) => {
        const seatIndex = whatifPlayerSeatIndex(row.id, joinOrderPlayers);
        const placement = rankByPlayerId[row.id];
        const medalBg = scoreboardRowMedalGradient(placement);
        const showDelta = shouldShowScoreboardDelta(effectivePhase);
        const deltaEntering = isScoreboardDeltaEntering(effectivePhase);
        const displayScore = getAnimatedDisplayScore(
          row.preRevealScore,
          row.finalScore,
          effectivePhase,
          revealedAt,
          nowMs,
        );
        const player = players.find((p) => p.id === row.id)!;

        return (
          <ScoreboardRow
            key={row.id}
            rowRef={(el) => {
              if (el) rowRefs.current.set(row.id, el);
              else rowRefs.current.delete(row.id);
            }}
            medalBg={medalBg}
            seatIndex={seatIndex}
            player={player}
            viewerPlayerId={viewerPlayerId}
            displayName={row.display_name}
            displayScore={displayScore}
            roundDelta={row.roundDelta}
            showDelta={showDelta && row.roundDelta !== 0}
            deltaEntering={deltaEntering}
            flipClassName={effectivePhase === "reorder" ? "whatif-scoreboard-row--flip" : ""}
            activeChallengeRound={activeChallengeRound}
            tvMutedColor={tvMutedColor}
          />
        );
      })}
    </Stack>
  );
}

type ScoreboardRowProps = {
  rowRef: (el: HTMLDivElement | null) => void;
  medalBg: string | undefined;
  seatIndex: number;
  player: WhatIfPlayer;
  viewerPlayerId: number | null;
  displayName: string;
  displayScore: number;
  roundDelta: number;
  showDelta: boolean;
  deltaEntering: boolean;
  flipClassName: string;
  activeChallengeRound: boolean;
  tvMutedColor: string;
};

function ScoreboardRow({
  rowRef,
  medalBg,
  seatIndex,
  player,
  viewerPlayerId,
  displayName,
  displayScore,
  roundDelta,
  showDelta,
  deltaEntering,
  flipClassName,
  activeChallengeRound,
  tvMutedColor,
}: ScoreboardRowProps) {
  return (
    <Box
      ref={rowRef}
      position="relative"
      w="100%"
      minW={0}
      borderRadius="md"
      bg={medalBg}
      px="2"
      py="1"
      className={flipClassName || undefined}
    >
      <HStack align="center" gap="3" w="100%" minW={0} justify="space-between">
        <HStack flex="1" minW={0} gap="2" align="center">
          <WhatIfPlayerFace
            player={player}
            viewerPlayerId={viewerPlayerId}
            seatIndex={seatIndex >= 0 ? seatIndex : undefined}
            avatarSize="lg"
          />
          <Text
            fontSize="clamp(1.2rem, 3vh, 1.65rem)"
            fontWeight="semibold"
            lineHeight="1.25"
          >
            {displayName} · {displayScore} pts
          </Text>
          {player.paused ? (
            <Text
              color={tvMutedColor}
              fontSize="clamp(0.85rem, 2vh, 1rem)"
              fontWeight="medium"
            >
              (paused)
            </Text>
          ) : null}
        </HStack>
        <Box minW="3.5rem" display="flex" justifyContent="flex-end" alignItems="center">
          {showDelta ? (
            <Text
              className={[
                "whatif-scoreboard-delta",
                roundDelta > 0 ? "whatif-scoreboard-delta--positive" : "whatif-scoreboard-delta--negative",
                activeChallengeRound && roundDelta < 0
                  ? "whatif-scoreboard-delta--negative-on-challenge"
                  : "",
                deltaEntering ? "whatif-scoreboard-delta--enter" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {formatRoundScoreDelta(roundDelta)}
            </Text>
          ) : null}
        </Box>
      </HStack>
    </Box>
  );
}
