import type {
  Meal,
  MealCategoryBrief,
  MealCategoryOptionsByAxis,
  MealPlanInstance,
  PantryInventoryRow,
} from "./types";

export function upsertMealInList(meals: Meal[], meal: Meal): Meal[] {
  const idx = meals.findIndex((m) => m.id === meal.id);
  if (idx < 0) return [...meals, meal];
  const next = [...meals];
  next[idx] = meal;
  return next;
}

export function removeMealFromList(meals: Meal[], mealId: number): Meal[] {
  return meals.filter((m) => m.id !== mealId);
}

export function upsertInstanceInList(
  instances: MealPlanInstance[],
  instance: MealPlanInstance,
): MealPlanInstance[] {
  const idx = instances.findIndex((i) => i.id === instance.id);
  if (idx < 0) return [...instances, instance];
  const next = [...instances];
  next[idx] = instance;
  return next;
}

export function removeInstanceFromList(
  instances: MealPlanInstance[],
  instanceId: number,
): MealPlanInstance[] {
  return instances.filter((i) => i.id !== instanceId);
}

export function upsertPantryRowInList(
  rows: PantryInventoryRow[],
  row: PantryInventoryRow,
): PantryInventoryRow[] {
  const idx = rows.findIndex((r) => r.id === row.id);
  if (idx < 0) return [...rows, row];
  const next = [...rows];
  next[idx] = row;
  return next;
}

export function removePantryRowFromList(
  rows: PantryInventoryRow[],
  rowId: number,
): PantryInventoryRow[] {
  return rows.filter((r) => r.id !== rowId);
}

export function upsertCategoryOption(
  options: MealCategoryOptionsByAxis,
  opt: MealCategoryBrief,
): MealCategoryOptionsByAxis {
  const axis = opt.axis;
  const list = options[axis];
  const idx = list.findIndex((o) => o.id === opt.id);
  const nextList = [...list];
  if (idx < 0) {
    nextList.push(opt);
    nextList.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  } else {
    nextList[idx] = opt;
  }
  return { ...options, [axis]: nextList };
}
