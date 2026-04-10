import { describe, expect, it } from "vitest";

import { linesToIngredients } from "./recipeIngredients";

describe("linesToIngredients", () => {
  it("returns empty array for empty or whitespace-only input", () => {
    expect(linesToIngredients("")).toEqual([]);
    expect(linesToIngredients("   \n  \n")).toEqual([]);
  });

  it("trims lines and drops blanks", () => {
    expect(linesToIngredients("  flour  \n\nsugar")).toEqual([
      { raw_line: "flour" },
      { raw_line: "sugar" },
    ]);
  });

  it("maps each non-empty line to a raw_line object", () => {
    expect(linesToIngredients("one\ntwo")).toEqual([{ raw_line: "one" }, { raw_line: "two" }]);
  });
});
