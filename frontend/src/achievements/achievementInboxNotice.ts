import { emojiForAchievementSlug } from "./achievementIcon";
import { sortAchievementsNewestFirst } from "./sortAchievements";
import type { AchievementSummary } from "./types";

export function achievementInboxId(slug: string): string {
  return `achievement-${slug}`;
}

const ACHIEVEMENT_INBOX_ID_PREFIX = "achievement-";

export function achievementSlugFromInboxId(id: string): string | null {
  if (!id.startsWith(ACHIEVEMENT_INBOX_ID_PREFIX)) return null;
  const slug = id.slice(ACHIEVEMENT_INBOX_ID_PREFIX.length);
  return slug.length > 0 ? slug : null;
}

export function formatAchievementInboxNotice(a: AchievementSummary): string {
  return `${emojiForAchievementSlug(a.slug)} Unlocked: ${a.title}. ${a.description}`;
}

/** Unread achievement unlock notices for the home inbox bell (newest first). */
export function deriveUnreadAchievementNotices(
  achievements: AchievementSummary[],
  readIds: ReadonlySet<string>,
): { id: string; text: string }[] {
  return sortAchievementsNewestFirst(achievements)
    .filter((a) => !readIds.has(achievementInboxId(a.slug)))
    .map((a) => ({
      id: achievementInboxId(a.slug),
      text: formatAchievementInboxNotice(a),
    }));
}
