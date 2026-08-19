/** Display labels and app routes for achievement `category` slugs from the catalog. */
const CATEGORY_META: Record<string, { label: string; emoji: string; to: string }> = {
  quotes: { label: "Quotes", emoji: "📜", to: "/quotes" },
  songaday: { label: "Song-a-Day", emoji: "🎶", to: "/songaday" },
  calendar: { label: "Calendar", emoji: "🗓️", to: "/calendar" },
  closet: { label: "Community Closet", emoji: "👒", to: "/closet" },
  people: { label: "Family Tree", emoji: "🌳", to: "/people" },
  goals: { label: "Goal-Getter", emoji: "🏅", to: "/goals" },
  zodiac: { label: "Zodiackary", emoji: "🌞", to: "/zodiac" },
  meal: { label: "Meal Maestro", emoji: "🧑‍🍳", to: "/meal" },
  scorenado: { label: "Scorenado", emoji: "♣️", to: "/scorenado" },
  whatif: { label: "WhatIf", emoji: "🎲", to: "/whatif" },
  pondclicker: { label: "PondClicker", emoji: "🪷", to: "/clicker" },
  estates: { label: "Estates", emoji: "🏰", to: "/estates" },
  onboarding: { label: "Pond Arbor", emoji: "👋", to: "/" },
  recommendations: { label: "Recommenda", emoji: "👍", to: "/recommendations" },
  books: { label: "Books", emoji: "📚", to: "/books" },
};

const GENERAL_META = { label: "Pond Arbor", emoji: "🏆", to: "/" };

export function achievementCategoryMeta(category: string): {
  label: string;
  emoji: string;
} {
  const key = category.trim();
  if (!key) return GENERAL_META;
  const hit = CATEGORY_META[key];
  if (hit) return { label: hit.label, emoji: hit.emoji };
  return {
    label: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    emoji: "🏆",
  };
}

/** App route for a category; unmapped categories fall back to home. */
export function achievementCategoryAppPath(category: string): string {
  const key = category.trim();
  if (!key) return GENERAL_META.to;
  return CATEGORY_META[key]?.to ?? GENERAL_META.to;
}
