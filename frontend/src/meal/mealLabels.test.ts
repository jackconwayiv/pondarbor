import { describe, expect, it } from "vitest";

import { dayColumnOrder, mealLabel } from "./mealLabels";
import type { Meal, Recipe } from "./types";

function recipe(id: number, title: string): Recipe {
  return {
    id,
    owner_user: 1,
    title,
    directions: "",
    notes: "",
    cloned_from_recipe: null,
    ingredients: [],
    created_at: "",
    updated_at: "",
  };
}

function meal(partial: Partial<Meal> & Pick<Meal, "id">): Meal {
  return {
    owner_user: 1,
    recipes: [],
    title: "",
    blurb: "",
    cloned_from_meal: null,
    created_at: "",
    updated_at: "",
    ...partial,
  };
}

describe("dayColumnOrder", () => {
  it("rotates from weekStartsOn through 6 and wraps", () => {
    expect(dayColumnOrder(0)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(dayColumnOrder(3)).toEqual([3, 4, 5, 6, 0, 1, 2]);
    expect(dayColumnOrder(6)).toEqual([6, 0, 1, 2, 3, 4, 5]);
  });
});

describe("mealLabel", () => {
  it("uses trimmed title when present", () => {
    expect(mealLabel(meal({ id: 1, title: "  Taco night  " }))).toBe("Taco night");
  });

  it("truncates long titles with ellipsis", () => {
    const long = "a".repeat(50);
    expect(mealLabel(meal({ id: 1, title: long }))).toBe(`${"a".repeat(48)}…`);
  });

  it("falls back to recipe titles when title empty", () => {
    const m = meal({
      id: 2,
      title: "",
      recipes: [recipe(1, "Soup"), recipe(2, "Salad")],
    });
    expect(mealLabel(m)).toBe("Soup, Salad");
  });

  it("falls back to blurb when no title or recipes", () => {
    expect(mealLabel(meal({ id: 3, title: "", blurb: "Leftovers" }))).toBe("Leftovers");
  });

  it("falls back to Meal #id when nothing else", () => {
    expect(mealLabel(meal({ id: 42, title: "", blurb: "" }))).toBe("Meal #42");
  });
});
