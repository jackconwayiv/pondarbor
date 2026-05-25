import { describe, expect, it } from "vitest";

import { isSpecialtyUnlocked } from "./visibility";
import { globalEpsBoost, simulateGame } from "./simulation";
import {
  buildPollinatorChain,
  POLLINATOR_MECHANIC_TEXT,
  POLLINATOR_PRICE_ANCHORS,
  POLLINATOR_SPECIALTY_DENIZEN_ID,
  POLLINATOR_SPECIALTY_ID_START,
  pollinatorPriceAtTier,
  pollinatorUnlockBlossoms,
} from "./pollinatorEvolutions";

describe("pollinatorEvolutions", () => {
  const chain = buildPollinatorChain();

  it("defines 20 specialties ids 632–651", () => {
    expect(chain).toHaveLength(20);
    expect(chain[0]!.id).toBe(POLLINATOR_SPECIALTY_ID_START);
    expect(chain[19]!.id).toBe(POLLINATOR_SPECIALTY_ID_START + 19);
    chain.forEach((def, i) => {
      expect(def.denizenId).toBe(POLLINATOR_SPECIALTY_DENIZEN_ID);
      expect(def.effectText).toBe(POLLINATOR_MECHANIC_TEXT);
      expect(def.unlockBlossoms).toBe(pollinatorUnlockBlossoms(i));
    });
  });

  it("uses price anchors from the specified ladder", () => {
    expect(POLLINATOR_PRICE_ANCHORS[0]).toBe(100_000);
    expect(POLLINATOR_PRICE_ANCHORS[1]).toBe(1_000_000);
    expect(POLLINATOR_PRICE_ANCHORS[2]).toBe(10_000_000);
    expect(POLLINATOR_PRICE_ANCHORS[3]).toBe(10_000_000_000);
    expect(POLLINATOR_PRICE_ANCHORS[4]).toBe(100_000_000_000_000);
    expect(pollinatorPriceAtTier(5)).toBe(1e17);
    expect(pollinatorPriceAtTier(6)).toBe(1e20);
  });

  it("unlocks by blossom count not denizen owned", () => {
    const mosquito = chain[0]!;
    const golden = chain[19]!;
    expect(isSpecialtyUnlocked(mosquito, { ripples: 99 }, 0, 0, 4)).toBe(false);
    expect(isSpecialtyUnlocked(mosquito, { ripples: 0 }, 0, 0, 5)).toBe(true);
    expect(isSpecialtyUnlocked(golden, { ripples: 1 }, 0, 0, 99)).toBe(false);
    expect(isSpecialtyUnlocked(golden, { ripples: 1 }, 0, 0, 100)).toBe(true);
  });

  it("stacks +0.01% EpS per blossom per owned pollinator", () => {
    const owned: Record<number, boolean> = {};
    for (const def of chain) owned[def.id] = true;
    const effects = chain.map((d) => d.effect);
    expect(globalEpsBoost(effects, 100)).toBeCloseTo(1.2, 10);
    const sim = simulateGame({ ripples: 1, sediment: 10 }, owned, {}, 100);
    const base = simulateGame({ ripples: 1, sediment: 10 }, {}, {}, 100);
    expect(sim.energyPerSecond).toBeCloseTo(base.energyPerSecond * 1.2, 5);
  });
});
