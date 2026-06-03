import { addPlayer, patchGame, removePlayer } from "./api";
import { playerPlaceholderName } from "./playerDisplayName";
import { SCORENADO_PLAYER_COLORS } from "./playerColors";
import { isScoredByRounds } from "./scorenadoRounds";
import {
  SCORENADO_DEFAULT_MIN_PLAYERS,
  SCORENADO_MAX_PLAYERS,
  SCORENADO_MAX_TEMPLATE_ROUNDS,
  templateMinPlayers,
} from "./scorenadoTemplateSetup";
import type { GameDetail } from "./types";

function clampCount(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function gameMinPlayers(game: GameDetail): number {
  return templateMinPlayers({
    id: game.template.id,
    name: game.template.name,
    scored_by_rounds: game.template.scored_by_rounds,
    low_score_wins: game.template.low_score_wins,
    min_players: game.template.min_players ?? SCORENADO_DEFAULT_MIN_PLAYERS,
    default_round_count: 1,
    is_published: false,
    can_edit: false,
    created_at: "",
    updated_at: "",
    categories: [],
  });
}

export function clampGamePlayerCount(game: GameDetail, count: number): number {
  return clampCount(count, gameMinPlayers(game), SCORENADO_MAX_PLAYERS);
}

export function clampGameRoundCount(game: GameDetail, count: number): number {
  const min = game.round_count;
  return clampCount(count, min, SCORENADO_MAX_TEMPLATE_ROUNDS);
}

export async function applyGameSettings(
  accessToken: string | null,
  gameId: string,
  game: GameDetail,
  targetPlayerCount: number,
  targetRoundCount: number,
): Promise<GameDetail> {
  let current = game;
  const players = clampGamePlayerCount(game, targetPlayerCount);
  const roundBased = isScoredByRounds(game.template.scored_by_rounds);
  const rounds = roundBased ? clampGameRoundCount(game, targetRoundCount) : current.round_count;

  while (current.players.length < players) {
    const n = current.players.length + 1;
    current = await addPlayer(accessToken, gameId, {
      display_name: playerPlaceholderName(n),
      color: `${SCORENADO_PLAYER_COLORS[n % SCORENADO_PLAYER_COLORS.length]}.200`,
    });
  }
  while (current.players.length > players) {
    const last = current.players[current.players.length - 1];
    current = await removePlayer(accessToken, gameId, last.id);
  }

  if (roundBased && rounds > current.round_count) {
    current = await patchGame(accessToken, gameId, { round_count: rounds });
  }

  return current;
}
