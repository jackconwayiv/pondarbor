/**
 * Invariants for owned evolution → EpS / click wiring.
 * See EVOLUTION_SIMULATION_AUDIT.md for the effect map.
 */
import { describe, expect, it } from "vitest";

import { getOwnedDenizenCount } from "./denizens";
import { POLLINATOR_SPECIALTY_ID_START } from "./pollinatorEvolutions";
import {
  isRetiredWindSpecialtyId,
  RETIRED_WIND_SPECIALTY_IDS,
} from "./retiredWindEvolutions";
import { PAIRING_SPECIALTY_ID_START } from "./pairingEvolutions";
import { getSpecialtyDef, SPECIALTIES, CLICK_SPECIALTY_ID_START, specialtiesForDenizen } from "./specialties";
import {
  marginalEpsIfBuySpecialty,
  simulateGame,
} from "./simulation";

/** Minimal pond for isolated evolution tests. */
const BASE_OWNED = { ripples: 1, sediment: 10, fungi: 8 } as const;

function otherDenizenEpsUnchanged(
  before: Record<string, number>,
  after: Record<string, number>,
  changedId: string,
): void {
  for (const id of Object.keys(before)) {
    if (id === changedId) continue;
    expect(after[id]).toBeCloseTo(before[id]!, 8);
  }
}

