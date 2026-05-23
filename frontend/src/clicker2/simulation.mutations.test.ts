import { describe, expect, it } from "vitest";

import { getDenizenDef } from "./denizens";
import { simulateGame } from "./simulation";

describe("simulation mutations", () => {
  it("applies +level% EpS per copy for owned denizens", () => {
    const owned = { fungi: 10 };
    const base = simulateGame(owned, {});
    const mutated = simulateGame(owned, {}, { fungi: 5 });
    expect(mutated.denizenEps.fungi).toBeCloseTo(base.denizenEps.fungi * 1.05);
    expect(mutated.energyPerSecond).toBeCloseTo(base.energyPerSecond * 1.05);
  });

  it("does not boost unowned denizens", () => {
    const def = getDenizenDef("microbes");
    expect(def).toBeDefined();
    const none = simulateGame({}, {}, { microbes: 10 });
    expect(none.denizenEps.microbes ?? 0).toBe(0);
    expect(none.energyPerSecond).toBe(0);
  });
});
