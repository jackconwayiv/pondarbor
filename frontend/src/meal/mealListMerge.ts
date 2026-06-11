import type { MealListQuery } from "./api";
import type { Meal, SharedMeal } from "./types";

export type MealListEntry = Meal & { author_display?: string };

function tagNamesMatch(meal: Meal, tagsCsv: string): boolean {
  const required = tagsCsv
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  if (required.length === 0) return true;
  const have = new Set((meal.tag_names ?? []).map((t) => t.toLowerCase()));
  return required.every((t) => have.has(t));
}

function mealTextMatches(meal: Meal, text: string | undefined): boolean {
  const needle = text?.trim().toLowerCase();
  if (!needle) return true;
  return (
    (meal.title ?? "").toLowerCase().includes(needle) ||
    (meal.blurb ?? "").toLowerCase().includes(needle) ||
    (meal.directions ?? "").toLowerCase().includes(needle)
  );
}

function mealListFiltersMatch(meal: Meal, q: MealListQuery): boolean {
  if (!mealTextMatches(meal, q.q)) return false;
  if (q.tags?.trim() && !tagNamesMatch(meal, q.tags)) return false;
  if (q.meal_type_id != null && (meal.meal_type?.id ?? null) !== q.meal_type_id) return false;
  if (q.cuisine_id != null && (meal.cuisine?.id ?? null) !== q.cuisine_id) return false;
  if (q.time_id != null && (meal.time?.id ?? null) !== q.time_id) return false;
  if (q.ingredient_id != null) {
    const hit = (meal.ingredients ?? []).some((ing) => ing.ingredient_id === q.ingredient_id);
    if (!hit) return false;
  }
  if (q.ingredient_q?.trim()) {
    const needle = q.ingredient_q.trim().toLowerCase();
    const hit = (meal.ingredients ?? []).some((ing) =>
      (ing.raw_line ?? "").toLowerCase().includes(needle) ||
      (ing.name ?? "").toLowerCase().includes(needle),
    );
    if (!hit) return false;
  }
  return true;
}

/** Client-side filters for owned/partner meals (bootstrap cache). */
export function filterOwnedMealsForList(meals: Meal[], q: MealListQuery): Meal[] {
  return meals.filter((m) => mealListFiltersMatch(m, q));
}

/** Client-side filters for friend-published meals (bootstrap cache). */
export function filterSharedMealsForList(meals: SharedMeal[], q: MealListQuery): SharedMeal[] {
  return meals.filter((m) => mealListFiltersMatch(m, q));
}

function pantryCoverageSortKey(pct: number | null | undefined): number {
  return pct == null ? -1 : pct;
}

export function sortMealListEntries(
  meals: MealListEntry[],
  sort: MealListQuery["sort"],
): MealListEntry[] {
  const copy = [...meals];
  if (sort === "pantry_coverage_pct") {
    copy.sort((a, b) => {
      const diff =
        pantryCoverageSortKey(b.pantry_coverage_pct) - pantryCoverageSortKey(a.pantry_coverage_pct);
      if (diff !== 0) return diff;
      return (a.title ?? "").localeCompare(b.title ?? "", undefined, { sensitivity: "base" });
    });
    return copy;
  }
  if (sort === "title") {
    copy.sort((a, b) =>
      (a.title ?? "").localeCompare(b.title ?? "", undefined, { sensitivity: "base" }),
    );
    return copy;
  }
  if (sort === "upcoming_slot_count") {
    copy.sort((a, b) => {
      const diff = (b.upcoming_slot_count ?? 0) - (a.upcoming_slot_count ?? 0);
      if (diff !== 0) return diff;
      return (a.title ?? "").localeCompare(b.title ?? "", undefined, { sensitivity: "base" });
    });
    return copy;
  }
  copy.sort((a, b) => {
    const tb = Date.parse(b.updated_at) || 0;
    const ta = Date.parse(a.updated_at) || 0;
    return tb - ta;
  });
  return copy;
}

export function mergeOwnedAndSharedMeals(
  owned: Meal[],
  shared: SharedMeal[],
  q: MealListQuery,
): MealListEntry[] {
  const ownedIds = new Set(owned.map((m) => m.id));
  const sharedOnly = filterSharedMealsForList(
    shared.filter((s) => !ownedIds.has(s.id)),
    q,
  );
  const merged: MealListEntry[] = [
    ...owned,
    ...sharedOnly.map((s) => ({
      ...s,
      author_display: s.author_display,
    })),
  ];
  const sortKey = q.sort ?? "pantry_coverage_pct";
  const sorted = sortMealListEntries(merged, sortKey);
  if (sortKey === "pantry_coverage_pct") {
    return sorted;
  }
  return partitionZeroPantryCoverage(sorted);
}

/** When pantry is in use, sink 0% coverage meals (and meals with no countable ingredients) to the bottom. */
export function partitionZeroPantryCoverage(meals: MealListEntry[]): MealListEntry[] {
  const hasCoverage = meals.some((m) => m.pantry_coverage_pct != null);
  if (!hasCoverage) return meals;
  const upper: MealListEntry[] = [];
  const lower: MealListEntry[] = [];
  for (const meal of meals) {
    const pct = meal.pantry_coverage_pct;
    if (pct == null || pct === 0) {
      lower.push(meal);
    } else {
      upper.push(meal);
    }
  }
  return [...upper, ...lower];
}
