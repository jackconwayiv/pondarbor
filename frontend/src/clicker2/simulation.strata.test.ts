import { describe, expect, it } from "vitest";

import { STRATIFIED_POND_SPECIALTY_ID } from "./fossilShop";
import {
  simulateGame,
  strataEffectFraction,
  strataLevelsEpsBonusPercent,
} from "./simulation";
import { getSpecialtyDef } from "./specialties";

const STRATA_ENERGY_TIER_IDS = [680, 681, 682, 683, 684] as const;

const TIER_FRACTIONS: Record<(typeof STRATA_ENERGY_TIER_IDS)[number], number> =
  {
    680: 0.1,
    681: 0.25,
    682: 0.5,
    683: 0.75,
    684: 1,
  };

/** Fossilized strata count used for per-tier EpS ratio checks. */
const FOSSILIZED_STRATA = 10;

function expectedEpsMultiplier(fossilizedStrata: number, fraction: number): number {
  return 1 + (fossilizedStrata * fraction) / 100;
}

describe("strata levels EpS", () => {
  it("no bonus without Stratified Pond", () => {
    const eps = simulateGame({ ripples: 1 }, { 684: true }, {}, 0, 100);
    const base = simulateGame({ ripples: 1 }, {}, {}, 0, 100);
    expect(eps.energyPerSecond).toBe(base.energyPerSecond);
  });

  it("no bonus with Stratified Pond until a fraction evolution", () => {
    const eps = simulateGame(
      { ripples: 1 },
      { [STRATIFIED_POND_SPECIALTY_ID]: true },
      {},
      0,
      FOSSILIZED_STRATA,
    );
    const base = simulateGame({ ripples: 1 }, {}, {}, 0, FOSSILIZED_STRATA);
    expect(eps.energyPerSecond).toBe(base.energyPerSecond);
  });

  it("ignores stratified pond zero fraction when picking bonus tier", () => {
    const pond = getSpecialtyDef(STRATIFIED_POND_SPECIALTY_ID)!;
    const embedded = getSpecialtyDef(680)!;
    expect(strataEffectFraction([pond.effect, embedded.effect])).toBe(0.1);
    expect(
      strataLevelsEpsBonusPercent(
        [pond.effect, embedded.effect],
        FOSSILIZED_STRATA,
        true,
      ),
    ).toBe(FOSSILIZED_STRATA * 0.1);
  });

  it.each(STRATA_ENERGY_TIER_IDS)(
    "tier %i applies its fraction of the strata EpS bonus",
    (tierId) => {
      const fraction = TIER_FRACTIONS[tierId];
      const base = simulateGame(
        { ripples: 1 },
        {},
        {},
        0,
        FOSSILIZED_STRATA,
      );
      const owned = {
        [STRATIFIED_POND_SPECIALTY_ID]: true,
        [tierId]: true,
      };
      const boosted = simulateGame(
        { ripples: 1 },
        owned,
        {},
        0,
        FOSSILIZED_STRATA,
      );
      expect(boosted.energyPerSecond / base.energyPerSecond).toBeCloseTo(
        expectedEpsMultiplier(FOSSILIZED_STRATA, fraction),
        5,
      );
    },
  );

  it("higher owned tier overrides lower fraction (max fraction rule)", () => {
    const owned = {
      [STRATIFIED_POND_SPECIALTY_ID]: true,
      680: true,
      684: true,
    };
    const boosted = simulateGame(
      { ripples: 1 },
      owned,
      {},
      0,
      FOSSILIZED_STRATA,
    );
    const base = simulateGame({ ripples: 1 }, {}, {}, 0, FOSSILIZED_STRATA);
    expect(boosted.energyPerSecond / base.energyPerSecond).toBeCloseTo(
      expectedEpsMultiplier(FOSSILIZED_STRATA, 1),
      5,
    );
  });

  it("applies fossilized strata at museum fraction (100 strata)", () => {
    const owned = {
      [STRATIFIED_POND_SPECIALTY_ID]: true,
      684: true,
    };
    const withStrata = simulateGame({ ripples: 1 }, owned, {}, 0, 100);
    const base = simulateGame({ ripples: 1 }, {}, {}, 0, 0);
    expect(withStrata.energyPerSecond).toBeGreaterThan(base.energyPerSecond);
    expect(withStrata.energyPerSecond / base.energyPerSecond).toBeCloseTo(2, 5);
  });

  it("strataLevelsEpsBonusPercent uses max fraction tier", () => {
    const effects = [
      { type: "strata_effect_fraction" as const, fraction: 0.1 },
      { type: "strata_effect_fraction" as const, fraction: 0.5 },
    ];
    expect(strataLevelsEpsBonusPercent(effects, 10, true)).toBe(5);
  });
});
