import { describe, expect, it } from "vitest";

import { denizenDoubleEfficiencyEffectText, getDenizenDef } from "./denizens";
import { isSpecialtyUnlocked, isSpecialtyShopVisible } from "./visibility";
import {
  buildWindEvolutionChain,
  formatWindUnlockSummary,
  WIND_EVOLUTION_EMOJI,
  WIND_SPECIALTY_DENIZEN_ID,
  WIND_SPECIALTY_ID_START,
} from "./windEvolutions";
import { evolutionDisplayEmoji } from "./clicker2OwnedEvolutions";
import { specialtyTierIndex } from "./specialties";
import { specialtyTierGradient } from "./specialtyTierColors";
import { simulateGame } from "./simulation";

describe("wind evolutions", () => {
  const chain = buildWindEvolutionChain();

  it("defines four cards with fixed prices and ids 675–678", () => {
    expect(chain).toHaveLength(4);
    expect(chain.map((d) => d.id)).toEqual([
      WIND_SPECIALTY_ID_START,
      WIND_SPECIALTY_ID_START + 1,
      WIND_SPECIALTY_ID_START + 2,
      WIND_SPECIALTY_ID_START + 3,
    ]);
    expect(chain.map((d) => d.price)).toEqual([
      90_000,
      180_000,
      27_000_000,
      360_000_000,
    ]);
    expect(chain.every((d) => d.denizenId === WIND_SPECIALTY_DENIZEN_ID)).toBe(
      true,
    );
  });

  it("uses face blowing wind emoji and tier gradients 0–3", () => {
    for (let i = 0; i < chain.length; i++) {
      const def = chain[i]!;
      expect(evolutionDisplayEmoji(def)).toBe(WIND_EVOLUTION_EMOJI);
      expect(specialtyTierIndex(def)).toBe(i);
      expect(specialtyTierGradient(i)).toBe(specialtyTierGradient(specialtyTierIndex(def)));
    }
  });

  it("doubles ripple click and EpS", () => {
    const east = chain[0]!;
    const ripples = getDenizenDef("ripples")!;
    expect(east.effect).toEqual({
      type: "double_click_and_denizen",
      denizenId: "ripples",
    });
    expect(east.effectText).toBe(denizenDoubleEfficiencyEffectText(ripples));

    const owned = { ripples: 10 };
    const before = simulateGame(owned, {});
    const after = simulateGame(owned, { [east.id]: true });
    expect(after.denizenEps.ripples).toBeCloseTo(
      (before.denizenEps.ripples ?? 0) * 2,
      8,
    );
  });

  it("unlocks from wind clicks and ripples owned", () => {
    const east = chain[0]!;
    const south = chain[1]!;
    expect(
      isSpecialtyUnlocked(east, { ripples: 1 }, 0, 0, 0, {}, undefined, 1),
    ).toBe(true);
    expect(
      isSpecialtyUnlocked(east, { ripples: 0 }, 0, 0, 0, {}, undefined, 1),
    ).toBe(false);
    expect(
      isSpecialtyUnlocked(east, { ripples: 1 }, 0, 0, 0, {}, undefined, 0),
    ).toBe(false);
    expect(
      isSpecialtyUnlocked(south, { ripples: 10 }, 0, 0, 0, {}, undefined, 2),
    ).toBe(true);
    expect(
      isSpecialtyUnlocked(south, { ripples: 9 }, 0, 0, 0, {}, undefined, 2),
    ).toBe(false);
    expect(formatWindUnlockSummary(east)).toBe(
      "1 wind event clicked · 1+ Ripples",
    );
  });

  it("hides owned cards from shop", () => {
    const east = chain[0]!;
    expect(
      isSpecialtyShopVisible(
        east,
        { ripples: 5 },
        { [east.id]: true },
        0,
        0,
        0,
        undefined,
        5,
      ),
    ).toBe(false);
  });
});
