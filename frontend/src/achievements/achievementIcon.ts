/** Frontend map: one place for achievement medal emojis (aligned with backend slugs in `achievements.services`). */
const SLUG_TO_EMOJI: Record<string, string> = {
  archivist: "📚",
  town_crier: "📣",
  whatif_wiz: "🧙",
  whatif_warrior: "⚔️",
  pondclicker_tier_1_pond: "🐌",
  pondclicker_tier_2_pond: "🦐",
  pondclicker_tier_3_pond: "🐟",
  pondclicker_tier_4_pond: "🐸",
  pondclicker_tier_5_pond: "🦆",
  pondclicker_tier_6_pond: "🦦",
  sharing_is_caring: "🤝",
  something_borrowed: "👜",
  good_as_new: "✨",
  thats_amore: "🍝",
  tasty_plans: "👨‍🍳",
  smorgasbord: "\u{1F37D}",
  i_can_smell_it_from_here: "\u{1F963}",
  month_of_music: "\u{1F3B6}",
  music_lover: "\u{1F493}",
};

const DEFAULT_EMOJI = "🏆";

export function emojiForAchievementSlug(slug: string): string {
  return SLUG_TO_EMOJI[slug] ?? DEFAULT_EMOJI;
}