describe("simulation evolution effect wiring", () => {
  describe("denizen double_denizen cards", () => {
    const fungiTier0Id = 31;

    it("one fungi evolution doubles only fungi EpS and total EpS by fungi share", () => {
      const owned = { ...BASE_OWNED };
      const before = simulateGame(owned, {});
      const after = simulateGame(owned, { [fungiTier0Id]: true });

      expect(after.denizenEps.fungi).toBeCloseTo(before.denizenEps.fungi! * 2, 8);
      expect(after.energyPerSecond).toBeCloseTo(
        before.energyPerSecond + before.denizenEps.fungi!,
        8,
      );
      otherDenizenEpsUnchanged(before.denizenEps, after.denizenEps, "fungi");
    });

    it("two fungi evolution cards stack ×4 on fungi EpS", () => {
      const owned = { ...BASE_OWNED };
      const one = simulateGame(owned, { [fungiTier0Id]: true });
      const two = simulateGame(owned, {
        [fungiTier0Id]: true,
        [fungiTier0Id + 1]: true,
      });
      expect(two.denizenEps.fungi).toBeCloseTo(one.denizenEps.fungi! * 2, 8);
    });
  });

  describe("ripple double_click_and_denizen", () => {
    const surfaceTensionId = 1;

    it("doubles ripple EpS and click baseline multiplier", () => {
      const owned = { ripples: 5, sediment: 3 };
      const before = simulateGame(owned, {});
      const after = simulateGame(owned, { [surfaceTensionId]: true });

      expect(after.denizenEps.ripples).toBeCloseTo(
        before.denizenEps.ripples! * 2,
        8,
      );
      expect(after.clickValue).toBeCloseTo(before.clickValue * 2, 8);
    });
  });

  describe("pond production_percent", () => {
    const pondTier0Id = 166;
    const treeTier0Id = 690;
    const cloudTier0Id = 705;

    it("scales all denizen EpS and click baseline by +1%", () => {
      const owned = { ...BASE_OWNED };
      const before = simulateGame(owned, {});
      const after = simulateGame(owned, { [pondTier0Id]: true });
      const mult = 1.01;

      expect(after.energyPerSecond).toBeCloseTo(
        before.energyPerSecond * mult,
        8,
      );
      for (const id of ["ripples", "sediment", "fungi"] as const) {
        expect(after.denizenEps[id]).toBeCloseTo(before.denizenEps[id]! * mult, 8);
      }

      expect(after.clickValue).toBeCloseTo(before.clickValue * mult, 8);
    });

    it("tree and cloud tiers stack pond-wide production_percent", () => {
      const owned = { ...BASE_OWNED };
      const before = simulateGame(owned, {});
      const afterTree = simulateGame(owned, { [treeTier0Id]: true });
      const afterCloud = simulateGame(owned, { [cloudTier0Id]: true });

      expect(afterTree.energyPerSecond).toBeCloseTo(
        before.energyPerSecond * 1.01,
        8,
      );
      expect(afterCloud.energyPerSecond).toBeCloseTo(
        before.energyPerSecond * 1.01,
        8,
      );
    });
  });

  describe("click_eps_percent (click reflection)", () => {
    const clickTier0Id = 617;

    it("does not change EpS; adds click from current EpS × percent", () => {
      const owned = { ...BASE_OWNED };
      const before = simulateGame(owned, {});
      const after = simulateGame(owned, { [clickTier0Id]: true });

      expect(after.energyPerSecond).toBeCloseTo(before.energyPerSecond, 8);
      expect(after.clickValue - before.clickValue).toBeCloseTo(
        before.energyPerSecond / 100,
        8,
      );
      expect(
        after.clickBreakdown.clickBaseline +
          after.clickBreakdown.clickFromEpSPercent,
      ).toBeCloseTo(after.clickValue, 8);
    });
  });

  describe("clickBreakdown aggregation (reflections)", () => {
    it("clickFromEpSPercent can exceed ripples passive", () => {
      const owned = { ripples: 50, sediment: 200, fungi: 3_500 };
      const ownedSpec: Record<number, boolean> = { 1: true, 2: true, 3: true };
      for (let i = 0; i < 15; i++) {
        ownedSpec[CLICK_SPECIALTY_ID_START + i] = true;
      }
      const sim = simulateGame(owned, ownedSpec);
      const { clickBreakdown } = sim;

      expect(
        clickBreakdown.clickBaseline + clickBreakdown.clickFromEpSPercent,
      ).toBeCloseTo(sim.clickValue, 6);
      expect(clickBreakdown.clickEpsPercentTotal).toBe(15);
      expect(clickBreakdown.rippleEfficiencyMultiplier).toBe(8);
      const rippleEps = sim.denizenEps.ripples ?? 0;
      expect(sim.clickValue).toBeGreaterThan(rippleEps * 4);
      expect(clickBreakdown.clickFromEpSPercent).toBeGreaterThan(rippleEps);
    });
  });

  describe("retired wind evolutions", () => {
    it("ignores owned ids 675–678 for effects", () => {
      const owned = { ripples: 10 };
      const withoutWind = simulateGame(owned, { 1: true });
      const withRetiredWind = simulateGame(owned, {
        1: true,
        ...Object.fromEntries(RETIRED_WIND_SPECIALTY_IDS.map((id) => [id, true])),
      });
      expect(withRetiredWind).toEqual(withoutWind);
      for (const id of RETIRED_WIND_SPECIALTY_IDS) {
        expect(isRetiredWindSpecialtyId(id)).toBe(true);
      }
    });
  });

  describe("eps_percent_per_blossom (pollinator)", () => {
    const pollinatorTier0Id = POLLINATOR_SPECIALTY_ID_START;
    const blossoms = 100;

    it("scales EpS and click baseline by +0.01% per blossom per owned card", () => {
      const owned = { ...BASE_OWNED };
      const before = simulateGame(owned, {}, {}, blossoms);
      const after = simulateGame(owned, { [pollinatorTier0Id]: true }, {}, blossoms);
      const mult = 1 + (0.01 * blossoms) / 100;

      expect(after.energyPerSecond).toBeCloseTo(
        before.energyPerSecond * mult,
        8,
      );
      expect(after.clickValue).toBeCloseTo(before.clickValue * mult, 5);
    });
  });

  describe("pairing denizen_eps_percent_per_denizen", () => {
    it("matches floor(source/step) formula on Nutrient Floor (sediment×fungi)", () => {
      const nutrientFloor = SPECIALTIES.find((s) => s.name === "Nutrient Floor")!;

      const ownedDenizens = { ripples: 1, sediment: 22, fungi: 15 };
      const before = simulateGame(ownedDenizens, {});
      const after = simulateGame(ownedDenizens, {
        [nutrientFloor.id]: true,
      });

      expect(after.denizenEps.sediment).toBeCloseTo(
        before.denizenEps.sediment! * 2,
        8,
      );
      const steps = Math.floor(
        getOwnedDenizenCount(ownedDenizens, "sediment") / 11,
      );
      expect(after.denizenEps.fungi).toBeCloseTo(
        before.denizenEps.fungi! * (1 + steps / 100),
        8,
      );
    });
  });

  describe("concentric_rings", () => {
    const ringsId = 4;

    it("adds ripple EpS and click baseline from non-ripple denizen count", () => {
      const owned = { ripples: 2, sediment: 10, fungi: 5 };
      const before = simulateGame(owned, {});
      const after = simulateGame(owned, { [ringsId]: true });
      const nonRipple = 10 + 5;

      expect(after.denizenEps.ripples).toBeGreaterThan(
        before.denizenEps.ripples!,
      );
      expect(after.clickValue).toBeGreaterThan(before.clickValue);
      const rippleGain = after.denizenEps.ripples! - before.denizenEps.ripples!;
      expect(rippleGain).toBeCloseTo(0.1 * nonRipple * 2, 8);
    });
  });

  describe("ownedSpecialtyEffects coverage", () => {
    it("applies all effects from pairing cards with effects[]", () => {
      const pairing = getSpecialtyDef(PAIRING_SPECIALTY_ID_START)!;
      expect(pairing.effects?.length).toBe(2);
      expect(pairing.effect.type).toBe("double_denizen");
    });

    it("ripple shop chain uses double_click_and_denizen on early tiers", () => {
      const rippleChain = specialtiesForDenizen("ripples").slice(0, 3);
      for (const def of rippleChain) {
        expect(def.effect).toEqual({
          type: "double_click_and_denizen",
          denizenId: "ripples",
        });
      }
    });

    it("denizen chains use double_denizen only", () => {
      const fungiChain = specialtiesForDenizen("fungi").slice(0, 3);
      for (const def of fungiChain) {
        expect(def.effect).toEqual({
          type: "double_denizen",
          denizenId: "fungi",
        });
      }
    });

    it("tier-4.5 doubles apply via double_denizen and double_click_and_denizen", () => {
      const fungiTier45 = specialtiesForDenizen("fungi")[4]!;
      const rippleTier45 = specialtiesForDenizen("ripples")[4]!;
      expect(fungiTier45.unlockOwned).toBe(75);
      expect(rippleTier45.unlockOwned).toBe(75);
      expect(fungiTier45.effect.type).toBe("double_denizen");
      expect(rippleTier45.effect.type).toBe("double_click_and_denizen");

      const owned = { ripples: 5, fungi: 10, sediment: 1 };
      const before = simulateGame(owned, {});
      const after = simulateGame(owned, {
        [fungiTier45.id]: true,
        [rippleTier45.id]: true,
      });
      expect(after.denizenEps.fungi).toBeCloseTo((before.denizenEps.fungi ?? 0) * 2, 8);
      expect(after.denizenEps.ripples).toBeCloseTo(
        (before.denizenEps.ripples ?? 0) * 2,
        8,
      );
      expect(after.clickValue).toBeCloseTo(before.clickValue * 2, 8);
    });
  });

  describe("marginal helpers use simulateGame", () => {
    it("marginal EpS from specialty matches direct simulateGame delta", () => {
      const owned = { ...BASE_OWNED };
      const ownedSpec: Record<number, boolean> = {};
      const id = 31;
      const marginal = marginalEpsIfBuySpecialty(id, owned, ownedSpec);
      const direct =
        simulateGame(owned, { [id]: true }).energyPerSecond -
        simulateGame(owned, ownedSpec).energyPerSecond;
      expect(marginal).toBeCloseTo(direct, 8);
    });
  });
});
