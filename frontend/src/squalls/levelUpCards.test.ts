import { describe, expect, it } from "vitest";

import { rollLevelUpCardChoices } from "./tavernCards";
import { createInitialHero } from "./shantiesLocalSave";

describe("rollLevelUpCardChoices export", () => {
  it("returns three cards by default", () => {
    const cards = rollLevelUpCardChoices(createInitialHero());
    expect(cards).toHaveLength(3);
  });

  it("returns distinct offers from equipment pools", () => {
    const cards = rollLevelUpCardChoices(createInitialHero());
    expect(new Set(cards).size).toBe(3);
  });
});
