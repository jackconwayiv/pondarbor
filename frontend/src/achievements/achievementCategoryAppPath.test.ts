import { describe, expect, it } from "vitest";
import { achievementCategoryAppPath } from "./achievementCategoryLabels";

describe("achievementCategoryAppPath", () => {
  it("maps known categories to app routes", () => {
    expect(achievementCategoryAppPath("goals")).toBe("/goals");
    expect(achievementCategoryAppPath("pondclicker")).toBe("/clicker");
  });

  it("sends onboarding to home", () => {
    expect(achievementCategoryAppPath("onboarding")).toBe("/");
  });

  it("falls back to home for unknown categories", () => {
    expect(achievementCategoryAppPath("")).toBe("/");
    expect(achievementCategoryAppPath("future_thing")).toBe("/");
  });
});
