import { describe, expect, it } from "vitest";

import { evolutionDisplayEmoji, STRATA_EVOLUTION_EMOJI } from "./clicker2OwnedEvolutions";
import { STRATIFIED_POND_SPECIALTY_ID, FOSSIL_EMOJI } from "./fossilShop";
import {
  FOSSIL_SPECIALTY_DENIZEN_ID,
  STRATA_EFFECT_SPECIALTY_IDS,
  getSpecialtyDef,
} from "./specialties";
import { isSpecialtyShopVisible, isSpecialtyUnlocked } from "./visibility";

/** Energy-shop strata tiers (Embedded Fossils → Museum). */
const STRATA_ENERGY_TIERS = [
  { id: 680, name: "Embedded Fossils", fraction: 0.1, price: 100 },
  { id: 681, name: "Paleontological Survey", fraction: 0.25, price: 10_000 },
  { id: 682, name: "Excavation Site", fraction: 0.5, price: 100_000 },
  { id: 683, name: "Research Center", fraction: 0.75, price: 1_000_000 },
  {
    id: 684,
    name: "Natural History Museum",
    fraction: 1,
    price: 1_000_000_000,
  },
] as const;

function ownedSpecialtiesThrough(tierId: number): Record<number, boolean> {
  const owned: Record<number, boolean> = {
    [STRATIFIED_POND_SPECIALTY_ID]: true,
  };
  for (const tier of STRATA_ENERGY_TIERS) {
    owned[tier.id] = true;
    if (tier.id === tierId) break;
  }
  return owned;
}

describe("strata effect chain catalog", () => {
  it("lists stratified pond plus five energy evolutions", () => {
    expect(STRATA_EFFECT_SPECIALTY_IDS).toEqual([
      STRATIFIED_POND_SPECIALTY_ID,
      ...STRATA_ENERGY_TIERS.map((t) => t.id),
    ]);
  });

  it("defines stratified pond as fossil-shop gate with zero fraction", () => {
    const pond = getSpecialtyDef(STRATIFIED_POND_SPECIALTY_ID);
    expect(pond).toMatchObject({
      name: "Stratified Pond",
      denizenId: FOSSIL_SPECIALTY_DENIZEN_ID,
      fossilShopOnly: true,
      priceFossils: 1,
      effect: { type: "strata_effect_fraction", fraction: 0 },
    });
    expect(pond?.requiresOwnedSpecialtyId).toBeUndefined();
  });

  it.each(
    STRATA_ENERGY_TIERS.map((tier, index) => ({
      tier,
      expectedRequires:
        index === 0
          ? STRATIFIED_POND_SPECIALTY_ID
          : STRATA_ENERGY_TIERS[index - 1]!.id,
    })),
  )(
    "tier $tier.name has fraction, price, and prerequisite",
    ({ tier, expectedRequires }) => {
      const def = getSpecialtyDef(tier.id);
      expect(def).toMatchObject({
        name: tier.name,
        denizenId: FOSSIL_SPECIALTY_DENIZEN_ID,
        price: tier.price,
        effect: { type: "strata_effect_fraction", fraction: tier.fraction },
        requiresOwnedSpecialtyId: expectedRequires,
      });
      expect(def?.fossilShopOnly).toBeFalsy();
      expect(evolutionDisplayEmoji(def!)).toBe(STRATA_EVOLUTION_EMOJI);
    },
  );

  it("uses bone emoji for Stratified Pond, museum emoji for energy tiers", () => {
    expect(
      evolutionDisplayEmoji(getSpecialtyDef(STRATIFIED_POND_SPECIALTY_ID)!),
    ).toBe(FOSSIL_EMOJI);
    expect(evolutionDisplayEmoji(getSpecialtyDef(680)!)).toBe(
      STRATA_EVOLUTION_EMOJI,
    );
  });
});

describe("strata effect chain unlocks", () => {
  const withPond = { [STRATIFIED_POND_SPECIALTY_ID]: true };

  it.each(
    STRATA_ENERGY_TIERS.map((tier, index) => ({ tier, index })),
  )("$tier.name requires the previous tier in the chain", ({ tier, index }) => {
    const def = getSpecialtyDef(tier.id)!;
    if (index === 0) {
      expect(isSpecialtyUnlocked(def, {}, 0, 0, 0, {})).toBe(false);
      expect(isSpecialtyUnlocked(def, {}, 0, 0, 0, withPond)).toBe(true);
      return;
    }
    const prevId = STRATA_ENERGY_TIERS[index - 1]!.id;
    expect(isSpecialtyUnlocked(def, {}, 0, 0, 0, withPond)).toBe(false);
    expect(
      isSpecialtyUnlocked(def, {}, 0, 0, 0, ownedSpecialtiesThrough(prevId)),
    ).toBe(true);
  });

  it.each(STRATA_ENERGY_TIERS.slice(1))(
    "shop shows $name only when prerequisite is owned",
    (tier) => {
      const def = getSpecialtyDef(tier.id)!;
      const prevId = def.requiresOwnedSpecialtyId!;
      expect(isSpecialtyShopVisible(def, {}, withPond, 0, 0, 0)).toBe(false);
      expect(
        isSpecialtyShopVisible(
          def,
          {},
          { ...withPond, [prevId]: true },
          0,
          0,
          0,
        ),
      ).toBe(true);
    },
  );
});
