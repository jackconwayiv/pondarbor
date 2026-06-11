import { normalizePantryTags } from "./pantryTagVocab";
import type { PantryTagDimension } from "./pantryTagVocab";
import type { PantryInventoryRow } from "./types";

export type PantrySortKey =
  | "name_asc"
  | "name_desc"
  | "location"
  | "quantity"
  | "food_group"
  | "storage"
  | "preferred_meal"
  | "dietary";

export const PANTRY_SORT_OPTIONS: { value: PantrySortKey; label: string }[] = [
  { value: "name_asc", label: "Name A–Z" },
  { value: "name_desc", label: "Name Z–A" },
  { value: "location", label: "Location" },
  { value: "quantity", label: "Quantity" },
  { value: "food_group", label: "Food group" },
  { value: "storage", label: "Storage" },
  { value: "preferred_meal", label: "Preferred meal" },
  { value: "dietary", label: "Dietary" },
];

export function ingredientFoodGroup(row: PantryInventoryRow): string {
  const fromIngredient = (row.ingredient.food_group ?? "").trim();
  if (fromIngredient) return fromIngredient;
  const tags = normalizePantryTags(row.pantry_tags);
  return tags.food_group[0]?.trim() ?? "";
}

function primaryTag(row: PantryInventoryRow, dim: PantryTagDimension): string {
  if (dim === "food_group") {
    return ingredientFoodGroup(row).toLowerCase();
  }
  const tags = normalizePantryTags(row.pantry_tags);
  return tags[dim][0]?.toLowerCase() ?? "";
}

function compareName(a: PantryInventoryRow, b: PantryInventoryRow, dir: 1 | -1): number {
  return dir * a.ingredient.name.localeCompare(b.ingredient.name);
}

export function sortPantryRows(rows: PantryInventoryRow[], sort: PantrySortKey): PantryInventoryRow[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    let cmp = 0;
    switch (sort) {
      case "name_asc":
        return compareName(a, b, 1);
      case "name_desc":
        return compareName(a, b, -1);
      case "location":
        cmp = (a.location || "").localeCompare(b.location || "");
        break;
      case "quantity": {
        const aq = a.simple_have != null ? (a.simple_have ? 1 : 0) : a.quantity;
        const bq = b.simple_have != null ? (b.simple_have ? 1 : 0) : b.quantity;
        cmp = aq - bq;
        break;
      }
      case "food_group":
      case "storage":
      case "preferred_meal":
      case "dietary":
        cmp = primaryTag(a, sort).localeCompare(primaryTag(b, sort));
        break;
    }
    if (cmp !== 0) return cmp;
    return a.ingredient.name.localeCompare(b.ingredient.name);
  });
  return copy;
}

export function filterPantryRows(
  rows: PantryInventoryRow[],
  nameQuery: string,
  tagFilters: Partial<Record<PantryTagDimension, string>>,
): PantryInventoryRow[] {
  const q = nameQuery.trim().toLowerCase();
  return rows.filter((row) => {
    if (q && !row.ingredient.name.toLowerCase().includes(q)) return false;
    for (const [dim, want] of Object.entries(tagFilters) as [PantryTagDimension, string][]) {
      if (!want) continue;
      const fold = want.toLowerCase();
      if (dim === "food_group") {
        if (ingredientFoodGroup(row).toLowerCase() !== fold) return false;
        continue;
      }
      const tags = normalizePantryTags(row.pantry_tags);
      if (!tags[dim].some((t) => t.toLowerCase() === fold)) return false;
    }
    return true;
  });
}

export function formatPantryQuantity(row: PantryInventoryRow): string {
  if (row.simple_have === true) return "Have";
  if (row.simple_have === false) return "Don’t have";
  return `qty ${row.quantity}`;
}

export function formatPantryLocation(row: PantryInventoryRow): string {
  const loc = (row.location ?? "").trim();
  const owner = row.owner_label?.trim();
  if (!loc && !owner) return "No location";
  if (loc && owner) return `${loc} · ${owner}`;
  return loc || owner || "No location";
}

export function formatPantryRecommendationHint(row: PantryInventoryRow): string | null {
  if (row.pantry_recommendation_hint === "not_scheduled") return "Not Scheduled";
  if (row.pantry_recommendation_hint === "no_recipes") return "No Recipes";
  return null;
}

export function isPantryRowDepleted(row: PantryInventoryRow): boolean {
  return row.quantity === 0 && row.simple_have !== true;
}

export function partitionDepletedPantryRows(rows: PantryInventoryRow[]): PantryInventoryRow[] {
  const stocked: PantryInventoryRow[] = [];
  const depleted: PantryInventoryRow[] = [];
  for (const row of rows) {
    (isPantryRowDepleted(row) ? depleted : stocked).push(row);
  }
  return [...stocked, ...depleted];
}
