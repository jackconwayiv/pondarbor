/** Frontend map: one place for achievement medal emojis (aligned with backend slugs in `achievements.services`). */
const SLUG_TO_EMOJI: Record<string, string> = {
  archivist: "📚",
  town_crier: "📣",
  whatif_wiz: "🧙",
  whatif_warrior: "⚔️",
  pondclicker_tier_1_pond: "🐌",
  sharing_is_caring: "🤝",
  something_borrowed: "👜",
  good_as_new: "✨",
};

const DEFAULT_EMOJI = "🏆";

export function emojiForAchievementSlug(slug: string): string {
  return SLUG_TO_EMOJI[slug] ?? DEFAULT_EMOJI;
}
