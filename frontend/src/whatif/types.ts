export type WhatIfPlayer = {
  id: number;
  display_name: string;
  avatar_emoji: string;
  /** Set when the player joined while logged in (profile photo). */
  avatar_url?: string;
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
  proposed_by?: { display_name: string; avatar_url: string } | null;
};

export type WhatIfSubjectOption =
  | { kind: "player"; player_id: number }
  | { kind: "challenge" };

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
  /** Legacy duel tiles only; normal challenge rounds use the subject die. */
  subject_candidate_ids?: number[];
  subject_options?: WhatIfSubjectOption[];
  /** Step rolled on the subject die (1..min(P, 6)); present until the active player picks A/B. */
  subject_die_value?: number | null;
  subject_candidate_seat_a?: number | null;
  subject_candidate_seat_b?: number | null;
  subject_pick_degenerate?: boolean;
  marker_index?: number | null;
  last_subject_seat_index?: number | null;
  duel?: { step: string; challenged_player_id?: number | null } | null;
  voting_deadline_at?: string | null;
  /** True while the active player has paused the voting round (no votes accepted, timer frozen). */
  voting_paused?: boolean;
  /** Seconds remaining on the deadline at the moment of pause; restored on resume. */
  voting_pause_remaining_seconds?: number | null;
  reveal_flairs?: string[];
  pending_question_skip_by_player_id?: number | null;
  skip_ui_suppressed_for_question_id?: number | null;
  /** Times each player id has been the round subject this session. */
  subject_times?: Record<string, number>;
  next_turn_not_before?: string | null;
  final_scores?: Array<{
    player_id: number;
    display_name: string;
    avatar_emoji: string;
    avatar_url?: string;
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

/** One row from GET /api/v1/whatif/sessions/mine/ */
export type WhatIfMySessionRow = {
  short_code: string;
  status: WhatIfSessionState["status"];
  created_at: string;
  updated_at: string;
  is_owner: boolean;
  player_names: string[];
  winner_display_name?: string | null;
};

export type WhatIfMySessionsResponse = {
  open_lobby: WhatIfMySessionRow[];
  in_progress: WhatIfMySessionRow[];
  completed: WhatIfMySessionRow[];
};
