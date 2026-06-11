import { Tag, Wrap, WrapItem } from "@chakra-ui/react";
import type { Meal, MealCategoryBrief } from "./types";

/** Default meal-time label; omit from read-only chips (neutral / uninformative). */
function isVisibleChipLabel(name: string): boolean {
  return name.trim() !== "Average";
}

type MealTagsCategoriesChipsProps = {
  meal: Pick<Meal, "tag_names" | "meal_type" | "cuisine" | "time">;
  /** When set, show at most this many tag chips plus a "+N" chip for the rest. */
  maxTags?: number;
  size?: "sm" | "md" | "lg";
};

export function MealTagsCategoriesChips({
  meal,
  maxTags,
  size = "sm",
}: MealTagsCategoriesChipsProps) {
  const categories = [meal.meal_type, meal.cuisine, meal.time].filter(
    (c): c is MealCategoryBrief => {
      if (!c?.name?.trim()) return false;
      return isVisibleChipLabel(c.name);
    },
  );
  const tags = (meal.tag_names ?? [])
    .map((t) => t.trim())
    .filter(Boolean)
    .filter(isVisibleChipLabel);
  const displayTags = maxTags != null ? tags.slice(0, maxTags) : tags;
  const extraTags = maxTags != null ? Math.max(0, tags.length - maxTags) : 0;

  if (categories.length === 0 && displayTags.length === 0 && extraTags === 0) {
    return null;
  }

  return (
    <Wrap gap="1">
      {categories.map((cat) => (
        <WrapItem key={`${cat.axis}-${cat.id}`}>
          <Tag.Root size={size} colorPalette="lilypad" variant="subtle">
            <Tag.Label>{cat.name}</Tag.Label>
          </Tag.Root>
        </WrapItem>
      ))}
      {displayTags.map((name, i) => (
        <WrapItem key={`tag-${i}-${name}`}>
          <Tag.Root size={size} colorPalette="lilypad" variant="outline">
            <Tag.Label>{name}</Tag.Label>
          </Tag.Root>
        </WrapItem>
      ))}
      {extraTags > 0 ? (
        <WrapItem>
          <Tag.Root size={size} colorPalette="gray" variant="subtle">
            <Tag.Label>+{extraTags}</Tag.Label>
          </Tag.Root>
        </WrapItem>
      ) : null}
    </Wrap>
  );
}
