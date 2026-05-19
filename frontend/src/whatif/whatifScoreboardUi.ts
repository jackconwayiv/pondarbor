export type ScoreboardRankPlayer = { id: number; score: number };

/**
 * Competition ranks from current scores (1,2,2,4…). Empty when everyone is still at 0.
 * Matches backend `final_scores` ranking so medal rows persist across turn/voting phases.
 */
export function scoreboardCompetitionRanks(players: ScoreboardRankPlayer[]): Record<number, number> {
  if (players.length === 0) return {};
  const sorted = [...players].sort((a, b) => b.score - a.score);
  if (sorted.every((p) => p.score === 0)) return {};

  const out: Record<number, number> = {};
  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    const rank = i === 0 ? 1 : p.score === sorted[i - 1].score ? out[sorted[i - 1].id] : i + 1;
    out[p.id] = rank;
  }
  return out;
}

/** Gold medal tint — 1st-place scoreboard rows and game-over TV cards. */
export const WHATIF_SCOREBOARD_GOLD_GRADIENT =
  "linear-gradient(90deg, rgba(255, 215, 0, 0.14), transparent)";

/** Subtle row backgrounds for top 3 ranks (competition ranking). */
export function scoreboardRowMedalGradient(rank: number | undefined): string | undefined {
  if (rank === 1) return WHATIF_SCOREBOARD_GOLD_GRADIENT;
  if (rank === 2) return "linear-gradient(90deg, rgba(180, 190, 200, 0.18), transparent)";
  if (rank === 3) return "linear-gradient(90deg, rgba(180, 120, 70, 0.14), transparent)";
  return undefined;
}

export function formatRoundScoreDelta(delta: number): string {
  if (delta > 0) return `+${delta}`;
  return String(delta);
}

/** Hand/TV headline after reveal from `vote_counts` + answer labels. */
export function formatWhatIfTopVoteLine(
  voteCounts: Record<string, number> | undefined,
  answers: Record<string, string> | undefined,
): string | null {
  const voteRows = Object.entries(voteCounts ?? {}).sort(
    (a, b) => Number(b[1]) - Number(a[1]) || Number(a[0]) - Number(b[0]),
  );
  const topVoteCount = voteRows.length > 0 ? Number(voteRows[0][1]) : 0;
  if (topVoteCount <= 0) return null;

  const winningOptions = voteRows
    .filter(([, count]) => Number(count) === topVoteCount)
    .map(([option]) => {
      const label = answers?.[option]?.trim();
      return label && label !== "" ? label : "(unknown)";
    });
  if (winningOptions.length === 0) return null;
  if (winningOptions.length === 1) return `Top vote: ${winningOptions[0]}`;
  return `Top votes: ${winningOptions.join(" & ")}`;
}
