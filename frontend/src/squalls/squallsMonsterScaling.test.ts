import { describe, expect, it } from "vitest";

import { scaleMonsterStats } from "./squallsMonsterScaling";

describe("scaleMonsterStats", () => {
  it("keeps baseline stats at level 1", () => {
    expect(scaleMonsterStats({ level: 1, hp: 8, armor: 4 }, 1)).toEqual({
      hp: 8,
      armor: 4,
      damageMin: 1,
      damageMax: 4,
    });
  });

  it("adds +2 hp and +2 min/max damage each level", () => {
    expect(scaleMonsterStats({ level: 1, hp: 8 }, 3)).toEqual({
      hp: 12,
      armor: 0,
      damageMin: 5,
      damageMax: 8,
    });
    expect(scaleMonsterStats({ level: 1, hp: 7 }, 7)).toEqual({
      hp: 19,
      armor: 0,
      damageMin: 13,
      damageMax: 16,
    });
  });
});
