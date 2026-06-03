export type TemplateCategory = {
  id: string;
  name: string;
  description: string;
  sort_order: number;
  is_scored: boolean;
};

export type ScoreboardTemplate = {
  id: string;
  name: string;
  scored_by_rounds: boolean;
  low_score_wins: boolean;
  min_players: number;
  default_round_count: number;
  is_published: boolean;
  can_edit: boolean;
  created_at: string;
  updated_at: string;
  /** Latest game activity for this user with this template (Play sort). */
  last_played_at?: string | null;
  categories: TemplateCategory[];
};

export type TemplateCategoryInput = {
  name: string;
  description?: string;
  sort_order?: number;
  is_scored?: boolean;
};

export type ScorenadoUserSummary = {
  id: number;
  display_name: string;
  avatar_url: string;
};

export type InviteStatus = "pending" | "accepted" | "rejected" | "cancelled" | null;

export type GamePlayer = {
  id: string;
  display_name: string;
  color: string;
  sort_order: number;
  team: string;
  total: number | null;
  is_winner: boolean;
  invite_status?: InviteStatus;
  invited_user?: ScorenadoUserSummary | null;
  claimed_user?: ScorenadoUserSummary | null;
};

export type GameTag = {
  id: string;
  label: string;
  player_id: string | null;
};

export type GameCategory = TemplateCategory & {
  scores: Record<string, number | null>;
  /** Present when template uses scored_by_rounds; keys are round numbers "1", "2", … */
  scores_by_round?: Record<string, Record<string, number | null>>;
};

export type GameDetail = {
  id: string;
  title: string;
  played_at: string | null;
  is_finalized: boolean;
  notes: string;
  round_count: number;
  created_at: string;
  updated_at: string;
  is_owner: boolean;
  can_edit: boolean;
  owner_user?: ScorenadoUserSummary | null;
  template: {
    id: string;
    name: string;
    scored_by_rounds: boolean;
    low_score_wins: boolean;
    min_players?: number;
    categories: GameCategory[];
  };
  players: GamePlayer[];
  tags: GameTag[];
};

export type GameListItem = {
  id: string;
  title: string;
  played_at: string | null;
  is_finalized: boolean;
  template_name: string;
  player_count: number;
  updated_at: string;
  is_owner: boolean;
};

export type ScorenadoSeatInvite = {
  player_id: string;
  game_id: string;
  game_title: string;
  slot_display_name: string;
  owner_label: string;
};

export type ScorenadoStats = {
  games_owned: number;
  games_participated: number;
  wins: number;
};
