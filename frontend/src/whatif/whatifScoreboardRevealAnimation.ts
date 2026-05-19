/** TV scoreboard reveal timeline (ms from `revealed_at`). */

export const SCOREBOARD_REVEAL_HOLD_MS = 2000;
export const SCOREBOARD_REVEAL_DELTA_IN_MS = 500;
export const SCOREBOARD_REVEAL_SCORE_COUNT_MS = 750;
export const SCOREBOARD_REVEAL_SETTLE_MS = 1000;
export const SCOREBOARD_REVEAL_REORDER_MS = 500;

/** Hold after scoreboard animation before server declares winner; sync with backend constants.py */
export const DECLARE_WINNER_HOLD_MS = 2000;

const DELTA_START_MS = SCOREBOARD_REVEAL_HOLD_MS;
const SCORE_COUNT_START_MS = DELTA_START_MS + SCOREBOARD_REVEAL_DELTA_IN_MS;
const SETTLE_START_MS = SCORE_COUNT_START_MS + SCOREBOARD_REVEAL_SCORE_COUNT_MS;
const REORDER_START_MS = SETTLE_START_MS + SCOREBOARD_REVEAL_SETTLE_MS;
export const SCOREBOARD_REVEAL_TOTAL_MS = REORDER_START_MS + SCOREBOARD_REVEAL_REORDER_MS;

export type ScoreboardRevealPhase =
  | "hold"
  | "deltaIn"
  | "scoreCount"
  | "settle"
  | "reorder"
  | "done";

export function parseRevealedAtMs(revealedAtIso: string | null | undefined): number | null {
  if (!revealedAtIso) return null;
  const t = new Date(revealedAtIso).getTime();
  return Number.isFinite(t) ? t : null;
}

export function getScoreboardRevealElapsedMs(
  revealedAtIso: string | null | undefined,
  nowMs: number,
): number | null {
  const start = parseRevealedAtMs(revealedAtIso);
  if (start == null) return null;
  return Math.max(0, nowMs - start);
}

export function getScoreboardRevealPhase(
  revealedAtIso: string | null | undefined,
  nowMs: number,
): ScoreboardRevealPhase | null {
  const elapsed = getScoreboardRevealElapsedMs(revealedAtIso, nowMs);
  if (elapsed == null) return null;
  if (elapsed < DELTA_START_MS) return "hold";
  if (elapsed < SCORE_COUNT_START_MS) return "deltaIn";
  if (elapsed < SETTLE_START_MS) return "scoreCount";
  if (elapsed < REORDER_START_MS) return "settle";
  if (elapsed < SCOREBOARD_REVEAL_TOTAL_MS) return "reorder";
  return "done";
}

export function usePreRevealScoreboardOrder(phase: ScoreboardRevealPhase | null): boolean {
  return phase === "hold" || phase === "deltaIn" || phase === "scoreCount" || phase === "settle";
}

export function shouldShowScoreboardDelta(phase: ScoreboardRevealPhase | null): boolean {
  return (
    phase === "deltaIn" ||
    phase === "scoreCount" ||
    phase === "settle" ||
    phase === "reorder" ||
    phase === "done"
  );
}

export function isScoreboardDeltaEntering(phase: ScoreboardRevealPhase | null): boolean {
  return phase === "deltaIn";
}

export function getAnimatedDisplayScore(
  preRevealScore: number,
  finalScore: number,
  phase: ScoreboardRevealPhase | null,
  revealedAtIso: string | null | undefined,
  nowMs: number,
): number {
  if (phase === "hold" || phase === "deltaIn" || phase == null) return preRevealScore;
  if (phase === "scoreCount") {
    const elapsed = getScoreboardRevealElapsedMs(revealedAtIso, nowMs) ?? 0;
    const t = Math.min(
      1,
      Math.max(0, (elapsed - SCORE_COUNT_START_MS) / SCOREBOARD_REVEAL_SCORE_COUNT_MS),
    );
    return Math.round(preRevealScore + (finalScore - preRevealScore) * t);
  }
  return finalScore;
}

export type ScoreboardPlayerScores = {
  id: number;
  display_name: string;
  finalScore: number;
  preRevealScore: number;
  roundDelta: number;
};

export function buildScoreboardPlayerScores(
  players: Array<{ id: number; display_name: string; score: number }>,
  roundScores: Record<string, number> | undefined,
): ScoreboardPlayerScores[] {
  return players.map((p) => {
    const roundDelta = Number(roundScores?.[String(p.id)] ?? 0);
    const finalScore = p.score;
    const preRevealScore = finalScore - roundDelta;
    return {
      id: p.id,
      display_name: p.display_name,
      finalScore,
      preRevealScore,
      roundDelta,
    };
  });
}

export function sortScoreboardRows(
  rows: ScoreboardPlayerScores[],
  usePreReveal: boolean,
): ScoreboardPlayerScores[] {
  return [...rows].sort((a, b) => {
    const scoreA = usePreReveal ? a.preRevealScore : a.finalScore;
    const scoreB = usePreReveal ? b.preRevealScore : b.finalScore;
    return scoreB - scoreA || a.display_name.localeCompare(b.display_name);
  });
}

/** Final rank order; tied scores keep settle-phase order so rows do not swap past each other. */
export function sortScoreboardRowsFinalPreservingTies(
  rows: ScoreboardPlayerScores[],
  settleOrder: ScoreboardPlayerScores[],
): ScoreboardPlayerScores[] {
  const settleIndex = new Map(settleOrder.map((r, i) => [r.id, i]));
  return [...rows].sort((a, b) => {
    const byScore = b.finalScore - a.finalScore;
    if (byScore !== 0) return byScore;
    return (settleIndex.get(a.id) ?? 0) - (settleIndex.get(b.id) ?? 0);
  });
}
