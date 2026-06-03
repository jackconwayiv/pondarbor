import type { GamePlayer } from "./types";

/** Default seat label when no custom name is set (P1, P2, …). */
export function playerPlaceholderName(seatNumber: number): string {
  return `P${seatNumber}`;
}

/** Label for scoreboard columns and player UI (editable seat name). */
export function playerDisplayName(player: GamePlayer): string {
  return player.display_name;
}
