export type AchievementSummary = {
  slug: string;
  title: string;
  description: string;
  category: string;
  unlocked_at: string;
  display_group: string;
  display_group_order: number;
  /** When false, hidden from friends’ profiles; null/true treated as shown. Omitted on friend-only payloads is fine. */
  visible_to_friends?: boolean | null;
};

/** API row from `POST …/achievement-peers/` (minimal fields for avatars). */
export type AchievementPeerAvatarRow = {
  id: number;
  nickname: string;
  avatar_url: string;
};

/** Earner on a Hall of Fame row (`GET …/achievement-trophy-case/`). */
export type HallOfFameEarner = AchievementPeerAvatarRow & {
  unlocked_at: string;
};

/** Row from `GET …/achievement-trophy-case/`. */
export type HallOfFameRow = {
  slug: string;
  title: string;
  description: string;
  category: string;
  display_group: string;
  display_group_order: number;
  catalog_order: number;
  is_earned: boolean;
  earner_count: number;
  earners: HallOfFameEarner[];
};

export type HallOfFameCategoryGroup = {
  category: string;
  label: string;
  emoji: string;
  earnedRows: HallOfFameRow[];
  lockedRows: HallOfFameRow[];
};

export type HallOfFamePayload = {
  population_count: number;
  rows: HallOfFameRow[];
};
