import type { GameCategory, GameDetail, GamePlayer } from "./types";

export function isScoredByRounds(scoredByRounds: boolean | undefined): boolean {
  return Boolean(scoredByRounds);
}

/** Scores for one category in the active round (or the only pass when not round-based). */
export function scoresForRound(
  category: GameCategory,
  roundNumber: number,
  roundBased: boolean,
): Record<string, number | null> {
  if (!roundBased) {
    return category.scores ?? {};
  }
  return category.scores_by_round?.[String(roundNumber)] ?? {};
}

export function listRoundNumbers(roundCount: number): number[] {
  const n = Math.max(1, roundCount);
  return Array.from({ length: n }, (_, i) => i + 1);
}

export function gameRoundNumbers(game: GameDetail): number[] {
  return listRoundNumbers(game.round_count ?? 1);
}

export type RoundCategoryRow = {
  categoryIndex: number;
  roundNumber: number;
  category: GameCategory;
  isFirstRoundForCategory: boolean;
  categoryRoundSpan: number;
};

/** Flat rows for a round-based scoreboard (category × round). */
export function roundCategoryTableRows(
  categories: GameCategory[],
  roundCount: number,
): RoundCategoryRow[] {
  const rounds = listRoundNumbers(roundCount);
  const span = rounds.length;
  const rows: RoundCategoryRow[] = [];
  categories.forEach((category, categoryIndex) => {
    rounds.forEach((roundNumber, roundIdx) => {
      rows.push({
        categoryIndex,
        roundNumber,
        category,
        isFirstRoundForCategory: roundIdx === 0,
        categoryRoundSpan: span,
      });
    });
  });
  return rows;
}

export function scoringStepCount(
  categoryCount: number,
  roundCount: number,
  roundBased: boolean,
): number {
  if (!roundBased) return categoryCount;
  return categoryCount * Math.max(1, roundCount);
}

export function scoringStepIndex(
  categoryIndex: number,
  roundNumber: number,
  roundCount: number,
  roundBased: boolean,
): number {
  if (!roundBased) return categoryIndex;
  return categoryIndex * Math.max(1, roundCount) + (roundNumber - 1);
}

export function scoringStepFromIndex(
  step: number,
  roundCount: number,
  roundBased: boolean,
): { categoryIndex: number; roundNumber: number } {
  if (!roundBased) {
    return { categoryIndex: step, roundNumber: 1 };
  }
  const rounds = Math.max(1, roundCount);
  return {
    categoryIndex: Math.floor(step / rounds),
    roundNumber: (step % rounds) + 1,
  };
}

/** Steps within one round (category walk), not the full game. */
export function roundScoringStepCount(categoryCount: number): number {
  return Math.max(1, categoryCount);
}

export function isLastCategoryInRound(
  categoryIndex: number,
  categoryCount: number,
): boolean {
  return categoryIndex >= Math.max(1, categoryCount) - 1;
}

export function isLastScoringRound(activeRound: number, roundCount: number): boolean {
  return activeRound >= Math.max(1, roundCount);
}

function playerHasScore(
  scores: Record<string, number | null>,
  player: GamePlayer,
): boolean {
  const value = scores[player.id];
  return value !== null && value !== undefined;
}

/** True when every scored category has a value for every player in every round. */
export function isGameReadyToFinish(game: GameDetail): boolean {
  const roundBased = isScoredByRounds(game.template.scored_by_rounds);
  const scoredCategories = game.template.categories.filter((c) => c.is_scored);
  if (scoredCategories.length === 0 || game.players.length === 0) {
    return false;
  }
  const rounds = roundBased ? listRoundNumbers(game.round_count) : [1];
  for (const category of scoredCategories) {
    for (const roundNumber of rounds) {
      const scores = scoresForRound(category, roundNumber, roundBased);
      for (const player of game.players) {
        if (!playerHasScore(scores, player)) return false;
      }
    }
  }
  return true;
}

/** First incomplete category/round for Enter scores, or last round start when complete. */
export function suggestedScoringStart(game: GameDetail): {
  categoryIndex: number;
  roundNumber: number;
} {
  const roundBased = isScoredByRounds(game.template.scored_by_rounds);
  const categories = game.template.categories;
  if (!roundBased || categories.length === 0) {
    return { categoryIndex: 0, roundNumber: 1 };
  }
  for (const roundNumber of listRoundNumbers(game.round_count)) {
    for (let categoryIndex = 0; categoryIndex < categories.length; categoryIndex++) {
      const scores = scoresForRound(categories[categoryIndex], roundNumber, true);
      const incomplete = game.players.some((player) => !playerHasScore(scores, player));
      if (incomplete) {
        return { categoryIndex, roundNumber };
      }
    }
  }
  return { categoryIndex: 0, roundNumber: Math.max(1, game.round_count) };
}
