import type { ScoreboardTemplate } from "./types";

export const SCORENADO_MAX_PLAYERS = 8;
export const SCORENADO_MAX_TEMPLATE_ROUNDS = 99;
export const SCORENADO_DEFAULT_MIN_PLAYERS = 2;
export const SCORENADO_DEFAULT_ROUND_COUNT = 3;
export const SCORENADO_ABSOLUTE_MIN_PLAYERS = 1;

export function clampTemplateMinPlayers(value: number): number {
  return Math.max(
    SCORENADO_ABSOLUTE_MIN_PLAYERS,
    Math.min(SCORENADO_MAX_PLAYERS, value),
  );
}

export function clampTemplateDefaultRounds(value: number): number {
  return Math.max(1, Math.min(SCORENADO_MAX_TEMPLATE_ROUNDS, value));
}

export function templateMinPlayers(template: ScoreboardTemplate | null): number {
  return clampTemplateMinPlayers(template?.min_players ?? SCORENADO_DEFAULT_MIN_PLAYERS);
}

export function templateDefaultRoundCount(
  template: ScoreboardTemplate | null,
): number {
  return clampTemplateDefaultRounds(
    template?.default_round_count ?? SCORENADO_DEFAULT_ROUND_COUNT,
  );
}
