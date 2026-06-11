import type { PantryInventoryRow } from "./types";

export const PANTRY_INGREDIENT_PLACEHOLDER_EMOJI = "🧺";

/** Default pantry card emoji per ingredient category (when no user override). */
export const FOOD_GROUP_DEFAULT_EMOJIS: Record<string, string> = {
  Bread: "🍞",
  Starch: "🍚",
  Vegetables: "🥬",
  Fruit: "🍎",
  Meat: "🥩",
  Protein: "🥚",
  Dairy: "🧀",
  Seafood: "🐟",
  "Pantry staple": "🫙",
  Condiment: "🧂",
  Beverage: "🥤",
};

export function foodGroupDefaultEmoji(foodGroup: string | undefined | null): string | null {
  const fg = (foodGroup ?? "").trim();
  if (!fg) return null;
  return FOOD_GROUP_DEFAULT_EMOJIS[fg] ?? null;
}

export function pantryIngredientDisplayEmoji(row: PantryInventoryRow): string {
  const override = (row.ingredient.display_emoji ?? "").trim();
  if (override) return override;
  const fromCategory = foodGroupDefaultEmoji(row.ingredient.food_group);
  if (fromCategory) return fromCategory;
  return PANTRY_INGREDIENT_PLACEHOLDER_EMOJI;
}
