import { describe, expect, it } from "vitest";

import { createInitialHero } from "./shantiesLocalSave";
import { applyRest, getRestCost } from "./shantiesRest";

describe("shantiesRest", () => {
  it("costs 3x max HP", () => {
    expect(getRestCost(20)).toBe(60);
    expect(getRestCost(35)).toBe(105);
  });

  it("heals to full and charges rest cost", () => {
    const hero = { ...createInitialHero(), current_hp: 7, gold: 200 };
    const rested = applyRest(hero);
    expect(rested.current_hp).toBe(rested.max_hp);
    expect(rested.gold).toBe(200 - getRestCost(hero.max_hp));
  });
});
