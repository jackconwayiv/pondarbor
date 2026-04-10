import type { AchievementSummary } from "./types";

/** Newest unlock first (matches backend `achievement_rows_for_user` ordering). */
export function sortAchievementsNewestFirst(
  rows: AchievementSummary[],
): AchievementSummary[] {
  return [...rows].sort(
    (a, b) =>
      new Date(b.unlocked_at).getTime() - new Date(a.unlocked_at).getTime(),
  );
}
