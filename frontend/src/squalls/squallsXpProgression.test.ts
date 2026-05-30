import { describe, expect, it } from "vitest";

import {
  heroLevelFromXp,
  xpRequiredForLevel,
  xpToNextLevel,
} from "./squallsXpProgression";

describe("squallsXpProgression", () => {
  it("matches configured cumulative thresholds", () => {
    expect(xpRequiredForLevel(1)).toBe(0);
    expect(xpRequiredForLevel(2)).toBe(10);
    expect(xpRequiredForLevel(3)).toBe(32);
    expect(xpRequiredForLevel(4)).toBe(68);
    expect(xpRequiredForLevel(5)).toBe(120);
    expect(xpRequiredForLevel(6)).toBe(190);
    expect(xpRequiredForLevel(7)).toBe(280);
  });

  it("maps cumulative xp to level", () => {
    expect(heroLevelFromXp(0)).toBe(1);
    expect(heroLevelFromXp(9)).toBe(1);
    expect(heroLevelFromXp(10)).toBe(2);
    expect(heroLevelFromXp(31)).toBe(2);
    expect(heroLevelFromXp(32)).toBe(3);
    expect(heroLevelFromXp(68)).toBe(4);
    expect(heroLevelFromXp(280)).toBe(7);
  });

  it("reports progress to next level", () => {
    expect(xpToNextLevel(0, 1)).toEqual({ current: 0, needed: 10, remaining: 10 });
    expect(xpToNextLevel(22, 2)).toEqual({ current: 12, needed: 22, remaining: 10 });
    expect(xpToNextLevel(280, 7)).toEqual({ current: 0, needed: 112, remaining: 112 });
  });
});
