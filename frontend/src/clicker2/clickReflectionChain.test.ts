import { describe, expect, it } from "vitest";

import { simulateGame } from "./simulation";
import {
  CLICK_CHAIN_PRICE,
  CLICK_SPECIALTY_DENIZEN_ID,
  CLICK_SPECIALTY_ID_START,
  CLICK_UNLOCK_ENERGY,
  clickChainPrice,
  clickChainUnlockEnergy,
  specialtiesForDenizen,
  specialtyTierIndex,
} from "./specialties";
import { isSpecialtyUnlocked, isSpecialtyShopVisible } from "./visibility";

describe("click reflection evolution chain", () => {
  const chain = specialtiesForDenizen(CLICK_SPECIALTY_DENIZEN_ID);

  it("defines 15 tiers with ids 617–631", () => {
    expect(chain).toHaveLength(15);
    expect(chain[0]!.id).toBe(CLICK_SPECIALTY_ID_START);
    expect(chain[14]!.id).toBe(CLICK_SPECIALTY_ID_START + 14);
    for (const def of chain) {
      expect(def.effect).toEqual({ type: "click_eps_percent", percent: 1 });
      expect(def.unlockClickEnergy).toBe(
        clickChainUnlockEnergy(specialtyTierIndex(def)),
      );
    }
  });

  it("unlock and price follow ×100 extrapolation at tiers 0, 3, and 14", () => {
    expect(CLICK_UNLOCK_ENERGY[0]).toBe(1_000);
    expect(CLICK_UNLOCK_ENERGY[3]).toBe(1_000_000_000);
    expect(CLICK_UNLOCK_ENERGY[14]).toBe(1_000 * 100 ** 14);

    expect(CLICK_CHAIN_PRICE[0]).toBe(50_000);
    expect(CLICK_CHAIN_PRICE[3]).toBe(50_000_000_000);
    expect(clickChainPrice(14)).toBe(50_000 * 100 ** 14);
  });

  it("unlocks from energy_from_clicking, not denizen owned", () => {
    const tier0 = chain[0]!;
    expect(
      isSpecialtyUnlocked(tier0, { ripples: 1 }, 0, 999),
    ).toBe(false);
    expect(
      isSpecialtyUnlocked(tier0, { ripples: 0 }, 0, 1_000),
    ).toBe(true);
    expect(
      isSpecialtyUnlocked(tier0, { ripples: 99 }, 1e30, 0),
    ).toBe(false);
  });

  it("shop visibility does not require prior tier owned", () => {
    const tier2 = chain[2]!;
    expect(
      isSpecialtyShopVisible(
        tier2,
        { ripples: 1 },
        {},
        0,
        tier2.unlockClickEnergy!,
      ),
    ).toBe(true);
    expect(
      isSpecialtyShopVisible(
        tier2,
        { ripples: 1 },
        {},
        0,
        tier2.unlockClickEnergy! - 1,
      ),
    ).toBe(false);
    expect(
      isSpecialtyShopVisible(
        tier2,
        { ripples: 1 },
        { [tier2.id]: true },
        0,
        tier2.unlockClickEnergy!,
      ),
    ).toBe(false);
  });

  it("adds EpS-linked click bonus from owned tiers", () => {
    const ownedDenizens = { ripples: 1, sediment: 10 };
    const base = simulateGame(ownedDenizens, {});
    const withFivePercent = simulateGame(ownedDenizens, {
      [chain[0]!.id]: true,
      [chain[1]!.id]: true,
      [chain[2]!.id]: true,
      [chain[3]!.id]: true,
      [chain[4]!.id]: true,
    });
    const epsBonus =
      (base.energyPerSecond * 5) / 100;
    expect(withFivePercent.clickValue - base.clickValue).toBeCloseTo(
      epsBonus,
      5,
    );
  });
});
