// Keep in sync with backend/closet/constants.py (CANONICAL_CLOSET_CATEGORIES).

export const CLOSET_CATEGORY_PRESETS = [
  "Clothing",
  "Accessories",
  "Books/Media",
  "Sports/Outdoors",
  "Tools",
  "Board Games",
] as const;

export const CLOSET_CATEGORY_PRESET_SET = new Set<string>(CLOSET_CATEGORY_PRESETS);

/** Preset or custom: letters and forward slashes only. */
export const CLOSET_CUSTOM_CATEGORY_PATTERN = /^[A-Za-z/]+$/;

export const CLOSET_CUSTOM_SELECT_VALUE = "__custom__";

/** Friends browse API only; matches backend closet.constants.FRIENDS_ITEMS_CATEGORY_OTHER. */
export const CLOSET_FRIENDS_CATEGORY_OTHER = "__other__";

export function isAllowedClosetCategory(raw: string): boolean {
  const t = raw.trim();
  if (!t) return true;
  if (CLOSET_CATEGORY_PRESET_SET.has(t)) return true;
  return CLOSET_CUSTOM_CATEGORY_PATTERN.test(t);
}

export function closetCategorySelectValue(category: string): string {
  const t = category.trim();
  if (!t) return "";
  if (CLOSET_CATEGORY_PRESET_SET.has(t)) return t;
  return CLOSET_CUSTOM_SELECT_VALUE;
}
