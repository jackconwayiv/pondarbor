import { describe, expect, it } from "vitest";

import {
  achievementInboxId,
  achievementSlugFromInboxId,
  deriveUnreadAchievementNotices,
  formatAchievementInboxNotice,
} from "./achievementInboxNotice";
import type { AchievementSummary } from "./types";

function achievement(
  slug: string,
  unlockedAt: string,
  title = "Test Badge",
  description = "You did a thing.",
): AchievementSummary {
  return {
    slug,
    title,
    description,
    category: "pond",
    unlocked_at: unlockedAt,
    display_group: "pond",
    display_group_order: 1,
  };
}

describe("achievementInboxId", () => {
  it("prefixes slug with achievement-", () => {
    expect(achievementInboxId("pondclicker_tier_1_pond")).toBe(
      "achievement-pondclicker_tier_1_pond",
    );
  });
});

describe("achievementSlugFromInboxId", () => {
  it("returns slug for achievement inbox ids", () => {
    expect(
      achievementSlugFromInboxId("achievement-pondclicker_tier_1_pond"),
    ).toBe("pondclicker_tier_1_pond");
  });

  it("returns null for non-achievement ids", () => {
    expect(achievementSlugFromInboxId("pending-friends")).toBeNull();
    expect(achievementSlugFromInboxId("achievement-")).toBeNull();
  });
});

describe("formatAchievementInboxNotice", () => {
  it("mirrors toast title and description in one line", () => {
    const text = formatAchievementInboxNotice(
      achievement("pondclicker_tier_1_pond", "2026-01-01T00:00:00Z"),
    );
    expect(text).toBe("🐌 Unlocked: Test Badge. You did a thing.");
  });
});

describe("deriveUnreadAchievementNotices", () => {
  const older = achievement("older", "2026-01-01T00:00:00Z", "Older");
  const newer = achievement("newer", "2026-02-01T00:00:00Z", "Newer");

  it("returns only achievements not in readIds", () => {
    const readIds = new Set([achievementInboxId("older")]);
    const notices = deriveUnreadAchievementNotices([older, newer], readIds);
    expect(notices).toHaveLength(1);
    expect(notices[0]?.id).toBe(achievementInboxId("newer"));
  });

  it("sorts newest unlock first", () => {
    const notices = deriveUnreadAchievementNotices([older, newer], new Set());
    expect(notices.map((n) => n.id)).toEqual([
      achievementInboxId("newer"),
      achievementInboxId("older"),
    ]);
  });

  it("formats notice text for each unread achievement", () => {
    const notices = deriveUnreadAchievementNotices([newer], new Set());
    expect(notices[0]?.text).toBe("🏆 Unlocked: Newer. You did a thing.");
  });
});
