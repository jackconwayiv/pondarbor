export const PANTRY_TAG_DIMENSIONS = [
  "food_group",
  "storage",
  "preferred_meal",
  "dietary",
] as const;

/** Pantry row tags only — food group lives on the ingredient vocabulary. */
export const PANTRY_ROW_TAG_DIMENSIONS = [
  "storage",
  "preferred_meal",
  "dietary",
] as const;

export type PantryTagDimension = (typeof PANTRY_TAG_DIMENSIONS)[number];
export type PantryRowTagDimension = (typeof PANTRY_ROW_TAG_DIMENSIONS)[number];

export const PANTRY_TAG_DIMENSION_LABELS: Record<PantryTagDimension, string> = {
  food_group: "Food group",
  storage: "Storage",
  preferred_meal: "Preferred meal",
  dietary: "Dietary",
};

const PANTRY_TAG_PRESET_VALUES: Record<PantryTagDimension, readonly string[]> = {
  food_group: [
    "Bread",
    "Starch",
    "Vegetables",
    "Fruit",
    "Meat",
    "Protein",
    "Dairy",
    "Seafood",
    "Pantry staple",
    "Condiment",
    "Beverage",
  ],
  storage: ["Freezer", "Fridge", "Pantry", "Counter", "Spice rack"],
  preferred_meal: ["Breakfast", "Brunch", "Lunch", "Dinner", "Snack", "Dessert"],
  dietary: ["Vegan", "Vegetarian", "Gluten-free", "Low FODMAP", "Nut-free", "Dairy-free"],
};

export const PANTRY_TAG_PRESETS = PANTRY_TAG_PRESET_VALUES;

/** Canonical ingredient category presets (stored on Ingredient.food_group). */
export const INGREDIENT_FOOD_GROUP_PRESETS = PANTRY_TAG_PRESETS.food_group;

import type { PantryTags } from "./types";

export function emptyPantryTags(): PantryTags {
  return {
    food_group: [],
    storage: [],
    preferred_meal: [],
    dietary: [],
  };
}

export function normalizePantryTags(raw: Partial<PantryTags> | null | undefined): PantryTags {
  const base = emptyPantryTags();
  if (!raw) return base;
  for (const key of PANTRY_TAG_DIMENSIONS) {
    const val = raw[key];
    if (!Array.isArray(val)) continue;
    const seen = new Set<string>();
    const cleaned: string[] = [];
    for (const item of val) {
      const s = String(item).trim();
      if (!s) continue;
      const fold = s.toLowerCase();
      if (seen.has(fold)) continue;
      seen.add(fold);
      cleaned.push(s);
    }
    base[key] = cleaned;
  }
  return base;
}

export function pantryTagsSummary(tags: PantryTags): string {
  const parts: string[] = [];
  for (const key of PANTRY_TAG_DIMENSIONS) {
    for (const t of tags[key]) {
      parts.push(t);
    }
  }
  return parts.join(" · ");
}

export function hasAnyPantryTags(tags: PantryTags): boolean {
  return PANTRY_TAG_DIMENSIONS.some((k) => tags[k].length > 0);
}
