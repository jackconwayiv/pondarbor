import { describe, expect, it } from "vitest";

import {
  levelOffsetFromRoll,
  resolveEncounterBaseLevel,
  rollEncounterLevel,
} from "./squallsEncounterLevel";

describe("squallsEncounterLevel", () => {
  it("uses hero level as base at sea and wreck", () => {
    expect(
      resolveEncounterBaseLevel({
        heroLevel: 4,
        scope: "sea",
        island: null,
        dungeon: null,
      }),
    ).toBe(4);
    expect(
      resolveEncounterBaseLevel({
        heroLevel: 4,
        scope: "wreck",
        island: null,
        dungeon: null,
      }),
    ).toBe(4);
  });

  it("applies island and dungeon level factors", () => {
    expect(
      resolveEncounterBaseLevel({
        heroLevel: 4,
        scope: "island",
        island: { name: "x", size: null, vibe: "Foreboding", explorePoints: 0, levelFactor: 1 },
        dungeon: null,
      }),
    ).toBe(5);
    expect(
      resolveEncounterBaseLevel({
        heroLevel: 1,
        scope: "islandDungeon",
        island: null,
        dungeon: { kind: "cave", name: "x", delvePoints: 1, levelFactor: -1, areaId: "cave:a" },
      }),
    ).toBe(1);
  });

  it("maps random roll to 15/75/10 offsets", () => {
    expect(levelOffsetFromRoll(0.0)).toBe(-1);
    expect(levelOffsetFromRoll(0.149)).toBe(-1);
    expect(levelOffsetFromRoll(0.15)).toBe(1);
    expect(levelOffsetFromRoll(0.249)).toBe(1);
    expect(levelOffsetFromRoll(0.25)).toBe(0);
  });

  it("clamps rolled level to base +/- 1 with min 1", () => {
    expect(rollEncounterLevel(3, 0.01)).toBe(2);
    expect(rollEncounterLevel(3, 0.2)).toBe(4);
    expect(rollEncounterLevel(1, 0.01)).toBe(1);
  });
});
