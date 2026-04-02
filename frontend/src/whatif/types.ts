export type WhatIfPlayer = {
  id: number;
  display_name: string;
  avatar_emoji: string;
  score: number;
  skips_remaining: number;
  ready_to_start?: boolean;
  /** Host may pause disconnected players; their vote is not required to reveal. */
  paused?: boolean;
};

export type WhatIfQuestion = {
  id: number;
  prompt: string;
  answers: Record<string, string>;
};

export type WhatIfRoundState = {
  active_player_id?: number | null;
  question_id?: number | null;
  question_prompt?: string | null;
  question?: WhatIfQuestion | null;
  votes?: Record<string, number>;
  vote_counts?: Record<string, number>;
  voted_player_ids?: number[];
  round_scores?: Record<string, number>;
  challenge_target_player_id?: number | null;
  /** Two non-active players chosen for the active player to pick between as round subject (3+ players). */
  subject_candidate_ids?: number[];
  /** Times each player id has been the round subject this session. */
  subject_times?: Record<string, number>;
  next_turn_not_before?: string | null;
  final_scores?: Array<{
    player_id: number;
    display_name: string;
    avatar_emoji: string;
    score: number;
    rank: number;
  }>;
  winner_player_id?: number | null;
  you?: WhatIfPlayer;
  your_vote?: number | null;
};

export type WhatIfSessionState = {
  short_code: string;
  status:
    | "pre_lobby"
    | "open"
    | "turn"
    | "voting"
    | "reveal"
    | "post_results"
    | "ended";
  challenge_mode: boolean;
  state_version: number;
  /** Points needed to win (from server `WHATIF_WIN_SCORE`). */
  win_score?: number;
  state: WhatIfRoundState;
  players?: WhatIfPlayer[];
  created_at?: string;
  updated_at?: string;
};

