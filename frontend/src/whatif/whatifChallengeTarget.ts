import type { WhatIfRoundState } from "./types";

export function hasChallengeTarget(state: WhatIfRoundState | undefined | null): boolean {
  if (!state) return false;
  return state.challenge_target_player_id != null || state.challenge_target_npc_id != null;
}
