import type { RecommendationCategory } from "./types";

export type CategoryGroupId = "places" | "media" | "links";

export type CategoryGroupConfig = {
  id: CategoryGroupId;
  label: string;
  emoji: string;
  description: string;
  /** Preset slug order within the group. */
  slugOrder: string[];
};

export const CATEGORY_GROUPS: CategoryGroupConfig[] = [
  {
    id: "places",
    label: "Places",
    emoji: "📍",
    description: "Restaurants, businesses, and destinations",
    slugOrder: ["restaurants", "businesses", "destinations"],
  },
  {
    id: "media",
    label: "Media",
    emoji: "🎭",
    description: "Books, TV, films, and music",
    slugOrder: ["books", "tv", "films", "music"],
  },
  {
    id: "links",
    label: "Links",
    emoji: "🔗",
    description: "Websites, articles, and other URLs",
    slugOrder: ["links"],
  },
];

export function categoriesForGroup(
  groupId: CategoryGroupId,
  categories: RecommendationCategory[],
): RecommendationCategory[] {
  const config = CATEGORY_GROUPS.find((g) => g.id === groupId);
  const inGroup = categories.filter((c) => c.group === groupId);
  if (!config) return inGroup;
  const order = new Map(config.slugOrder.map((slug, i) => [slug, i]));
  return [...inGroup].sort((a, b) => {
    const ai = order.get(a.slug) ?? 999;
    const bi = order.get(b.slug) ?? 999;
    if (ai !== bi) return ai - bi;
    return a.name.localeCompare(b.name);
  });
}

export function groupLabel(groupId: CategoryGroupId): string {
  return CATEGORY_GROUPS.find((g) => g.id === groupId)?.label ?? groupId;
}

export function defaultCategorySlugForGroup(groupId: CategoryGroupId): string {
  return CATEGORY_GROUPS.find((g) => g.id === groupId)?.slugOrder[0] ?? "";
}

/** Singular labels for the add-recommendation picker ("What are you recommending?"). */
const CATEGORY_PICK_LABELS: Record<string, string> = {
  restaurants: "Restaurant",
  businesses: "Business",
  destinations: "Destination",
  books: "Book",
  tv: "TV",
  films: "Film",
  music: "Music",
  links: "Link",
};

export function categoryPickLabel(category: RecommendationCategory): string {
  return CATEGORY_PICK_LABELS[category.slug] ?? category.name;
}
