import { describe, expect, it } from "vitest";

import { pickEncounterMonsterNames } from "./monsters";

describe("pickEncounterMonsterNames", () => {
  it("sea fights always include Harpy and Siren for 2–3 total foes", () => {
    for (let i = 0; i < 40; i++) {
      const names = pickEncounterMonsterNames("sea");
      expect(names.filter((name) => name === "Harpy").length).toBeGreaterThanOrEqual(1);
      expect(names.filter((name) => name === "Siren").length).toBe(1);
      expect(names.length).toBeGreaterThanOrEqual(2);
      expect(names.length).toBeLessThanOrEqual(3);
    }
  });
});
