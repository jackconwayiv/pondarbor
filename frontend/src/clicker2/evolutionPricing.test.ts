import { describe, expect, it } from "vitest";

import {
  buildReferenceStateAtUnlock,
  denizenEvolutionPrice,
  sedimentEvolutionPrice,
  SEDIMENT_TIER_3_RIPPLE_RATIO,
  generateSpecialtyPrices,
  pondProductionAnchoredPrice,
  rippleEvolutionPrice,
  RIPPLE_EARLY_PRICE_ANCHORS,
  TRANSCENDENCE_TIER_15_PRICE,
  validatePricingTable,
} from "./evolutionPricing";
import { DENIZEN_EVOLUTION_TIER_MULT } from "./evolutionTierMults";
import { getDenizenDef } from "./denizens";
import {
  POND_SPECIALTY_DENIZEN_ID,
  specialtiesForDenizen,
  specialtyTierIndex,
  SPECIALTIES,
} from "./specialties";

describe("buildReferenceStateAtUnlock", () => {
  it("owns prior tiers in the same denizen chain", () => {
    const chain = specialtiesForDenizen("sediment");
    const tier3 = chain[3]!;
    const ref = buildReferenceStateAtUnlock(tier3);
    expect(ref.ownedDenizens.sediment).toBe(tier3.unlockOwned);
    for (const s of chain) {
      if (specialtyTierIndex(s) < 3) {
        expect(ref.ownedSpecialties[s.id]).toBe(true);
      }
    }
  });

  it("populates non-ripple denizens for ripple chain pricing", () => {
    const rings = SPECIALTIES.find((s) => s.id === 4)!;
    const ref = buildReferenceStateAtUnlock(rings);
    expect(ref.ownedDenizens.ripples).toBeGreaterThan(0);
    expect(ref.ownedDenizens.sediment).toBeGreaterThan(0);
  });

  it("limits pond reference denizens by all-time unlock energy", () => {
    const pond0 = specialtiesForDenizen(POND_SPECIALTY_DENIZEN_ID)[0]!;
    const ref = buildReferenceStateAtUnlock(pond0);
    expect(ref.ownedDenizens.small_fish ?? 0).toBe(0);
    expect(ref.ownedDenizens.sediment).toBeGreaterThan(0);
    expect(ref.ownedDenizens.invertebrates ?? 0).toBe(0);
  });
});

describe("generateSpecialtyPrices", () => {
  const prices = generateSpecialtyPrices(SPECIALTIES);

  it("has a positive price for every specialty", () => {
    for (const s of SPECIALTIES) {
      expect(prices[s.id]).toBeGreaterThan(0);
    }
  });

  it("passes validation (monotone chains)", () => {
    const violations = validatePricingTable(SPECIALTIES, prices);
    expect(violations).toEqual([]);
  });

  it("keeps prices non-decreasing within each chain", () => {
    const chains = new Set(SPECIALTIES.map((s) => s.denizenId));
    for (const denizenId of chains) {
      const chain = specialtiesForDenizen(denizenId);
      let prev = 0;
      for (const s of chain) {
        const p = prices[s.id]!;
        expect(p).toBeGreaterThanOrEqual(prev);
        prev = p;
      }
    }
  });

  it("uses pond production price anchors for every tier", () => {
    const chain = specialtiesForDenizen(POND_SPECIALTY_DENIZEN_ID);
    for (let tier = 0; tier < chain.length; tier++) {
      const s = chain[tier]!;
      expect(prices[s.id]).toBe(pondProductionAnchoredPrice(tier));
    }
    expect(prices[chain[0]!.id]).toBe(1_000_000);
    expect(prices[chain[17]!.id]).toBe(500_000_000_000);
  });

  it("uses ripple early anchors for the first five tiers", () => {
    const chain = specialtiesForDenizen("ripples");
    for (let tier = 0; tier < 5; tier++) {
      const s = chain[tier]!;
      expect(prices[s.id]).toBe(rippleEvolutionPrice(tier));
      expect(prices[s.id]).toBe(RIPPLE_EARLY_PRICE_ANCHORS[tier]);
    }
    expect(RIPPLE_EARLY_PRICE_ANCHORS).toEqual([
      100, 500, 10_000, 100_000, 10_000_000,
    ]);
  });

  it("uses baseCost × tier mult for sediment except tier 3 anchor", () => {
    const def = getDenizenDef("sediment")!;
    const chain = specialtiesForDenizen("sediment");
    for (let tier = 0; tier < 5; tier++) {
      const s = chain[tier]!;
      expect(prices[s.id]).toBe(denizenEvolutionPrice("sediment", tier));
      if (tier === 3) continue;
      const expected = Math.round(def.baseCost * DENIZEN_EVOLUTION_TIER_MULT[tier]!);
      expect(prices[s.id]).toBe(expected);
    }
    expect(prices[chain[0]!.id]).toBe(1_000);
    expect(prices[chain[3]!.id]).toBe(2_500_000);
    expect(prices[chain[4]!.id]).toBe(500_000_000);
  });

  it("anchors sediment tier 3 at half the old baseCost×mult price (25× ripple tier 3)", () => {
    const def = getDenizenDef("sediment")!;
    const legacyTier3 = Math.round(def.baseCost * DENIZEN_EVOLUTION_TIER_MULT[3]!);
    expect(legacyTier3).toBe(5_000_000);
    expect(sedimentEvolutionPrice(3)).toBe(2_500_000);
    expect(sedimentEvolutionPrice(3)).toBe(legacyTier3 / 2);
    expect(sedimentEvolutionPrice(3) / rippleEvolutionPrice(3)).toBe(
      SEDIMENT_TIER_3_RIPPLE_RATIO,
    );
  });

  it("pins transcendence tier 15 at 25 unvigintillion", () => {
    const chain = specialtiesForDenizen("transcendence");
    const tier15 = chain[14]!;
    expect(tier15.id).toBe(363);
    const expected = denizenEvolutionPrice("transcendence", 14);
    expect(prices[tier15.id]).toBe(expected);
    expect(Math.abs(expected / TRANSCENDENCE_TIER_15_PRICE - 1)).toBeLessThan(
      1e-9,
    );
  });

  it("prices every denizen chain as baseCost × tier mult", () => {
    for (const def of SPECIALTIES.map((s) => s.denizenId)) {
      if (def === POND_SPECIALTY_DENIZEN_ID || def === "ripples") continue;
      const denizen = getDenizenDef(def);
      expect(denizen).toBeDefined();
      const chain = specialtiesForDenizen(def);
      for (const s of chain) {
        const tier = specialtyTierIndex(s);
        expect(prices[s.id]).toBe(denizenEvolutionPrice(def, tier));
      }
    }
  });
});

describe("specialty catalog wiring", () => {
  it("uses generated prices on denizen defs", () => {
    const def = getDenizenDef("fungi");
    expect(def).toBeDefined();
    const tier0 = specialtiesForDenizen("fungi")[0]!;
    expect(tier0.price).toBe(generateSpecialtyPrices(SPECIALTIES)[tier0.id]);
    expect(tier0.price).toBe(Math.round(def!.baseCost * DENIZEN_EVOLUTION_TIER_MULT[0]!));
  });
});
