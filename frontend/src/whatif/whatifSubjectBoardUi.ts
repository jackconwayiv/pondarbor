import type { WhatIfPlayer } from "./types";

/** L = P (2 players) or P + 1 (3+ includes Challenge at index L − 1). */
export function subjectBoardSeatCount(numPlayers: number): number {
  if (numPlayers <= 0) return 0;
  if (numPlayers === 2) return 2;
  return numPlayers + 1;
}

export function subjectBoardSeatIsChallenge(seatIndex: number, numPlayers: number): boolean {
  const L = subjectBoardSeatCount(numPlayers);
  return numPlayers >= 3 && seatIndex === L - 1;
}

/** Join-order player seats 0..P−1; last seat is Challenge when L = P + 1. */
export function subjectBoardSeatLabel(playersJoinOrder: WhatIfPlayer[], seatIndex: number): string {
  const P = playersJoinOrder.length;
  const L = subjectBoardSeatCount(P);
  if (seatIndex < 0 || seatIndex >= L) return "?";
  if (subjectBoardSeatIsChallenge(seatIndex, P)) return "Challenge";
  return playersJoinOrder[seatIndex]?.display_name ?? "?";
}
