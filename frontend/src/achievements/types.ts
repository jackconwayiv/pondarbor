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
