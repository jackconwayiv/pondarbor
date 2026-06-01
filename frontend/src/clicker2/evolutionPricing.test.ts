import { describe, expect, it } from "vitest";

import {
  buildReferenceStateAtUnlock,
  denizenEvolutionPrice,
  denizenTier45Price,
  denizenTier4CatalogPrice,
  sedimentEvolutionPrice,
  SEDIMENT_TIER_3_RIPPLE_RATIO,
  generateSpecialtyPrices,
  pondProductionAnchoredPrice,
  rippleEvolutionPrice,
  RIPPLE_EARLY_PRICE_ANCHORS,
  TRANSCENDENCE_TIER_15_PRICE,
  validatePricingTable,
} from "./evolutionPricing";
import {
  DENIZEN_TIER45_SPECIALTY_IDS,
  DENIZEN_TIER45_UNLOCK_OWNED,
} from "./tier45Evolutions";
import { DENIZEN_EVOLUTION_TIER_MULT } from "./evolutionTierMults";
import { getDenizenDef } from "./denizens";
import { evolutionChainDenizenIds } from "./milestones";
import { PAIRING_SPECIALTY_DENIZEN_ID } from "./pairingEvolutions";
import {
  CLOUD_SPECIALTY_DENIZEN_ID,
  TREE_SPECIALTY_DENIZEN_ID,
} from "./treeCloudEvolutions";
import {
  POND_SPECIALTY_DENIZEN_ID,
  SEDIMENT_CRACIAL_GLAPE_SPECIALTY_ID,
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
      if (denizenId === PAIRING_SPECIALTY_DENIZEN_ID) continue;
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

  it("uses ripple early anchors for tiers 0–3 and geometric-mean tier 4.5", () => {
    const chain = specialtiesForDenizen("ripples");
    for (let tier = 0; tier < 4; tier++) {
      const s = chain[tier]!;
      expect(prices[s.id]).toBe(rippleEvolutionPrice(tier));
      expect(prices[s.id]).toBe(RIPPLE_EARLY_PRICE_ANCHORS[tier]);
    }
    const tier45 = chain[4]!;
    expect(tier45.id).toBe(DENIZEN_TIER45_SPECIALTY_IDS.ripples);
    expect(prices[tier45.id]).toBe(rippleEvolutionPrice(4));
    expect(prices[tier45.id]).toBe(denizenTier45Price("ripples"));
    expect(prices[tier45.id]).toBe(
      Math.round(
        Math.sqrt(
          RIPPLE_EARLY_PRICE_ANCHORS[3]! * RIPPLE_EARLY_PRICE_ANCHORS[4]!,
        ),
      ),
    );
    expect(RIPPLE_EARLY_PRICE_ANCHORS).toEqual([
      100, 500, 10_000, 100_000, 10_000_000,
    ]);
  });

  it("uses baseCost × tier mult for sediment except tier 3 anchor and tier 4.5", () => {
    const def = getDenizenDef("sediment")!;
    const chain = specialtiesForDenizen("sediment");
    for (let tier = 0; tier < 7; tier++) {
      const s = chain[tier]!;
      expect(prices[s.id]).toBe(denizenEvolutionPrice("sediment", tier));
      if (tier === 3 || tier === 4) continue;
      const multIndex = tier >= 5 ? tier - 1 : tier;
      const expected = Math.round(
        def.baseCost * DENIZEN_EVOLUTION_TIER_MULT[multIndex]!,
      );
      expect(prices[s.id]).toBe(expected);
    }
    expect(prices[chain[0]!.id]).toBe(1_000);
    expect(prices[chain[3]!.id]).toBe(2_500_000);
    expect(prices[chain[4]!.id]).toBe(sedimentEvolutionPrice(4));
    expect(prices[chain[5]!.id]).toBe(500_000_000);
    expect(chain[4]!.id).toBe(SEDIMENT_CRACIAL_GLAPE_SPECIALTY_ID);
    expect(chain[4]!.unlockOwned).toBe(75);
  });

  it("prices sediment tier 4.5 between tier 3 and tier 4 catalog prices", () => {
    expect(sedimentEvolutionPrice(4)).toBe(
      Math.round(Math.sqrt(2_500_000 * 500_000_000)),
    );
    expect(sedimentEvolutionPrice(4)).toBeGreaterThan(2_500_000);
    expect(sedimentEvolutionPrice(4)).toBeLessThan(500_000_000);
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
    expect(chain).toHaveLength(16);
    const tier15 = chain[15]!;
    expect(tier15.id).toBe(363);
    const expected = denizenEvolutionPrice("transcendence", 15);
    expect(prices[tier15.id]).toBe(expected);
    expect(Math.abs(expected / TRANSCENDENCE_TIER_15_PRICE - 1)).toBeLessThan(
      1e-9,
    );
  });

  it("prices every denizen chain as baseCost × tier mult", () => {
    for (const denizenId of evolutionChainDenizenIds()) {
      if (
        denizenId === POND_SPECIALTY_DENIZEN_ID ||
        denizenId === "ripples" ||
        denizenId === TREE_SPECIALTY_DENIZEN_ID ||
        denizenId === CLOUD_SPECIALTY_DENIZEN_ID
      ) {
        continue;
      }
      const chain = specialtiesForDenizen(denizenId);
      for (const s of chain) {
        const tier = specialtyTierIndex(s);
        expect(prices[s.id]).toBe(denizenEvolutionPrice(denizenId, tier));
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

describe("tier-4.5 denizen evolutions", () => {
  const prices = generateSpecialtyPrices(SPECIALTIES);

  const tier45DenizenIds = [
    "sediment",
    "ripples",
    "fungi",
    "microbes",
    "transcendence",
  ] as const;

  it.each(tier45DenizenIds)(
    "%s chain has 16 specialties with tier-4.5 at index 4",
    (denizenId) => {
      const chain = specialtiesForDenizen(denizenId);
      expect(chain).toHaveLength(16);
      const tier45 = chain[4]!;
      expect(specialtyTierIndex(tier45)).toBe(4);
      expect(tier45.unlockOwned).toBe(DENIZEN_TIER45_UNLOCK_OWNED);
      expect(prices[tier45.id]).toBe(denizenTier45Price(denizenId));
      expect(prices[tier45.id]).toBeGreaterThan(
        denizenTier3PriceForTest(denizenId),
      );
      expect(prices[tier45.id]).toBeLessThan(denizenTier4CatalogPrice(denizenId));
    },
  );

  it("fungi tier-4.5 doubles fungi EpS", () => {
    const tier45 = specialtiesForDenizen("fungi")[4]!;
    expect(tier45.id).toBe(DENIZEN_TIER45_SPECIALTY_IDS.fungi);
    expect(tier45.effect).toEqual({
      type: "double_denizen",
      denizenId: "fungi",
    });
  });

  it("ripples tier-4.5 doubles click and ripples", () => {
    const tier45 = specialtiesForDenizen("ripples")[4]!;
    expect(tier45.id).toBe(DENIZEN_TIER45_SPECIALTY_IDS.ripples);
    expect(tier45.effect).toEqual({
      type: "double_click_and_denizen",
      denizenId: "ripples",
    });
  });

  it("prices fungi tier-4.5 as geometric mean of tier 3 and tier 4 catalog", () => {
    const def = getDenizenDef("fungi")!;
    const tier3 = Math.round(def.baseCost * DENIZEN_EVOLUTION_TIER_MULT[3]!);
    const tier4 = Math.round(def.baseCost * DENIZEN_EVOLUTION_TIER_MULT[4]!);
    expect(denizenTier45Price("fungi")).toBe(Math.round(Math.sqrt(tier3 * tier4)));
  });
});

function denizenTier3PriceForTest(denizenId: string): number {
  if (denizenId === "sediment") return sedimentEvolutionPrice(3);
  if (denizenId === "ripples") return RIPPLE_EARLY_PRICE_ANCHORS[3]!;
  const def = getDenizenDef(denizenId);
  return Math.round(def!.baseCost * DENIZEN_EVOLUTION_TIER_MULT[3]!);
}
