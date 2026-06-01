import { describe, expect, it } from "vitest";

import { createDefaultClicker2State } from "./api";
import {
  FOSSIL_RECORD_SPECIALTY_ID,
  FOSSIL_SHOP_SPECIALTY_IDS,
  STRATIFIED_POND_SPECIALTY_ID,
  isFossilShopItemForSale,
} from "./fossilShop";
import { applyPondCycle } from "./pondCycle";
import { simulateGame } from "./simulation";
import { getSpecialtyDef } from "./specialties";
import { isSpecialtyShopVisible, isSpecialtyUnlocked } from "./visibility";

describe("Fossil Record", () => {
  const def = () => getSpecialtyDef(FOSSIL_RECORD_SPECIALTY_ID)!;

  it("is a fossil-shop specialty that persists across pond cycles", () => {
    expect(FOSSIL_SHOP_SPECIALTY_IDS).toContain(FOSSIL_RECORD_SPECIALTY_ID);
    expect(def()).toMatchObject({
      name: "Fossil Record",
      priceFossils: 3,
      fossilShopOnly: true,
      requiresOwnedSpecialtyId: STRATIFIED_POND_SPECIALTY_ID,
      effect: { type: "production_percent", percent: 10 },
      effectText: "Your pond is forever 10% more efficient.",
    });
  });

  it("is not sold in the energy evolution shop", () => {
    expect(
      isSpecialtyShopVisible(
        def(),
        {},
        { [STRATIFIED_POND_SPECIALTY_ID]: true },
        0,
        0,
        0,
      ),
    ).toBe(false);
  });

  it("requires stratified pond before it is for sale", () => {
    expect(isFossilShopItemForSale(def(), {})).toBe(false);
    expect(
      isFossilShopItemForSale(def(), {
        [STRATIFIED_POND_SPECIALTY_ID]: true,
      }),
    ).toBe(true);
    expect(
      isFossilShopItemForSale(def(), {
        [STRATIFIED_POND_SPECIALTY_ID]: true,
        [FOSSIL_RECORD_SPECIALTY_ID]: true,
      }),
    ).toBe(false);
  });

  it("is unlocked only when stratified pond is owned", () => {
    expect(isSpecialtyUnlocked(def(), {}, 0, 0, 0, {})).toBe(false);
    expect(
      isSpecialtyUnlocked(def(), {}, 0, 0, 0, {
        [STRATIFIED_POND_SPECIALTY_ID]: true,
      }),
    ).toBe(true);
  });

  it("grants a permanent +10% EpS multiplier", () => {
    const owned = { ripples: 1 };
    const base = simulateGame(owned, {});
    const withRecord = simulateGame(owned, {
      [FOSSIL_RECORD_SPECIALTY_ID]: true,
    });
    expect(withRecord.energyPerSecond).toBeCloseTo(
      base.energyPerSecond * 1.1,
      8,
    );
    expect(withRecord.clickValue).toBeCloseTo(base.clickValue * 1.1, 8);
  });

  it("stacks additively with stratified pond strata bonus", () => {
    const owned = { ripples: 1 };
    const base = simulateGame(owned, {}, {}, 0, 10);
    const pondAndStrata = simulateGame(
      owned,
      {
        [STRATIFIED_POND_SPECIALTY_ID]: true,
        680: true,
      },
      {},
      0,
      10,
    );
    const withRecord = simulateGame(
      owned,
      {
        [STRATIFIED_POND_SPECIALTY_ID]: true,
        680: true,
        [FOSSIL_RECORD_SPECIALTY_ID]: true,
      },
      {},
      0,
      10,
    );
    expect(withRecord.energyPerSecond).toBeGreaterThan(
      pondAndStrata.energyPerSecond,
    );
    expect(
      withRecord.energyPerSecond - pondAndStrata.energyPerSecond,
    ).toBeCloseTo(base.energyPerSecond * 0.1, 6);
  });

  it("survives pond cycle while energy evolutions reset", () => {
    const base = createDefaultClicker2State();
    const state = {
      ...base,
      owned_specialties: {
        [STRATIFIED_POND_SPECIALTY_ID]: true,
        [FOSSIL_RECORD_SPECIALTY_ID]: true,
        680: true,
      },
      specialty_acquired_at_ms: {
        [STRATIFIED_POND_SPECIALTY_ID]: 100,
        [FOSSIL_RECORD_SPECIALTY_ID]: 200,
        680: 300,
      },
    };
    const next = applyPondCycle(state, 1_000_000);
    expect(next.owned_specialties[STRATIFIED_POND_SPECIALTY_ID]).toBe(true);
    expect(next.owned_specialties[FOSSIL_RECORD_SPECIALTY_ID]).toBe(true);
    expect(next.owned_specialties[680]).toBeUndefined();
    expect(next.specialty_acquired_at_ms[FOSSIL_RECORD_SPECIALTY_ID]).toBe(
      200,
    );
  });
});
